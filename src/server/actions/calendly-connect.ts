"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { deleteCalendlyWebhook, listCalendlyEventTypes } from "@/lib/calendly/api";
import { calendlyAuthUrl } from "@/lib/calendly/client";
import { CALENDLY_OAUTH_STATE_COOKIE } from "@/lib/calendly/meetings-constants";
import { MEETINGS_SETTINGS_PATH } from "@/lib/meetings-constants";
import { createAdminClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";

export async function startCalendlyConnectAction(): Promise<ActionResult<{ url: string }>> {
  const actor = await requireStaff();
  if (actor.role !== "professional") {
    return fail("Apenas profissionais conectam a propria agenda.");
  }

  const state = randomUUID();
  const url = calendlyAuthUrl(state);
  if (!url) {
    return fail("Reunioes por Calendly ainda nao foram configuradas nesta instalacao.");
  }

  const store = await cookies();
  store.set(CALENDLY_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return ok({ url });
}

export async function disconnectCalendlyAction(): Promise<ActionResult<null>> {
  const actor = await requireStaff();
  if (actor.role !== "professional") return fail("Sem permissao.");

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("professional_calendly_accounts")
    .select("webhook_subscription_uri")
    .eq("user_id", actor.authUser.id)
    .maybeSingle();

  if (account?.webhook_subscription_uri) {
    await deleteCalendlyWebhook(actor.authUser.id, account.webhook_subscription_uri);
  }

  const { error } = await admin
    .from("professional_calendly_accounts")
    .delete()
    .eq("user_id", actor.authUser.id);

  if (error) {
    return fail(describeError(error, "Nao foi possivel desconectar o Calendly."));
  }

  revalidatePath(MEETINGS_SETTINGS_PATH);
  return done();
}

/**
 * Estado da conexao — usado pela tela de configuracoes e por
 * `requestMeetingAction` para decidir se mostra o fluxo de link unico ou o
 * de propor data/hora manualmente.
 */
export async function loadCalendlyConnectionStatus(professionalId: string): Promise<{
  connected: boolean;
  eventTypeUri: string | null;
  eventTypeName: string | null;
  eventTypeDuration: number | null;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("professional_calendly_accounts")
    .select("event_type_uri, event_type_name, event_type_duration")
    .eq("user_id", professionalId)
    .maybeSingle();

  return {
    connected: Boolean(data),
    eventTypeUri: data?.event_type_uri ?? null,
    eventTypeName: data?.event_type_name ?? null,
    eventTypeDuration: data?.event_type_duration ?? null,
  };
}

export interface CalendlyEventTypeOption {
  uri: string;
  name: string;
  durationMinutes: number;
  schedulingUrl: string;
}

/** Tipos de evento que ja existem na conta do profissional — o app nao cria nenhum. */
export async function listCalendlyEventTypesAction(): Promise<ActionResult<CalendlyEventTypeOption[]>> {
  const actor = await requireStaff();
  if (actor.role !== "professional") return fail("Sem permissao.");

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("professional_calendly_accounts")
    .select("calendly_uri")
    .eq("user_id", actor.authUser.id)
    .maybeSingle();

  if (!account) return fail("Conecte o Calendly primeiro.");

  const result = await listCalendlyEventTypes(actor.authUser.id, account.calendly_uri);
  if (!result.ok) return fail(result.error);

  return ok(
    result.data.map((item) => ({
      uri: item.uri,
      name: item.name,
      durationMinutes: item.durationMinutes,
      schedulingUrl: item.schedulingUrl,
    })),
  );
}

const setEventTypeSchema = z.object({
  eventTypeUri: z.url(),
  name: z.string().trim().min(1),
  durationMinutes: z.number().int().positive(),
  schedulingUrl: z.url(),
});

/**
 * Grava o Event Type escolhido. Recebe os campos ja resolvidos por
 * `listCalendlyEventTypesAction` (o proprio picker) em vez de rebuscar na
 * Calendly, para nao ter uma segunda chamada so para confirmar o que o
 * dropdown ja mostrou.
 */
export async function setCalendlyEventTypeAction(
  input: z.input<typeof setEventTypeSchema>,
): Promise<ActionResult<null>> {
  const actor = await requireStaff();
  if (actor.role !== "professional") return fail("Sem permissao.");

  const parsed = setEventTypeSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error.issues, "Dados invalidos."));

  const admin = createAdminClient();
  const { error } = await admin
    .from("professional_calendly_accounts")
    .update({
      event_type_uri: parsed.data.eventTypeUri,
      event_type_name: parsed.data.name,
      event_type_duration: parsed.data.durationMinutes,
      event_type_scheduling_url: parsed.data.schedulingUrl,
    })
    .eq("user_id", actor.authUser.id);

  if (error) {
    return fail(describeError(error, "Nao foi possivel salvar o tipo de reuniao."));
  }

  revalidatePath(MEETINGS_SETTINGS_PATH);
  return done();
}

