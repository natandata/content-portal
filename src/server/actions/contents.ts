"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { LINK_FILE_TYPE, MAX_CAROUSEL_SLIDES, normalizeExternalUrl } from "@/lib/domain";
import { BUCKETS } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { ContentRow } from "@/types/database";

const metadataSchema = z.object({
  clientId: z.uuid("Selecione um cliente"),
  title: z.string().trim().min(2, "Informe o titulo"),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(["image", "video", "carousel"]),
  scheduledDate: z.union([z.iso.date(), z.literal("")]).optional(),
  caption: z.string().trim().max(4000).optional(),
  internalNotes: z.string().trim().max(2000).optional(),
});

/** Arquivo enviado ao Storage. */
const uploadedFileSchema = z.object({
  filePath: z.string().min(1),
  thumbnailPath: z.string().nullable().optional(),
  position: z.number().int().min(1).max(MAX_CAROUSEL_SLIDES),
  fileType: z.string().min(1),
});

/**
 * Arquivo que mora fora do portal. A normalizacao roda de novo aqui — o cliente
 * ja validou, mas server action e endpoint publico.
 */
const linkFileSchema = z.object({
  externalUrl: z
    .string()
    .min(1, "Informe o link")
    .transform((value) => normalizeExternalUrl(value))
    .refine((value): value is string => value !== null, "Link invalido: use um endereco http(s)."),
  position: z.number().int().min(1).max(MAX_CAROUSEL_SLIDES),
});

const fileSchema = z.union([linkFileSchema, uploadedFileSchema]);

type FileInput = z.infer<typeof fileSchema>;

function isLink(file: FileInput): file is z.infer<typeof linkFileSchema> {
  return "externalUrl" in file;
}

function isUpload(file: FileInput): file is z.infer<typeof uploadedFileSchema> {
  return !isLink(file);
}

function revalidateContents(clientId?: string, contentId?: string) {
  revalidatePath("/admin/content");
  revalidatePath("/professional/content");
  revalidatePath("/admin/approvals");
  revalidatePath("/professional/approvals");
  revalidatePath("/admin/dashboard");
  revalidatePath("/professional/dashboard");
  revalidatePath("/client/content");
  revalidatePath("/client/dashboard");
  revalidatePath("/client/feed");
  if (clientId) {
    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath(`/professional/clients/${clientId}`);
  }
  if (contentId) {
    revalidatePath(`/admin/content/${contentId}`);
    revalidatePath(`/professional/content/${contentId}`);
    revalidatePath(`/client/content/${contentId}`);
  }
}

async function logHistory(contentId: string, action: string, comment?: string | null) {
  const actor = await requireStaff();
  const supabase = await createClient();

  await supabase.from("approval_history").insert({
    content_id: contentId,
    user_id: actor.authUser.id,
    actor_name: actor.displayName,
    action,
    comment: comment ?? null,
  });
}

/**
 * Cria o rascunho antes do upload — os arquivos vao para
 * `content/{client_id}/{content_id}/...`, entao o id precisa existir primeiro.
 */
export async function createContentDraftAction(
  input: z.input<typeof metadataSchema>,
): Promise<ActionResult<ContentRow>> {
  const actor = await requireStaff();

  const parsed = metadataSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { data: content, error } = await supabase
    .from("contents")
    .insert({
      client_id: data.clientId,
      professional_id: actor.authUser.id,
      title: data.title,
      description: data.description || null,
      type: data.type,
      scheduled_date: data.scheduledDate || null,
      caption: data.caption || null,
      internal_notes: data.internalNotes || null,
      status: "draft",
    })
    .select("*")
    .single();

  if (error || !content) {
    return fail(describeError(error, "Nao foi possivel criar o conteudo."));
  }

  return ok(content);
}

export async function updateContentAction(
  contentId: string,
  input: z.input<typeof metadataSchema>,
): Promise<ActionResult<ContentRow>> {
  await requireStaff();

  const parsed = metadataSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { data: content, error } = await supabase
    .from("contents")
    .update({
      title: data.title,
      description: data.description || null,
      scheduled_date: data.scheduledDate || null,
      caption: data.caption || null,
      internal_notes: data.internalNotes || null,
    })
    .eq("id", contentId)
    .select("*")
    .single();

  if (error || !content) {
    return fail(describeError(error, "Nao foi possivel atualizar o conteudo."));
  }

  await logHistory(contentId, "Profissional atualizou o conteudo");
  revalidateContents(content.client_id, contentId);
  return ok(content);
}

