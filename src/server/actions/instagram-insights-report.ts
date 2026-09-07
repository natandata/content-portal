import "server-only";

import { callInstagramTool } from "@/lib/composio/client";
import { composioConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { deliverInstagramInsightsReportPdf } from "@/server/reports/instagram-report-delivery";
import { describeError, fail, ok, type ActionResult } from "@/server/result";
import type { InstagramInsightsReportRow } from "@/types/database";

/**
 * Nao e uma server action ("use server") de proposito -- vive por tras da
 * rota `api/reports/instagram-insights` (que pode declarar `maxDuration`
 * maior; um modulo de action comum nao controla isso). Ver Etapa 4 do plano.
 */

// O mais completo possivel dentre as metricas de conta validas (ver
// INSTAGRAM_GET_USER_INSIGHTS) -- fica de fora so o que e de outra
// plataforma (threads_*) ou pede parametro extra incompativel com uma
// serie temporal (online_followers quebra por hora do dia, nao por dia).
const ACCOUNT_METRICS = [
  "reach",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "replies",
  "follows_and_unfollows",
  "profile_links_taps",
  "views",
  "profile_views",
  "website_clicks",
  "follower_count",
];

const MEDIA_METRICS = ["views", "reach", "saved", "likes", "comments", "shares", "total_interactions"];

// Metricas proprias de Stories -- a Meta rejeita a maioria das metricas de
// post normais quando o media e um story (ver known_pitfalls da propria API).
const STORY_METRICS = ["views", "reach", "replies", "navigation", "profile_visits", "follows", "link_clicks"];

// A Meta so libera demografia como "agora" (this_week/this_month), nunca
// para um periodo historico -- por isso mora fora da janela do relatorio.
// Uma chamada por dimensao: a API aceita so um `breakdown` por vez.
const AUDIENCE_BREAKDOWNS = ["age", "gender", "city", "country"] as const;

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
  connectionId: string;
  periodMonths: 3 | 6 | 9;
  requestedBy: string | null;
}): Promise<ActionResult<InstagramInsightsReportRow>> {
  const config = composioConfig();
  if (!config) return fail("Insights do Instagram ainda nao foram configurados nesta instalacao.");

  const admin = createAdminClient();

  const { data: connection } = await admin
    .from("client_instagram_connections")
    .select("composio_connection_id")
    .eq("id", params.connectionId)
    .eq("client_id", params.clientId)
    .maybeSingle();
  if (!connection) return fail("Conecte o Instagram do cliente antes de gerar este relatorio.");
  const connectedAccountId = connection.composio_connection_id;

  const until = new Date();
  const since = new Date(until);
  since.setMonth(since.getMonth() - params.periodMonths);
  const sinceTs = Math.floor(since.getTime() / 1000);
  const untilTs = Math.floor(until.getTime() / 1000);

  const { data: report, error: insertError } = await admin
    .from("instagram_insights_reports")
    .insert({
      client_id: params.clientId,
      connection_id: params.connectionId,
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

  const accountResult = await callInstagramTool(params.clientId, connectedAccountId, "INSTAGRAM_GET_USER_INSIGHTS", {
    since: sinceTs,
    until: untilTs,
    period: "day",
    metric: ACCOUNT_METRICS,
  });
  if (!accountResult.ok) {
    await markFailed(accountResult.error);
    return fail(accountResult.error);
  }

  const mediaResult = await callInstagramTool(params.clientId, connectedAccountId, "INSTAGRAM_GET_IG_USER_MEDIA", {
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

    const insightsResult = await callInstagramTool(params.clientId, connectedAccountId, "INSTAGRAM_GET_IG_MEDIA_INSIGHTS", {
      ig_media_id: mediaId,
      metric: MEDIA_METRICS,
    });

    // Um post individual falhar (ex.: media fora da janela de 2 anos) nao
    // derruba o relatorio inteiro -- ele so aparece sem as metricas extras.
    return { ...post, insights: insightsResult.ok ? extractArray(insightsResult.data) : null };
  });

  // Stories e demografia sao melhor-esforco puro: nenhuma falha aqui deve
  // impedir o relatorio de fechar com o que ja foi coletado ate agora.
  const storiesResult = await callInstagramTool(params.clientId, connectedAccountId, "INSTAGRAM_GET_IG_USER_STORIES", {
    ig_user_id: "me",
  });
  const activeStories = storiesResult.ok ? extractArray(storiesResult.data) : [];

  const storiesWithInsights = await mapWithConcurrency(activeStories, INSIGHTS_CONCURRENCY, async (story) => {
    const storyId = typeof story.id === "string" ? story.id : null;
    if (!storyId) return story;

    const insightsResult = await callInstagramTool(params.clientId, connectedAccountId, "INSTAGRAM_GET_IG_MEDIA_INSIGHTS", {
      ig_media_id: storyId,
      metric: STORY_METRICS,
    });
    return { ...story, insights: insightsResult.ok ? extractArray(insightsResult.data) : null };
  });

  const audienceEntries = await Promise.all(
    AUDIENCE_BREAKDOWNS.map(async (breakdown) => {
      const result = await callInstagramTool(params.clientId, connectedAccountId, "INSTAGRAM_GET_USER_INSIGHTS", {
        metric: ["follower_demographics"],
        metric_type: "total_value",
        timeframe: "this_month",
        breakdown,
      });
      return [breakdown, result.ok ? result.data : null] as const;
    }),
  );
  const audience = Object.fromEntries(audienceEntries.filter(([, value]) => value !== null));

  const { data: updated, error: updateError } = await admin
    .from("instagram_insights_reports")
    .update({
      status: "done",
      account_metrics: accountResult.data,
      posts: postsWithInsights,
      stories: storiesWithInsights,
      audience: Object.keys(audience).length > 0 ? audience : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", report.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return fail(describeError(updateError, "Relatorio coletado, mas houve falha ao salvar."));
  }

  // Melhor esforco -- entrega o PDF em Documentos, mas o relatorio ja esta
  // salvo e visivel na tela mesmo se isso falhar (ver comentario da funcao).
  await deliverInstagramInsightsReportPdf({
    clientId: params.clientId,
    report: updated,
    requestedBy: params.requestedBy,
  });

  return ok(updated);
}
