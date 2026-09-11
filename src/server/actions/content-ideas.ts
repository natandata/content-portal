"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { runInstagramProfilesDetails, runInstagramProfilesPosts } from "@/lib/apify/client";
import { apifyConfig } from "@/lib/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { ContentIdeaGenerationRow } from "@/types/database";

/** Aceita "@usuario" ou "usuario" -- tira o @ e espacos, minusculo (Instagram nao diferencia caixa). */
function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

const createSchema = z.object({
  clientId: z.uuid(),
  clientUsername: z.string().trim().min(1, "Informe o perfil do cliente"),
  referenceUsernames: z
    .array(z.string().trim().min(1))
    .min(1, "Informe pelo menos 1 perfil de referencia")
    .max(5, "No maximo 5 perfis de referencia"),
});

/**
 * Cria a linha da geracao (sem o relatorio ainda -- o caminho do arquivo no
 * Storage inclui este id, entao o upload so acontece depois, ver
 * `attachContentIdeaReportAction`). Mesmo desenho em 2 passos de
 * `createDocumentAction`/`attachDocumentFileAction`.
 */
export async function startContentIdeaGenerationAction(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ id: string }>> {
  const actor = await requireStaff();

  if (!apifyConfig()) {
    return fail("Geracao de ideias por IA ainda nao foi configurada nesta instalacao (Apify).");
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error.issues, "Dados invalidos."));

  const clientUsername = normalizeUsername(parsed.data.clientUsername);
  const referenceUsernames = Array.from(
    new Set(parsed.data.referenceUsernames.map(normalizeUsername).filter(Boolean)),
  );
  if (referenceUsernames.length === 0) return fail("Informe pelo menos 1 perfil de referencia valido.");

  // `content_idea_generations` so tem policy de SELECT (mesmo padrao de
  // `instagram_public_reports`) -- confirma que o actor enxerga este
  // cliente pelo client RLS-limitado antes de escrever pela serviceRole,
  // senao qualquer staff logado poderia gerar ideias pra cliente alheio.
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id").eq("id", parsed.data.clientId).maybeSingle();
  if (!client) return fail("Cliente nao encontrado.");

  const admin = createAdminClient();
  const { data: generation, error } = await admin
    .from("content_idea_generations")
    .insert({
      client_id: parsed.data.clientId,
      requested_by: actor.authUser.id,
      client_username: clientUsername,
      reference_usernames: referenceUsernames,
    })
    .select("id")
    .single();

  if (error || !generation) {
    return fail(describeError(error, "Nao foi possivel iniciar a geracao."));
  }

  return ok({ id: generation.id });
}

/**
 * Recebe o caminho do relatorio ja enviado ao Storage (ou `null` -- o
 * relatorio e opcional, a IA trabalha so com os perfis quando ele falta),
 * dispara os 2 runs da Apify (bio + posts, cobrindo cliente + referencias de
 * uma vez) e marca `scraping`. O restante (analise por IA, criacao dos
 * rascunhos) acontece na rota de webhook quando os 2 runs voltarem
 * (`generateContentIdeas`).
 */
export async function attachContentIdeaReportAction(
  generationId: string,
  reportFilePath: string | null,
): Promise<ActionResult<null>> {
  await requireStaff();

  const admin = createAdminClient();
  const { data: generation } = await admin
    .from("content_idea_generations")
    .select("id, client_id, client_username, reference_usernames, status")
    .eq("id", generationId)
    .maybeSingle();

  if (!generation) return fail("Geracao nao encontrada.");
  if (generation.status !== "pending") return fail("Esta geracao ja foi iniciada.");

  const usernames = [generation.client_username, ...generation.reference_usernames];

  const [detailsRun, postsRun] = await Promise.all([
    runInstagramProfilesDetails(generationId, usernames),
    runInstagramProfilesPosts(generationId, usernames),
  ]);

  if (!detailsRun.ok || !postsRun.ok) {
    const message = !detailsRun.ok ? detailsRun.error : (postsRun as { ok: false; error: string }).error;
    await admin
      .from("content_idea_generations")
      .update({ report_file_path: reportFilePath, status: "failed", error: message, completed_at: new Date().toISOString() })
      .eq("id", generationId);
    return fail(`Nao foi possivel iniciar a leitura dos perfis: ${message}`);
  }

  const { error } = await admin
    .from("content_idea_generations")
    .update({
      report_file_path: reportFilePath,
      status: "scraping",
      apify_details_run_id: detailsRun.data.runId,
      apify_posts_run_id: postsRun.data.runId,
    })
    .eq("id", generationId);

  if (error) return fail(describeError(error, "Nao foi possivel salvar o relatorio."));

  revalidatePath(`/professional/clients/${generation.client_id}`);
  revalidatePath(`/admin/clients/${generation.client_id}`);

  return done();
}

/** Historico de geracoes do cliente -- mais recente primeiro. */
export async function loadContentIdeaGenerations(clientId: string): Promise<ContentIdeaGenerationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_idea_generations")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

/** Refaz uma geracao que falhou, com os mesmos perfis e o mesmo relatorio ja enviado. */
export async function retryContentIdeaGenerationAction(generationId: string): Promise<ActionResult<{ id: string }>> {
  await requireStaff();

  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("content_idea_generations")
    .select("client_id, client_username, reference_usernames, report_file_path")
    .eq("id", generationId)
    .maybeSingle();

  if (!previous) return fail("Geracao nao encontrada.");

  const started = await startContentIdeaGenerationAction({
    clientId: previous.client_id,
    clientUsername: previous.client_username,
    referenceUsernames: previous.reference_usernames,
  });
  if (!started.ok) return started;

  const attached = await attachContentIdeaReportAction(started.data.id, previous.report_file_path);
  if (!attached.ok) return attached;

  return ok({ id: started.data.id });
}
