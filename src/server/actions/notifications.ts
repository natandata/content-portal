"use server";

import { z } from "zod";

import { getActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, type ActionResult } from "@/server/result";

const subscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

/** Grava a inscricao deste navegador. Upsert pelo endpoint — reativar e so reenviar. */
export async function subscribeToPushAction(
  input: z.input<typeof subscriptionSchema>,
): Promise<ActionResult<null>> {
  const actor = await getActor();
  if (!actor) return fail("Sessao expirada.");

  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Inscricao invalida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: actor.authUser.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth_key: parsed.data.keys.auth,
      user_agent: null,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return fail(describeError(error, "Nao foi possivel ativar as notificacoes."));
  }

  return done();
}

/** Remove a inscricao deste navegador — usado ao desativar ou trocar de conta. */
export async function unsubscribeFromPushAction(endpoint: string): Promise<ActionResult<null>> {
  const actor = await getActor();
  if (!actor) return fail("Sessao expirada.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", actor.authUser.id);

  if (error) {
    return fail(describeError(error, "Nao foi possivel desativar as notificacoes."));
  }

  return done();
}

/** Marca que a pessoa ja respondeu (ou dispensou) o convite pos-tour. */
export async function dismissNotificationPromptAction(): Promise<ActionResult<null>> {
  const actor = await getActor();
  if (!actor) return fail("Sessao expirada.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_prompted");

  if (error) return fail(error.message);
  return done();
}
