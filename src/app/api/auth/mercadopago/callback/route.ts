import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth";
import { appBaseUrl } from "@/lib/env";
import { exchangeMercadoPagoCode } from "@/lib/mercadopago/client";
import { MERCADOPAGO_OAUTH_STATE_COOKIE } from "@/lib/mercadopago/constants";
import { createAdminClient } from "@/lib/supabase/server";

const SETTINGS_PATH = "/professional/settings/payments";

/**
 * Volta do consentimento do Mercado Pago -- mesmo desenho de
 * `app/api/auth/calendly/callback/route.ts`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const deniedByUser = url.searchParams.get("error");

  const store = await cookies();
  const savedState = store.get(MERCADOPAGO_OAUTH_STATE_COOKIE)?.value;
  store.delete(MERCADOPAGO_OAUTH_STATE_COOKIE);

  const back = (query: string) => NextResponse.redirect(`${appBaseUrl()}${SETTINGS_PATH}${query}`);

  if (deniedByUser) return back("?error=mercadopago_denied");
  if (!code || !state || !savedState || state !== savedState) return back("?error=mercadopago_invalid_state");

  const actor = await requireStaff().catch(() => null);
  if (!actor || actor.role !== "professional") return back("?error=mercadopago_session");

  const tokens = await exchangeMercadoPagoCode(code);
  if (!tokens) return back("?error=mercadopago_exchange_failed");

  const admin = createAdminClient();
  const { error } = await admin.from("professional_mercadopago_accounts").upsert(
    {
      user_id: actor.authUser.id,
      mercadopago_user_id: tokens.userId,
      public_key: tokens.publicKey,
      live_mode: tokens.liveMode,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires_at: new Date(tokens.expiresAt).toISOString(),
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) return back("?error=mercadopago_save_failed");

  return back("?done=mercadopago");
}
