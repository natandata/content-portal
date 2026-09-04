"use server";

import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { normalizeExternalUrl } from "@/lib/domain";
import { intlLocale } from "@/lib/i18n/locale";
import { BUCKETS } from "@/lib/paths";
import { sendPushToClient } from "@/lib/push";
import { canChargeWithStripe } from "@/lib/stripe/capabilities";
import { createClient } from "@/lib/supabase/server";
import { logClientActivity } from "@/server/activity";
import { revalidateInvoices } from "@/server/invoices/revalidate";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { InvoiceRow } from "@/types/database";

const createSchema = z
  .object({
    clientId: z.uuid("Selecione um cliente"),
    title: z.string().trim().min(2, "Informe o titulo da cobranca"),
    method: z.enum(["boleto", "link", "pix", "stripe"]),
    amount: z.coerce.number().positive("Informe um valor maior que zero"),
    currency: z.enum(["BRL", "USD", "EUR", "GBP"]),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de vencimento"),
    paymentLink: z.string().trim().optional(),
    pixKey: z.string().trim().optional(),
  })
  .transform((data) => {
    if (data.method !== "link") return { ...data, paymentLink: undefined };
    const normalized = data.paymentLink ? normalizeExternalUrl(data.paymentLink) : null;
    return { ...data, paymentLink: normalized ?? undefined };
  })
  .refine((data) => data.method !== "link" || Boolean(data.paymentLink), {
    message: "Informe um link valido (http/https).",
    path: ["paymentLink"],
  })
  .refine((data) => data.method !== "pix" || Boolean(data.pixKey && data.pixKey.length > 0), {
    message: "Informe a chave Pix.",
    path: ["pixKey"],
  })
  // A Stripe desta integracao esta configurada para o Brasil e liquida em BRL.
  .refine((data) => data.method !== "stripe" || data.currency === "BRL", {
    message: "Pagamento online aceita apenas BRL.",
    path: ["currency"],
  });

/** Cria a cobranca. Boleto ainda sem arquivo — vem depois via attachBoletoAction. */
export async function createInvoiceAction(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<InvoiceRow>> {
  const actor = await requireStaff();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();

  // Pagamento online precisa saber, ja na emissao, em qual conta conectada esta
  // cobranca vai liquidar. Guardar o id aqui (em vez de resolver pelo
  // clients.professional_id na hora de cobrar) mantem a cobranca liquidando na
  // conta de quem a emitiu, mesmo que o cliente troque de responsavel depois.
  let stripeAccountId: string | null = null;

  if (parsed.data.method === "stripe") {
    const resolved = await resolveStripeAccountForClient(supabase, parsed.data.clientId);
    if (!resolved.ok) return resolved;
    stripeAccountId = resolved.data;
  }

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      client_id: parsed.data.clientId,
      title: parsed.data.title,
      method: parsed.data.method,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      due_date: parsed.data.dueDate,
      payment_link: parsed.data.method === "link" ? (parsed.data.paymentLink ?? null) : null,
      pix_key: parsed.data.method === "pix" ? (parsed.data.pixKey ?? null) : null,
      stripe_account_id: stripeAccountId,
      created_by: actor.authUser.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel criar a cobranca."));
  }

  // Boleto ainda espera o PDF: quem chamou anexa o arquivo e so entao avisamos
  // o cliente (attachBoletoAction cuida do aviso nesse caso).
  if (parsed.data.method !== "boleto") {
    await notifyAndLog(supabase, data, actor.displayName);
  }

  revalidateInvoices(parsed.data.clientId);
  return ok(data);
}

/**
 * Descobre a conta Connect que recebe as cobrancas deste cliente — a do
 * profissional responsavel por ele — e recusa se ela ainda nao pode cobrar.
 */
async function resolveStripeAccountForClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
): Promise<ActionResult<string>> {
  const { data: client } = await supabase
    .from("clients")
    .select("professional_id")
    .eq("id", clientId)
    .maybeSingle();

  if (!client?.professional_id) {
    return fail("Este cliente nao tem profissional responsavel para receber o pagamento.");
  }

  const { data: account } = await supabase
    .from("professional_payment_accounts")
    .select("*")
    .eq("user_id", client.professional_id)
    .maybeSingle();

  if (!canChargeWithStripe(account)) {
    return fail("O profissional responsavel ainda nao ativou o pagamento online.");
  }

  // canChargeWithStripe ja garantiu que a conta existe e esta habilitada.
  return ok(account!.stripe_account_id!);
}

async function notifyAndLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoice: InvoiceRow,
  actorName: string,
) {
  await logClientActivity(supabase, invoice.client_id, actorName, `Enviou uma cobranca: "${invoice.title}"`);
  await sendPushToClient(invoice.client_id, (locale) => {
    const due = new Date(`${invoice.due_date}T12:00:00Z`);
    const dueLabel = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "short", timeZone: "UTC" }).format(due);
    return locale === "en"
      ? {
          title: "New invoice",
          body: `"${invoice.title}" is due on ${dueLabel}.`,
          url: "/client/payments",
          tag: `invoice-${invoice.id}`,
        }
      : {
          title: "Nova cobranca",
          body: `"${invoice.title}" chegou — vencimento em ${dueLabel}.`,
          url: "/client/payments",
          tag: `invoice-${invoice.id}`,
        };
  }).catch(() => {});
}

export async function attachBoletoAction(
  invoiceId: string,
  filePath: string,
): Promise<ActionResult<null>> {
  const actor = await requireStaff();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .update({ boleto_file_path: filePath })
    .eq("id", invoiceId)
    .select("*")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel anexar o boleto."));
  }

  await notifyAndLog(supabase, data, actor.displayName);
  revalidateInvoices(data.client_id);
  return done();
}

export async function markInvoicePaidAction(invoiceId: string): Promise<ActionResult<null>> {
  const actor = await requireStaff();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString(), paid_by: actor.authUser.id })
    .eq("id", invoiceId)
    .select("client_id, title")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel marcar a cobranca como paga."));
  }

  await logClientActivity(
    supabase,
    data.client_id,
    actor.displayName,
    `Marcou a cobranca "${data.title}" como paga`,
  );

  revalidateInvoices(data.client_id);
  return done();
}

export async function deleteInvoiceAction(invoiceId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("client_id, boleto_file_path")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) return fail("Cobranca nao encontrada.");

  if (invoice.boleto_file_path) {
    await supabase.storage.from(BUCKETS.invoices).remove([invoice.boleto_file_path]);
  }

  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) {
    return fail(describeError(error, "Nao foi possivel excluir a cobranca."));
  }

  revalidateInvoices(invoice.client_id);
  return done();
}
