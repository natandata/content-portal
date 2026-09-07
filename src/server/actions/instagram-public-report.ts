"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runInstagramProfileScraper } from "@/lib/apify/client";
import { apifyConfig } from "@/lib/env";
import { requireStaff } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { describeError, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { InstagramPublicReportRow } from "@/types/database";

const startSchema = z.object({
  clientId: z.uuid("Selecione um cliente"),
  // Aceita com ou sem "@" na frente -- normaliza antes de salvar.
  username: z
    .string()
    .trim()
    .min(1, "Informe o @ do perfil")
    .transform((value) => value.replace(/^@/, "").trim())
    .refine((value) => value.length > 0 && value.length <= 60, "Informe um @ valido"),
});

/**
 * Dispara o scrape de um perfil publico do Instagram. Cria a linha
 * 'pending', chama a Apify e sobe para 'running' -- o webhook
 * (`api/webhooks/apify`) e quem completa com o resultado depois.
 */
export async function startPublicReportAction(
  input: z.input<typeof startSchema>,
): Promise<ActionResult<InstagramPublicReportRow>> {
  const actor = await requireStaff();

  if (!apifyConfig()) {
    return fail("Relatorio de perfil publico ainda nao foi configurado nesta instalacao.");
  }

  const parsed = startSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  // RLS confirma que o ator pode ver este cliente antes de qualquer gasto na Apify.
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", parsed.data.clientId)
    .maybeSingle();
  if (!client) return fail("Cliente nao encontrado.");

  const admin = createAdminClient();
  const { data: report, error: insertError } = await admin
    .from("instagram_public_reports")
    .insert({
      client_id: parsed.data.clientId,
      username: parsed.data.username,
      requested_by: actor.authUser.id,
    })
    .select("*")
    .single();

  if (insertError || !report) {
    return fail(describeError(insertError, "Nao foi possivel criar o relatorio."));
  }

  const runResult = await runInstagramProfileScraper(report.id, parsed.data.username);
  if (!runResult.ok) {
    await admin
      .from("instagram_public_reports")
      .update({ status: "failed", error: runResult.error, completed_at: new Date().toISOString() })
      .eq("id", report.id);
    return fail(runResult.error);
  }

  const { data: updated, error: updateError } = await admin
    .from("instagram_public_reports")
    .update({ status: "running", apify_run_id: runResult.data.runId })
    .eq("id", report.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return fail(describeError(updateError, "Relatorio disparado, mas houve falha ao salvar o status."));
  }

  revalidatePath("/professional/reports");
  return ok(updated);
}
