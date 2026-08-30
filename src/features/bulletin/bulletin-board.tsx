import { Megaphone } from "lucide-react";

import { BulletinCard } from "@/components/bulletin/bulletin-card";
import { NewPostButton } from "@/components/bulletin/new-post-button";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import { loadBulletinAdminList, loadBulletinFeed } from "@/server/queries";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Pagina cheia do mural. Admin ve rascunho tambem e pode gerenciar. */
export async function BulletinBoard({
  supabase,
  isAdmin,
  locale,
}: {
  supabase: SupabaseClient<Database>;
  isAdmin: boolean;
  locale: Locale;
}) {
  const dict = getDictionary(locale).bulletin;
  const posts = isAdmin
    ? await loadBulletinAdminList(supabase)
    : (await loadBulletinFeed(supabase)).map((post) => ({ ...post, published: true }));

  return (
    <>
      <PageHeader
        title={dict.title}
        description={dict.subtitle}
        actions={isAdmin ? <NewPostButton locale={locale} /> : undefined}
      />

      {posts.length === 0 ? (
        <EmptyState icon={<Megaphone className="size-5" />} title={dict.empty} />
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <BulletinCard
              key={post.id}
              post={post}
              locale={locale}
              canManage={isAdmin}
              published={post.published}
            />
          ))}
        </div>
      )}
    </>
  );
}
