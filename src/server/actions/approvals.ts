"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireClientActor } from "@/lib/auth";
import { pickLocale, type Locale } from "@/lib/i18n/locale";
import { getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { resolveClientStaffIds, sendPushToUsers } from "@/lib/push";
import { logClientActivity } from "@/server/activity";
import { describeError, done, fail, firstIssue, type ActionResult } from "@/server/result";

/** Schema por idioma: a mensagem do `.refine` precisa nascer no idioma certo. */
function buildSchema(locale: Locale) {
  return z
    .object({
      contentId: z.uuid(),
      status: z.enum(["approved", "rejected", "revision_requested"]),
      comment: z.string().trim().max(2000).optional(),
    })
    .refine((value) => value.status === "approved" || (value.comment && value.comment.length >= 3), {
      message: pickLocale(
        locale,
        "Descreva o motivo para o profissional entender o que ajustar.",
        "Describe the reason so the professional understands what to adjust.",
      ),
      path: ["comment"],
    });
}

/**
 * Aprovar / reprovar / solicitar alteracao.
 * Toda a transacao (approval + status + historico) acontece no RPC.
 */
export async function submitApprovalAction(
  input: z.input<ReturnType<typeof buildSchema>>,
): Promise<ActionResult<null>> {
  const actor = await requireClientActor();
  const locale = await getLocale();

  const parsed = buildSchema(locale).safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, pickLocale(locale, "Dados invalidos.", "Invalid data.")));
  }

  const supabase = await createClient();
  const { data: content, error } = await supabase.rpc("submit_approval", {
    p_content_id: parsed.data.contentId,
    p_status: parsed.data.status,
    p_comment: parsed.data.comment || null,
  });

  if (error) {
    return fail(
      describeError(
        error,
        pickLocale(locale, "Nao foi possivel registrar sua resposta.", "Could not record your response."),
      ),
    );
  }

  revalidatePath("/client/content");
  revalidatePath(`/client/content/${parsed.data.contentId}`);
  revalidatePath("/client/dashboard");
  revalidatePath("/admin/dashboard");
  revalidatePath("/professional/dashboard");
  revalidatePath("/admin/approvals");
  revalidatePath("/professional/approvals");
  revalidatePath("/admin/content");
  revalidatePath("/professional/content");

  if (content) {
    const activityAction = {
      approved: `Aprovou o conteudo "${content.title}"`,
      rejected: `Reprovou o conteudo "${content.title}"`,
      revision_requested: `Pediu alteracao no conteudo "${content.title}"`,
    }[parsed.data.status];
    await logClientActivity(supabase, content.client_id, actor.displayName, activityAction);

    const notice = {
      approved: { title: "Conteudo aprovado", body: `O cliente aprovou "${content.title}".` },
      rejected: { title: "Conteudo reprovado", body: `O cliente reprovou "${content.title}".` },
      revision_requested: {
        title: "Ajuste solicitado",
        body: `O cliente pediu alteracao em "${content.title}".`,
      },
    }[parsed.data.status];

    // URL diferente por publico: admin e profissional moram em prefixos distintos.
    const { professionalId, adminIds } = await resolveClientStaffIds(content.client_id);
    const tag = `content-${content.id}`;

    await Promise.all([
      professionalId
        ? sendPushToUsers([professionalId], {
            ...notice,
            url: `/professional/content/${content.id}`,
            tag,
          })
        : Promise.resolve(),
      adminIds.length > 0
        ? sendPushToUsers(adminIds, { ...notice, url: `/admin/content/${content.id}`, tag })
        : Promise.resolve(),
    ]).catch(() => {});
  }

  return done();
}
