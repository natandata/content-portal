import { NextResponse } from "next/server";

import { fetchApifyRun, fetchDatasetItems } from "@/lib/apify/client";
import { apifyConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Webhook da Apify -- confirma a conclusao (ou falha) de um run do scraper
 * de perfil publico do Instagram (relatorio 1).
 *
 * Autenticacao: o segredo vai colado na propria URL do webhook (query
 * `token`), gerado por nos na hora de disparar o run
 * (`runInstagramProfileScraper`, em `src/lib/apify/client.ts`) -- a Apify
 * nao assina a entrega, entao esse e o unico jeito de confirmar que quem
 * chamou foi mesmo a Apify.
 *
 * Idempotencia: sem tabela extra, ao contrario da Stripe/Calendly -- cada
 * run mapeia 1:1 para uma linha de `instagram_public_reports`, entao o
 * proprio `status` da linha serve de trava. So processa se ainda estiver
 * 'running'; o UPDATE final e condicionado a `status = 'running'` (transicao
 * de estado guardada, atomica no Postgres), entao uma reentrega da mesma
 * notificacao nao processa duas vezes.
 */
export const runtime = "nodejs";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function POST(request: Request) {
  const config = apifyConfig();
  if (!config) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const reportId = url.searchParams.get("reportId");
  if (!token || token !== config.webhookSecret || !reportId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: report } = await admin
    .from("instagram_public_reports")
    .select("id, apify_run_id, status")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ error: "Relatorio nao encontrado" }, { status: 404 });
  }
  if (report.status !== "running" || !report.apify_run_id) {
    // Ja processado (reentrega da mesma notificacao) -- nada a fazer.
    return NextResponse.json({ received: true, duplicate: true });
  }

  const runResult = await fetchApifyRun(report.apify_run_id);
  if (!runResult.ok) {
    await claimFailure(admin, reportId, runResult.error);
    return NextResponse.json({ error: runResult.error }, { status: 500 });
  }

  const { status, datasetId } = runResult.data;

  if (status !== "SUCCEEDED") {
    // FAILED, TIMED-OUT ou ABORTED -- reportado pela propria Apify.
    await claimFailure(admin, reportId, `A Apify reportou o run como ${status}.`);
    return NextResponse.json({ received: true });
  }

  if (!datasetId) {
    await claimFailure(admin, reportId, "Run concluido sem dataset de resultado.");
    return NextResponse.json({ received: true });
  }

  const itemsResult = await fetchDatasetItems(datasetId);
  if (!itemsResult.ok) {
    await claimFailure(admin, reportId, itemsResult.error);
    return NextResponse.json({ error: itemsResult.error }, { status: 500 });
  }

  const profile = itemsResult.data[0] as (Record<string, unknown> & { latestPosts?: unknown[] }) | undefined;
  if (!profile) {
    await claimFailure(admin, reportId, "Perfil nao encontrado, privado ou inexistente.");
    return NextResponse.json({ received: true });
  }

  const { latestPosts, ...summary } = profile;

  const { error, data } = await admin
    .from("instagram_public_reports")
    .update({
      status: "done",
      apify_dataset_id: datasetId,
      summary,
      posts: latestPosts ?? [],
      completed_at: new Date().toISOString(),
    })
    .eq("id", reportId)
    .eq("status", "running")
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ received: true, duplicate: true });

  return NextResponse.json({ received: true });
}

/** Guarda a transicao para 'failed' -- so aplica se a linha ainda estiver 'running' (mesma trava do caminho de sucesso). */
async function claimFailure(admin: AdminClient, reportId: string, message: string) {
  await admin
    .from("instagram_public_reports")
    .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("status", "running");
}
