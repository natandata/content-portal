import { NextResponse } from "next/server";

import { apifyConfig } from "@/lib/env";
import { fetchApifyRun, fetchDatasetItems } from "@/lib/apify/client";
import { createAdminClient } from "@/lib/supabase/server";
import { generateContentIdeas } from "@/server/content-ideas/generate";

/**
 * Webhook do Apify pra geracao de ideias de conteudo -- mesmo desenho de
 * `api/webhooks/apify/route.ts` (segredo colado na URL, a Apify nao assina
 * a entrega), mas cobre 2 runs por geracao (`kind=details` e `kind=posts`,
 * ver `runInstagramProfilesDetails`/`runInstagramProfilesPosts` em
 * `lib/apify/client.ts`) em vez de 1 relatorio = 1 run.
 *
 * So dispara a etapa de IA quando as DUAS colunas (`profiles_summary` e
 * `profiles_posts`) estiverem preenchidas -- a segunda entrega a chegar
 * completa a condicao e segue direto pra `generateContentIdeas`, sem um
 * terceiro mecanismo de disparo.
 *
 * ATENCAO: os nomes de campo lidos do dataset (`ownerUsername`, `username`,
 * `biography`, `caption`, `displayUrl` etc.) sao os documentados pelo ator
 * `apify/instagram-scraper`, mas nao foram confirmados ao vivo contra uma
 * run de verdade nesta sessao (sem output schema disponivel na API da
 * Apify) -- vale conferir contra o primeiro run real antes de confiar cegamente.
 */
export const runtime = "nodejs";

type AdminClient = ReturnType<typeof createAdminClient>;
type Kind = "details" | "posts";

export async function POST(request: Request) {
  const config = apifyConfig();
  if (!config) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const generationId = url.searchParams.get("generationId");
  const kind = url.searchParams.get("kind") as Kind | null;
  if (!token || token !== config.webhookSecret || !generationId || (kind !== "details" && kind !== "posts")) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: generation } = await admin
    .from("content_idea_generations")
    .select("id, status, profiles_summary, profiles_posts")
    .eq("id", generationId)
    .maybeSingle();

  if (!generation) return NextResponse.json({ error: "Geracao nao encontrada" }, { status: 404 });
  if (generation.status !== "scraping") {
    // Ja processado (reentrega da mesma notificacao) -- nada a fazer.
    return NextResponse.json({ received: true, duplicate: true });
  }

  const runIdColumn = kind === "details" ? "apify_details_run_id" : "apify_posts_run_id";
  const { data: withRunId } = await admin
    .from("content_idea_generations")
    .select(runIdColumn)
    .eq("id", generationId)
    .maybeSingle();
  const runId = (withRunId as Record<string, string | null> | null)?.[runIdColumn];
  if (!runId) return NextResponse.json({ error: "Run nao encontrado" }, { status: 404 });

  const runResult = await fetchApifyRun(runId);
  if (!runResult.ok) {
    await claimFailure(admin, generationId, runResult.error);
    return NextResponse.json({ error: runResult.error }, { status: 500 });
  }

  const { status, datasetId } = runResult.data;
  if (status !== "SUCCEEDED") {
    await claimFailure(admin, generationId, `A Apify reportou o run de ${kind} como ${status}.`);
    return NextResponse.json({ received: true });
  }
  if (!datasetId) {
    await claimFailure(admin, generationId, `Run de ${kind} concluido sem dataset de resultado.`);
    return NextResponse.json({ received: true });
  }

  const itemsResult = await fetchDatasetItems(datasetId);
  if (!itemsResult.ok) {
    await claimFailure(admin, generationId, itemsResult.error);
    return NextResponse.json({ error: itemsResult.error }, { status: 500 });
  }

  const items = itemsResult.data as Record<string, unknown>[];
  const grouped =
    kind === "details" ? groupByUsername(items, "username") : groupByUsername(items, "ownerUsername");

  const { error, data } = await admin
    .from("content_idea_generations")
    .update(kind === "details" ? { profiles_summary: grouped } : { profiles_posts: grouped })
    .eq("id", generationId)
    .eq("status", "scraping")
    .select("profiles_summary, profiles_posts")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "duplicate" }, { status: 200 });

  const bothDone = Boolean(data.profiles_summary) && Boolean(data.profiles_posts);
  if (!bothDone) return NextResponse.json({ received: true });

  const { error: analyzingError } = await admin
    .from("content_idea_generations")
    .update({ status: "analyzing" })
    .eq("id", generationId)
    .eq("status", "scraping");
  if (analyzingError) {
    return NextResponse.json({ error: analyzingError.message }, { status: 500 });
  }

  await generateContentIdeas(admin, generationId);

  return NextResponse.json({ received: true });
}

/** Agrupa itens crus do dataset por username -- 1 run cobre varios perfis de uma vez. */
function groupByUsername(items: Record<string, unknown>[], usernameField: string): Record<string, unknown> {
  const grouped: Record<string, unknown[]> = {};
  for (const item of items) {
    const username = item[usernameField];
    if (typeof username !== "string" || !username) continue;
    (grouped[username] ??= []).push(item);
  }

  // "details" tem 1 item por perfil -- desembrulha a lista de 1 pra ficar
  // {username: {...bio}} em vez de {username: [{...bio}]}.
  if (usernameField === "username") {
    return Object.fromEntries(Object.entries(grouped).map(([username, list]) => [username, list[0]]));
  }
  return grouped;
}

/** Guarda a transicao para 'failed' -- so aplica se a geracao ainda estiver 'scraping'. */
async function claimFailure(admin: AdminClient, generationId: string, message: string) {
  await admin
    .from("content_idea_generations")
    .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
    .eq("id", generationId)
    .eq("status", "scraping");
}
