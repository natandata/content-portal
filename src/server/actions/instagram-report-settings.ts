"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, type ActionResult } from "@/server/result";
import type { ClientInstagramReportSettingsRow } from "@/types/database";

const REPORTS_PATH = "/professional/reports";

/** Preferencia de relatorio automatico do cliente — usado pelo toggle na tela de Relatorios. */
export async function loadInstagramReportSettings(clientId: string): Promise<{
  autoReportEnabled: boolean;
  autoReportPeriodMonths: 3 | 6 | 9;
  autoReportDay: number;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("client_instagram_report_settings")
    .select("auto_report_enabled, auto_report_period_months, auto_report_day")
    .eq("client_id", clientId)
    .maybeSingle();

  return {
    autoReportEnabled: data?.auto_report_enabled ?? false,
    autoReportPeriodMonths: (data?.auto_report_period_months as 3 | 6 | 9 | undefined) ?? 3,
    autoReportDay: data?.auto_report_day ?? 1,
  };
}

const settingsSchema = z.object({
  clientId: z.uuid(),
  autoReportEnabled: z.boolean(),
  autoReportPeriodMonths: z.union([z.literal(3), z.literal(6), z.literal(9)]),
  autoReportDay: z.number().int().min(1).max(28),
});

/** Liga/desliga o relatorio automatico mensal do cliente — upsert porque a linha so nasce no primeiro save. */
export async function saveInstagramReportSettingsAction(
  input: z.input<typeof settingsSchema>,
): Promise<ActionResult<null>> {
  await requireStaff();

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("client_instagram_report_settings").upsert(
    {
      client_id: parsed.data.clientId,
      auto_report_enabled: parsed.data.autoReportEnabled,
      auto_report_period_months: parsed.data.autoReportPeriodMonths,
      auto_report_day: parsed.data.autoReportDay,
    } satisfies Partial<ClientInstagramReportSettingsRow> & { client_id: string },
    { onConflict: "client_id" },
  );

  if (error) {
    return fail(describeError(error, "Nao foi possivel salvar a preferencia de relatorio automatico."));
  }

  revalidatePath(REPORTS_PATH);
  return done();
}
