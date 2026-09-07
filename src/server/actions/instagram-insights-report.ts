import "server-only";

import { callInstagramTool } from "@/lib/composio/client";
import { composioConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { describeError, fail, ok, type ActionResult } from "@/server/result";
import type { InstagramInsightsReportRow } from "@/types/database";

/**
 * Nao e uma server action ("use server") de proposito -- vive por tras da
 * rota `api/reports/instagram-insights` (que pode declarar `maxDuration`
 * maior; um modulo de action comum nao controla isso). Ver Etapa 4 do plano.
 */

const ACCOUNT_METRICS = [
  "reach",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "profile_views",
  "follower_count",
];

const MEDIA_METRICS = ["views", "reach", "saved", "likes", "comments", "shares", "total_interactions"];

// Cap deliberado -- ver "O que ainda nao foi observado" no plano: o tempo
// real de uma coleta com muitos posts nao foi medido ainda. Cada post exige
// uma chamada de insights a parte, entao 25 posts (o tamanho de pagina
// default da Graph API) com concorrencia limitada mantem isso dentro do
// `maxDuration` da rota mesmo no plano Hobby da Vercel. Cliente com mais
// posts que isso no periodo ve so os mais recentes -- nunca falha silencioso.
const MAX_POSTS = 25;
const INSIGHTS_CONCURRENCY = 5;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await fn(item);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** A Graph API embrulha listas em `{ data: [...] }` -- extrai defensivamente, sem supor a forma exata. */
function extractArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: Record<string, unknown>[] }).data;
  }
  return [];
}

export async function runInstagramInsightsReport(params: {
  clientId: string;
  periodMonths: 3 | 6 | 9;
  requestedBy: string;
}): Promise<ActionResult<InstagramInsightsReportRow>> {
  const config = composioConfig();
  if (!config) return fail("Insights do Instagram ainda nao foram configurados nesta instalacao.");

  const admin = createAdminClient();

  const { data: connection } = await admin
    .from("client_instagram_connections")
    .select("client_id")
    .eq("client_id", params.clientId)
    .maybeSingle();
  if (!connection) return fail("Conecte o Instagram do cliente antes de gerar este relatorio.");

  const until = new Date();
  const since = new Date(until);
  since.setMonth(since.getMonth() - params.periodMonths);
  const sinceTs = Math.floor(since.getTime() / 1000);
  const untilTs = Math.floor(until.getTime() / 1000);

  const { data: report, error: insertError } = await admin
    .from("instagram_insights_reports")
    .insert({
      client_id: params.clientId,
      period_months: params.periodMonths,
      status: "running",
      requested_by: params.requestedBy,
    })
    .select("*")
    .single();

  if (insertError || !report) {
    return fail(describeError(insertError, "Nao foi possivel criar o relatorio."));
  }
  const reportId = report.id;

  async function markFailed(message: string) {
    await admin
      .from("instagram_insights_reports")
      .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
      .eq("id", reportId);
  }

  const accountResult = await callInstagramTool(params.clientId, "INSTAGRAM_GET_USER_INSIGHTS", {
    since: sinceTs,
    until: untilTs,
    period: "day",
    metric: ACCOUNT_METRICS,
  });
  if (!accountResult.ok) {
    await markFailed(accountResult.error);
    return fail(accountResult.error);
  }

  const mediaResult = await callInstagramTool(params.clientId, "INSTAGRAM_GET_IG_USER_MEDIA", {
    ig_user_id: "me",
    since: sinceTs,
    until: untilTs,
    limit: MAX_POSTS,
  });
  if (!mediaResult.ok) {
    await markFailed(mediaResult.error);
    return fail(mediaResult.error);
  }

  const mediaList = extractArray(mediaResult.data);

  const postsWithInsights = await mapWithConcurrency(mediaList, INSIGHTS_CONCURRENCY, async (post) => {
    const mediaId = typeof post.id === "string" ? post.id : null;
    if (!mediaId) return post;

    const insightsResult = await callInstagramTool(params.clientId, "INSTAGRAM_GET_IG_MEDIA_INSIGHTS", {
      ig_media_id: mediaId,
      metric: MEDIA_METRICS,
    });

    // Um post individual falhar (ex.: media fora da janela de 2 anos) nao
    // derruba o relatorio inteiro -- ele so aparece sem as metricas extras.
    return { ...post, insights: insightsResult.ok ? extractArray(insightsResult.data) : null };
  });

  const { data: updated, error: updateError } = await admin
    .from("instagram_insights_reports")
    .update({
      status: "done",
      account_metrics: accountResult.data,
      posts: postsWithInsights,
      completed_at: new Date().toISOString(),
    })
    .eq("id", report.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return fail(describeError(updateError, "Relatorio coletado, mas houve falha ao salvar."));
  }

  return ok(updated);
}
