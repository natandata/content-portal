"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { ClientMetricRow } from "@/types/database";

const metricSchema = z.object({
  clientId: z.uuid("Selecione um cliente"),
  metricName: z.string().trim().min(1, "Informe o nome da metrica"),
  metricValue: z.coerce.number("Informe um valor numerico"),
  periodDate: z.iso.date("Informe o mes de referencia"),
  notes: z.string().trim().max(2000).optional(),
});

function revalidateMetrics(clientId?: string) {
  revalidatePath("/professional/reports");
  if (clientId) {
    revalidatePath(`/professional/clients/${clientId}`);
  }
}

export async function createMetricAction(
  input: z.input<typeof metricSchema>,
): Promise<ActionResult<ClientMetricRow>> {
  const actor = await requireStaff();

  const parsed = metricSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();
  // period_date normaliza para o dia 1 do mes escolhido — agrupa o historico.
  const periodDate = `${parsed.data.periodDate.slice(0, 7)}-01`;

  const { data, error } = await supabase
    .from("client_metrics")
    .insert({
      client_id: parsed.data.clientId,
      created_by: actor.authUser.id,
      metric_name: parsed.data.metricName,
      metric_value: parsed.data.metricValue,
      period_date: periodDate,
      notes: parsed.data.notes || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel salvar a metrica."));
  }

  revalidateMetrics(parsed.data.clientId);
  return ok(data);
}

export async function updateMetricAction(
  metricId: string,
  input: z.input<typeof metricSchema>,
): Promise<ActionResult<ClientMetricRow>> {
  await requireStaff();

  const parsed = metricSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();
  const periodDate = `${parsed.data.periodDate.slice(0, 7)}-01`;

  const { data, error } = await supabase
    .from("client_metrics")
    .update({
      metric_name: parsed.data.metricName,
      metric_value: parsed.data.metricValue,
      period_date: periodDate,
      notes: parsed.data.notes || null,
    })
    .eq("id", metricId)
    .select("*")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel atualizar a metrica."));
  }

  revalidateMetrics(data.client_id);
  return ok(data);
}

export async function deleteMetricAction(metricId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data: metric } = await supabase
    .from("client_metrics")
    .select("client_id")
    .eq("id", metricId)
    .maybeSingle();

  if (!metric) return fail("Metrica nao encontrada.");

  const { error } = await supabase.from("client_metrics").delete().eq("id", metricId);
  if (error) {
    return fail(describeError(error, "Nao foi possivel excluir a metrica."));
  }

  revalidateMetrics(metric.client_id);
  return done();
}
