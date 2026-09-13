import Link from "next/link";
import { Images, X } from "lucide-react";

import { ApprovalActions } from "@/components/content/approval-actions";
import { ContentCard } from "@/components/content/content-card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { requireClientActor } from "@/lib/auth";
import { AWAITING_CLIENT_STATUSES } from "@/lib/domain";
import { getServerDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadContentFileCounts, loadContentPreviews } from "@/server/queries";
import type { ContentStatus } from "@/types/database";

/** Os 3 grupos que os cartoes do dashboard filtram -- mesma tally de `dashboard.tsx`. */
export type ContentFilter = "awaiting" | "approved" | "revision";

const FILTER_STATUSES: Record<ContentFilter, ContentStatus[]> = {
  awaiting: AWAITING_CLIENT_STATUSES,
  approved: ["approved", "published"],
  revision: ["revision_requested", "rejected"],
};

const FILTER_LABEL: Record<ContentFilter, string> = {
  awaiting: "Aguardando voce",
  approved: "Aprovados",
  revision: "Em alteracao",
};

export async function ClientContents({ filter }: { filter?: ContentFilter } = {}) {
  await requireClientActor();
  const supabase = await createClient();
  const { locale, dict } = await getServerDictionary();

  // O cliente nunca ve rascunhos: eles ainda estao em producao. Ordem
  // cronologica (data agendada, depois horario) -- nao por ultima
  // atualizacao, senao a lista embaralha toda vez que a equipe edita algo.
  let query = supabase
    .from("contents")
    .select("*")
    .neq("status", "draft")
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .order("scheduled_time", { ascending: true, nullsFirst: false });

  if (filter) query = query.in("status", FILTER_STATUSES[filter]);

  const { data: contents } = await query;

  const rows = contents ?? [];
  const ids = rows.map((row) => row.id);

  const [previews, counts] = await Promise.all([
    loadContentPreviews(supabase, ids),
    loadContentFileCounts(supabase, ids),
  ]);

  return (
    <>
      <PageHeader
        title={dict.content.title}
        description={dict.content.subtitle}
        actions={
          filter ? (
            <Link
              href="/client/content"
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
            >
              {FILTER_LABEL[filter]}
              <X className="size-3.5" aria-hidden />
            </Link>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Images className="size-5" />}
          title={dict.content.empty}
          description={dict.content.emptyBody}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((content) => (
            <ContentCard
              key={content.id}
              content={content}
              previewUrl={previews.get(content.id) ?? null}
              fileCount={counts.get(content.id) ?? 0}
              href={`/client/content/${content.id}`}
              locale={locale}
              actions={
                <ApprovalActions
                  contentId={content.id}
                  status={content.status}
                  viewHref={`/client/content/${content.id}`}
                  locale={locale}
                />
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
