"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, type ActionResult } from "@/server/result";
import type { InstagramScheduledReportRow } from "@/types/database";

const REPORTS_PATH = "/professional/reports";

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const scheduleSchema = z.object({
  clientId: z.uuid(),
  connectionId: z.uuid(),
  periodMonths: z.union([z.literal(3), z.literal(6), z.literal(9)]),
  scheduledDate: z.iso.date("Informe uma data valida"),
});

/**
 * Agenda a emissao do relatorio pra uma data especifica -- so data, sem
 * hora: o cron roda 1x/dia (plano Hobby da Vercel) num horario que ela
 * mesma escolhe, entao "hora exata" nunca seria cumprida de verdade.
 */
export async function scheduleInstagramReportAction(
  input: z.input<typeof scheduleSchema>,
): Promise<ActionResult<null>> {
  const actor = await requireStaff();

  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }
  if (parsed.data.scheduledDate < todayIso()) {
    return fail("A data precisa ser hoje ou no futuro.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("instagram_scheduled_reports").insert({
    client_id: parsed.data.clientId,
    connection_id: parsed.data.connectionId,
    period_months: parsed.data.periodMonths,
    scheduled_date: parsed.data.scheduledDate,
    requested_by: actor.authUser.id,
  });

  if (error) {
    return fail(describeError(error, "Nao foi possivel agendar o relatorio."));
  }

  revalidatePath(REPORTS_PATH);
  return done();
}

export async function cancelScheduledReportAction(id: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  // So cancela o que ainda nao rodou -- um ja processado vira historico.
  const { error } = await supabase.from("instagram_scheduled_reports").delete().eq("id", id).eq("status", "pending");
  if (error) {
    return fail(describeError(error, "Nao foi possivel cancelar o agendamento."));
  }

  revalidatePath(REPORTS_PATH);
  return done();
}

/** Agendamentos pendentes de um cliente -- usado pra listar na tela de Relatorios. */
export async function loadScheduledReports(clientId: string): Promise<InstagramScheduledReportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("instagram_scheduled_reports")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "pending")
    .order("scheduled_date");

  return data ?? [];
}
