import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Registra uma linha no feed de "Atividades recentes" do cliente. Melhor
 * esforco de proposito — igual as notificacoes push: se o log falhar, a acao
 * que o disparou ja aconteceu e nao pode ser desfeita por causa disso.
 */
export async function logClientActivity(
  supabase: Client,
  clientId: string,
  actorName: string,
  action: string,
): Promise<void> {
  await supabase
    .from("client_activities")
    .insert({ client_id: clientId, actor_name: actorName, action })
    .then(
      () => {},
      () => {},
    );
}
