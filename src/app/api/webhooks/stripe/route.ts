import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripeWebhookSecret } from "@/lib/env";
import { getStripe } from "@/lib/stripe/client";
import { sendPushToClientStaff } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/server";
import { logClientActivity } from "@/server/activity";
import { markInvoicePaidFromStripe } from "@/server/invoices/mark-paid";
import { revalidateInvoices } from "@/server/invoices/revalidate";

/**
 * Webhook da Stripe.
 *
 * Unica rota do projeto que le o corpo cru: a assinatura e calculada sobre os
 * bytes exatos, entao passar por `request.json()` invalidaria a verificacao.
 *
 * O middleware ja ignora `api/`, entao nada intercepta esta rota — a
 * autenticacao e a propria assinatura, do mesmo jeito que o cron se autentica
 * pelo Bearer. Sem segredo configurado, recusa tudo (falha fechado).
 *
 * Cadastre UM endpoint so no painel, com eventos de contas conectadas
 * ligados. Dois endpoints separados geram dois segredos diferentes e este
 * codigo so conhece um.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = stripeWebhookSecret();
  const stripe = getStripe();

  if (!secret || !stripe) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Assinatura ausente" }, { status: 400 });
  }

  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
  } catch {
    // Nao vaza o motivo: quem nao tem o segredo nao precisa saber o porque.
    return NextResponse.json({ error: "Assinatura invalida" }, { status: 400 });
  }

  const admin = createAdminClient();
  // Em evento de conta conectada a Stripe preenche `account`; em evento da
  // propria plataforma vem indefinido.
  const accountId = event.account ?? null;

  // Reserva o evento. A PK e o proprio id (evt_...), entao a segunda entrega
  // da mesma coisa bate na unique e para aqui.
  const { error: claimError } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type, account_id: accountId });

  if (claimError) {
    if (claimError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  try {
    await handleEvent(event, accountId, admin);
  } catch (error) {
    // Solta a reserva antes de devolver erro. Sem isso, o retry da Stripe
    // bateria na unique e seria engolido como duplicata — e o evento se
    // perderia para sempre.
    await admin.from("stripe_events").delete().eq("id", event.id);
    const message = error instanceof Error ? error.message : "Falha ao processar o evento";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  await admin
    .from("stripe_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", event.id);

  return NextResponse.json({ received: true });
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function handleEvent(event: Stripe.Event, accountId: string | null, admin: AdminClient) {
  switch (event.type) {
    case "account.updated":
      await syncAccount(event.data.object as Stripe.Account, admin);
      return;

    case "checkout.session.completed":
      await onSessionCompleted(event.data.object as Stripe.Checkout.Session, accountId, admin);
      return;

    // Boleto ou Pix compensado: e aqui que a cobranca vira paga de verdade.
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoice = await findInvoiceForSession(session, accountId, admin);
      if (!invoice) return;

      await markInvoicePaidFromStripe(admin, invoice, {
        paymentIntentId: paymentIntentIdOf(session),
        amountPaidCents: session.amount_total ?? null,
        applicationFeeCents: invoice.application_fee_cents,
      });
      return;
    }

    // Boleto vencido sem pagamento, Pix expirado.
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoice = await findInvoiceForSession(session, accountId, admin);
      if (!invoice) return;

      await setPaymentStatus(invoice.id, invoice.client_id, "failed", admin);
      await sendPushToClientStaff(invoice.client_id, {
        title: "Pagamento nao concluido",
        body: `"${invoice.title}" nao foi paga.`,
        url: "/professional/payments",
        tag: `invoice-failed-${invoice.id}`,
      }).catch(() => {});
      return;
    }

    // Sessao caducou antes de qualquer pagamento: limpa para o proximo toque
    // do cliente gerar uma nova em vez de reabrir uma morta.
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoice = await findInvoiceForSession(session, accountId, admin);
      if (!invoice || invoice.status === "paid") return;

      const { error } = await admin
        .from("invoices")
        .update({
          stripe_checkout_session_id: null,
          stripe_hosted_url: null,
          stripe_hosted_url_expires_at: null,
          stripe_payment_status: null,
        })
        .eq("id", invoice.id);

      if (error) throw new Error(error.message);
      revalidateInvoices(invoice.client_id);
      return;
    }

    // Cartao recusado. A cobranca continua em aberto e o cliente pode tentar
    // de novo — nao e caso de avisar a equipe.
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const invoiceId = intent.metadata?.invoice_id;
      if (!invoiceId) return;

      const { data: invoice } = await admin
        .from("invoices")
        .select("id, client_id, status, stripe_account_id")
        .eq("id", invoiceId)
        .maybeSingle();

      if (!invoice || invoice.status === "paid") return;
      if (accountId && invoice.stripe_account_id !== accountId) return;

      await setPaymentStatus(invoice.id, invoice.client_id, "failed", admin);
      return;
    }

    // Estorno: a cobranca volta a ficar em aberto. Deixar como paga corromperia
    // todo numero de receita que le esta tabela.
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      // A metadata do Charge nem sempre e herdada do PaymentIntent, entao o
      // caminho confiavel e o intent que ja guardamos na cobranca.
      const intentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : (charge.payment_intent?.id ?? null);

      const query = admin.from("invoices").select("id, client_id, title, stripe_account_id");
      const { data: invoice } = intentId
        ? await query.eq("stripe_payment_intent_id", intentId).maybeSingle()
        : charge.metadata?.invoice_id
          ? await query.eq("id", charge.metadata.invoice_id).maybeSingle()
          : { data: null };

      if (!invoice) return;
      if (accountId && invoice.stripe_account_id !== accountId) return;

      const { error } = await admin
        .from("invoices")
        .update({
          status: "open",
          paid_at: null,
          paid_by: null,
          amount_paid_cents: null,
          stripe_payment_status: "refunded",
        })
        .eq("id", invoice.id);

      if (error) throw new Error(error.message);

      await logClientActivity(
        admin,
        invoice.client_id,
        "Stripe",
        `Pagamento estornado: "${invoice.title}"`,
      );
      await sendPushToClientStaff(invoice.client_id, {
        title: "Pagamento estornado",
        body: `"${invoice.title}" foi estornada e voltou para em aberto.`,
        url: "/professional/payments",
        tag: `invoice-refund-${invoice.id}`,
      }).catch(() => {});

      revalidateInvoices(invoice.client_id);
      return;
    }

    default:
      // Evento que nao tratamos ainda. Responder 200 e proposital: devolver
      // erro faria a Stripe reenviar para sempre.
      return;
  }
}

/** Localiza a cobranca do evento e confere que ela pertence mesmo a conta que
 * disparou — id de sessao de outra plataforma nao pode mexer aqui. */
