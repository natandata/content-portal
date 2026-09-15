import "server-only";

import { appBaseUrl } from "@/lib/env";
import { intlLocale } from "@/lib/i18n/locale";
import { createPixPayment } from "@/lib/mercadopago/client";
import { BUCKETS, invoiceAttachmentPath } from "@/lib/paths";
import { sendPushToClient } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { logClientActivity } from "@/server/activity";
import { assertClientOwnership, MCP_MAX_FILE_BYTES, type McpActor } from "@/server/mcp/auth";
import { resolveMercadoPagoAccessToken } from "@/server/mercadopago/resolve";
import { describeError, fail, ok, type ActionResult } from "@/server/result";

/** Mesma logica de `resolveMercadoPagoProfessionalForClient` (invoices.ts), so com admin client direto. */
async function resolveMercadoPagoProfessional(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
): Promise<ActionResult<string>> {
  const { data: client } = await admin.from("clients").select("professional_id").eq("id", clientId).maybeSingle();
  if (!client?.professional_id) {
    return fail("Este cliente nao tem profissional responsavel para receber o Pix.");
  }

  const { data: account } = await admin
    .from("professional_mercadopago_accounts")
    .select("user_id")
    .eq("user_id", client.professional_id)
    .maybeSingle();

  if (!account) {
    return fail(
      "O profissional responsavel ainda nao conectou a conta Mercado Pago (Configuracoes > Publicacoes).",
    );
  }

  return ok(account.user_id);
}

/**
 * Cria uma cobranca Pix automatica (Mercado Pago) com QR code -- mesma
 * logica do trecho `mercadopago` de `createInvoiceAction`
 * (`src/server/actions/invoices.ts`), reescrita sem cookie de sessao.
 */
export async function createMercadoPagoChargeTool(
  actor: McpActor,
  input: { clientId: string; title: string; amount: number; dueDate: string; payerName: string; payerCpf: string },
): Promise<ActionResult<{ invoiceId: string; qrCodeBase64: string | null; pixCode: string | null; clientPortalUrl: string }>> {
  if (!input.title?.trim() || input.title.trim().length < 2) return fail("Informe o titulo da cobranca.");
  if (!(typeof input.amount === "number" && input.amount > 0)) return fail("Informe um valor maior que zero.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate ?? "")) return fail("Data de vencimento invalida (use AAAA-MM-DD).");
  if (!input.payerName?.trim()) return fail("Informe o nome do pagador.");
  const payerCpfDigits = (input.payerCpf ?? "").replace(/\D/g, "");
  if (payerCpfDigits.length !== 11) return fail("Informe um CPF valido (11 digitos).");

  const admin = createAdminClient();
  const ownership = await assertClientOwnership(admin, actor, input.clientId);
  if (!ownership.ok) return ownership;

  const resolvedProfessional = await resolveMercadoPagoProfessional(admin, input.clientId);
  if (!resolvedProfessional.ok) return resolvedProfessional;
  const mercadoPagoProfessionalId = resolvedProfessional.data;

  const { data: invoice, error } = await admin
    .from("invoices")
    .insert({
      client_id: input.clientId,
      title: input.title,
      method: "mercadopago",
      amount: input.amount,
      currency: "BRL",
      due_date: input.dueDate,
      mercadopago_professional_id: mercadoPagoProfessionalId,
      created_by: actor.userId,
      payer_name: input.payerName,
      payer_cpf: payerCpfDigits,
    })
    .select("*")
    .single();

  if (error || !invoice) return fail(describeError(error, "Nao foi possivel criar a cobranca."));

  const resolvedToken = await resolveMercadoPagoAccessToken(admin, mercadoPagoProfessionalId);
  if (!resolvedToken) {
    await admin.from("invoices").delete().eq("id", invoice.id);
    return fail("O profissional responsavel ainda nao conectou a conta Mercado Pago.");
  }

  const { data: paymentAccount } = await admin
    .from("professional_payment_accounts")
    .select("platform_fee_percent")
    .eq("user_id", mercadoPagoProfessionalId)
    .maybeSingle();
  const feePercent = paymentAccount?.platform_fee_percent ?? 1;
  const applicationFee = Math.round(input.amount * (feePercent / 100) * 100) / 100;

  const pix = await createPixPayment(resolvedToken.accessToken, {
    invoiceId: invoice.id,
    amount: input.amount,
    description: input.title,
    payerEmail: actor.email || "sem-email@contentportal.local",
    payerName: input.payerName,
    payerCpf: payerCpfDigits,
    applicationFee,
  });

  if (!pix.ok) {
    await admin.from("invoices").delete().eq("id", invoice.id);
    return fail(`Nao foi possivel gerar o Pix: ${pix.error}`);
  }

  const { data: updated, error: updateError } = await admin
    .from("invoices")
    .update({
      mercadopago_payment_id: String(pix.data.id),
      mercadopago_status: pix.data.status,
      mercadopago_qr_code: pix.data.qrCode,
      mercadopago_qr_code_base64: pix.data.qrCodeBase64,
      application_fee_cents: Math.round(applicationFee * 100),
    })
    .eq("id", invoice.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return fail(describeError(updateError, "Pix criado, mas nao foi possivel salvar o QR code."));
  }

  await logClientActivity(admin, input.clientId, actor.displayName, `Enviou uma cobranca: "${updated.title}"`);
  await sendPushToClient(input.clientId, (locale) => {
    const due = new Date(`${updated.due_date}T12:00:00Z`);
    const dueLabel = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "short", timeZone: "UTC" }).format(due);
    return locale === "en"
      ? { title: "New invoice", body: `"${updated.title}" is due on ${dueLabel}.`, url: "/client/payments", tag: `invoice-${updated.id}` }
      : { title: "Nova cobranca", body: `"${updated.title}" chegou — vencimento em ${dueLabel}.`, url: "/client/payments", tag: `invoice-${updated.id}` };
  }).catch(() => {});

  return ok({
    invoiceId: updated.id,
    qrCodeBase64: updated.mercadopago_qr_code_base64,
    pixCode: updated.mercadopago_qr_code,
    clientPortalUrl: `${appBaseUrl()}/client/payments`,
  });
}

