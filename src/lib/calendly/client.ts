import "server-only";

import { calendlyOAuthConfig } from "@/lib/env";

/**
 * OAuth2 puro via `fetch` — a API da Calendly e REST simples, sem SDK
 * oficial em Node que valha a pena instalar so por isto (diferente do
 * Google, que exige `googleapis` para o client de Calendar).
 */
export function calendlyAuthUrl(state: string): string | null {
  const config = calendlyOAuthConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    state,
  });

  return `https://auth.calendly.com/oauth/authorize?${params.toString()}`;
}

export interface CalendlyTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms — calculado aqui a partir do `expires_in` (segundos) que a Calendly devolve. */
  expiresAt: number;
}

async function requestToken(body: Record<string, string>): Promise<CalendlyTokens | null> {
  const config = calendlyOAuthConfig();
  if (!config) return null;

  const response = await fetch("https://auth.calendly.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...body,
    }),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { access_token: string; refresh_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/** Troca o `code` do redirect pelo primeiro par de tokens. */
export function exchangeCalendlyCode(code: string): Promise<CalendlyTokens | null> {
  const config = calendlyOAuthConfig();
  if (!config) return Promise.resolve(null);

  return requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });
}

/** Renova o access_token quando ele expira — a Calendly nao tem client library que faca isso sozinho. */
export function refreshCalendlyTokens(refreshToken: string): Promise<CalendlyTokens | null> {
  return requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}
