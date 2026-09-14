"use server";

import { requireClientActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, type ActionResult } from "@/server/result";

/**
 * Mesmo texto vira a chave de traducao em `dict.historyAction` (ver
 * `src/lib/i18n/dictionary.ts`) -- convencao ja usada pelas outras acoes do
 * historico (`Cliente aprovou o conteudo`, etc.), o texto em si e a chave.
 */
const VIEW_ACTION = "Cliente visualizou o conteudo";

/**
 * Registra no historico a primeira vez que o cliente abre um conteudo --
 * prova que ele viu, evitando "eu nao vi isso" depois. Idempotente: so
 * grava uma vez por conteudo, chamadas seguintes nao duplicam a linha.
 */
export async function recordContentViewedAction(contentId: string): Promise<ActionResult<null>> {
  const actor = await requireClientActor();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("approval_history")
    .select("id")
    .eq("content_id", contentId)
    .eq("action", VIEW_ACTION)
    .maybeSingle();

  if (existing) return done();

  const { error } = await supabase.from("approval_history").insert({
    content_id: contentId,
    user_id: actor.authUser.id,
    actor_name: actor.displayName,
    action: VIEW_ACTION,
  });

  if (error) return fail(describeError(error, "Nao foi possivel registrar a visualizacao."));
  return done();
}
