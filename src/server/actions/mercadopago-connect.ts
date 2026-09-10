"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { mercadoPagoAuthUrl } from "@/lib/mercadopago/client";
import { MERCADOPAGO_OAUTH_STATE_COOKIE } from "@/lib/mercadopago/constants";
import { createAdminClient } from "@/lib/supabase/server";
import { describeError, done, fail, ok, type ActionResult } from "@/server/result";

const SETTINGS_PATH = "/professional/settings/payments";

/** Comeca o consentimento -- mesmo desenho de `startCalendlyConnectAction`. */
export async function startMercadoPagoConnectAction(): Promise<ActionResult<{ url: string }>> {
  const actor = await requireStaff();
  if (actor.role !== "professional") {
    return fail("Apenas profissionais conectam a propria conta de recebimento.");
  }

  const state = randomUUID();
  const url = mercadoPagoAuthUrl(state);
  if (!url) {
    return fail("Pix automatico ainda nao foi configurado nesta instalacao.");
  }

  const store = await cookies();
  store.set(MERCADOPAGO_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return ok({ url });
}

export async function disconnectMercadoPagoAction(): Promise<ActionResult<null>> {
  const actor = await requireStaff();
  if (actor.role !== "professional") return fail("Sem permissao.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("professional_mercadopago_accounts")
    .delete()
    .eq("user_id", actor.authUser.id);

  if (error) {
    return fail(describeError(error, "Nao foi possivel desconectar o Mercado Pago."));
  }

  revalidatePath(SETTINGS_PATH);
  return done();
}

/** Estado da conexao -- usado pela tela de configuracoes. */
export async function loadMercadoPagoConnectionStatus(
  professionalId: string,
): Promise<{ connected: boolean; connectedAt: string | null; liveMode: boolean }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("professional_mercadopago_accounts")
    .select("connected_at, live_mode")
    .eq("user_id", professionalId)
    .maybeSingle();

  return { connected: Boolean(data), connectedAt: data?.connected_at ?? null, liveMode: data?.live_mode ?? false };
}
