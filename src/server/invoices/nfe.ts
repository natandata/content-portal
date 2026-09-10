import { createNfse, getNfeStatus } from "@/lib/focusnfe/client";
import { focusNfeConfig } from "@/lib/env";
import { logClientActivity } from "@/server/activity";
import type { createAdminClient } from "@/lib/supabase/server";
import type { InvoiceRow } from "@/types/database";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Emite a nota fiscal de uma cobranca paga (best-effort -- nunca falha o
 * fluxo de pagamento por causa disso). So dispara se o Focus NFe estiver
 * configurado E a cobranca tiver CPF do pagador (obrigatorio pra emitir).
 *
 * Ver aviso em `lib/focusnfe/client.ts`: o formato exato do payload da API
 * do Focus NFe nao foi confirmado ao vivo nesta sessao -- conferir contra
 * uma conta sandbox real antes do primeiro envio de producao.
 */
export async function emitNfeForInvoice(
  admin: AdminClient,
  invoice: Pick<InvoiceRow, "id" | "client_id" | "title" | "amount" | "payer_name" | "payer_cpf">,
): Promise<void> {
  const config = focusNfeConfig();
  if (!config) return;
  if (!invoice.payer_cpf || !invoice.payer_name) return;

  await admin.from("invoices").update({ nfe_status: "processing", nfe_ref: invoice.id }).eq("id", invoice.id);

  const result = await createNfse(config.apiToken, config.sandbox, {
    ref: invoice.id,
    discriminacao: invoice.title,
    valorServicos: invoice.amount,
    tomador: { cpf: invoice.payer_cpf, razaoSocial: invoice.payer_name },
  });

  if (!result.ok) {
    await admin.from("invoices").update({ nfe_status: "error", nfe_error: result.error }).eq("id", invoice.id);
    return;
  }

  await admin
    .from("invoices")
    .update({
      nfe_status: result.data.status === "autorizado" ? "issued" : "processing",
      nfe_number: result.data.numero,
      nfe_pdf_url: result.data.urlPdf,
    })
    .eq("id", invoice.id);

  if (result.data.status === "autorizado") {
    await logClientActivity(admin, invoice.client_id, "Focus NFe", `Nota fiscal emitida: "${invoice.title}"`);
  }
}

/** Reconciliacao -- consulta o status de notas ainda "processing" (emissao e assincrona do lado do Focus NFe). */
export async function reconcilePendingNfe(admin: AdminClient, limit = 20): Promise<{ checked: number; issued: number }> {
  const config = focusNfeConfig();
  if (!config) return { checked: 0, issued: 0 };

  const { data: pending } = await admin
    .from("invoices")
    .select("id, client_id, title, nfe_ref")
    .eq("nfe_status", "processing")
    .not("nfe_ref", "is", null)
    .limit(limit);

  let issued = 0;
  for (const invoice of pending ?? []) {
    const result = await getNfeStatus(config.apiToken, config.sandbox, invoice.nfe_ref!);
    if (!result.ok) continue;

    if (result.data.status === "autorizado") {
      await admin
        .from("invoices")
        .update({ nfe_status: "issued", nfe_number: result.data.numero, nfe_pdf_url: result.data.urlPdf })
        .eq("id", invoice.id);
      await logClientActivity(admin, invoice.client_id, "Focus NFe", `Nota fiscal emitida: "${invoice.title}"`);
      issued += 1;
    } else if (result.data.status.startsWith("erro")) {
      await admin.from("invoices").update({ nfe_status: "error", nfe_error: result.data.erro }).eq("id", invoice.id);
    }
  }

  return { checked: pending?.length ?? 0, issued };
}
