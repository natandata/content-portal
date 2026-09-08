"use server";

import { randomUUID } from "node:crypto";
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
  label?: string,
): Promise<ActionResult<{ url: string }>> {
  await requireStaff();

  if (!composioConfig()) {
    return fail("Insights do Instagram ainda nao foram configurados nesta instalacao.");
  }
  if (!z.uuid().safeParse(clientId).success || !(await assertCanManageClient(clientId))) {
    return fail("Cliente nao encontrado.");
  }

  const callbackUrl = `${appBaseUrl()}/api/auth/composio/callback?clientId=${encodeURIComponent(clientId)}`;
  // Aleatorio a cada tentativa -- a Composio exige alias unico por
  // userId+toolkit no projeto, e nunca reaproveitar evita colidir com um
  // alias de uma conexao antiga ja removida.
  const alias = `ig-${clientId}-${randomUUID().slice(0, 8)}`;
  const result = await initiateInstagramConnection(clientId, callbackUrl, alias);
  if (!result.ok) return fail(result.error);

  const store = await cookies();
  store.set(INSTAGRAM_CONNECT_COOKIE, JSON.stringify({ connectionId: result.data.connectionId, label: label?.trim() || null }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return ok({ url: result.data.redirectUrl });
}

export async function disconnectInstagramAction(
  clientId: string,
  connectionId: string,
): Promise<ActionResult<null>> {
  await requireStaff();
  if (!(await assertCanManageClient(clientId))) return fail("Cliente nao encontrado.");

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("client_instagram_connections")
    .select("composio_connection_id")
    .eq("id", connectionId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!connection) return fail("Conexao nao encontrada.");

  // Melhor esforco -- mesmo se a revogacao do lado da Composio falhar, o
  // registro local sai e o cliente pode tentar conectar de novo.
  await disconnectInstagramConnection(connection.composio_connection_id).catch(() => {});

  const { error } = await admin.from("client_instagram_connections").delete().eq("id", connectionId);
  if (error) {
    return fail(describeError(error, "Nao foi possivel desconectar o Instagram."));
  }

  revalidatePath(REPORTS_PATH);
  return done();
}

/** Troca qual conta e a "principal" (a que entra no relatorio automatico mensal). */
export async function setPrincipalInstagramConnectionAction(
  clientId: string,
  connectionId: string,
): Promise<ActionResult<null>> {
  await requireStaff();
  if (!(await assertCanManageClient(clientId))) return fail("Cliente nao encontrado.");

  const admin = createAdminClient();

  const { error: clearError } = await admin
    .from("client_instagram_connections")
    .update({ is_principal: false })
    .eq("client_id", clientId);
  if (clearError) return fail(describeError(clearError, "Nao foi possivel atualizar a conta principal."));

  const { error: setError } = await admin
    .from("client_instagram_connections")
    .update({ is_principal: true })
    .eq("id", connectionId)
    .eq("client_id", clientId);
  if (setError) return fail(describeError(setError, "Nao foi possivel atualizar a conta principal."));

  revalidatePath(REPORTS_PATH);
  return done();
}

export interface InstagramConnectionStatus {
  id: string;
  instagramUsername: string | null;
  label: string | null;
  isPrincipal: boolean;
  publishScopeGranted: boolean;
}

/** Contas conectadas do cliente (pode ser mais de uma) — usado pelo cartao do Instagram na tela de Relatorios e pelo seletor de publicacao. */
export async function loadInstagramConnectionStatus(clientId: string): Promise<InstagramConnectionStatus[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("client_instagram_connections")
    .select("id, instagram_username, label, is_principal, publish_scope_granted")
    .eq("client_id", clientId)
    .order("is_principal", { ascending: false })
    .order("connected_at");

  return (data ?? []).map((row) => ({
    id: row.id,
    instagramUsername: row.instagram_username,
    label: row.label,
    isPrincipal: row.is_principal,
    publishScopeGranted: row.publish_scope_granted,
  }));
}
