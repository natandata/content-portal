"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { railwayTriggerConfig } from "@/lib/env";
import { triggerReferenceTranscribeWorker } from "@/lib/railway/client";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, type ActionResult } from "@/server/result";
import type { ClientReferenceTranscriptionRow } from "@/types/database";

const schema = z.object({
  clientId: z.uuid(),
  referenceIds: z.array(z.uuid()).min(1, "Selecione pelo menos 1 link"),
});

/**
 * Cria 1 linha `pending` por link escolhido e dispara o worker do Railway
 * uma unica vez (sem polling -- o worker le todas as linhas `pending` que
 * encontrar nessa execucao, entao um disparo so ja cobre o lote inteiro).
 */
export async function startReferenceTranscriptionAction(
  input: z.input<typeof schema>,
): Promise<ActionResult<null>> {
  const actor = await requireStaff();

  if (!railwayTriggerConfig()) {
    return fail("Transcricao ainda nao foi configurada nesta instalacao (Railway).");
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error.issues, "Dados invalidos."));

  // `client_reference_transcriptions` so tem policy de SELECT (mesmo padrao
  // de `instagram_public_reports`) -- confirma que o actor enxerga este
  // cliente pelo RLS antes de escrever pela serviceRole.
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id").eq("id", parsed.data.clientId).maybeSingle();
  if (!client) return fail("Cliente nao encontrado.");

  const { data: references } = await supabase
    .from("client_references")
    .select("id")
    .eq("client_id", parsed.data.clientId)
    .in("id", parsed.data.referenceIds);

  const validIds = new Set((references ?? []).map((r) => r.id));
  const referenceIds = parsed.data.referenceIds.filter((id) => validIds.has(id));
  if (referenceIds.length === 0) return fail("Nenhum dos links selecionados foi encontrado.");

  const admin = createAdminClient();
  const { error } = await admin.from("client_reference_transcriptions").insert(
    referenceIds.map((referenceId) => ({
      client_id: parsed.data.clientId,
      reference_id: referenceId,
      requested_by: actor.authUser.id,
    })),
  );

  if (error) return fail(describeError(error, "Nao foi possivel iniciar a transcricao."));

  const triggered = await triggerReferenceTranscribeWorker();
  if (!triggered.ok) {
    // As linhas ficam `pending` mesmo assim -- o proximo disparo bem
    // sucedido (ex.: "Tentar de novo" ou uma nova selecao) ainda as pega,
    // entao nao precisa desfazer o insert.
    return fail(`Linhas criadas, mas nao foi possivel iniciar o processamento: ${triggered.error}`);
  }

  revalidatePath(`/professional/clients/${parsed.data.clientId}`);
  revalidatePath(`/admin/clients/${parsed.data.clientId}`);

  return done();
}

/** Historico de transcricoes do cliente -- mais recente primeiro. */
export async function loadClientReferenceTranscriptions(
  clientId: string,
): Promise<ClientReferenceTranscriptionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_reference_transcriptions")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

/** Retoma linhas que falharam (volta pra `pending`) e dispara o worker de novo. */
export async function retryReferenceTranscriptionsAction(
  transcriptionIds: string[],
): Promise<ActionResult<null>> {
  await requireStaff();
  if (transcriptionIds.length === 0) return fail("Nada para tentar de novo.");

  if (!railwayTriggerConfig()) {
    return fail("Transcricao ainda nao foi configurada nesta instalacao (Railway).");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("client_reference_transcriptions")
    .update({ status: "pending", error: null })
    .in("id", transcriptionIds)
    .eq("status", "failed");

  if (error) return fail(describeError(error, "Nao foi possivel reiniciar a transcricao."));

  const triggered = await triggerReferenceTranscribeWorker();
  if (!triggered.ok) return fail(triggered.error);

  return done();
}
