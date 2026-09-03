import { sendPushToClient, sendPushToClientStaff } from "@/lib/push";
import { logClientActivity } from "@/server/activity";
import { revalidateInvoices } from "@/server/invoices/revalidate";
import type { createAdminClient } from "@/lib/supabase/server";
import type { InvoiceRow } from "@/types/database";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Confirma o pagamento de uma cobranca a partir de um evento da Stripe.
 *
 * Nao reaproveita `markInvoicePaidAction` porque aquela acao chama
 * `requireStaff()` e o webhook nao tem sessao nenhuma. Aqui a autorizacao ja
 * foi feita: a assinatura do evento e que provou que veio da Stripe.
 *
 * Escrito para ser idempotente: e um "grava estas colunas onde id = X", entao
 * processar o mesmo evento duas vezes nao muda o resultado.
 */
export async function markInvoicePaidFromStripe(
  admin: AdminClient,
  invoice: Pick<InvoiceRow, "id" | "client_id" | "title" | "paid_at">,
  details: {
    paymentIntentId: string | null;
    amountPaidCents: number | null;
    applicationFeeCents: number | null;
  },
): Promise<void> {
  // Ja estava paga: nao reescreve `paid_at` nem dispara aviso de novo.
  if (invoice.paid_at) return;

  const { error } = await admin
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      // Nenhuma pessoa marcou: quem confirmou foi a Stripe.
      paid_by: null,
      stripe_payment_status: "paid",
      stripe_payment_intent_id: details.paymentIntentId,
      amount_paid_cents: details.amountPaidCents,
      application_fee_cents: details.applicationFeeCents,
    })
    .eq("id", invoice.id);

  if (error) throw new Error(error.message);

  await logClientActivity(
    admin,
    invoice.client_id,
    "Stripe",
    `Pagamento confirmado: "${invoice.title}"`,
  );

  // Recibo para o cliente e aviso para quem atende — o profissional precisa
  // saber que o dinheiro entrou sem ficar conferindo o painel.
  await sendPushToClient(invoice.client_id, {
    title: "Pagamento confirmado",
    body: `"${invoice.title}" foi paga. Obrigado!`,
    url: "/client/payments",
    tag: `invoice-${invoice.id}`,
  }).catch(() => {});

  await sendPushToClientStaff(invoice.client_id, {
    title: "Cobranca paga",
    body: `"${invoice.title}" foi paga pelo cliente.`,
    url: "/professional/payments",
    tag: `invoice-paid-${invoice.id}`,
  }).catch(() => {});

  revalidateInvoices(invoice.client_id);
}
