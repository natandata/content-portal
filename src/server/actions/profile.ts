"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { MAX_HIGHLIGHTS } from "@/lib/domain";
import { BUCKETS } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, type ActionResult } from "@/server/result";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullish()
    .transform((value) => value ?? null);

const profileSchema = z.object({
  clientId: z.uuid("Selecione um cliente"),
  displayName: optionalText(60),
  username: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, ""))
    .refine(
      (value) => value === "" || /^[A-Za-z0-9._]{1,30}$/.test(value),
      "O @ aceita ate 30 caracteres entre letras, numeros, ponto e underline.",
    )
    .transform((value) => value || null)
    .nullish()
    .transform((value) => value ?? null),
  bio: optionalText(300),
  avatarPath: z.string().trim().min(1).nullish(),
  postsCount: z.number().int().min(0).nullish(),
  followersCount: z.number().int().min(0).max(1_000_000_000),
  followingCount: z.number().int().min(0).max(1_000_000_000),
  showReelsTab: z.boolean(),
});

const highlightSchema = z.object({
  title: z.string().trim().min(1, "Todo destaque precisa de um nome").max(20),
  coverPath: z.string().trim().min(1).nullish(),
});

function revalidateFeed(clientId: string) {
  revalidatePath("/admin/feed");
  revalidatePath("/professional/feed");
  revalidatePath("/client/feed");
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/professional/clients/${clientId}`);
}

/**
 * Grava o cabecalho do perfil. Upsert porque o registro so nasce quando alguem
 * abre o editor pela primeira vez.
 */
export async function saveClientProfileAction(
  input: z.input<typeof profileSchema>,
): Promise<ActionResult<null>> {
  await requireStaff();

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const data = parsed.data;
  const supabase = await createClient();

  // Trocar a foto deixa a anterior orfa no bucket.
  const { data: current } = await supabase
    .from("client_profiles")
    .select("avatar_path")
    .eq("client_id", data.clientId)
    .maybeSingle();

  const { error } = await supabase.from("client_profiles").upsert(
    {
      client_id: data.clientId,
      display_name: data.displayName,
      username: data.username,
      bio: data.bio,
      avatar_path: data.avatarPath ?? null,
      posts_count: data.postsCount ?? null,
      followers_count: data.followersCount,
      following_count: data.followingCount,
      show_reels_tab: data.showReelsTab,
    },
    { onConflict: "client_id" },
  );

  if (error) {
    return fail(describeError(error, "Nao foi possivel salvar o perfil."));
  }

  const previous = current?.avatar_path;
  if (previous && previous !== data.avatarPath) {
    await supabase.storage.from(BUCKETS.profiles).remove([previous]);
  }

  revalidateFeed(data.clientId);
  return done();
}

/**
 * Substitui a lista inteira de destaques — a ordem do array vira a posicao,
 * que e como o Instagram exibe.
 */
export async function saveHighlightsAction(
  clientId: string,
  highlights: z.input<typeof highlightSchema>[],
): Promise<ActionResult<null>> {
  await requireStaff();

  if (!z.uuid().safeParse(clientId).success) return fail("Cliente invalido.");

  const parsed = z
    .array(highlightSchema)
    .max(MAX_HIGHLIGHTS, `O perfil comporta no maximo ${MAX_HIGHLIGHTS} destaques.`)
    .safeParse(highlights);

  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Destaques invalidos."));
  }

  const supabase = await createClient();

  const { data: previous } = await supabase
    .from("profile_highlights")
    .select("cover_path")
    .eq("client_id", clientId);

  const { error: deleteError } = await supabase
    .from("profile_highlights")
    .delete()
    .eq("client_id", clientId);

  if (deleteError) {
    return fail(describeError(deleteError, "Nao foi possivel atualizar os destaques."));
  }

  if (parsed.data.length > 0) {
    const { error: insertError } = await supabase.from("profile_highlights").insert(
      parsed.data.map((highlight, index) => ({
        client_id: clientId,
        title: highlight.title,
        cover_path: highlight.coverPath ?? null,
        position: index + 1,
      })),
    );

    if (insertError) {
      return fail(describeError(insertError, "Nao foi possivel salvar os destaques."));
    }
  }

  const kept = new Set(
    parsed.data.map((highlight) => highlight.coverPath).filter(Boolean) as string[],
  );
  const orphans = (previous ?? [])
    .map((row) => row.cover_path)
    .filter((path): path is string => Boolean(path) && !kept.has(path as string));

  if (orphans.length > 0) {
    await supabase.storage.from(BUCKETS.profiles).remove(orphans);
  }

  revalidateFeed(clientId);
  return done();
}
