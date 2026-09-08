import "server-only";

import { callInstagramTool } from "@/lib/composio/client";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Publicacao direta no Instagram (feed/carrossel, v1 -- Reels/Stories ficam
 * pra uma fase 2 de proposito). Usa o mesmo `callInstagramTool` generico ja
 * usado pelos relatorios de insights, so que com os tools de escrita da
 * Graph API em vez dos de leitura.
 *
 * Confirmado ao vivo via Composio (COMPOSIO_SEARCH_TOOLS/GET_TOOL_SCHEMAS)
 * antes de implementar: `INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH` ja espera
 * internamente ate o container ficar `FINISHED` -- nao precisa de polling
 * proprio. `INSTAGRAM_CREATE_CAROUSEL_CONTAINER` aceita URLs de imagem
 * direto (`child_image_urls`), sem precisar criar um container por filho
 * antes. `ig_user_id: "me"` funciona igual aos tools de leitura ja usados
 * (mesmo padrao de `instagram-insights-report.ts`).
 *
 * A Meta pede `#` como `%23` na legenda do endpoint de imagem unica --
 * aplicamos o mesmo encoding no carrossel por seguranca (nunca confirmado
 * se o carrossel precisa, mas decodificar de volta e' inofensivo se nao
 * precisar).
 */
function encodeCaption(caption: string | null): string | undefined {
  if (!caption) return undefined;
  return caption.replace(/#/g, "%23");
}

/** Cria o container de uma imagem unica de feed. Devolve o `creation_id`. */
export async function createFeedMediaContainer(
  clientId: string,
  connectedAccountId: string,
  params: { imageUrl: string; caption: string | null },
): Promise<Result<{ creationId: string }>> {
  const result = await callInstagramTool(clientId, connectedAccountId, "INSTAGRAM_POST_IG_USER_MEDIA", {
    ig_user_id: "me",
    image_url: params.imageUrl,
    caption: encodeCaption(params.caption),
  });
  if (!result.ok) return result;

  const creationId = str(result.data.id);
  if (!creationId) return { ok: false, error: "A Meta nao devolveu o id do container criado." };
  return { ok: true, data: { creationId } };
}

/** Cria o container de um carrossel (2-10 imagens) direto a partir das URLs -- sem etapa de container filho por filho. */
export async function createCarouselContainer(
  clientId: string,
  connectedAccountId: string,
  params: { imageUrls: string[]; caption: string | null },
): Promise<Result<{ creationId: string }>> {
  const result = await callInstagramTool(clientId, connectedAccountId, "INSTAGRAM_CREATE_CAROUSEL_CONTAINER", {
    ig_user_id: "me",
    child_image_urls: params.imageUrls,
    caption: encodeCaption(params.caption),
  });
  if (!result.ok) return result;

  const creationId = str(result.data.id);
  if (!creationId) return { ok: false, error: "A Meta nao devolveu o id do container criado." };
  return { ok: true, data: { creationId } };
}

/** Publica um container ja criado -- espera internamente ate FINISHED (imagem e quase instantaneo). */
export async function publishContainer(
  clientId: string,
  connectedAccountId: string,
  creationId: string,
): Promise<Result<{ mediaId: string }>> {
  const result = await callInstagramTool(clientId, connectedAccountId, "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH", {
    ig_user_id: "me",
    creation_id: creationId,
    max_wait_seconds: 60,
  });
  if (!result.ok) return result;

  const mediaId = str(result.data.id);
  if (!mediaId) return { ok: false, error: "A Meta nao confirmou a publicacao." };
  return { ok: true, data: { mediaId } };
}

/**
 * Cota de publicacao das ultimas 24h -- checar antes de um lote (cron) evita
 * estourar o limite no meio do processamento. Leitura defensiva: o formato
 * exato de `{data:[{quota_usage, config:{quota_total}}]}` nunca foi
 * observado contra uma resposta real desta conta (a conta de teste nunca
 * publicou o suficiente pra aproximar do limite) -- se o parsing falhar,
 * devolve `null` em vez de quebrar, e o chamador trata "sem info de cota"
 * como "segue publicando" (nunca bloqueia por falta de dado).
 */
export async function getPublishingLimit(
  clientId: string,
  connectedAccountId: string,
): Promise<Result<{ quotaUsage: number | null; quotaTotal: number | null }>> {
  const result = await callInstagramTool(
    clientId,
    connectedAccountId,
    "INSTAGRAM_GET_IG_USER_CONTENT_PUBLISHING_LIMIT",
    { ig_user_id: "me" },
  );
  if (!result.ok) return result;

  const entry = (Array.isArray(result.data.data) ? result.data.data[0] : null) as
    | { quota_usage?: unknown; config?: { quota_total?: unknown } }
    | null;
  const quotaUsage = typeof entry?.quota_usage === "number" ? entry.quota_usage : null;
  const quotaTotal = typeof entry?.config?.quota_total === "number" ? entry.config.quota_total : null;
  return { ok: true, data: { quotaUsage, quotaTotal } };
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
