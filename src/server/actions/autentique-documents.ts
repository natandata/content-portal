"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { createSignatureDocument } from "@/lib/autentique/client";
import { autentiqueConfig } from "@/lib/env";
import { BUCKETS } from "@/lib/paths";
import { sendPushToClient } from "@/lib/push";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { logClientActivity } from "@/server/activity";
import { describeError, done, fail, firstIssue, type ActionResult } from "@/server/result";

/**
 * Assinatura via Autentique -- terceira opcao por documento, ao lado do
 * upload manual e do link do Gov.br (nenhum dos dois muda). Ao contrario
 * desses, esta chama a API real do Autentique (GraphQL) e acompanha o
 * progresso sozinha: um webhook global (`api/webhooks/autentique`) e' o
 * caminho rapido, um cron diario de reconciliamento
 * (`api/cron/autentique-reconcile`) e' a rede de seguranca caso o webhook
 * nao esteja configurado certo ou seja perdido.
 */

function revalidateDocuments(clientId: string) {
  revalidatePath("/admin/documents");
  revalidatePath("/professional/documents");
  revalidatePath("/client/documents");
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/professional/clients/${clientId}`);
}

const sendSchema = z.object({
  contractId: z.uuid(),
  signerName: z.string().trim().min(2, "Informe o nome do signatario"),
  signerEmail: z.email("Informe um e-mail valido"),
});

/** Envia o PDF original pro Autentique e passa a acompanhar a assinatura por la. */
export async function sendDocumentViaAutentiqueAction(
  input: z.input<typeof sendSchema>,
): Promise<ActionResult<null>> {
  const actor = await requireStaff();

  if (!autentiqueConfig()) {
    return fail("Assinatura via Autentique ainda nao foi configurada nesta instalacao.");
  }

  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error.issues, "Dados invalidos."));

  // RLS confirma que o ator pode ver este documento antes de qualquer
  // chamada ao Autentique.
  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, client_id, title, original_file_path, requires_signature, signature_provider, status")
    .eq("id", parsed.data.contractId)
    .maybeSingle();
  if (!contract) return fail("Documento nao encontrado.");
  if (!contract.requires_signature) return fail("Este documento nao pede assinatura.");
  if (!contract.original_file_path) return fail("Envie o PDF original antes de mandar pro Autentique.");
  if (contract.signature_provider === "autentique" && contract.status === "sent_for_signature") {
    return fail("Este documento ja foi enviado pro Autentique -- cancele o envio atual antes de reenviar.");
  }

  const admin = createAdminClient();
  const { data: fileBlob, error: downloadError } = await admin.storage
    .from(BUCKETS.contracts)
    .download(contract.original_file_path);
  if (downloadError || !fileBlob) {
    return fail(describeError(downloadError, "Nao foi possivel ler o PDF original."));
  }
  const fileBytes = Buffer.from(await fileBlob.arrayBuffer());

  const result = await createSignatureDocument({
    name: contract.title,
    fileBytes,
    fileName: "documento.pdf",
    signer: { name: parsed.data.signerName, email: parsed.data.signerEmail },
  });
  if (!result.ok) return fail(describeError(new Error(result.error), "Nao foi possivel enviar pro Autentique."));

  const { error: updateError } = await admin
    .from("contracts")
    .update({
      signature_provider: "autentique",
      autentique_document_id: result.data.autentiqueDocumentId,
      autentique_signer_name: parsed.data.signerName,
      autentique_signer_email: parsed.data.signerEmail,
      autentique_sent_at: new Date().toISOString(),
      autentique_error: null,
      status: "sent_for_signature",
    })
    .eq("id", contract.id);
  if (updateError) return fail(describeError(updateError, "Enviado, mas houve falha ao salvar o status."));

  await sendPushToClient(contract.client_id, {
    title: "Novo documento para assinar",
    body: `"${contract.title}" foi enviado para assinatura via Autentique.`,
    url: "/client/documents",
    tag: `document-${contract.id}`,
  }).catch(() => {});

  await logClientActivity(
    supabase,
    contract.client_id,
    actor.displayName,
    `Enviou o documento "${contract.title}" via Autentique`,
  );

  revalidateDocuments(contract.client_id);
  return done();
}

/** Desiste do fluxo Autentique e volta pro caminho manual -- staff decide reenviar do zero ou pedir upload manual. */
export async function cancelAutentiqueSignatureAction(contractId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contracts")
    .update({
      signature_provider: "manual",
      autentique_document_id: null,
      autentique_signer_name: null,
      autentique_signer_email: null,
      autentique_sent_at: null,
      autentique_signed_at: null,
      autentique_error: null,
      status: "awaiting_signature",
    })
    .eq("id", contractId)
    .eq("signature_provider", "autentique")
    .eq("status", "sent_for_signature")
    .select("client_id")
    .maybeSingle();
  if (error) return fail(describeError(error, "Nao foi possivel cancelar o envio."));
  if (!data) return fail("Este documento nao esta mais aguardando assinatura via Autentique.");

  revalidateDocuments(data.client_id);
  return done();
}
