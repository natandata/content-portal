import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth";
import { appBaseUrl } from "@/lib/env";
import { fetchGoogleEmail } from "@/lib/google/calendar";
import { getOAuthClient } from "@/lib/google/client";
import { GOOGLE_MEETINGS_PATH, GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google/meetings-constants";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Volta do consentimento do Google. Middleware ja ignora `api/`, entao nada
 * intercepta esta rota antes de chegar aqui — mesma situacao do webhook da
 * Stripe.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const deniedByUser = url.searchParams.get("error");

  const store = await cookies();
  const savedState = store.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  store.delete(GOOGLE_OAUTH_STATE_COOKIE);

  const back = (query: string) => NextResponse.redirect(`${appBaseUrl()}${GOOGLE_MEETINGS_PATH}${query}`);

  if (deniedByUser) return back("?error=denied");
  if (!code || !state || !savedState || state !== savedState) return back("?error=invalid_state");

  // Sessao expirada durante o consentimento: manda para o login em vez de
  // quebrar aqui, ja que requireStaff() redireciona sozinho.
  const actor = await requireStaff().catch(() => null);
  if (!actor || actor.role !== "professional") return back("?error=session");

  const oauth = getOAuthClient();
  if (!oauth) return back("?error=not_configured");

  try {
    const { tokens } = await oauth.getToken(code);

    // `prompt=consent` deveria sempre devolver um refresh_token novo, mas se
    // por algum motivo o Google nao mandar, nao ha o que salvar: melhor pedir
    // para tentar de novo do que gravar uma conexao que nunca vai renovar.
    if (!tokens.refresh_token) return back("?error=no_refresh_token");

    oauth.setCredentials(tokens);
    const email = await fetchGoogleEmail(oauth);
    if (!email) return back("?error=no_email");

    const admin = createAdminClient();
    const { error } = await admin.from("professional_google_accounts").upsert(
      {
        user_id: actor.authUser.id,
        google_email: email,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token ?? null,
        access_token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) return back("?error=save_failed");

    return back("?done=1");
  } catch {
    return back("?error=exchange_failed");
  }
}
