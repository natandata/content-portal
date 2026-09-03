"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { normalizeExternalUrl } from "@/lib/domain";
import { BUCKETS } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { IdeaImageRow, IdeaRow } from "@/types/database";

const linkSchema = z.object({
  label: z.string().trim().min(1, "Informe um titulo para o link").max(120),
  url: z
    .string()
    .trim()
    .transform((value) => normalizeExternalUrl(value))
    .refine((value): value is string => value !== null, "Link invalido: use um endereco http(s)."),
});

const ideaSchema = z.object({
  title: z.string().trim().min(2, "Informe o titulo da ideia"),
  notes: z.string().trim().max(4000).optional(),
  links: z.array(linkSchema).max(20).optional(),
  clientId: z.union([z.uuid(), z.literal("")]).optional(),
});

function revalidateIdeas() {
  revalidatePath("/professional/ideas");
}

export async function createIdeaAction(
  input: z.input<typeof ideaSchema>,
): Promise<ActionResult<IdeaRow>> {
  const actor = await requireStaff();

  const parsed = ideaSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ideas")
    .insert({
      professional_id: actor.authUser.id,
      title: parsed.data.title,
      notes: parsed.data.notes || null,
      links: parsed.data.links ?? [],
      client_id: parsed.data.clientId || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel criar a ideia."));
  }

  revalidateIdeas();
  return ok(data);
}

export async function updateIdeaAction(
  ideaId: string,
  input: z.input<typeof ideaSchema>,
): Promise<ActionResult<IdeaRow>> {
  await requireStaff();

  const parsed = ideaSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ideas")
    .update({
      title: parsed.data.title,
      notes: parsed.data.notes || null,
      links: parsed.data.links ?? [],
      client_id: parsed.data.clientId || null,
    })
    .eq("id", ideaId)
    .select("*")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel atualizar a ideia."));
  }

  revalidateIdeas();
  return ok(data);
}

export async function deleteIdeaAction(ideaId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data: images } = await supabase
    .from("idea_images")
    .select("file_path")
    .eq("idea_id", ideaId);

  const { error } = await supabase.from("ideas").delete().eq("id", ideaId);
  if (error) {
    return fail(describeError(error, "Nao foi possivel excluir a ideia."));
  }

  const paths = (images ?? []).map((image) => image.file_path);
  if (paths.length > 0) {
    await supabase.storage.from(BUCKETS.ideas).remove(paths);
  }

  revalidateIdeas();
  return done();
}

export async function addIdeaImageAction(
  ideaId: string,
  filePath: string,
): Promise<ActionResult<IdeaImageRow>> {
  await requireStaff();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("idea_images")
    .insert({ idea_id: ideaId, file_path: filePath })
    .select("*")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel anexar a imagem."));
  }

  revalidateIdeas();
  return ok(data);
}

export async function deleteIdeaImageAction(imageId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data: image } = await supabase
    .from("idea_images")
    .select("file_path")
    .eq("id", imageId)
    .maybeSingle();

  if (!image) return fail("Imagem nao encontrada.");

  const { error } = await supabase.from("idea_images").delete().eq("id", imageId);
  if (error) {
    return fail(describeError(error, "Nao foi possivel remover a imagem."));
  }

  await supabase.storage.from(BUCKETS.ideas).remove([image.file_path]);

  revalidateIdeas();
  return done();
}
