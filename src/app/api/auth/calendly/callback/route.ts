import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth";
import { createCalendlyWebhook, fetchCalendlyUser } from "@/lib/calendly/api";
import { exchangeCalendlyCode } from "@/lib/calendly/client";
import { CALENDLY_OAUTH_STATE_COOKIE } from "@/lib/calendly/meetings-constants";
import { appBaseUrl } from "@/lib/env";
import { MEETINGS_SETTINGS_PATH } from "@/lib/meetings-constants";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Volta do consentimento da Calendly. Mesmo desenho da rota equivalente do
 * Google (`app/api/auth/google/callback/route.ts`) — middleware ja ignora
 * `api/`, entao nada intercepta esta rota antes de chegar aqui.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const deniedByUser = url.searchParams.get("error");

  const store = await cookies();
  const savedState = store.get(CALENDLY_OAUTH_STATE_COOKIE)?.value;
  store.delete(CALENDLY_OAUTH_STATE_COOKIE);

  const back = (query: string) => NextResponse.redirect(`${appBaseUrl()}${MEETINGS_SETTINGS_PATH}${query}`);

  if (deniedByUser) return back("?error=calendly_denied");
  if (!code || !state || !savedState || state !== savedState) return back("?error=calendly_invalid_state");

  const actor = await requireStaff().catch(() => null);
  if (!actor || actor.role !== "professional") return back("?error=calendly_session");

  const tokens = await exchangeCalendlyCode(code);
  if (!tokens) return back("?error=calendly_exchange_failed");

  const calendlyUser = await fetchCalendlyUser(tokens.accessToken);
  if (!calendlyUser) return back("?error=calendly_no_user");

  const admin = createAdminClient();
  const { error } = await admin.from("professional_calendly_accounts").upsert(
    {
      user_id: actor.authUser.id,
      calendly_uri: calendlyUser.uri,
      calendly_email: calendlyUser.email,
      scheduling_url: calendlyUser.schedulingUrl,
      organization_uri: calendlyUser.organizationUri,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      access_token_expires_at: new Date(tokens.expiresAt).toISOString(),
      connected_at: new Date().toISOString(),
      // Zera o tipo de evento e a assinatura de webhook antigos numa
      // reconexao — melhor a pessoa escolher de novo do que carregar um
      // uri de uma conta anterior.
      event_type_uri: null,
      event_type_name: null,
      event_type_scheduling_url: null,
      event_type_duration: null,
      webhook_subscription_uri: null,
      webhook_signing_key: null,
    },
    { onConflict: "user_id" },
  );

  if (error) return back("?error=calendly_save_failed");

  if (calendlyUser.organizationUri) {
    const webhook = await createCalendlyWebhook(actor.authUser.id, {
      callbackUrl: `${appBaseUrl()}/api/webhooks/calendly`,
      userUri: calendlyUser.uri,
      organizationUri: calendlyUser.organizationUri,
    });

    if (webhook.ok) {
      await admin
        .from("professional_calendly_accounts")
        .update({
          webhook_subscription_uri: webhook.data.uri,
          webhook_signing_key: webhook.data.signingKey,
        })
        .eq("user_id", actor.authUser.id);
    }
    // Falha ao criar o webhook nao desfaz a conexao: a conta fica conectada
    // e o profissional pode gerar link de reuniao, so nao confirma sozinho
    // quando alguem marca -- resolve tentando reconectar depois.
  }

  return back("?done=calendly");
}
