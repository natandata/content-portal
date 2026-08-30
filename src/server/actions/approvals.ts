"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireClientActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveClientStaffIds, sendPushToUsers } from "@/lib/push";
import { describeError, done, fail, firstIssue, type ActionResult } from "@/server/result";

const schema = z
  .object({
    contentId: z.uuid(),
    status: z.enum(["approved", "rejected", "revision_requested"]),
    comment: z.string().trim().max(2000).optional(),
  })
  .refine(
    (value) => value.status === "approved" || (value.comment && value.comment.length >= 3),
    { message: "Descreva o motivo para o profissional entender o que ajustar.", path: ["comment"] },
  );

/**
 * Aprovar / reprovar / solicitar alteracao.
 * Toda a transacao (approval + status + historico) acontece no RPC.
 */
export async function submitApprovalAction(
  input: z.input<typeof schema>,
): Promise<ActionResult<null>> {
  await requireClientActor();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();
  const { data: content, error } = await supabase.rpc("submit_approval", {
    p_content_id: parsed.data.contentId,
    p_status: parsed.data.status,
    p_comment: parsed.data.comment || null,
  });

  if (error) {
    return fail(describeError(error, "Nao foi possivel registrar sua resposta."));
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
