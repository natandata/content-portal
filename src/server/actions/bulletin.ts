"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActor, requireAdmin } from "@/lib/auth";
import { pickLocale } from "@/lib/i18n/locale";
import { getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { BulletinPostRow } from "@/types/database";

const postSchema = z.object({
  title: z.string().trim().min(1, "Informe o titulo").max(120),
  body: z.string().trim().min(1, "Informe a descricao").max(4000),
  published: z.boolean(),
  scheduledDate: z.union([z.iso.date(), z.literal("")]).optional(),
});

function revalidateBulletin() {
  revalidatePath("/admin/updates");
  revalidatePath("/professional/updates");
  revalidatePath("/client/updates");
  revalidatePath("/admin/dashboard");
  revalidatePath("/professional/dashboard");
  revalidatePath("/client/dashboard");
}

export async function createBulletinPostAction(
  input: z.input<typeof postSchema>,
): Promise<ActionResult<BulletinPostRow>> {
  const actor = await requireAdmin();

  const parsed = postSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bulletin_posts")
    .insert({
      title: parsed.data.title,
      body: parsed.data.body,
      published: parsed.data.published,
      scheduled_date: parsed.data.scheduledDate || null,
      created_by: actor.authUser.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel publicar."));
  }

  revalidateBulletin();
  return ok(data);
}

export async function updateBulletinPostAction(
  postId: string,
  input: z.input<typeof postSchema>,
): Promise<ActionResult<null>> {
  await requireAdmin();

  const parsed = postSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("bulletin_posts")
    .update({
      title: parsed.data.title,
      body: parsed.data.body,
      published: parsed.data.published,
      scheduled_date: parsed.data.scheduledDate || null,
    })
    .eq("id", postId);

  if (error) {
    return fail(describeError(error, "Nao foi possivel salvar."));
  }

  revalidateBulletin();
  return done();
}

export async function deleteBulletinPostAction(postId: string): Promise<ActionResult<null>> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("bulletin_posts").delete().eq("id", postId);

  if (error) {
    return fail(describeError(error, "Nao foi possivel excluir."));
  }

  revalidateBulletin();
  return done();
}

export async function voteOnBulletinPostAction(
  postId: string,
  vote: -1 | 0 | 1,
): Promise<ActionResult<null>> {
  const actor = await getActor();
  const locale = await getLocale();
  if (!actor) return fail(pickLocale(locale, "Sessao expirada.", "Session expired."));

  const supabase = await createClient();
  const { error } = await supabase.rpc("vote_on_bulletin_post", {
    p_post_id: postId,
    p_vote: vote,
  });

  if (error) {
    return fail(
      describeError(error, pickLocale(locale, "Nao foi possivel registrar o voto.", "Could not register the vote.")),
    );
  }

  revalidateBulletin();
  return done();
}