/** Substitui a lista de arquivos do conteudo (usado no upload e na edicao). */
export async function replaceContentFilesAction(
  contentId: string,
  files: z.input<typeof fileSchema>[],
): Promise<ActionResult<null>> {
  await requireStaff();

  const parsed = z.array(fileSchema).min(1, "Envie ao menos um arquivo").safeParse(files);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Arquivos invalidos."));
  }

  const supabase = await createClient();

  const { data: content } = await supabase
    .from("contents")
    .select("id, client_id, type")
    .eq("id", contentId)
    .maybeSingle();

  if (!content) return fail("Conteudo nao encontrado.");

  const limit = content.type === "carousel" ? MAX_CAROUSEL_SLIDES : 1;
  if (parsed.data.length > limit) {
    return fail(`Este tipo de conteudo aceita no maximo ${limit} arquivo(s).`);
  }

  const { data: previous } = await supabase
    .from("content_files")
    .select("file_path, thumbnail_path")
    .eq("content_id", contentId);

  const keptPaths = new Set(
    parsed.data.filter(isUpload).map((file) => file.filePath),
  );
  const orphanFiles = (previous ?? [])
    .map((file) => file.file_path)
    .filter((path): path is string => Boolean(path) && !keptPaths.has(path as string));
  const keptThumbs = new Set(
    parsed.data
      .map((file) => (isLink(file) ? null : file.thumbnailPath))
      .filter((path): path is string => Boolean(path)),
  );
  const orphanThumbs = (previous ?? [])
    .map((file) => file.thumbnail_path)
    .filter((path): path is string => Boolean(path) && !keptThumbs.has(path as string));

  const { error: deleteError } = await supabase
    .from("content_files")
    .delete()
    .eq("content_id", contentId);

  if (deleteError) {
    return fail(describeError(deleteError, "Nao foi possivel atualizar os arquivos."));
  }

  const { error: insertError } = await supabase.from("content_files").insert(
    parsed.data.map((file) =>
      isLink(file)
        ? {
            content_id: contentId,
            file_path: null,
            external_url: file.externalUrl,
            thumbnail_path: null,
            position: file.position,
            file_type: LINK_FILE_TYPE,
          }
        : {
            content_id: contentId,
            file_path: file.filePath,
            external_url: null,
            thumbnail_path: file.thumbnailPath ?? null,
            position: file.position,
            file_type: file.fileType,
          },
    ),
  );

  if (insertError) {
    return fail(describeError(insertError, "Nao foi possivel salvar os arquivos."));
  }

  if (orphanFiles.length > 0) {
    await supabase.storage.from(BUCKETS.content).remove(orphanFiles);
  }
  if (orphanThumbs.length > 0) {
    await supabase.storage.from(BUCKETS.thumbnails).remove(orphanThumbs);
  }

  revalidateContents(content.client_id, contentId);
  return done();
}

/** Envia para o cliente: o conteudo passa a aguardar aprovacao. */
export async function submitContentAction(contentId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { count } = await supabase
    .from("content_files")
    .select("id", { count: "exact", head: true })
    .eq("content_id", contentId);

  if (!count) {
    return fail("Adicione ao menos um arquivo antes de enviar para o cliente.");
  }

  const { data, error } = await supabase
    .from("contents")
    .update({ status: "awaiting_approval" })
    .eq("id", contentId)
    .select("client_id, status")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel enviar o conteudo."));
  }

  await logHistory(contentId, "Conteudo enviado para aprovacao");
  revalidateContents(data.client_id, contentId);
  return done();
}

export async function setContentPublishedAction(
  contentId: string,
): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contents")
    .update({ status: "published" })
    .eq("id", contentId)
    .select("client_id")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel marcar como publicado."));
  }

  await logHistory(contentId, "Conteudo marcado como publicado");
  revalidateContents(data.client_id, contentId);
  return done();
}

export async function deleteContentAction(contentId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data: content } = await supabase
    .from("contents")
    .select("client_id")
    .eq("id", contentId)
    .maybeSingle();

  if (!content) return fail("Conteudo nao encontrado.");

  const { data: files } = await supabase
    .from("content_files")
    .select("file_path, thumbnail_path")
    .eq("content_id", contentId);

  const filePaths = (files ?? [])
    .map((file) => file.file_path)
    .filter((path): path is string => Boolean(path));
  const thumbPaths = (files ?? [])
    .map((file) => file.thumbnail_path)
    .filter((path): path is string => Boolean(path));

  const { error } = await supabase.from("contents").delete().eq("id", contentId);
  if (error) {
    return fail(describeError(error, "Nao foi possivel excluir o conteudo."));
  }

  if (filePaths.length > 0) await supabase.storage.from(BUCKETS.content).remove(filePaths);
  if (thumbPaths.length > 0) await supabase.storage.from(BUCKETS.thumbnails).remove(thumbPaths);

  revalidateContents(content.client_id, contentId);
  return done();
}
