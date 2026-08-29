"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { MAX_FEED_ITEMS } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, type ActionResult } from "@/server/result";

function revalidateFeed(clientId: string) {
  revalidatePath("/admin/feed");
  revalidatePath("/professional/feed");
  revalidatePath("/client/feed");
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/professional/clients/${clientId}`);
}

export async function addFeedItemAction(
  clientId: string,
  contentId: string,
): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { error } = await supabase.rpc("add_feed_item", {
    p_client_id: clientId,
    p_content_id: contentId,
  });

  if (error) {
    return fail(describeError(error, "Nao foi possivel adicionar ao feed."));
  }

  revalidateFeed(clientId);
  return done();
}

export async function removeFeedItemAction(
  clientId: string,
  feedItemId: string,
): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { error } = await supabase.from("feed_items").delete().eq("id", feedItemId);
  if (error) {
    return fail(describeError(error, "Nao foi possivel remover do feed."));
  }

  // Renumera para manter as posicoes contiguas de 1 a N.
  const { data: remaining } = await supabase
    .from("feed_items")
    .select("content_id")
    .eq("client_id", clientId)
    .order("position");

  if (remaining && remaining.length > 0) {
    await supabase.rpc("reorder_feed", {
      p_client_id: clientId,
      p_content_ids: remaining.map((item) => item.content_id),
    });
  }

  revalidateFeed(clientId);
  return done();
}

/** Persiste a ordem completa do feed em uma unica transacao. */
export async function reorderFeedAction(
  clientId: string,
  contentIds: string[],
): Promise<ActionResult<null>> {
  await requireStaff();

  if (contentIds.length > MAX_FEED_ITEMS) {
    return fail(`O feed comporta no maximo ${MAX_FEED_ITEMS} conteudos.`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_feed", {
    p_client_id: clientId,
    p_content_ids: contentIds,
  });

  if (error) {
    return fail(describeError(error, "Nao foi possivel salvar a nova ordem."));
  }

  revalidateFeed(clientId);
  return done();
}
