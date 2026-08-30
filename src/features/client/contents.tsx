import { Images } from "lucide-react";

import { ApprovalActions } from "@/components/content/approval-actions";
import { ContentCard } from "@/components/content/content-card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { requireClientActor } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadContentFileCounts, loadContentPreviews } from "@/server/queries";

export async function ClientContents() {
  await requireClientActor();
  const supabase = await createClient();
  const { locale, dict } = await getServerDictionary();

  // O cliente nunca ve rascunhos: eles ainda estao em producao.
  const { data: contents } = await supabase
    .from("contents")
    .select("*")
    .neq("status", "draft")
    .order("updated_at", { ascending: false });

  const rows = contents ?? [];
  const ids = rows.map((row) => row.id);

  const [previews, counts] = await Promise.all([
    loadContentPreviews(supabase, ids),
    loadContentFileCounts(supabase, ids),
  ]);

  return (
    <>
      <PageHeader title={dict.content.title} description={dict.content.subtitle} />

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
