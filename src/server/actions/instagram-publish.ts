"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { runInstagramPublish } from "@/server/instagram/run-publish";
import { describeError, done, fail, firstIssue, type ActionResult } from "@/server/result";

/**
 * Publicacao direta no Instagram (feed/carrossel) a partir do calendario de
 * conteudo. A logica de fato (`runInstagramPublish`) mora em
 * `server/instagram/run-publish.ts` -- fora de um arquivo "use server" de
 * proposito, pra poder ser importada tanto pela acao imediata (aqui embaixo)
 * quanto pelo worker de agendamento (Railway), que roda fora do build do
 * Next e nao pode importar de um arquivo "use server".
 */

function revalidateContentPaths(clientId: string, contentId: string) {
  revalidatePath(`/professional/content/${contentId}`);
  revalidatePath(`/admin/content/${contentId}`);
  revalidatePath("/professional/content");
  revalidatePath("/admin/content");
  revalidatePath(`/professional/clients/${clientId}`);
  revalidatePath(`/admin/clients/${clientId}`);
}

/** Publicar agora, disparado pelo staff -- escolhe a conexao na hora do clique. */
export async function publishContentNowAction(contentId: string, connectionId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data: content, error } = await supabase
    .from("contents")
    .update({ instagram_connection_id: connectionId })
    .eq("id", contentId)
    .select("client_id")
    .single();
  if (error || !content) return fail(describeError(error, "Conteudo nao encontrado."));

  const result = await runInstagramPublish(contentId);
  revalidateContentPaths(content.client_id, contentId);

  if (!result.ok) return fail(result.error ?? "Nao foi possivel publicar.");
  return done();
}

const scheduleSchema = z.object({
  contentId: z.uuid(),
  connectionId: z.uuid(),
  scheduledDate: z.iso.date(),
});

/** Agenda a publicacao pra uma data -- so data, sem hora (mesma limitacao ja aceita nos relatorios de Instagram). */
export async function scheduleContentPublishAction(
  input: z.input<typeof scheduleSchema>,
): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error.issues, "Dados invalidos."));

  const supabase = await createClient();
  const { data: content } = await supabase
    .from("contents")
    .select("status, client_id")
    .eq("id", parsed.data.contentId)
    .maybeSingle();
  if (!content) return fail("Conteudo nao encontrado.");
  if (content.status !== "approved") return fail("So e possivel agendar um conteudo aprovado.");

  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  if (parsed.data.scheduledDate < todayIso) return fail("Escolha uma data de hoje em diante.");

  const { error } = await supabase
    .from("contents")
    .update({
      instagram_connection_id: parsed.data.connectionId,
      scheduled_date: parsed.data.scheduledDate,
      publish_status: "scheduled",
      publish_error: null,
    })
    .eq("id", parsed.data.contentId);
  if (error) return fail(describeError(error, "Nao foi possivel agendar a publicacao."));

  revalidateContentPaths(content.client_id, parsed.data.contentId);
  return done();
}

/** Cancela um agendamento pendente -- so mexe se ainda estiver `scheduled` (nunca cancela algo ja publicando/publicado). */
export async function cancelScheduledPublishAction(contentId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contents")
    .update({ publish_status: "idle" })
    .eq("id", contentId)
    .eq("publish_status", "scheduled")
    .select("client_id")
    .maybeSingle();
  if (error) return fail(describeError(error, "Nao foi possivel cancelar o agendamento."));
  if (!data) return fail("Nao ha agendamento pendente pra cancelar.");

  revalidateContentPaths(data.client_id, contentId);
  return done();
}
