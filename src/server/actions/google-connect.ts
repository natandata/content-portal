"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { googleAuthUrl } from "@/lib/google/client";
import { GOOGLE_MEETINGS_PATH, GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google/meetings-constants";
import { createAdminClient } from "@/lib/supabase/server";
import { describeError, done, fail, ok, type ActionResult } from "@/server/result";

/**
 * Leva o profissional para o consentimento do Google. O `state` vai num
 * cookie httpOnly de vida curta e e conferido de volta no callback -- e a
 * defesa padrao contra CSRF nesse tipo de fluxo (alguem forjar um `code`
 * de outra sessao para a sua).
 */
export async function startGoogleConnectAction(): Promise<ActionResult<{ url: string }>> {
  const actor = await requireStaff();
  if (actor.role !== "professional") {
    return fail("Apenas profissionais conectam a propria agenda.");
  }

  const state = randomUUID();
  const url = googleAuthUrl(state);
  if (!url) {
    return fail("Reunioes por Google Meet ainda nao foram configuradas nesta instalacao.");
  }

  const store = await cookies();
  store.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return ok({ url });
}

export async function disconnectGoogleAction(): Promise<ActionResult<null>> {
  const actor = await requireStaff();
  if (actor.role !== "professional") return fail("Sem permissao.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("professional_google_accounts")
    .delete()
    .eq("user_id", actor.authUser.id);

  if (error) {
    return fail(describeError(error, "Nao foi possivel desconectar a conta Google."));
  }

  revalidatePath(GOOGLE_MEETINGS_PATH);
  return done();
}

/**
 * Estado atual da conexao — usado pela tela de configuracoes e para saber se
 * o cliente pode pedir reuniao. `professional_google_accounts` nao tem
 * policy de SELECT nenhuma (guarda token), entao isso so funciona com a
 * serviceRole; o que devolve aqui e so um booleano e o e-mail, nunca o token.
 */
export async function loadGoogleConnectionStatus(professionalId: string): Promise<{
  connected: boolean;
  googleEmail: string | null;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("professional_google_accounts")
    .select("google_email")
    .eq("user_id", professionalId)
    .maybeSingle();

  return { connected: Boolean(data), googleEmail: data?.google_email ?? null };
}
