"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { describeError, done, fail, type ActionResult } from "@/server/result";

const REPORTS_PATH = "/professional/reports";

/**
 * Exclusao/limpeza dos relatorios de Instagram (insights e perfil publico --
 * testes acumulam varios rapido). Nenhuma das duas tabelas tem policy de
 * delete (so select, ver migrations) -- mesmo padrao do resto do modulo:
 * confirma visibilidade do cliente com o client comum (RLS), executa a
 * exclusao com o admin. Nunca mexe em `contracts`/Documentos -- um relatorio
 * ja entregue la fica intacto mesmo se a linha de origem for apagada.
 */
async function assertClientVisible(clientId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  return Boolean(data);
}

export async function deleteInstagramInsightsReportAction(
  reportId: string,
  clientId: string,
): Promise<ActionResult<null>> {
  await requireStaff();
  if (!(await assertClientVisible(clientId))) return fail("Cliente nao encontrado.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("instagram_insights_reports")
    .delete()
    .eq("id", reportId)
    .eq("client_id", clientId);
  if (error) return fail(describeError(error, "Nao foi possivel excluir o relatorio."));

  revalidatePath(REPORTS_PATH);
  return done();
}

/** Apaga TODOS os relatorios de insights do cliente -- limpeza em massa (testes acumulam varios rapido). */
export async function clearInstagramInsightsReportsAction(clientId: string): Promise<ActionResult<null>> {
  await requireStaff();
  if (!(await assertClientVisible(clientId))) return fail("Cliente nao encontrado.");

  const admin = createAdminClient();
  const { error } = await admin.from("instagram_insights_reports").delete().eq("client_id", clientId);
  if (error) return fail(describeError(error, "Nao foi possivel limpar os relatorios."));

  revalidatePath(REPORTS_PATH);
  return done();
}

export async function deleteInstagramPublicReportAction(
  reportId: string,
  clientId: string,
): Promise<ActionResult<null>> {
  await requireStaff();
  if (!(await assertClientVisible(clientId))) return fail("Cliente nao encontrado.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("instagram_public_reports")
    .delete()
    .eq("id", reportId)
    .eq("client_id", clientId);
  if (error) return fail(describeError(error, "Nao foi possivel excluir o relatorio."));

  revalidatePath(REPORTS_PATH);
  return done();
}

/** Apaga TODOS os relatorios de perfil publico do cliente -- mesma limpeza em massa, pro lado da Apify. */
export async function clearInstagramPublicReportsAction(clientId: string): Promise<ActionResult<null>> {
  await requireStaff();
  if (!(await assertClientVisible(clientId))) return fail("Cliente nao encontrado.");

  const admin = createAdminClient();
  const { error } = await admin.from("instagram_public_reports").delete().eq("client_id", clientId);
  if (error) return fail(describeError(error, "Nao foi possivel limpar os relatorios."));

  revalidatePath(REPORTS_PATH);
  return done();
}
