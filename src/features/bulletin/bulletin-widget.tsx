import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";

import { BulletinCard } from "@/components/bulletin/bulletin-card";
import { NewPostButton } from "@/components/bulletin/new-post-button";
import { Card } from "@/components/ui/layout";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import { loadBulletinFeed } from "@/server/queries";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Card do dashboard com as ultimas novidades. O mesmo componente serve as
 * tres areas — o que muda e o prefixo de rota e se mostra "Nova novidade".
 */
export async function BulletinWidget({
  supabase,
  basePath,
  isAdmin,
  locale,
  limit = 2,
}: {
  supabase: SupabaseClient<Database>;
  basePath: string;
  isAdmin: boolean;
  locale: Locale;
  limit?: number;
}) {
  const dict = getDictionary(locale).bulletin;
  const posts = await loadBulletinFeed(supabase);

  if (posts.length === 0 && !isAdmin) return null;

  return (
    <Card className="mb-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Megaphone className="size-4 text-ink-400" aria-hidden />
          {dict.dashboardTitle}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {isAdmin ? <NewPostButton locale={locale} /> : null}
          {posts.length > 0 ? (
            <Link
              href={`${basePath}/updates`}
              className="focus-ring inline-flex items-center gap-1 rounded text-sm font-medium text-accent"
            >
              {dict.seeAll}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-ink-500">{dict.empty}</p>
      ) : (
        <div className="space-y-3">
          {posts.slice(0, limit).map((post) => (
            <BulletinCard key={post.id} post={post} locale={locale} canManage={isAdmin} />
          ))}
        </div>
      )}
    </Card>
  );
}
