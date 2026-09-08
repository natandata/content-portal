"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import {
  createCarouselContainer,
  createFeedMediaContainer,
  publishContainer,
} from "@/lib/composio/instagram-publish";
import { BUCKETS } from "@/lib/paths";
import { sendPushToClientStaff } from "@/lib/push";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { signedUrlMap } from "@/lib/storage";
import { logClientActivity } from "@/server/activity";
import { describeError, done, fail, firstIssue, type ActionResult } from "@/server/result";

/**
 * Publicacao direta no Instagram (feed/carrossel) a partir do calendario de
 * conteudo. `runInstagramPublish` e' a logica de fato, compartilhada entre a
 * acao imediata e o cron de agendamento -- mesmo espirito de
 * `instagram-insights-report.ts` (uma unica funcao "faz o trabalho" chamada
 * de dois lugares).
 */

function isJpeg(fileType: string): boolean {
  return fileType === "image/jpeg" || fileType === "image/jpg";
}

/** Mapeia o erro cru da Composio/Meta pra uma mensagem que faz sentido pro staff. */
function mapPublishError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("spam") || lower.includes("quota") || lower.includes("613")) {
    return "Limite diario de publicacoes do Instagram atingido. Tente novamente amanha.";
  }
  if (lower.includes("format") || lower.includes("invalid image") || lower.includes("jpeg") || lower.includes("resolution")) {
    return "A imagem nao pode ser publicada (formato ou tamanho invalido).";
  }
  if (lower.includes("expired") || lower.includes("9007") || lower.includes("not ready") || lower.includes("finished")) {
    return "A publicacao expirou ou nao ficou pronta a tempo. Tente novamente.";
  }
  if (lower.includes("permission") || lower.includes("scope") || lower.includes("oauth") || lower.includes("token")) {
    return "A conexao com o Instagram nao tem permissao para publicar. Reconecte a conta.";
  }
  return raw;
}

/**
 * Faz a publicacao de verdade. Assume que `contents.instagram_connection_id`
 * ja foi definido por quem chamou (acao imediata ou agendamento). Sempre
 * roda com o client admin -- `client_instagram_connections` nao tem RLS de
 * proposito, e o flip atomico de `publish_status` precisa ser a mesma
 * chamada que le o estado atual (evita corrida entre clique e cron).
 */
export async function runInstagramPublish(contentId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data: content } = await admin.from("contents").select("*").eq("id", contentId).maybeSingle();
  if (!content) return { ok: false, error: "Conteudo nao encontrado." };

  if (content.status !== "approved") {
    return { ok: false, error: "So e possivel publicar um conteudo aprovado." };
  }
  if (content.type === "video") {
    return { ok: false, error: "Publicacao direta de video ainda nao esta disponivel (Reels entra numa fase 2)." };
  }
  if (!content.instagram_connection_id) {
    return { ok: false, error: "Escolha uma conta do Instagram antes de publicar." };
  }

  const { data: files } = await admin
    .from("content_files")
    .select("*")
    .eq("content_id", contentId)
    .order("position");
  const filesList = files ?? [];
  if (filesList.length === 0) {
    return { ok: false, error: "Este conteudo nao tem nenhum arquivo." };
  }
  const invalidFile = filesList.find((file) => !file.file_path || !isJpeg(file.file_type));
  if (invalidFile) {
    return { ok: false, error: "Apenas imagens JPEG podem ser publicadas diretamente. Reexporte o arquivo." };
  }

  const { data: connection } = await admin
    .from("client_instagram_connections")
    .select("composio_connection_id, publish_scope_granted")
    .eq("id", content.instagram_connection_id)
    .eq("client_id", content.client_id)
    .maybeSingle();
  if (!connection) return { ok: false, error: "Conexao do Instagram nao encontrada." };
  if (!connection.publish_scope_granted) {
    return { ok: false, error: "Reconecte a conta do Instagram para habilitar a publicacao." };
  }

  // Flip atomico -- so segue se ainda nao foi reivindicado por outra chamada
  // (clique duplo, ou corrida entre acao imediata e cron).
  const { data: claimed } = await admin
    .from("contents")
    .update({ publish_status: "publishing", publish_error: null })
    .eq("id", contentId)
    .in("publish_status", ["idle", "scheduled"])
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, error: "Publicacao ja em andamento ou concluida." };

  async function markFailed(rawMessage: string) {
    const message = mapPublishError(rawMessage);
    await admin.from("contents").update({ publish_status: "failed", publish_error: message }).eq("id", contentId);
    return { ok: false, error: message };
  }

  // URL assinada gerada agora -- nunca reusa uma guardada de antes (o
  // container e' processado de forma assincrona pela Meta).
  const filePaths = filesList.map((file) => file.file_path).filter((p): p is string => Boolean(p));
  const urlMap = await signedUrlMap(admin, BUCKETS.content, filePaths);
  const urls = filePaths.map((path) => urlMap.get(path)).filter((url): url is string => Boolean(url));
  if (urls.length !== filePaths.length) {
    return await markFailed("Nao foi possivel gerar o link das imagens.");
  }

  const containerResult =
    content.type === "carousel"
      ? await createCarouselContainer(content.client_id, connection.composio_connection_id, {
          imageUrls: urls,
          caption: content.caption,
        })
      : await createFeedMediaContainer(content.client_id, connection.composio_connection_id, {
          imageUrl: urls[0]!,
          caption: content.caption,
        });

  if (!containerResult.ok) return await markFailed(containerResult.error);

  await admin
    .from("contents")
    .update({ publish_container_id: containerResult.data.creationId })
    .eq("id", contentId);

  const publishResult = await publishContainer(
    content.client_id,
    connection.composio_connection_id,
    containerResult.data.creationId,
  );
  if (!publishResult.ok) return await markFailed(publishResult.error);

  await admin
    .from("contents")
    .update({
      publish_status: "published",
      status: "published",
      instagram_media_id: publishResult.data.mediaId,
      published_at: new Date().toISOString(),
    })
    .eq("id", contentId);

  await sendPushToClientStaff(content.client_id, {
    title: "Publicado no Instagram",
    body: `"${content.title}" foi publicado com sucesso.`,
    url: `/professional/content/${contentId}`,
    tag: `content-publish-${contentId}`,
  }).catch(() => {});

  // Sem "quem" aqui de proposito -- essa funcao roda tanto do clique
  // imediato quanto do cron de agendamento, sem saber quem disparou.
  await logClientActivity(admin, content.client_id, "Publicacao automatica", `Publicou "${content.title}" no Instagram`);

  return { ok: true };
}

