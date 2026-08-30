"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describeError, fail, ok, type ActionResult } from "@/server/result";

export interface OrphanSummary {
  files: number;
  bytes: number;
  byBucket: { bucket: string; files: number; bytes: number }[];
}

function summarize(rows: { bucket_id: string; size: number }[]): OrphanSummary {
  const byBucket = new Map<string, { files: number; bytes: number }>();

  for (const row of rows) {
    const current = byBucket.get(row.bucket_id) ?? { files: 0, bytes: 0 };
    current.files += 1;
    current.bytes += row.size ?? 0;
    byBucket.set(row.bucket_id, current);
  }

  return {
    files: rows.length,
    bytes: rows.reduce((total, row) => total + (row.size ?? 0), 0),
    byBucket: [...byBucket.entries()]
      .map(([bucket, value]) => ({ bucket, ...value }))
      .sort((a, b) => b.bytes - a.bytes),
  };
}

/** Conta os arquivos do Storage que perderam a linha correspondente no banco. */
export async function countOrphanFilesAction(): Promise<ActionResult<OrphanSummary>> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("orphan_storage_objects");
  if (error) {
    return fail(describeError(error, "Nao foi possivel listar os arquivos orfaos."));
  }

  return ok(summarize(data ?? []));
}

/**
 * Apaga os orfaos. A lista e recalculada aqui dentro em vez de vir do cliente —
 * caminho de arquivo enviado pelo navegador viraria uma porta para apagar
 * qualquer objeto do Storage.
 */
export async function deleteOrphanFilesAction(): Promise<ActionResult<OrphanSummary>> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("orphan_storage_objects");
  if (error) {
    return fail(describeError(error, "Nao foi possivel listar os arquivos orfaos."));
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    return ok(summarize(rows));
  }

  const byBucket = new Map<string, string[]>();
  for (const row of rows) {
    const list = byBucket.get(row.bucket_id) ?? [];
    list.push(row.name);
    byBucket.set(row.bucket_id, list);
  }

  for (const [bucket, names] of byBucket) {
    // O Storage aceita listas grandes, mas em lotes o erro fica localizado.
    for (let index = 0; index < names.length; index += 100) {
      const batch = names.slice(index, index + 100);
      const { error: removeError } = await supabase.storage.from(bucket).remove(batch);
      if (removeError) {
        return fail(`Falha ao limpar o bucket "${bucket}": ${removeError.message}`);
      }
    }
  }

  revalidatePath("/admin/platform");
  return ok(summarize(rows));
}
