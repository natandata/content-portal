"use server";

import { requireClientActor } from "@/lib/auth";
import { daysUntil } from "@/lib/domain";
import { appBaseUrl } from "@/lib/env";
import { applicationFeeCents, toCents } from "@/lib/money";
import { rateLimit } from "@/lib/rate-limit";
import { paymentMethodTypesFor, type StripeMethod } from "@/lib/stripe/capabilities";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient, createClient } from "@/lib/supabase/server";
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

  // Cria objeto remoto a cada clique: merece o mesmo freio das rotas de login.
  const limit = rateLimit(`checkout:${actor.client.id}`, 10, 60_000);
  if (!limit.allowed) {
    return fail(`Muitas tentativas. Tente novamente em ${limit.retryAfterSeconds}s.`);
  }

  const stripe = getStripe();
  if (!stripe) return fail("Pagamento online indisponivel no momento.");

  // Leitura pela RLS de proposito: `invoices_select_scoped` E a autorizacao.
  // Id de cobranca de outro cliente simplesmente nao volta nenhuma linha.
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) return fail("Cobranca nao encontrada.");
  if (invoice.status === "paid") return fail("Esta cobranca ja foi paga.");
  if (invoice.method !== "stripe" || !invoice.stripe_account_id) {
    return fail("Esta cobranca nao aceita pagamento online.");
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
  if (invoice.stripe_checkout_session_id && invoice.stripe_hosted_url_expires_at) {
    const stillValid =
      new Date(invoice.stripe_hosted_url_expires_at).getTime() > Date.now() + 5 * 60_000;

    if (stillValid) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(
          invoice.stripe_checkout_session_id,
          {},
          { stripeAccount },
        );
        if (existing.status === "open" && existing.url) {
          return ok({ url: existing.url });
        }
      } catch {
        // Sessao sumiu ou nao pode ser lida: segue e cria outra.
      }
    }
  }

  const { data: account } = await admin
    .from("professional_payment_accounts")
    .select("*")
    .eq("stripe_account_id", stripeAccount)
    .maybeSingle();

  const methods: StripeMethod[] = paymentMethodTypesFor(account);
  if (methods.length === 0) {
    return fail("O pagamento online deste profissional esta indisponivel no momento.");
  }

  let amountCents: number;
  try {
    amountCents = toCents(invoice.amount);
  } catch (error) {
    return fail(describeError(error as Error, "Valor da cobranca invalido."));
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

    if (!session.url) return fail("A Stripe nao devolveu a pagina de pagamento.");

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
      return fail(describeError(error, "Nao foi possivel registrar o pagamento."));
    }

    return ok({ url: session.url });
  } catch (error) {
    return fail(describeError(error as Error, "Nao foi possivel abrir o pagamento."));
  }
}
