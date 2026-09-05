import "server-only";

import { google } from "googleapis";

import { getOAuthClient } from "@/lib/google/client";
import { createAdminClient } from "@/lib/supabase/server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Monta o client OAuth ja autenticado para ESTE profissional, a partir do
 * refresh_token guardado. Registra o listener que salva um access_token novo
 * sempre que a lib renovar sozinha (acontece por baixo dos panos, na primeira
 * chamada apos o token expirar) -- sem isso toda chamada pagaria o preco de
 * um refresh, mesmo tendo um access_token ainda valido guardado.
 */
async function clientFor(userId: string) {
  const oauth = getOAuthClient();
  if (!oauth) return null;

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("professional_google_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!account) return null;

  oauth.setCredentials({
    refresh_token: account.refresh_token,
    access_token: account.access_token ?? undefined,
    expiry_date: account.access_token_expires_at ? new Date(account.access_token_expires_at).getTime() : undefined,
  });

  oauth.on("tokens", (tokens) => {
    if (!tokens.access_token) return;
    void admin
      .from("professional_google_accounts")
      .update({
        access_token: tokens.access_token,
        access_token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      })
      .eq("user_id", userId);
  });

  return { oauth, calendarId: account.calendar_id };
}

/** Confirma que a conexao ainda e valida, buscando o e-mail da conta. Usado no cadastro. */
export async function fetchGoogleEmail(oauthClient: InstanceType<typeof google.auth.OAuth2>): Promise<string | null> {
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: oauthClient });
    const { data } = await oauth2.userinfo.get();
    return data.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Cria o evento com Meet na agenda do profissional e convida os dois lados.
 * `sendUpdates: "all"` e o que faz o Google mandar o e-mail de convite de
 * verdade -- sem isso o evento existe, mas ninguem e avisado.
 */
export async function createMeetEvent(
  userId: string,
  options: {
    summary: string;
    description: string;
    start: Date;
    end: Date;
    attendeeEmails: string[];
  },
): Promise<Result<{ eventId: string; meetLink: string }>> {
  const ctx = await clientFor(userId);
  if (!ctx) return { ok: false, error: "Conta Google do profissional nao esta conectada." };

  const calendar = google.calendar({ version: "v3", auth: ctx.oauth });

  try {
    const response = await calendar.events.insert({
      calendarId: ctx.calendarId,
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        summary: options.summary,
        description: options.description,
        start: { dateTime: options.start.toISOString() },
        end: { dateTime: options.end.toISOString() },
        attendees: options.attendeeEmails.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });

    const meetLink =
      response.data.hangoutLink ??
      response.data.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ??
      null;

    if (!response.data.id || !meetLink) {
      return { ok: false, error: "O Google Calendar nao devolveu o link do Meet." };
    }

    return { ok: true, data: { eventId: response.data.id, meetLink } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao criar o evento no Google Calendar." };
  }
}

/** Cancela o evento na agenda do profissional. Falha em silencio: o evento pode ja ter sido apagado por la. */
export async function cancelMeetEvent(userId: string, eventId: string): Promise<void> {
  const ctx = await clientFor(userId);
  if (!ctx) return;

  const calendar = google.calendar({ version: "v3", auth: ctx.oauth });
  await calendar.events.delete({ calendarId: ctx.calendarId, eventId, sendUpdates: "all" }).catch(() => {});
}
