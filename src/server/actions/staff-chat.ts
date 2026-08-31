"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { StaffChatMessageRow } from "@/types/database";

const sendSchema = z.object({
  professionalId: z.uuid(),
  body: z.string().trim().min(1, "Escreva uma mensagem.").max(4000),
});

function revalidateStaffChat(professionalId: string) {
  revalidatePath("/admin/chat");
  revalidatePath(`/admin/chat/${professionalId}`);
  revalidatePath("/professional/chat");
  revalidatePath("/professional/chat/admin");
  revalidatePath("/admin/dashboard");
  revalidatePath("/professional/dashboard");
}

/** Envia uma mensagem no thread admin <-> profissional. */
export async function sendStaffChatMessageAction(
  input: z.input<typeof sendSchema>,
): Promise<ActionResult<StaffChatMessageRow>> {
  const actor = await getActor();
  if (!actor) return fail("Sessao expirada.");

  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Nao foi possivel enviar a mensagem."));
  }

  const supabase = await createClient();
  const { data: message, error } = await supabase.rpc("send_staff_chat_message", {
    p_professional_id: parsed.data.professionalId,
    p_body: parsed.data.body,
  });

  if (error || !message) {
    return fail(describeError(error, "Nao foi possivel enviar a mensagem."));
  }

  revalidateStaffChat(parsed.data.professionalId);
  return ok(message);
}

export async function markStaffChatReadAction(professionalId: string): Promise<ActionResult<null>> {
  const actor = await getActor();
  if (!actor) return fail("Sessao expirada.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_staff_chat_read", {
    p_professional_id: professionalId,
  });

  if (error) return fail(describeError(error, "Nao foi possivel marcar como lido."));

  revalidatePath("/admin/chat");
  revalidatePath("/professional/chat");
  return done();
}
