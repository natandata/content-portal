import "server-only";

import { callInstagramTool } from "@/lib/composio/client";
import { composioConfig } from "@/lib/env";
import { num } from "@/lib/instagram-insights";
import { createAdminClient } from "@/lib/supabase/admin";
import { logClientActivity } from "@/server/activity";
import { deliverInstagramInsightsReportPdf } from "@/server/reports/instagram-report-delivery";
import { describeError, fail, ok, type ActionResult } from "@/server/result";
import type { InstagramInsightsReportRow } from "@/types/database";

/**
 * Nao e uma server action ("use server") de proposito -- vive por tras da
 * rota `api/reports/instagram-insights` (que pode declarar `maxDuration`
 * maior; um modulo de action comum nao controla isso). Ver Etapa 4 do plano.
 */

// So estas duas continuam com serie diaria de verdade (`period=day`) na
// Graph API -- confirmado ao vivo (2026-09-08): todo o resto de engajamento
// (likes/comments/etc) devolve vazio nesse modo, mesmo aparecendo como
// valido no schema da ferramenta. E' por isso que o relatorio mostrava
// zero em quase tudo antes desta correcao.
const ACCOUNT_METRICS_DAY = ["reach", "follower_count"];

// A Meta migrou essas metricas de engajamento pra so existirem via
// `metric_type=total_value` (um total pro periodo inteiro, sem serie
// diaria) -- confirmado ao vivo com numeros reais da conta conectada.
// `since`/`until` continuam valendo pra escopar o total ao periodo do
// relatorio (tambem confirmado ao vivo, comparando janelas diferentes).
const ACCOUNT_METRICS_TOTAL = [
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
];

const MEDIA_METRICS = ["views", "reach", "saved", "likes", "comments", "shares", "total_interactions"];

// So existem pra Reels -- pedir pra qualquer outro tipo de midia (foto,
// carrossel) derruba a chamada INTEIRA com erro 400 (confirmado ao vivo),
// entao isso e sempre uma segunda chamada separada, so quando o post e um
// Reel (ver `mapWithConcurrency` abaixo). `reels_skip_rate` (% que abandonou
// nos 3s iniciais) e a metrica mais proxima de "retencao" que a Graph API
// oferece -- ela nao expõe a curva de retencao completa.
const REEL_RETENTION_METRICS = ["ig_reels_avg_watch_time", "ig_reels_video_view_total_time", "reels_skip_rate"];

// Campos explicitos (em vez do default da ferramenta) -- precisa de
// `media_product_type` pra saber quais posts sao Reels (decide se pede
// REEL_RETENTION_METRICS), o resto e so o que os parsers de fato leem.
const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,permalink,timestamp,total_like_count,total_comments_count,saved_count";

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
    .select("composio_connection_id, instagram_username")
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
      instagram_username: connection.instagram_username,
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

  // Chamada critica -- reach/follower_count sao o minimo pro relatorio
  // fazer sentido; se isso falhar, o relatorio falha (mesmo comportamento
  // de antes desta correcao).
  const accountDayResult = await callInstagramTool(params.clientId, connectedAccountId, "INSTAGRAM_GET_USER_INSIGHTS", {
    since: sinceTs,
    until: untilTs,
    period: "day",
    metric: ACCOUNT_METRICS_DAY,
  });
  if (!accountDayResult.ok) {
    await markFailed(accountDayResult.error);
    return fail(accountDayResult.error);
  }

  // Melhor esforco -- engajamento agregado e "bonus" sobre o essencial
  // acima; uma falha aqui nunca deve derrubar o relatorio inteiro.
  const accountTotalResult = await callInstagramTool(params.clientId, connectedAccountId, "INSTAGRAM_GET_USER_INSIGHTS", {
    since: sinceTs,
    until: untilTs,
    metric_type: "total_value",
    metric: ACCOUNT_METRICS_TOTAL,
  });

  const accountMetrics = {
    data: [...extractArray(accountDayResult.data), ...(accountTotalResult.ok ? extractArray(accountTotalResult.data) : [])],
  };

  // Snapshot real "agora" (followers_count/follows_count/media_count) --
  // NAO e o mesmo que `follower_count` acima (que e o crescimento LIQUIDO no
  // periodo, nao o total da conta). Melhor esforco: sem isso o relatorio
  // so perde essa comparacao, nunca falha por causa dela.
  const profileResult = await callInstagramTool(params.clientId, connectedAccountId, "INSTAGRAM_GET_USER_INFO", {
    ig_user_id: "me",
  });
  const profileSnapshot = profileResult.ok
    ? {
        followers_count: num(profileResult.data.followers_count),
        follows_count: num(profileResult.data.follows_count),
        media_count: num(profileResult.data.media_count),
      }
    : null;

  const mediaResult = await callInstagramTool(params.clientId, connectedAccountId, "INSTAGRAM_GET_IG_USER_MEDIA", {
    ig_user_id: "me",
    since: sinceTs,
    until: untilTs,
    limit: MAX_POSTS,
    fields: MEDIA_FIELDS,
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
    if (!insightsResult.ok) return { ...post, insights: null };
    const baseInsights = extractArray(insightsResult.data);

    // Retencao so existe pra Reels -- pedir pra outro tipo de midia derruba
    // a chamada com 400 (ver comentario de REEL_RETENTION_METRICS acima),
    // entao so tenta quando o post e' de fato um Reel, e melhor-esforco
    // (uma falha aqui nunca derruba os insights base ja obtidos).
    const isReel = post.media_product_type === "REELS";
    const reelInsightsResult = isReel
      ? await callInstagramTool(params.clientId, connectedAccountId, "INSTAGRAM_GET_IG_MEDIA_INSIGHTS", {
          ig_media_id: mediaId,
          metric: REEL_RETENTION_METRICS,
        })
      : null;

    return {
      ...post,
      insights: reelInsightsResult?.ok ? [...baseInsights, ...extractArray(reelInsightsResult.data)] : baseInsights,
    };
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
      account_metrics: accountMetrics,
      posts: postsWithInsights,
      stories: storiesWithInsights,
      audience: Object.keys(audience).length > 0 ? audience : null,
      profile_snapshot: profileSnapshot,
      completed_at: new Date().toISOString(),
    })
    .eq("id", report.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return fail(describeError(updateError, "Relatorio coletado, mas houve falha ao salvar."));
  }

  // Melhor esforco -- se ninguem pediu (cron automatico), atribui ao
  // "Automatico" em vez de buscar um nome que nao existe.
  const requesterName = params.requestedBy
    ? ((await admin.from("users").select("name").eq("id", params.requestedBy).maybeSingle()).data?.name ??
      "Equipe")
    : "Relatorio automatico";
  await logClientActivity(
    admin,
    params.clientId,
    requesterName,
    `Emitiu relatorio de Instagram (${params.periodMonths} meses)${updated.instagram_username ? ` de @${updated.instagram_username}` : ""}`,
  );

  // Melhor esforco -- entrega o PDF em Documentos, mas o relatorio ja esta
  // salvo e visivel na tela mesmo se isso falhar (ver comentario da funcao).
  await deliverInstagramInsightsReportPdf({
    clientId: params.clientId,
    report: updated,
    requestedBy: params.requestedBy,
  });

  return ok(updated);
}