function revalidateContentPaths(clientId: string, contentId: string) {
  revalidatePath(`/professional/content/${contentId}`);
  revalidatePath(`/admin/content/${contentId}`);
  revalidatePath("/professional/content");
  revalidatePath("/admin/content");
  revalidatePath(`/professional/clients/${clientId}`);
  revalidatePath(`/admin/clients/${clientId}`);
}

/** Publicar agora, disparado pelo staff -- escolhe a conexao na hora do clique. */
export async function publishContentNowAction(contentId: string, connectionId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data: content, error } = await supabase
    .from("contents")
    .update({ instagram_connection_id: connectionId })
    .eq("id", contentId)
    .select("client_id")
    .single();
  if (error || !content) return fail(describeError(error, "Conteudo nao encontrado."));

  const result = await runInstagramPublish(contentId);
  revalidateContentPaths(content.client_id, contentId);

  if (!result.ok) return fail(result.error ?? "Nao foi possivel publicar.");
  return done();
}

const scheduleSchema = z.object({
  contentId: z.uuid(),
  connectionId: z.uuid(),
  scheduledDate: z.iso.date(),
});

/** Agenda a publicacao pra uma data -- so data, sem hora (mesma limitacao ja aceita nos relatorios de Instagram). */
export async function scheduleContentPublishAction(
  input: z.input<typeof scheduleSchema>,
): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error.issues, "Dados invalidos."));

  const supabase = await createClient();
  const { data: content } = await supabase
    .from("contents")
    .select("status, client_id")
    .eq("id", parsed.data.contentId)
    .maybeSingle();
  if (!content) return fail("Conteudo nao encontrado.");
  if (content.status !== "approved") return fail("So e possivel agendar um conteudo aprovado.");

  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  if (parsed.data.scheduledDate < todayIso) return fail("Escolha uma data de hoje em diante.");

  const { error } = await supabase
    .from("contents")
    .update({
      instagram_connection_id: parsed.data.connectionId,
      scheduled_date: parsed.data.scheduledDate,
      publish_status: "scheduled",
      publish_error: null,
    })
    .eq("id", parsed.data.contentId);
  if (error) return fail(describeError(error, "Nao foi possivel agendar a publicacao."));

  revalidateContentPaths(content.client_id, parsed.data.contentId);
  return done();
}

/** Cancela um agendamento pendente -- so mexe se ainda estiver `scheduled` (nunca cancela algo ja publicando/publicado). */
export async function cancelScheduledPublishAction(contentId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contents")
    .update({ publish_status: "idle" })
    .eq("id", contentId)
    .eq("publish_status", "scheduled")
    .select("client_id")
    .maybeSingle();
  if (error) return fail(describeError(error, "Nao foi possivel cancelar o agendamento."));
  if (!data) return fail("Nao ha agendamento pendente pra cancelar.");

  revalidateContentPaths(data.client_id, contentId);
  return done();
}