/**
 * Anexa um documento (base64) a uma cobranca ja existente -- generaliza o
 * slot que hoje so existe pro boleto (`invoices.attachment_path`, coluna
 * nova). Funciona pra qualquer metodo de cobranca.
 */
export async function attachDocumentToChargeTool(
  actor: McpActor,
  input: { invoiceId: string; fileBase64: string; fileName: string; mimeType?: string },
): Promise<ActionResult<null>> {
  if (!input.fileBase64) return fail("Envie o arquivo em base64.");
  if (!input.fileName?.trim()) return fail("Informe o nome do arquivo.");

  const admin = createAdminClient();
  const { data: invoice } = await admin.from("invoices").select("id, client_id").eq("id", input.invoiceId).maybeSingle();
  if (!invoice) return fail("Cobranca nao encontrada.");

  const ownership = await assertClientOwnership(admin, actor, invoice.client_id);
  if (!ownership.ok) return ownership;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(input.fileBase64, "base64");
  } catch {
    return fail("Arquivo em base64 invalido.");
  }
  if (buffer.length === 0) return fail("Arquivo vazio.");
  if (buffer.length > MCP_MAX_FILE_BYTES) return fail("Arquivo grande demais (limite de 20 MB).");

  const path = invoiceAttachmentPath(invoice.client_id, invoice.id, input.fileName);
  const { error: uploadError } = await admin.storage
    .from(BUCKETS.invoices)
    .upload(path, buffer, { contentType: input.mimeType || "application/pdf", upsert: true });
  if (uploadError) return fail(describeError(uploadError, "Nao foi possivel enviar o arquivo."));

  const { error } = await admin.from("invoices").update({ attachment_path: path }).eq("id", invoice.id);
  if (error) return fail(describeError(error, "Nao foi possivel salvar o anexo."));

  await logClientActivity(admin, invoice.client_id, actor.displayName, "Anexou um documento a cobranca");
  return ok(null);
}
