import "server-only";

import webpush from "web-push";

import { vapidConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

export interface PushPayload {
  title: string;
  body: string;
  /** Para onde o clique leva. Relativo a origem do app. */
  url: string;
  /**
   * Agrupa notificacoes do mesmo assunto — uma segunda push com a mesma tag
   * substitui a anterior na barra do aparelho em vez de empilhar.
   */
  tag?: string;
}

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;

  const config = vapidConfig();
  if (!config) return false;

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  configured = true;
  return true;
}

/**
 * Envia para todas as inscricoes de um usuario (auth.users.id) — pode ter mais
 * de uma, um dispositivo por navegador/aparelho onde a pessoa ativou.
 *
 * Roda com o cliente de service role de proposito: quem dispara a notificacao
 * e o profissional agindo sobre o conteudo do cliente (ou o contrario), e a
 * RLS de `push_subscriptions` so deixa cada um ler a propria inscricao.
 *
 * Falha silenciosamente quando a chave VAPID nao esta configurada — notificacao
 * e um extra, nunca pode derrubar a acao que a disparou.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;

  const admin = createAdminClient();
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("user_id", userId);

  if (!subscriptions || subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  const expired: string[] = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
          },
          body,
        );
      } catch (error) {
        // 404/410 = o navegador cancelou a inscricao do lado dele; limpamos aqui.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(subscription.id);
      }
    }),
  );

  if (expired.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", expired);
  }
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  const unique = [...new Set(userIds)];
  await Promise.all(unique.map((id) => sendPushToUser(id, payload)));
}

/** Cliente identificado pelo id de `clients` — resolve para o auth user dele. */
export async function sendPushToClient(clientId: string, payload: PushPayload): Promise<void> {
  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("auth_user_id")
    .eq("id", clientId)
    .maybeSingle();

  if (client?.auth_user_id) await sendPushToUser(client.auth_user_id, payload);
}

export interface ClientStaffIds {
  professionalId: string | null;
  adminIds: string[];
}

/** Quem cuida deste cliente: o profissional responsavel (se houver) e todo admin ativo. */
export async function resolveClientStaffIds(clientId: string): Promise<ClientStaffIds> {
  const admin = createAdminClient();

  const [{ data: client }, { data: admins }] = await Promise.all([
    admin.from("clients").select("professional_id").eq("id", clientId).maybeSingle(),
    admin.from("users").select("id").eq("role", "admin").eq("status", "active"),
  ]);

  return {
    professionalId: client?.professional_id ?? null,
    adminIds: (admins ?? []).map((row) => row.id),
  };
}

/**
 * Quem cuida deste cliente: o profissional responsavel (se houver) mais todo
 * admin ativo. Admin sempre entra — e quem responde mesmo sem ser o
 * profissional designado.
 *
 * Usa a mesma URL para todo mundo. Quando o link precisa apontar para
 * `/admin/...` ou `/professional/...` de forma diferente por audiencia, monte
 * o envio na mao com `resolveClientStaffIds` em vez desta funcao.
 */
export async function sendPushToClientStaff(
  clientId: string,
  payload: PushPayload,
): Promise<void> {
  const { professionalId, adminIds } = await resolveClientStaffIds(clientId);
  const ids = professionalId ? [...adminIds, professionalId] : adminIds;
  await sendPushToUsers(ids, payload);
}

/** So os administradores — usado para avisos que exigem privilegio de admin. */
export async function sendPushToAdmins(payload: PushPayload): Promise<void> {
  const admin = createAdminClient();
  const { data: admins } = await admin
    .from("users")
    .select("id")
    .eq("role", "admin")
    .eq("status", "active");

  await sendPushToUsers((admins ?? []).map((row) => row.id), payload);
}
