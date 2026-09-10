"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { runSocialPublish } from "@/server/social/run-publish";
import { describeError, done, fail, type ActionResult } from "@/server/result";
import type { SocialPlatform } from "@/types/database";

function revalidateContentPaths(clientId: string, contentId: string) {
  revalidatePath(`/professional/content/${contentId}`);
  revalidatePath(`/admin/content/${contentId}`);
  revalidatePath(`/professional/clients/${clientId}`);
  revalidatePath(`/admin/clients/${clientId}`);
}

/**
 * Publica um conteudo aprovado numa rede alem do Instagram, escolhida na
 * hora do clique. Cria o `content_publish_targets` (se ainda nao existir)
 * e chama `runSocialPublish` -- mesma logica que o cron de agendamento vai
 * reusar quando isso virar recorrente.
 */
export async function publishContentToSocialAction(
  contentId: string,
  platform: SocialPlatform,
  connectionId: string,
): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data: content, error: contentError } = await supabase
    .from("contents")
    .select("client_id")
    .eq("id", contentId)
    .maybeSingle();
  if (contentError || !content) return fail(describeError(contentError, "Conteudo nao encontrado."));

  const { error: upsertError } = await supabase
    .from("content_publish_targets")
    .upsert(
      { content_id: contentId, platform, connection_id: connectionId, status: "idle", error: null },
      { onConflict: "content_id,platform" },
    );
  if (upsertError) return fail(describeError(upsertError, "Nao foi possivel preparar a publicacao."));

  const result = await runSocialPublish(contentId, platform);
  revalidateContentPaths(content.client_id, contentId);

  if (!result.ok) return fail(result.error ?? "Nao foi possivel publicar.");
  return done();
}

export interface PublishTargetStatus {
  platform: SocialPlatform;
  status: string;
  error: string | null;
  connectionLabel: string | null;
}

/** Status de publicacao desse conteudo em cada rede -- usado pra mostrar o selo ao lado de cada botao. */
export async function loadContentPublishTargets(contentId: string): Promise<PublishTargetStatus[]> {
  const supabase = await createClient();
  const { data: targets } = await supabase
    .from("content_publish_targets")
    .select("platform, status, error, connection_id")
    .eq("content_id", contentId);

  const rows = targets ?? [];
  if (rows.length === 0) return [];

  const { data: connections } = await supabase
    .from("client_social_connections")
    .select("id, label")
    .in("id", rows.map((row) => row.connection_id));
  const labelByConnection = new Map((connections ?? []).map((c) => [c.id, c.label]));

  return rows.map((row) => ({
    platform: row.platform,
    status: row.status,
    error: row.error,
    connectionLabel: labelByConnection.get(row.connection_id) ?? null,
  }));
}
