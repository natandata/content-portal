import { NextResponse } from "next/server";

import { cronSecret } from "@/lib/env";
import { runInstagramInsightsReport } from "@/server/actions/instagram-insights-report";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Roda uma vez por dia (Vercel Cron — ver vercel.json) e gera o relatorio de
 * insights de todo cliente que ligou "Relatorio Automatico" e ainda nao tem
 * relatorio deste mes. Usa a conta marcada como PRINCIPAL de cada cliente --
 * nunca todas as contas dele.
 *
 * `last_auto_report_month` ('YYYY-MM') evita gerar duas vezes no mesmo mes
 * -- mesma ideia do `last_reminder_sent_on` do cron de cobranca.
 *
 * Cap deliberado por execucao: cada cliente devido custa uma chamada
 * completa de `runInstagramInsightsReport` (ate 25 posts, cada um com sua
 * propria busca de insights) -- processar demais numa unica invocacao
 * arriscaria estourar o `maxDuration` da funcao. O que sobrar fica pro dia
 * seguinte (a marca de mes so e gravada em quem for processado agora, entao
 * nada se perde, so atrasa).
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CLIENTS_PER_RUN = 5;

export async function GET(request: Request) {
  const secret = cronSecret();
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const currentMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(new Date())
    .slice(0, 7); // 'YYYY-MM'

  const { data: dueSettings, error } = await admin
    .from("client_instagram_report_settings")
    .select("client_id, auto_report_period_months, last_auto_report_month")
    .eq("auto_report_enabled", true)
    .limit(200); // filtra o mes em memoria abaixo -- poucas linhas esperadas, sem custo real

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const due = (dueSettings ?? [])
    .filter((settings) => settings.last_auto_report_month !== currentMonth)
    .slice(0, MAX_CLIENTS_PER_RUN);

  let processed = 0;
  let skippedNoPrincipal = 0;

  for (const settings of due) {
    const { data: principal } = await admin
      .from("client_instagram_connections")
      .select("id")
      .eq("client_id", settings.client_id)
      .eq("is_principal", true)
      .maybeSingle();

    if (!principal) {
      // Cliente ligou o automatico mas nunca marcou (ou perdeu) uma conta
      // principal -- pula sem erro, ninguem foi notificado disso ainda.
      skippedNoPrincipal += 1;
      continue;
    }

    await runInstagramInsightsReport({
      clientId: settings.client_id,
      connectionId: principal.id,
      periodMonths: (settings.auto_report_period_months as 3 | 6 | 9) ?? 3,
      requestedBy: null,
    });

    // Marca o mes mesmo se a geracao falhou -- reter no mesmo dia nao
    // resolveria uma falha do lado da Composio/Apify; mes que vem tenta de novo.
    await admin
      .from("client_instagram_report_settings")
      .update({ last_auto_report_month: currentMonth })
      .eq("client_id", settings.client_id);

    processed += 1;
  }

  return NextResponse.json({ ok: true, due: due.length, processed, skippedNoPrincipal });
}
