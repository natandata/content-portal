import { NextResponse } from "next/server";

import { getPublishingLimit } from "@/lib/composio/instagram-publish";
import { cronSecret } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { runInstagramPublish } from "@/server/actions/instagram-publish";

/**
 * Roda uma vez por dia (Vercel Cron -- ver vercel.json) e publica todo
 * conteudo com `publish_status='scheduled'` cuja `scheduled_date` ja
 * chegou. So data, sem hora -- mesma limitacao ja aceita no cron de
 * relatorios de Instagram (plano Hobby roda 1x/dia em horario impreciso).
 *
 * Cap deliberado por execucao: cada publicacao envolve criar um container
 * na Meta e esperar ele processar -- o que sobrar fica pro dia seguinte
 * (nada se perde, so atrasa, mesmo raciocinio do cron de relatorios).
 *
 * Checa a cota de publicacao (`getPublishingLimit`) uma vez por conexao
 * antes de processar seus itens -- se perto do teto, adia em vez de
 * estourar o limite no meio do lote (mantem `publish_status='scheduled'`,
 * tenta de novo no proximo dia).
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PER_RUN = 5;
const QUOTA_SKIP_THRESHOLD = 0.9; // acima de 90% da cota, adia

export async function GET(request: Request) {
  const secret = cronSecret();
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  const { data: due, error } = await admin
    .from("contents")
    .select("id, client_id, instagram_connection_id")
    .eq("publish_status", "scheduled")
    .lte("scheduled_date", todayIso)
    .limit(MAX_PER_RUN);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

  return NextResponse.json({ ok: true, due: due?.length ?? 0, processed, skippedQuota });
}
