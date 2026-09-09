import { getPublishingLimit } from "../../src/lib/composio/instagram-publish";
import { createAdminClient } from "../../src/lib/supabase/admin";
import { runInstagramPublish } from "../../src/server/instagram/run-publish";

/**
 * Reproduz o loop de lote/checagem de cota que hoje mora no corpo da rota
 * `api/cron/instagram-publish` (nao em `runInstagramPublish`) -- ver
 * comentario da rota original pra contexto completo.
 */
const MAX_PER_RUN = 5;
const QUOTA_SKIP_THRESHOLD = 0.9; // acima de 90% da cota, adia

async function main() {
  const admin = createAdminClient();
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  const { data: due, error } = await admin
    .from("contents")
    .select("id, client_id, instagram_connection_id")
    .eq("publish_status", "scheduled")
    .lte("scheduled_date", todayIso)
    .limit(MAX_PER_RUN);

  if (error) throw new Error(error.message);

  const quotaCache = new Map<string, boolean>(); // connectionId -> "pode publicar"
  let processed = 0;
  let skippedQuota = 0;

  for (const item of due ?? []) {
    if (!item.instagram_connection_id) continue;

    if (!quotaCache.has(item.instagram_connection_id)) {
      const { data: connection } = await admin
        .from("client_instagram_connections")
        .select("composio_connection_id")
        .eq("id", item.instagram_connection_id)
        .maybeSingle();

      let canPublish = true;
      if (connection) {
        const limitResult = await getPublishingLimit(item.client_id, connection.composio_connection_id);
        if (limitResult.ok && limitResult.data.quotaUsage != null && limitResult.data.quotaTotal != null) {
          canPublish = limitResult.data.quotaUsage / limitResult.data.quotaTotal < QUOTA_SKIP_THRESHOLD;
        }
      }
      quotaCache.set(item.instagram_connection_id, canPublish);
    }

    if (!quotaCache.get(item.instagram_connection_id)) {
      skippedQuota += 1;
      continue;
    }

    await runInstagramPublish(item.id);
    processed += 1;
  }

  console.log(`[instagram-publish] due=${due?.length ?? 0} processed=${processed} skippedQuota=${skippedQuota}`);
}

// Sem process.exit(0) no sucesso de proposito -- ver comentario em
// autentique-reconcile.ts (crash de libuv no Windows com saida forcada).
main().catch((err) => {
  console.error("[instagram-publish] failed:", err);
  process.exit(1);
});
