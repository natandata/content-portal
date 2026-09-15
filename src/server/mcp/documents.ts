import "server-only";

import { createSignatureDocument } from "@/lib/autentique/client";
import { autentiqueConfig } from "@/lib/env";
import { BUCKETS, contractPath } from "@/lib/paths";
import { sendPushToClient } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { logClientActivity } from "@/server/activity";
import { assertClientOwnership, MCP_MAX_FILE_BYTES, type McpActor } from "@/server/mcp/auth";
import { describeError, fail, ok, type ActionResult } from "@/server/result";

/**
 * Cria um documento e ja manda pra assinatura via Autentique -- mesma
 * logica de `createDocumentAction` + `sendDocumentViaAutentiqueAction`
 * (`src/server/actions/documents.ts` e `autentique-documents.ts`), so que
 * recebe os bytes do arquivo direto como argumento (base64) em vez de
 * depender de upload pelo navegador, e reaproveita o Buffer que ja subiu
 * pro Storage em vez de baixar de volta.
 */
export async function sendDocumentForSignatureTool(
  actor: McpActor,
  input: { clientId: string; title: string; fileBase64: string; fileName: string; signerName: string; signerEmail: string },
): Promise<ActionResult<{ contractId: string; autentiqueDocumentId: string }>> {
  if (!autentiqueConfig()) return fail("Assinatura via Autentique ainda nao foi configurada nesta instalacao.");
  if (!input.title?.trim() || input.title.trim().length < 2) return fail("Informe o titulo do documento.");
  if (!input.signerName?.trim() || input.signerName.trim().length < 2) return fail("Informe o nome do signatario.");
  if (!input.signerEmail?.includes("@")) return fail("Informe um e-mail valido para o signatario.");
  if (!input.fileBase64) return fail("Envie o arquivo em base64.");

  const admin = createAdminClient();
  const ownership = await assertClientOwnership(admin, actor, input.clientId);
  if (!ownership.ok) return ownership;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(input.fileBase64, "base64");
  } catch {
    return fail("Arquivo em base64 invalido.");
  }
  if (buffer.length === 0) return fail("Arquivo vazio.");
  if (buffer.length > MCP_MAX_FILE_BYTES) return fail("Arquivo grande demais (limite de 20 MB).");

  const { data: contract, error: contractError } = await admin
    .from("contracts")
    .insert({
      client_id: input.clientId,
      title: input.title,
      kind: "contract",
      requires_signature: true,
      allow_gov_br_signature: false,
      created_by: actor.userId,
    })
    .select("*")
    .single();
  if (contractError || !contract) return fail(describeError(contractError, "Nao foi possivel criar o documento."));

  const path = contractPath(input.clientId, contract.id, input.fileName || "documento.pdf");
  const { error: uploadError } = await admin.storage
    .from(BUCKETS.contracts)
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) return fail(describeError(uploadError, "Nao foi possivel enviar o PDF."));

  await admin
    .from("contracts")
    .update({ original_file_path: path, uploaded_at: new Date().toISOString() })
    .eq("id", contract.id);

  const result = await createSignatureDocument({
    name: input.title,
    fileBytes: buffer,
    fileName: input.fileName || "documento.pdf",
    signer: { name: input.signerName, email: input.signerEmail },
  });
  if (!result.ok) return fail(`Nao foi possivel enviar pro Autentique: ${result.error}`);

  const { error: updateError } = await admin
    .from("contracts")
    .update({
      signature_provider: "autentique",
      autentique_document_id: result.data.autentiqueDocumentId,
      autentique_signer_name: input.signerName,
      autentique_signer_email: input.signerEmail,
      autentique_sent_at: new Date().toISOString(),
      autentique_error: null,
      status: "sent_for_signature",
    })
    .eq("id", contract.id);
  if (updateError) return fail(describeError(updateError, "Enviado, mas houve falha ao salvar o status."));

  await sendPushToClient(input.clientId, {
    title: "Novo documento para assinar",
    body: `"${input.title}" foi enviado para assinatura via Autentique.`,
    url: "/client/documents",
    tag: `document-${contract.id}`,
  }).catch(() => {});

  await logClientActivity(admin, input.clientId, actor.displayName, `Enviou o documento "${input.title}" via Autentique`);

  return ok({ contractId: contract.id, autentiqueDocumentId: result.data.autentiqueDocumentId });
}
