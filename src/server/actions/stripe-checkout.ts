"use server";

import { requireClientActor } from "@/lib/auth";
import { daysUntil } from "@/lib/domain";
import { appBaseUrl } from "@/lib/env";
import { pickLocale } from "@/lib/i18n/locale";
import { getLocale } from "@/lib/i18n/server";
import { applicationFeeCents, toCents } from "@/lib/money";
import { rateLimit } from "@/lib/rate-limit";
import { paymentMethodTypesFor, type StripeMethod } from "@/lib/stripe/capabilities";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { markInvoicePaidFromStripe } from "@/server/invoices/mark-paid";
import { describeError, fail, ok, type ActionResult } from "@/server/result";

/** Boleto vence junto da cobranca, com um dia de folga. */
function boletoExpiryDays(dueDate: string): number {
  return Math.min(60, Math.max(1, daysUntil(dueDate) + 1));
}

/**
 * Abre (ou reabre) a pagina de pagamento de uma cobranca.
 *
 * Direct charge: a sessao e criada NA conta conectada do profissional, entao e
 * ele o merchant of record e o dinheiro cai na conta dele. A plataforma retem
 * `application_fee_amount`.
 */
export async function startInvoiceCheckoutAction(
  invoiceId: string,
): Promise<ActionResult<{ url: string }>> {
  const actor = await requireClientActor();
  const locale = await getLocale();

  // Cria objeto remoto a cada clique: merece o mesmo freio das rotas de login.
  const limit = rateLimit(`checkout:${actor.client.id}`, 10, 60_000);
  if (!limit.allowed) {
    return fail(
      pickLocale(
        locale,
        `Muitas tentativas. Tente novamente em ${limit.retryAfterSeconds}s.`,
        `Too many attempts. Try again in ${limit.retryAfterSeconds}s.`,
      ),
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return fail(pickLocale(locale, "Pagamento online indisponivel no momento.", "Online payment is unavailable right now."));
  }

  // Leitura pela RLS de proposito: `invoices_select_scoped` E a autorizacao.
  // Id de cobranca de outro cliente simplesmente nao volta nenhuma linha.
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) return fail(pickLocale(locale, "Cobranca nao encontrada.", "Invoice not found."));
  if (invoice.status === "paid") {
    return fail(pickLocale(locale, "Esta cobranca ja foi paga.", "This invoice has already been paid."));
  }
  if (invoice.method !== "stripe" || !invoice.stripe_account_id) {
    return fail(
      pickLocale(locale, "Esta cobranca nao aceita pagamento online.", "This invoice does not accept online payment."),
    );
  }

  const stripeAccount = invoice.stripe_account_id;
  // A leitura de professional_payment_accounts que vem a seguir precisa da
  // serviceRole: a policy de SELECT dessa tabela so libera o profissional
  // dono ou admin, nunca o cliente que esta pagando -- pela RLS normal essa
  // consulta sempre voltaria vazia aqui, derrubando o checkout com
  // "indisponivel" mesmo com a conta 100% ativa.
  const admin = createAdminClient();

  // Reabre a MESMA sessao enquanto ela vale. Importa muito em boleto e Pix: o
  // cliente precisa voltar ao mesmo documento, nao gerar um novo a cada toque.
  if (invoice.stripe_checkout_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        invoice.stripe_checkout_session_id,
        {},
        { stripeAccount },
      );

      // Rede de seguranca contra o webhook atrasar ou falhar: se a Stripe ja
      // diz que esta sessao foi paga e o nosso banco ainda nao sabe, reconcilia
      // AGORA em vez de deixar cair no fluxo abaixo e abrir uma segunda sessao
      // -- que criaria uma cobranca real duplicada, sem nenhum aviso ao cliente.
      if (existing.payment_status === "paid") {
        const intent = existing.payment_intent;
        await markInvoicePaidFromStripe(admin, invoice, {
          paymentIntentId: typeof intent === "string" ? intent : (intent?.id ?? null),
          amountPaidCents: existing.amount_total ?? null,
          applicationFeeCents: invoice.application_fee_cents,
        });
        return fail(pickLocale(locale, "Esta cobranca ja foi paga.", "This invoice has already been paid."));
      }

      const stillValid =
        invoice.stripe_hosted_url_expires_at &&
        new Date(invoice.stripe_hosted_url_expires_at).getTime() > Date.now() + 5 * 60_000;

      if (stillValid && existing.status === "open" && existing.url) {
        return ok({ url: existing.url });
      }
    } catch {
      // Sessao sumiu ou nao pode ser lida: segue e cria outra.
    }
  }

  const { data: account } = await admin
    .from("professional_payment_accounts")
    .select("*")
    .eq("stripe_account_id", stripeAccount)
    .maybeSingle();

  const methods: StripeMethod[] = paymentMethodTypesFor(account);
  if (methods.length === 0) {
    return fail(
      pickLocale(
        locale,
        "O pagamento online deste profissional esta indisponivel no momento.",
        "Online payment from this professional is unavailable right now.",
      ),
    );
  }

  let amountCents: number;
  try {
    amountCents = toCents(invoice.amount);
  } catch (error) {
    return fail(describeError(error as Error, pickLocale(locale, "Valor da cobranca invalido.", "Invalid invoice amount.")));
  }

  const feeCents = applicationFeeCents(amountCents, account?.platform_fee_percent ?? 0);

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: methods,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "brl",
              unit_amount: amountCents,
              product_data: { name: invoice.title },
            },
          },
        ],
        payment_intent_data: {
          description: invoice.title,
          // Comissao zero vai como ausente: mandar 0 criaria um objeto de
          // taxa sem significado nenhum.
          ...(feeCents > 0 ? { application_fee_amount: feeCents } : {}),
          metadata: { invoice_id: invoice.id, client_id: invoice.client_id },
        },
        payment_method_options: {
          ...(methods.includes("boleto")
            ? { boleto: { expires_after_days: boletoExpiryDays(invoice.due_date) } }
            : {}),
          ...(methods.includes("pix") ? { pix: { expires_after_seconds: 86400 } } : {}),
        },
        client_reference_id: invoice.id,
        metadata: { invoice_id: invoice.id, client_id: invoice.client_id },
        // A propria pagina hospedada da Stripe (campos, botao, avisos de
        // erro do cartao) segue este idioma -- sem isso ela cai no idioma do
        // navegador do cliente, que pode nao bater com o resto do portal.
        locale: locale === "en" ? "en" : "pt-BR",
        success_url: `${appBaseUrl()}/client/payments?pago=1`,
        cancel_url: `${appBaseUrl()}/client/payments`,
      },
      {
        // `stripeAccount` e o que torna isto uma direct charge.
        stripeAccount,
        // Balde de um minuto: dois toques seguidos reaproveitam a mesma
        // sessao, mas uma tentativa legitima mais tarde cria outra.
        idempotencyKey: `ckt-${invoice.id}-${Math.floor(Date.now() / 60_000)}`,
      },
    );

    if (!session.url) {
      return fail(
        pickLocale(locale, "A Stripe nao devolveu a pagina de pagamento.", "Stripe did not return the payment page."),
      );
    }

    // Cliente nao tem policy de UPDATE em invoices: so a serviceRole grava.
    const { error } = await admin
      .from("invoices")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_hosted_url: session.url,
        stripe_hosted_url_expires_at: session.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null,
        stripe_payment_status: session.payment_status,
        application_fee_cents: feeCents,
      })
      .eq("id", invoice.id);

    if (error) {
      return fail(
        describeError(error, pickLocale(locale, "Nao foi possivel registrar o pagamento.", "Could not record the payment.")),
      );
    }

    return ok({ url: session.url });
  } catch (error) {
    return fail(
      describeError(error as Error, pickLocale(locale, "Nao foi possivel abrir o pagamento.", "Could not open the payment page.")),
    );
  }
}
