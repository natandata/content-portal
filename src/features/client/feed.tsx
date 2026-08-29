import { Grid3x3 } from "lucide-react";

import { FeedGrid, type FeedEntry } from "@/components/feed/feed-grid";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { InstagramHeader } from "@/components/feed/instagram-profile";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { requireClientActor } from "@/lib/auth";
import { MAX_FEED_ITEMS } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { loadContentPreviews, loadProfileView } from "@/server/queries";

export async function ClientFeed() {
  const actor = await requireClientActor();
  const supabase = await createClient();

  const { data: feedItems } = await supabase
    .from("feed_items")
    .select("id, content_id, position, updated_at")
    .order("position");

  const items = feedItems ?? [];

  const { data: contents } = await supabase
    .from("contents")
    .select("id, title, type")
    .in("id", items.length > 0 ? items.map((item) => item.content_id) : ["00000000-0000-0000-0000-000000000000"]);

  const contentById = new Map((contents ?? []).map((content) => [content.id, content]));
  const previews = await loadContentPreviews(
    supabase,
    items.map((item) => item.content_id),
  );

  const entries: FeedEntry[] = items.flatMap((item) => {
    const content = contentById.get(item.content_id);
    if (!content) return [];
    return [
      {
        feedItemId: item.id,
        contentId: item.content_id,
        title: content.title,
        type: content.type,
        previewUrl: previews.get(item.content_id) ?? null,
        position: item.position,
      },
    ];
  });

  const profile = await loadProfileView(
    supabase,
    actor.client.id,
    actor.client.company_name,
    entries.length,
  );

  const lastUpdate = items.reduce<string | null>((latest, item) => {
    if (!latest || item.updated_at > latest) return item.updated_at;
    return latest;
  }, null);

  const reels = entries.filter((entry) => entry.type === "video");

  return (
    <>
      <PageHeader
        title="Feed"
        description={`Previa de como o perfil de ${actor.client.company_name} vai ficar.`}
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={<Grid3x3 className="size-5" />}
          title="Feed ainda vazio"
          description="Seu gestor de conteudo esta montando a composicao do perfil."
        />
      ) : (
        <div className="mx-auto max-w-md">
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <InstagramHeader profile={profile} fallbackName={actor.client.company_name} />

            <FeedTabs
              showReels={profile.showReelsTab}
              posts={
                <div className="p-1.5">
                  <FeedGrid entries={entries} />
                </div>
              }
              reels={
                <div className="p-1.5">
                  <FeedGrid
                    entries={reels}
                    fill={false}
                    emptyLabel="Nenhum reels na composicao ainda."
                  />
                </div>
              }
            />
          </div>

          <p className="mt-3 text-center text-xs text-ink-500 tabular-nums">
            {entries.length} de {MAX_FEED_ITEMS} posicoes
            {lastUpdate ? ` · atualizado em ${formatDate(lastUpdate)}` : null}
          </p>
        </div>
      )}
    </>
  );
}
