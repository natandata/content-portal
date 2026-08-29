"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireClientActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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
  const { error } = await supabase.rpc("submit_approval", {
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

  return done();
}