async function findInvoiceForSession(
  session: Stripe.Checkout.Session,
  accountId: string | null,
  admin: AdminClient,
) {
  const invoiceId = session.metadata?.invoice_id ?? session.client_reference_id;
  if (!invoiceId) return null;

  const { data: invoice } = await admin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) return null;
  if (accountId && invoice.stripe_account_id !== accountId) return null;

  return invoice;
}

async function setPaymentStatus(
  invoiceId: string,
  clientId: string,
  status: string,
  admin: AdminClient,
) {
  const { error } = await admin
    .from("invoices")
    .update({ stripe_payment_status: status })
    .eq("id", invoiceId);

  if (error) throw new Error(error.message);
  revalidateInvoices(clientId);
}

function paymentIntentIdOf(session: Stripe.Checkout.Session): string | null {
  const intent = session.payment_intent;
  if (!intent) return null;
  return typeof intent === "string" ? intent : intent.id;
}

/**
 * Checkout concluido — que NAO quer dizer pago.
 *
 * No cartao o dinheiro ja foi (`payment_status: "paid"`). Em boleto e Pix o
 * cliente apenas gerou o documento: a sessao chega com `unpaid` e a confirmacao
 * so vem depois, em `checkout.session.async_payment_succeeded`. Marcar pago
 * aqui sem checar seria dar por quitada uma cobranca que ninguem pagou.
 */
async function onSessionCompleted(
  session: Stripe.Checkout.Session,
  accountId: string | null,
  admin: AdminClient,
) {
  const invoice = await findInvoiceForSession(session, accountId, admin);
  if (!invoice) return;

  if (session.payment_status === "paid") {
    await markInvoicePaidFromStripe(admin, invoice, {
      paymentIntentId: paymentIntentIdOf(session),
      amountPaidCents: session.amount_total ?? null,
      applicationFeeCents: invoice.application_fee_cents,
    });
    return;
  }

  const { error } = await admin
    .from("invoices")
    .update({
      stripe_payment_status: "processing",
      stripe_payment_intent_id: paymentIntentIdOf(session),
    })
    .eq("id", invoice.id);

  if (error) throw new Error(error.message);

  revalidateInvoices(invoice.client_id);
}

/** Espelha o estado da conta conectada. E assim que a liberacao de uma
 * capacidade (o Pix, tipicamente) chega sem ninguem abrir a tela. */
async function syncAccount(account: Stripe.Account, admin: AdminClient) {
  const capabilities = Object.fromEntries(
    Object.entries(account.capabilities ?? {}).filter(([, value]) => typeof value === "string"),
  ) as Record<string, string>;

  const { error } = await admin
    .from("professional_payment_accounts")
    .update({
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      details_submitted: account.details_submitted ?? false,
      requirements_disabled_reason: account.requirements?.disabled_reason ?? null,
      capabilities,
      account_synced_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", account.id);

  // Conta que nao conhecemos (criada fora do app) simplesmente nao casa
  // nenhuma linha — nao e erro.
  if (error) throw new Error(error.message);
}
