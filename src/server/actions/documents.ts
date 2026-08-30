"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireClientActor, requireStaff } from "@/lib/auth";
import { BUCKETS } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { ContractRow, ContractStatus } from "@/types/database";

const createSchema = z.object({
  clientId: z.uuid("Selecione um cliente"),
  title: z.string().trim().min(2, "Informe o nome do documento"),
  notes: z.string().trim().max(1000).optional(),
  kind: z.enum(["contract", "strategy", "brandbook", "mockup", "other"]),
  requiresSignature: z.boolean(),
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
    .select("requires_signature")
    .eq("id", contractId)
    .maybeSingle();

  const status: ContractStatus = document?.requires_signature === false
    ? "delivered"
    : "awaiting_signature";

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
  await requireClientActor();
  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_signed_contract", {
    p_contract_id: contractId,
    p_file_path: filePath,
  });

  if (error) {
    return fail(describeError(error, "Nao foi possivel enviar o documento assinado."));
  }

  revalidateDocuments();
  return done();
}
