"use server";

import { getActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { done, fail, type ActionResult } from "@/server/result";

/**
 * Marca o tour como visto na conta de quem esta logado. O RPC resolve sozinho
 * se e equipe ou cliente — nada vem do navegador alem da sessao.
 */
export async function completeTourAction(): Promise<ActionResult<null>> {
  const actor = await getActor();
  if (!actor) return fail("Sessao expirada.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_tour_seen");

  if (error) return fail(error.message);
  return done();
}
