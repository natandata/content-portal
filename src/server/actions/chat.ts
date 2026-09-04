"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActor } from "@/lib/auth";
import { pickLocale, type Locale } from "@/lib/i18n/locale";
import { getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { ChatMessageRow } from "@/types/database";

function buildSendSchema(locale: Locale) {
  return z
    .object({
      clientId: z.uuid(),
      body: z.string().trim().max(4000).optional(),
      linkTargetType: z.enum(["dashboard", "content", "documents", "feed"]).optional(),
      linkTargetId: z.uuid().optional(),
      linkLabel: z.string().trim().max(80).optional(),
    })
    .refine((data) => Boolean(data.body?.trim()) || Boolean(data.linkTargetType), {
      message: pickLocale(locale, "Escreva uma mensagem ou anexe um link.", "Write a message or attach a link."),
      path: ["body"],
    })
    .refine((data) => data.linkTargetType !== "content" || Boolean(data.linkTargetId), {
      message: pickLocale(locale, "Selecione o conteudo.", "Select the content."),
      path: ["linkTargetId"],
    });
}

function revalidateChat(clientId: string) {
  revalidatePath("/admin/chat");
  revalidatePath(`/admin/chat/${clientId}`);
  revalidatePath("/professional/chat");
  revalidatePath(`/professional/chat/${clientId}`);
  revalidatePath("/client/chat");
  revalidatePath("/admin/dashboard");
  revalidatePath("/professional/dashboard");
  revalidatePath("/client/dashboard");
}

export async function sendChatMessageAction(
  input: z.input<ReturnType<typeof buildSendSchema>>,
): Promise<ActionResult<ChatMessageRow>> {
  const actor = await getActor();
  const locale = await getLocale();
  if (!actor) return fail(pickLocale(locale, "Sessao expirada.", "Session expired."));

  const parsed = buildSendSchema(locale).safeParse(input);
  if (!parsed.success) {
    return fail(
      firstIssue(
        parsed.error.issues,
        pickLocale(locale, "Nao foi possivel enviar a mensagem.", "Could not send the message."),
      ),
    );
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { data: message, error } = await supabase.rpc("send_chat_message", {
    p_client_id: data.clientId,
    p_body: data.body ?? "",
    p_link_target_type: data.linkTargetType ?? null,
    p_link_target_id: data.linkTargetId ?? null,
    p_link_label: data.linkLabel ?? null,
  });

  if (error || !message) {
    return fail(
      describeError(error, pickLocale(locale, "Nao foi possivel enviar a mensagem.", "Could not send the message.")),
    );
  }

  revalidateChat(data.clientId);
  return ok(message);
}

export async function markChatReadAction(clientId: string): Promise<ActionResult<null>> {
  const actor = await getActor();
  const locale = await getLocale();
  if (!actor) return fail(pickLocale(locale, "Sessao expirada.", "Session expired."));

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_chat_read", { p_client_id: clientId });

  if (error) {
    return fail(
      describeError(error, pickLocale(locale, "Nao foi possivel marcar como lido.", "Could not mark as read.")),
    );
  }

  revalidatePath("/admin/chat");
  revalidatePath("/professional/chat");
  revalidatePath("/client/chat");
  return done();
}
