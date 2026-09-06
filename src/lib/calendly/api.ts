import "server-only";

import { refreshCalendlyTokens } from "@/lib/calendly/client";
import { createAdminClient } from "@/lib/supabase/server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const REFRESH_MARGIN_MS = 5 * 60_000;

/**
 * Garante um access_token valido para este profissional, renovando e
 * gravando de volta quando estiver perto de expirar. A Calendly nao tem
 * client library que faca isso sozinho (diferente do `oauth.on("tokens", ...)`
 * do Google) — o refresh e manual aqui.
 */
async function validAccessToken(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("professional_calendly_accounts")
    .select("access_token, refresh_token, access_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!account) return null;

  const expiresAt = account.access_token_expires_at ? new Date(account.access_token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + REFRESH_MARGIN_MS) return account.access_token;

  const refreshed = await refreshCalendlyTokens(account.refresh_token);
  if (!refreshed) return account.access_token;

  await admin
    .from("professional_calendly_accounts")
    .update({
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken,
      access_token_expires_at: new Date(refreshed.expiresAt).toISOString(),
    })
    .eq("user_id", userId);

  return refreshed.accessToken;
}

/** Chamada autenticada generica contra a API da Calendly, em nome de um profissional ja conectado. */
async function calendlyFetch(userId: string, path: string, init?: RequestInit): Promise<Result<unknown>> {
  const token = await validAccessToken(userId);
  if (!token) return { ok: false, error: "Conta Calendly do profissional nao esta conectada." };

  const response = await fetch(
    path.startsWith("http") ? path : `https://api.calendly.com${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { ok: false, error: `Calendly respondeu ${response.status}: ${body.slice(0, 200)}` };
  }

  if (response.status === 204) return { ok: true, data: null };
  return { ok: true, data: await response.json() };
}

export interface CalendlyUser {
  uri: string;
  email: string;
  schedulingUrl: string;
  organizationUri: string | null;
}

/** Chamada feita direto com um access_token recem-trocado (ainda sem linha salva) — usada so no callback do OAuth. */
export async function fetchCalendlyUser(accessToken: string): Promise<CalendlyUser | null> {
  const response = await fetch("https://api.calendly.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    resource: { uri: string; email: string; scheduling_url: string; current_organization?: string };
  };

  return {
    uri: data.resource.uri,
    email: data.resource.email,
    schedulingUrl: data.resource.scheduling_url,
    organizationUri: data.resource.current_organization ?? null,
  };
}

export interface CalendlyEventType {
  uri: string;
  name: string;
  durationMinutes: number;
  schedulingUrl: string;
  active: boolean;
}

export async function listCalendlyEventTypes(userId: string, userUri: string): Promise<Result<CalendlyEventType[]>> {
  const result = await calendlyFetch(userId, `/event_types?user=${encodeURIComponent(userUri)}&active=true`);
  if (!result.ok) return result;

  const data = result.data as {
    collection: { uri: string; name: string; duration: number; scheduling_url: string; active: boolean }[];
  };

  return {
    ok: true,
    data: data.collection.map((item) => ({
      uri: item.uri,
      name: item.name,
      durationMinutes: item.duration,
      schedulingUrl: item.scheduling_url,
      active: item.active,
    })),
  };
}

/**
 * Link de agendamento de USO UNICO contra o Event Type escolhido — a peca
 * central da feature. O app nunca reserva horario via API: gera este link e
 * deixa a pessoa escolher e confirmar do lado da Calendly, que ja resolve
 * fuso, buffer e limite diario sozinha.
 */
export async function createSingleUseSchedulingLink(userId: string, eventTypeUri: string): Promise<Result<string>> {
  const result = await calendlyFetch(userId, "/scheduling_links", {
    method: "POST",
    body: JSON.stringify({
      max_event_count: 1,
      owner: eventTypeUri,
      owner_type: "EventType",
    }),
  });
  if (!result.ok) return result;

  const data = result.data as { resource: { booking_url: string } };
  return { ok: true, data: data.resource.booking_url };
}

export interface CalendlyWebhookSubscription {
  uri: string;
  signingKey: string;
}

/**
 * Assinatura de webhook escopada a ESTE profissional — a Calendly exige que
 * cada subscription seja criada com o token de quem ela observa; nao existe
 * "um endpoint para todo mundo" configurado uma unica vez, como fizemos na
 * Stripe com "eventos de contas conectadas".
 */
export async function createCalendlyWebhook(
  userId: string,
  options: { callbackUrl: string; userUri: string; organizationUri: string },
): Promise<Result<CalendlyWebhookSubscription>> {
  const result = await calendlyFetch(userId, "/webhook_subscriptions", {
    method: "POST",
    body: JSON.stringify({
      url: options.callbackUrl,
      events: ["invitee.created", "invitee.canceled"],
      organization: options.organizationUri,
      user: options.userUri,
      scope: "user",
    }),
  });
  if (!result.ok) return result;

  const data = result.data as { resource: { uri: string; signing_key: string } };
  return { ok: true, data: { uri: data.resource.uri, signingKey: data.resource.signing_key } };
}

export async function deleteCalendlyWebhook(userId: string, subscriptionUri: string): Promise<void> {
  await calendlyFetch(userId, subscriptionUri, { method: "DELETE" }).catch(() => {});
}

/** Cancela um evento ja marcado — usado quando alguem cancela pelo app depois que a reuniao ja foi confirmada. */
export async function cancelCalendlyEvent(userId: string, eventUri: string, reason: string): Promise<void> {
  await calendlyFetch(userId, `${eventUri}/cancellation`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  }).catch(() => {});
}
