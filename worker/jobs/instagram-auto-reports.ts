import { createAdminClient } from "../../src/lib/supabase/admin";
import { runInstagramInsightsReport } from "../../src/server/actions/instagram-insights-report";

/**
 * Reproduz a orquestracao que hoje mora no corpo da rota
 * `api/cron/instagram-auto-reports` (nao em `runInstagramInsightsReport`,
 * que processa um cliente/conexao por vez) -- gera o relatorio automatico de
 * todo cliente devido, mais os agendamentos avulsos por data. Ver comentario
 * da rota original pra contexto completo (limites, `last_auto_report_month`,
 * `auto_report_day` como minimo, etc).
 */
const MAX_CLIENTS_PER_RUN = 5;
const MAX_SCHEDULED_PER_RUN = 5;

async function main() {
  const admin = createAdminClient();
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const currentMonth = todayIso.slice(0, 7);
  const currentDay = Number(todayIso.slice(8, 10));

  const { data: dueSettings, error } = await admin
    .from("client_instagram_report_settings")
    .select("client_id, auto_report_period_months, auto_report_day, last_auto_report_month")
    .eq("auto_report_enabled", true)
    .limit(200);

  if (error) throw new Error(error.message);

  const due = (dueSettings ?? [])
    .filter((settings) => settings.last_auto_report_month !== currentMonth && currentDay >= settings.auto_report_day)
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
      skippedNoPrincipal += 1;
      continue;
    }

    await runInstagramInsightsReport({
      clientId: settings.client_id,
      connectionId: principal.id,
      periodMonths: (settings.auto_report_period_months as 3 | 6 | 9) ?? 3,
      requestedBy: null,
    });

    await admin
      .from("client_instagram_report_settings")
      .update({ last_auto_report_month: currentMonth })
      .eq("client_id", settings.client_id);

    processed += 1;
  }

  const { data: dueSchedules } = await admin
    .from("instagram_scheduled_reports")
    .select("id, client_id, connection_id, period_months")
    .eq("status", "pending")
    .lte("scheduled_date", todayIso)
    .limit(MAX_SCHEDULED_PER_RUN);

  let scheduledProcessed = 0;

  for (const scheduled of dueSchedules ?? []) {
    const result = await runInstagramInsightsReport({
      clientId: scheduled.client_id,
      connectionId: scheduled.connection_id,
      periodMonths: scheduled.period_months as 3 | 6 | 9,
      requestedBy: null,
    });

    await admin
      .from("instagram_scheduled_reports")
      .update({
        status: result.ok ? "done" : "failed",
        error: result.ok ? null : result.error,
        processed_at: new Date().toISOString(),
      })
      .eq("id", scheduled.id);

    scheduledProcessed += 1;
  }

  console.log(
    `[instagram-auto-reports] due=${due.length} processed=${processed} skippedNoPrincipal=${skippedNoPrincipal} scheduledDue=${dueSchedules?.length ?? 0} scheduledProcessed=${scheduledProcessed}`,
  );
}

// Sem process.exit(0) no sucesso de proposito -- ver comentario em
// autentique-reconcile.ts (crash de libuv no Windows com saida forcada).
main().catch((err) => {
  console.error("[instagram-auto-reports] failed:", err);
  process.exit(1);
});
