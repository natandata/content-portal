import "server-only";

import { google } from "googleapis";

import { googleOAuthConfig } from "@/lib/env";

/** `null` quando as credenciais do Google nao estao configuradas nesta instalacao. */
export function getOAuthClient() {
  const config = googleOAuthConfig();
  if (!config) return null;
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

/**
 * `access_type: offline` + `prompt: consent` sao os dois que garantem um
 * refresh_token de volta -- sem eles o Google so devolve o refresh_token na
 * PRIMEIRA autorizacao de todas, nunca mais depois (mesmo reconectando).
 */
export function googleAuthUrl(state: string): string | null {
  const client = getOAuthClient();
  if (!client) return null;

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}
