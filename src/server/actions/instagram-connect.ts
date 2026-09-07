"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  disconnectInstagramConnection,
  initiateInstagramConnection,
} from "@/lib/composio/client";
import { INSTAGRAM_CONNECT_COOKIE } from "@/lib/composio/constants";
import { requireStaff } from "@/lib/auth";
import { appBaseUrl, composioConfig } from "@/lib/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { describeError, done, fail, ok, type ActionResult } from "@/server/result";

const REPORTS_PATH = "/professional/reports";

async function assertCanManageClient(clientId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  return Boolean(data);
}

export async function startInstagramConnectAction(
  clientId: string,
): Promise<ActionResult<{ url: string }>> {
  await requireStaff();

  if (!composioConfig()) {
    return fail("Insights do Instagram ainda nao foram configurados nesta instalacao.");
  }
  if (!z.uuid().safeParse(clientId).success || !(await assertCanManageClient(clientId))) {
    return fail("Cliente nao encontrado.");
  }

  const callbackUrl = `${appBaseUrl()}/api/auth/composio/callback?clientId=${encodeURIComponent(clientId)}`;
  const result = await initiateInstagramConnection(clientId, callbackUrl);
  if (!result.ok) return fail(result.error);

  const store = await cookies();
  store.set(INSTAGRAM_CONNECT_COOKIE, result.data.connectionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return ok({ url: result.data.redirectUrl });
}

export async function disconnectInstagramAction(clientId: string): Promise<ActionResult<null>> {
  await requireStaff();
  if (!(await assertCanManageClient(clientId))) return fail("Cliente nao encontrado.");

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("client_instagram_connections")
    .select("composio_connection_id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (connection) {
    // Melhor esforco -- mesmo se a revogacao do lado da Composio falhar, o
    // registro local sai e o cliente pode tentar conectar de novo.
    await disconnectInstagramConnection(connection.composio_connection_id).catch(() => {});
  }

  const { error } = await admin.from("client_instagram_connections").delete().eq("client_id", clientId);
  if (error) {
    return fail(describeError(error, "Nao foi possivel desconectar o Instagram."));
  }

  revalidatePath(REPORTS_PATH);
  return done();
}

/** Estado da conexao — usado pelo cartao do Instagram na tela de Relatorios. */
export async function loadInstagramConnectionStatus(clientId: string): Promise<{
  connected: boolean;
  instagramUsername: string | null;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("client_instagram_connections")
    .select("instagram_username")
    .eq("client_id", clientId)
    .maybeSingle();

  return { connected: Boolean(data), instagramUsername: data?.instagram_username ?? null };
}
