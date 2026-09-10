import "server-only";

import {
  listFacebookPages,
  listPinterestBoards,
  publishToFacebook,
  publishToLinkedIn,
  publishToPinterest,
  publishToTikTok,
  publishToYoutube,
} from "@/lib/composio/social-publish";
import { BUCKETS } from "@/lib/paths";
import { signedUrl } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { logClientActivity } from "@/server/activity";
import type { SocialPlatform } from "@/types/database";

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  pinterest: "Pinterest",
  youtube: "YouTube",
};

/**
 * Publica um conteudo numa rede alem do Instagram (que tem seu proprio
 * `server/instagram/run-publish.ts`). Mesmo espirito: flip atomico de
 * status na mesma query que le o estado, pra nunca publicar duas vezes por
 * corrida entre clique e cron.
 */
export async function runSocialPublish(
  contentId: string,
  platform: SocialPlatform,
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data: content } = await admin.from("contents").select("*").eq("id", contentId).maybeSingle();
  if (!content) return { ok: false, error: "Conteudo nao encontrado." };
  if (content.status !== "approved") return { ok: false, error: "So e possivel publicar um conteudo aprovado." };

  const { data: target } = await admin
    .from("content_publish_targets")
    .select("*")
    .eq("content_id", contentId)
    .eq("platform", platform)
    .maybeSingle();
  if (!target) return { ok: false, error: `Nenhum destino de ${PLATFORM_LABEL[platform]} configurado pra este conteudo.` };

  const { data: connection } = await admin
    .from("client_social_connections")
    .select("*")
    .eq("id", target.connection_id)
    .maybeSingle();
  if (!connection) return { ok: false, error: "Conexao nao encontrada." };

  const { data: files } = await admin
    .from("content_files")
    .select("*")
    .eq("content_id", contentId)
    .order("position");
  const filesList = files ?? [];
  if (filesList.length === 0) return { ok: false, error: "Este conteudo nao tem nenhum arquivo." };

  // Flip atomico -- so segue se ainda nao foi reivindicado por outra chamada.
  const { data: claimed } = await admin
    .from("content_publish_targets")
    .update({ status: "publishing", error: null })
    .eq("id", target.id)
    .in("status", ["idle", "scheduled"])
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, error: "Publicacao ja em andamento ou concluida." };

  const targetId = target.id;
  async function markFailed(message: string) {
    await admin.from("content_publish_targets").update({ status: "failed", error: message }).eq("id", targetId);
    return { ok: false, error: message };
  }

  const firstFile = filesList[0]!;
  if (!firstFile.file_path) return await markFailed("Arquivo sem caminho valido.");
  const fileUrl = await signedUrl(admin, BUCKETS.content, firstFile.file_path);
  if (!fileUrl) return await markFailed("Nao foi possivel gerar o link do arquivo.");

  const platformData = connection.platform_data as Record<string, unknown>;
  let externalRef: string | null = null;

  if (platform === "tiktok") {
    const result = await publishToTikTok(content.client_id, connection.composio_connection_id, {
      videoUrl: fileUrl,
      caption: content.caption,
    });
    if (!result.ok) return await markFailed(result.error);
    externalRef = result.data.publishId;
    // TikTok processa de forma assincrona -- o publish_id fica salvo, mas o
    // status so vira "published" quando o cron de reconciliamento confirmar
    // via TIKTOK_FETCH_PUBLISH_STATUS (ver worker/jobs futuro). Por ora fica
    // "publishing" com o publish_id guardado.
    await admin.from("content_publish_targets").update({ external_ref: externalRef }).eq("id", target.id);
    return { ok: true };
  }

  if (platform === "facebook") {
    const pageId = platformData.pageId as string | undefined;
    if (!pageId) return await markFailed("Nenhuma Page do Facebook escolhida na conexao.");
    const result = await publishToFacebook(content.client_id, connection.composio_connection_id, {
      pageId,
      imageUrl: fileUrl,
      caption: content.caption,
    });
    if (!result.ok) return await markFailed(result.error);
    externalRef = result.data.postId;
  } else if (platform === "linkedin") {
    const authorUrn = platformData.authorUrn as string | undefined;
    if (!authorUrn) return await markFailed("Conexao do LinkedIn sem autor identificado.");
    const result = await publishToLinkedIn(content.client_id, connection.composio_connection_id, {
      authorUrn,
      imageUrl: fileUrl,
      caption: content.caption,
    });
    if (!result.ok) return await markFailed(result.error);
    externalRef = result.data.postUrn;
  } else if (platform === "pinterest") {
    const boardId = platformData.boardId as string | undefined;
    if (!boardId) return await markFailed("Nenhum board do Pinterest escolhido na conexao.");
    const result = await publishToPinterest(content.client_id, connection.composio_connection_id, {
      boardId,
      imageUrl: fileUrl,
      title: content.title,
      description: content.caption,
    });
    if (!result.ok) return await markFailed(result.error);
    externalRef = result.data.pinId;
  } else if (platform === "youtube") {
    const result = await publishToYoutube(content.client_id, connection.composio_connection_id, {
      videoUrl: fileUrl,
      title: content.title,
      description: content.caption,
    });
    if (!result.ok) return await markFailed(result.error);
    externalRef = result.data.videoId;
  }

  await admin
    .from("content_publish_targets")
    .update({ status: "published", external_ref: externalRef, published_at: new Date().toISOString() })
    .eq("id", target.id);

  await logClientActivity(
    admin,
    content.client_id,
    "Publicacao automatica",
    `Publicou "${content.title}" no ${PLATFORM_LABEL[platform]}`,
  );

  return { ok: true };
}

/** Usado pelo picker de Facebook na tela de conexao. */
export { listFacebookPages, listPinterestBoards };
