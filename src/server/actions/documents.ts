"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireClientActor, requireStaff } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { pickLocale } from "@/lib/i18n/locale";
import { BUCKETS } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";
import { resolveClientStaffIds, sendPushToClient, sendPushToUsers } from "@/lib/push";
import { logClientActivity } from "@/server/activity";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { ContractRow, ContractStatus } from "@/types/database";

const createSchema = z
  .object({
    clientId: z.uuid("Selecione um cliente"),
    title: z.string().trim().min(2, "Informe o nome do documento"),
    notes: z.string().trim().max(1000).optional(),
    kind: z.enum(["contract", "strategy", "brandbook", "mockup", "other"]),
    requiresSignature: z.boolean(),
    // So faz sentido oferecer o atalho do Gov.br quando ha o que assinar.
    allowGovBrSignature: z.boolean().default(false),
  })
  .refine((data) => !data.allowGovBrSignature || data.requiresSignature, {
    message: "A assinatura via Gov.br exige pedir devolucao assinada.",
    path: ["allowGovBrSignature"],
  });

function revalidateDocuments(clientId?: string) {
  revalidatePath("/admin/documents");
  revalidatePath("/professional/documents");
  revalidatePath("/client/documents");
  revalidatePath("/client/dashboard");
  if (clientId) {
    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath(`/professional/clients/${clientId}`);
  }
}

/** Cria o registro para que o PDF possa ser enviado em `contracts/{client}/{contract}`. */
export async function createDocumentAction(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<ContractRow>> {
  const actor = await requireStaff();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .insert({
      client_id: parsed.data.clientId,
      title: parsed.data.title,
      notes: parsed.data.notes || null,
      kind: parsed.data.kind,
      requires_signature: parsed.data.requiresSignature,
      allow_gov_br_signature: parsed.data.allowGovBrSignature,
      created_by: actor.authUser.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel criar o documento."));
  }

  revalidateDocuments(parsed.data.clientId);
  return ok(data);
}

export async function attachDocumentFileAction(
  contractId: string,
  filePath: string,
): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  // Documento que nao pede assinatura ja nasce entregue: nao ha o que aguardar.
  const { data: document } = await supabase
    .from("contracts")
    .select("requires_signature, title")
    .eq("id", contractId)
    .maybeSingle();

  const requiresSignature = document?.requires_signature !== false;
  const status: ContractStatus = requiresSignature ? "awaiting_signature" : "delivered";

  const { data, error } = await supabase
    .from("contracts")
    .update({
      original_file_path: filePath,
      uploaded_at: new Date().toISOString(),
      status,
    })
    .eq("id", contractId)
    .select("client_id")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel anexar o arquivo."));
  }

  revalidateDocuments(data.client_id);

  await sendPushToClient(data.client_id, (locale) => {
    const en = locale === "en";
    const title = document?.title ?? (en ? "Document" : "Documento");
    return requiresSignature
      ? {
          title: en ? "New document for signature" : "Novo documento para assinatura",
          body: en
            ? `"${title}" arrived and is waiting for your signature.`
            : `"${title}" chegou e esta esperando sua assinatura.`,
          url: "/client/documents",
          tag: `document-${contractId}`,
        }
      : {
          title: en ? "New document to view" : "Novo documento para visualizar",
          body: en ? `"${title}" is now available for you to view.` : `"${title}" ja esta disponivel para voce ver.`,
          url: "/client/documents",
          tag: `document-${contractId}`,
        };
  }).catch(() => {});

  return done();
}

export async function setDocumentStatusAction(
  contractId: string,
  status: ContractStatus,
): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contracts")
    .update({ status })
    .eq("id", contractId)
    .select("client_id")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel atualizar o documento."));
  }

  revalidateDocuments(data.client_id);
  return done();
}

export async function deleteDocumentAction(contractId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select("client_id, original_file_path, signed_file_path")
    .eq("id", contractId)
    .maybeSingle();

  if (!contract) return fail("Documento nao encontrado.");

  if (contract.original_file_path) {
    await supabase.storage.from(BUCKETS.contracts).remove([contract.original_file_path]);
  }
  if (contract.signed_file_path) {
    await supabase.storage.from(BUCKETS.signedContracts).remove([contract.signed_file_path]);
  }

  const { error } = await supabase.from("contracts").delete().eq("id", contractId);
  if (error) {
    return fail(describeError(error, "Nao foi possivel excluir o documento."));
  }

  revalidateDocuments(contract.client_id);
  return done();
}

/** Cliente envia o PDF assinado — validado no banco pelo RPC. */
export async function submitSignedDocumentAction(
  contractId: string,
  filePath: string,
): Promise<ActionResult<null>> {
  const actor = await requireClientActor();
  const supabase = await createClient();
  const locale = await getLocale();

  const { data: contract, error } = await supabase.rpc("submit_signed_contract", {
    p_contract_id: contractId,
    p_file_path: filePath,
  });

  if (error) {
    return fail(
      describeError(
        error,
        pickLocale(locale, "Nao foi possivel enviar o documento assinado.", "Could not submit the signed document."),
      ),
    );
  }

  revalidateDocuments();

  if (contract) {
    await logClientActivity(
      supabase,
      contract.client_id,
      actor.displayName,
      `Assinou o documento "${contract.title}"`,
    );

    const { professionalId, adminIds } = await resolveClientStaffIds(contract.client_id);
    const notice = {
      title: "Documento assinado recebido",
      body: `O cliente devolveu "${contract.title}" assinado.`,
      tag: `document-${contractId}`,
    };

    await Promise.all([
      professionalId
        ? sendPushToUsers([professionalId], {
            ...notice,
            url: `/professional/documents`,
          })
        : Promise.resolve(),
      adminIds.length > 0
        ? sendPushToUsers(adminIds, { ...notice, url: "/admin/documents" })
        : Promise.resolve(),
    ]).catch(() => {});
  }

  return done();
}
