"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { normalizeExternalUrl } from "@/lib/domain";
import { BUCKETS } from "@/lib/paths";
import { sendPushToClient } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { logClientActivity } from "@/server/activity";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { InvoiceRow } from "@/types/database";

const createSchema = z
  .object({
    clientId: z.uuid("Selecione um cliente"),
    title: z.string().trim().min(2, "Informe o titulo da cobranca"),
    method: z.enum(["boleto", "link", "pix"]),
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
  });

function revalidateInvoices(clientId?: string) {
  revalidatePath("/admin/payments");
  revalidatePath("/professional/payments");
  revalidatePath("/client/payments");
  revalidatePath("/client/dashboard");
  revalidatePath("/admin/dashboard");
  revalidatePath("/professional/dashboard");
  if (clientId) {
    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath(`/professional/clients/${clientId}`);
  }
}

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

async function notifyAndLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoice: InvoiceRow,
  actorName: string,
) {
  await logClientActivity(supabase, invoice.client_id, actorName, `Enviou uma cobranca: "${invoice.title}"`);
  await sendPushToClient(invoice.client_id, {
    title: "Nova cobranca",
    body: `"${invoice.title}" chegou — vencimento em ${invoice.due_date.split("-").reverse().join("/")}.`,
    url: "/client/payments",
    tag: `invoice-${invoice.id}`,
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
