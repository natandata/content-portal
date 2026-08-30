import { Grid3x3 } from "lucide-react";

import { FeedGrid, type FeedEntry } from "@/components/feed/feed-grid";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { InstagramHeader } from "@/components/feed/instagram-profile";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { requireClientActor } from "@/lib/auth";
import { MAX_FEED_ITEMS } from "@/lib/domain";
import { getServerDictionary } from "@/lib/i18n/server";
import { intlLocale } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { loadContentPreviews, loadProfileView } from "@/server/queries";

export async function ClientFeed() {
  const actor = await requireClientActor();
  const supabase = await createClient();
  const { locale, dict } = await getServerDictionary();

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
        title={dict.feed.title}
        description={dict.feed.subtitle(actor.client.company_name)}
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={<Grid3x3 className="size-5" />}
          title={dict.feed.empty}
          description={dict.feed.emptyBody}
        />
      ) : (
        <div className="mx-auto max-w-md">
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <InstagramHeader
              profile={profile}
              fallbackName={actor.client.company_name}
              locale={locale}
            />

            <FeedTabs
              showReels={profile.showReelsTab}
              posts={
                <div className="p-1.5">
                  <FeedGrid entries={entries} />
                </div>
              }
              reels={
                <div className="p-1.5">
                  <FeedGrid entries={reels} fill={false} emptyLabel={dict.feed.noReels} />
                </div>
              }
            />
          </div>

          <p className="mt-3 text-center text-xs text-ink-500 tabular-nums">
            {dict.feed.positions(entries.length, MAX_FEED_ITEMS)}
            {lastUpdate
              ? ` · ${dict.feed.updatedOn} ${formatDate(lastUpdate, intlLocale(locale))}`
              : null}
          </p>
        </div>
      )}
    </>
  );
}
