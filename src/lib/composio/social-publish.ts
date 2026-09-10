import "server-only";

import { callComposioTool, uploadFileToComposio } from "@/lib/composio/client";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Publicacao nas redes alem do Instagram (que tem seu proprio modulo,
 * `composio/instagram-publish.ts`). Cada rede tem seu proprio formato de
 * entrada -- confirmado ao vivo via COMPOSIO_GET_TOOL_SCHEMAS antes de
 * codar (2026-09-10):
 *
 * - TikTok: `TIKTOK_PUBLISH_VIDEO` aceita `video_url` direto (like o
 *   Instagram) -- sem roundtrip de upload. So permite `SELF_ONLY` em apps
 *   nao auditados pela TikTok (ver `publishToTikTok`).
 * - Facebook: `FACEBOOK_CREATE_PHOTO_POST` aceita `url` direto, mas precisa
 *   do `page_id` (a conexao OAuth e da conta pessoal, nao da Page).
 * - LinkedIn: `LINKEDIN_CREATE_LINKED_IN_POST` exige as imagens no formato
 *   `{name,mimetype,s3key}` -- sem opcao de URL direta -- por isso passa
 *   por `uploadFileToComposio` primeiro.
 * - Pinterest: `PINTEREST_CREATE_PIN` aceita `image_url` direto, precisa de
 *   `board_id` (escolhido na conexao via `PINTEREST_LIST_BOARDS`).
 * - YouTube: `YOUTUBE_UPLOAD_VIDEO` exige o video no mesmo formato
 *   `{name,mimetype,s3key}` do LinkedIn -- mesmo roundtrip de upload.
 */

export async function publishToTikTok(
  clientId: string,
  connectionId: string,
  params: { videoUrl: string; caption: string | null },
): Promise<Result<{ publishId: string }>> {
  const result = await callComposioTool(clientId, connectionId, "TIKTOK_PUBLISH_VIDEO", {
    video_url: params.videoUrl,
    caption: params.caption ?? undefined,
    // So SELF_ONLY e permitido pra apps que a TikTok ainda nao auditou --
    // e o unico valor que nao lanca erro de permissao logo de cara.
    // Publico exige o app passar pela revisao da TikTok (fora do escopo
    // desta v1) e a conta trocar pra esse nivel via creator_info/query.
    privacy_level: "SELF_ONLY",
  });
  if (!result.ok) return result;

  const publishId = (result.data as { publish_id?: string }).publish_id;
  if (!publishId) return { ok: false, error: "TikTok nao devolveu um publish_id." };
  return { ok: true, data: { publishId } };
}

export async function getTikTokPublishStatus(
  clientId: string,
  connectionId: string,
  publishId: string,
): Promise<Result<{ status: string; failReason: string | null }>> {
  const result = await callComposioTool(clientId, connectionId, "TIKTOK_FETCH_PUBLISH_STATUS", {
    publish_id: publishId,
  });
  if (!result.ok) return result;

  const data = result.data as { status?: string; fail_reason?: string };
  return { ok: true, data: { status: data.status ?? "UNKNOWN", failReason: data.fail_reason ?? null } };
}

export async function publishToFacebook(
  clientId: string,
  connectionId: string,
  params: { pageId: string; imageUrl: string; caption: string | null },
): Promise<Result<{ postId: string }>> {
  const result = await callComposioTool(clientId, connectionId, "FACEBOOK_CREATE_PHOTO_POST", {
    page_id: params.pageId,
    url: params.imageUrl,
    message: params.caption ?? undefined,
  });
  if (!result.ok) return result;

  const postId = (result.data as { post_id?: string; id?: string }).post_id ?? (result.data as { id?: string }).id;
  if (!postId) return { ok: false, error: "Facebook nao devolveu o id do post." };
  return { ok: true, data: { postId } };
}

