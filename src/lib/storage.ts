import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { BucketName } from "@/lib/paths";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export const SIGNED_URL_TTL = 60 * 60; // 1 hora

/** URL assinada para um unico objeto. Retorna null se o caminho nao existir. */
export async function signedUrl(
  supabase: Client,
  bucket: BucketName,
  path: string | null | undefined,
  expiresIn = SIGNED_URL_TTL,
): Promise<string | null> {
  if (!path) return null;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

/** URL assinada com download forcado (usada nos contratos). */
export async function signedDownloadUrl(
  supabase: Client,
  bucket: BucketName,
  path: string | null | undefined,
  fileName: string,
  expiresIn = SIGNED_URL_TTL,
): Promise<string | null> {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn, { download: fileName });

  if (error || !data) return null;
  return data.signedUrl;
}

/** Assina varios objetos de uma vez e devolve um mapa caminho -> URL. */
export async function signedUrlMap(
  supabase: Client,
  bucket: BucketName,
  paths: (string | null | undefined)[],
  expiresIn = SIGNED_URL_TTL,
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
  const result = new Map<string, string>();

  if (unique.length === 0) return result;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unique, expiresIn);
  if (error || !data) return result;

  for (const entry of data) {
    if (entry.signedUrl && entry.path) {
      result.set(entry.path, entry.signedUrl);
    }
  }

  return result;
}
