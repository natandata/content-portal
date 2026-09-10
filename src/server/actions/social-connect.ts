"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { disconnectSocialConnection, initiateSocialConnection } from "@/lib/composio/client";
import { SOCIAL_CONNECT_COOKIE } from "@/lib/composio/social-constants";
import { getLinkedInAuthor, listFacebookPages, listPinterestBoards } from "@/lib/composio/social-publish";
import { requireStaff } from "@/lib/auth";
import { appBaseUrl, composioConfig } from "@/lib/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { logClientActivity } from "@/server/activity";
import { describeError, done, fail, ok, type ActionResult } from "@/server/result";
import type { SocialPlatform } from "@/types/database";

const CLIENTS_PATH = "/professional/clients";
const PLATFORMS: SocialPlatform[] = ["tiktok", "linkedin", "facebook", "pinterest", "youtube"];
const platformSchema = z.enum(PLATFORMS as [SocialPlatform, ...SocialPlatform[]]);

async function assertCanManageClient(clientId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  return Boolean(data);
}

/** Inicia o OAuth de uma rede social pra um cliente -- mesmo mecanismo do Instagram, generico por plataforma. */
export async function startSocialConnectAction(
  clientId: string,
  platform: SocialPlatform,
  label?: string,
): Promise<ActionResult<{ url: string }>> {
  await requireStaff();

  if (!composioConfig()) return fail("Integracoes sociais ainda nao foram configuradas nesta instalacao.");
  if (!z.uuid().safeParse(clientId).success || !(await assertCanManageClient(clientId))) {
    return fail("Cliente nao encontrado.");
  }
  const parsedPlatform = platformSchema.safeParse(platform);
  if (!parsedPlatform.success) return fail("Rede invalida.");

  const callbackUrl = `${appBaseUrl()}/api/auth/composio-social/callback?clientId=${encodeURIComponent(clientId)}&platform=${platform}`;
  const alias = `${platform}-${clientId}-${randomUUID().slice(0, 8)}`;
  const result = await initiateSocialConnection(parsedPlatform.data, clientId, callbackUrl, alias);
  if (!result.ok) return fail(result.error);

  const store = await cookies();
  store.set(
    SOCIAL_CONNECT_COOKIE,
    JSON.stringify({ connectionId: result.data.connectionId, platform, label: label?.trim() || null }),
    { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" },
  );

  return ok({ url: result.data.redirectUrl });
}

export async function disconnectSocialAction(connectionId: string): Promise<ActionResult<null>> {
  const actor = await requireStaff();
  const admin = createAdminClient();

  const { data: connection } = await admin
    .from("client_social_connections")
    .select("client_id, platform, composio_connection_id, label")
    .eq("id", connectionId)
    .maybeSingle();
  if (!connection) return fail("Conexao nao encontrada.");
  if (!(await assertCanManageClient(connection.client_id))) return fail("Cliente nao encontrado.");

  await disconnectSocialConnection(connection.composio_connection_id).catch(() => {});

  const { error } = await admin.from("client_social_connections").delete().eq("id", connectionId);
  if (error) return fail(describeError(error, "Nao foi possivel desconectar."));

  await logClientActivity(
    admin,
    connection.client_id,
    actor.displayName,
    `Desconectou o ${connection.platform}${connection.label ? ` (${connection.label})` : ""}`,
  );

  revalidatePath(CLIENTS_PATH);
  return done();
}

export interface SocialTargetOption {
  id: string;
  name: string;
}

/** Lista as opcoes de destino (Pages do Facebook / boards do Pinterest) pra staff escolher depois de conectar. */
export async function loadSocialTargetOptionsAction(
  connectionId: string,
): Promise<ActionResult<SocialTargetOption[]>> {
  await requireStaff();
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("client_social_connections")
    .select("client_id, platform, composio_connection_id")
    .eq("id", connectionId)
    .maybeSingle();
  if (!connection) return fail("Conexao nao encontrada.");

  if (connection.platform === "facebook") {
    const result = await listFacebookPages(connection.client_id, connection.composio_connection_id);
    if (!result.ok) return fail(result.error);
    return ok(result.data);
  }
  if (connection.platform === "pinterest") {
    const result = await listPinterestBoards(connection.client_id, connection.composio_connection_id);
    if (!result.ok) return fail(result.error);
    return ok(result.data);
  }
  return fail("Esta rede nao precisa de selecao de destino.");
}

/** Grava qual Page/board foi escolhido pra essa conexao. */
export async function setSocialTargetAction(
  connectionId: string,
  targetId: string,
  targetName: string,
): Promise<ActionResult<null>> {
  await requireStaff();
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("client_social_connections")
    .select("platform")
    .eq("id", connectionId)
    .maybeSingle();
  if (!connection) return fail("Conexao nao encontrada.");

  const key = connection.platform === "facebook" ? "pageId" : "boardId";
  const nameKey = connection.platform === "facebook" ? "pageName" : "boardName";

  const { error } = await admin
    .from("client_social_connections")
    .update({ platform_data: { [key]: targetId, [nameKey]: targetName } })
    .eq("id", connectionId);
  if (error) return fail(describeError(error, "Nao foi possivel salvar o destino."));

  revalidatePath(CLIENTS_PATH);
  return done();
}

export interface SocialConnectionStatus {
  id: string;
  platform: SocialPlatform;
  label: string | null;
  platformData: Record<string, unknown>;
  needsTargetSelection: boolean;
}

/** Conexoes sociais do cliente (todas as redes, exceto Instagram que tem sua propria tela). */
export async function loadSocialConnectionsStatus(clientId: string): Promise<SocialConnectionStatus[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("client_social_connections")
    .select("id, platform, label, platform_data")
    .eq("client_id", clientId)
    .order("connected_at");

  return (data ?? []).map((row) => ({
    id: row.id,
    platform: row.platform,
    label: row.label,
    platformData: row.platform_data,
    needsTargetSelection:
      (row.platform === "facebook" && !row.platform_data.pageId) ||
      (row.platform === "pinterest" && !row.platform_data.boardId),
  }));
}

/** Resolve o autor do LinkedIn (URN) logo apos conectar -- sem isso nenhum post pode ser criado. */
export async function resolveLinkedInAuthorAction(connectionId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("client_social_connections")
    .select("client_id, composio_connection_id")
    .eq("id", connectionId)
    .maybeSingle();
  if (!connection) return fail("Conexao nao encontrada.");

  const result = await getLinkedInAuthor(connection.client_id, connection.composio_connection_id);
  if (!result.ok) return fail(result.error);

  const { error } = await admin
    .from("client_social_connections")
    .update({ platform_data: { authorUrn: result.data.urn, authorName: result.data.name } })
    .eq("id", connectionId);
  if (error) return fail(describeError(error, "Nao foi possivel salvar o autor do LinkedIn."));

  revalidatePath(CLIENTS_PATH);
  return done();
}