export async function listFacebookPages(
  clientId: string,
  connectionId: string,
): Promise<Result<{ id: string; name: string }[]>> {
  const result = await callComposioTool(clientId, connectionId, "FACEBOOK_LIST_MANAGED_PAGES", {});
  if (!result.ok) return result;

  const data = result.data as { data?: { id?: string; name?: string }[] };
  const pages = (data.data ?? [])
    .filter((page): page is { id: string; name: string } => Boolean(page.id && page.name));
  return { ok: true, data: pages };
}

export async function publishToLinkedIn(
  clientId: string,
  connectionId: string,
  params: { authorUrn: string; imageUrl: string; caption: string | null },
): Promise<Result<{ postUrn: string }>> {
  const upload = await uploadFileToComposio(params.imageUrl, "LINKEDIN_CREATE_LINKED_IN_POST", "LINKEDIN");
  if (!upload.ok) return upload;

  const result = await callComposioTool(clientId, connectionId, "LINKEDIN_CREATE_LINKED_IN_POST", {
    author: params.authorUrn,
    commentary: params.caption ?? "",
    images: [upload.data],
  });
  if (!result.ok) return result;

  const postUrn = (result.data as { id?: string }).id;
  if (!postUrn) return { ok: false, error: "LinkedIn nao devolveu o id do post." };
  return { ok: true, data: { postUrn } };
}

export async function getLinkedInAuthor(
  clientId: string,
  connectionId: string,
): Promise<Result<{ urn: string; name: string }>> {
  const result = await callComposioTool(clientId, connectionId, "LINKEDIN_GET_MY_INFO", {});
  if (!result.ok) return result;

  const data = result.data as { sub?: string; name?: string };
  if (!data.sub) return { ok: false, error: "LinkedIn nao devolveu o id do perfil." };
  return { ok: true, data: { urn: `urn:li:person:${data.sub}`, name: data.name ?? "Perfil do LinkedIn" } };
}

export async function publishToPinterest(
  clientId: string,
  connectionId: string,
  params: { boardId: string; imageUrl: string; title: string | null; description: string | null },
): Promise<Result<{ pinId: string }>> {
  const result = await callComposioTool(clientId, connectionId, "PINTEREST_CREATE_PIN", {
    board_id: params.boardId,
    title: params.title ?? undefined,
    description: params.description ?? undefined,
    media_source: { source_type: "image_url", url: params.imageUrl },
  });
  if (!result.ok) return result;

  const pinId = (result.data as { id?: string }).id;
  if (!pinId) return { ok: false, error: "Pinterest nao devolveu o id do pin." };
  return { ok: true, data: { pinId } };
}

export async function listPinterestBoards(
  clientId: string,
  connectionId: string,
): Promise<Result<{ id: string; name: string }[]>> {
  const result = await callComposioTool(clientId, connectionId, "PINTEREST_LIST_BOARDS", { privacy: "ALL" });
  if (!result.ok) return result;

  const data = result.data as { items?: { id?: string; name?: string }[] };
  const boards = (data.items ?? [])
    .filter((board): board is { id: string; name: string } => Boolean(board.id && board.name));
  return { ok: true, data: boards };
}

export async function publishToYoutube(
  clientId: string,
  connectionId: string,
  params: { videoUrl: string; title: string; description: string | null },
): Promise<Result<{ videoId: string }>> {
  const upload = await uploadFileToComposio(params.videoUrl, "YOUTUBE_UPLOAD_VIDEO", "YOUTUBE");
  if (!upload.ok) return upload;

  const result = await callComposioTool(clientId, connectionId, "YOUTUBE_UPLOAD_VIDEO", {
    title: params.title.slice(0, 100),
    description: params.description ?? "",
    tags: [],
    categoryId: "22", // "People & Blogs" -- categoria generica, sem opcao melhor sem contexto do nicho do cliente
    privacyStatus: "public",
    videoFilePath: upload.data,
  });
  if (!result.ok) return result;

  const videoId = (result.data as { id?: string }).id;
  if (!videoId) return { ok: false, error: "YouTube nao devolveu o id do video." };
  return { ok: true, data: { videoId } };
}
