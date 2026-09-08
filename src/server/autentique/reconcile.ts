import "server-only";

import { downloadSignedPdf, getDocumentStatus } from "@/lib/autentique/client";
import { BUCKETS, signedContractPath } from "@/lib/paths";
import { sendPushToClientStaff } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Nao e uma server action ("use server") de proposito -- `completeIfSigned`
 * recebe o client admin como parametro, que nao e serializavel (obrigatorio
 * pra funcoes exportadas de um arquivo "use server"). Chamada tanto pelo
 * webhook (`api/webhooks/autentique`, caminho rapido) quanto pelo cron
 * diario (`api/cron/autentique-reconcile`, rede de seguranca), mesmo
 * espirito de `instagram-insights-report.ts`.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

function revalidateDocuments(clientId: string) {
  // Evita depender de `next/cache` aqui (webhook/cron nao sao sempre um
  // contexto de requisicao de pagina) -- quem serve a pagina de Documentos
  // ja revalida via `router.refresh()`/navegacao normal; o dado em si ja
  // esta correto no banco assim que este modulo termina.
  void clientId;
}

/** Confirma com o Autentique e, se assinado por todos, baixa o PDF e fecha o documento. Devolve true se completou agora. */
export async function completeIfSigned(
  admin: AdminClient,
  contract: { id: string; client_id: string; title: string; autentique_document_id: string | null },
): Promise<boolean> {
  if (!contract.autentique_document_id) return false;

  const statusResult = await getDocumentStatus(contract.autentique_document_id);
  if (!statusResult.ok || !statusResult.data.signedFileUrl) {
    if (!statusResult.ok) {
      await admin.from("contracts").update({ autentique_error: statusResult.error }).eq("id", contract.id);
    }
    return false;
  }

  const pdfResult = await downloadSignedPdf(statusResult.data.signedFileUrl);
  if (!pdfResult.ok) {
    await admin.from("contracts").update({ autentique_error: pdfResult.error }).eq("id", contract.id);
    return false;
  }

  const filePath = signedContractPath(contract.client_id, contract.id, "assinado-autentique.pdf");
  const { error: uploadError } = await admin.storage
    .from(BUCKETS.signedContracts)
    .upload(filePath, pdfResult.data, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    await admin.from("contracts").update({ autentique_error: uploadError.message }).eq("id", contract.id);
    return false;
  }

  // "signed" (nao "approved") -- fica com data/hora visivel na tag do
  // documento, e o staff ainda tem "Confirmar recebimento" disponivel (mesmo
  // botao que ja existe pro fluxo manual) se quiser dar o aprovado final.
  const now = new Date().toISOString();
  await admin
    .from("contracts")
    .update({
      signed_file_path: filePath,
      signed_at: now,
      autentique_signed_at: now,
      autentique_error: null,
      status: "signed",
    })
    .eq("id", contract.id);

  await sendPushToClientStaff(contract.client_id, {
    title: "Documento assinado via Autentique",
    body: `"${contract.title}" foi assinado por todos os signatarios.`,
    url: "/professional/documents",
    tag: `document-signed-${contract.id}`,
  }).catch(() => {});

  revalidateDocuments(contract.client_id);
  return true;
}

/**
 * Rede de seguranca do webhook -- pra cada contrato `sent_for_signature`,
 * confirma direto com o Autentique se ja terminou. Cap deliberado por
 * execucao, mesmo raciocinio dos outros crons: sobra fica pro dia seguinte.
 */
export async function reconcileAutentiqueDocuments(limit = 20): Promise<{ processed: number; completed: number }> {
  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("contracts")
    .select("id, client_id, title, autentique_document_id")
    .eq("status", "sent_for_signature")
    .eq("signature_provider", "autentique")
    .not("autentique_document_id", "is", null)
    .limit(limit);

  let completed = 0;
  for (const contract of pending ?? []) {
    const ok = await completeIfSigned(admin, contract);
    if (ok) completed += 1;
  }
  return { processed: pending?.length ?? 0, completed };
}
