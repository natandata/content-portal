import { CheckCircle2, MessageSquareWarning } from "lucide-react";

import { ContentCard } from "@/components/content/content-card";
import { StaffContentActions } from "@/components/content/staff-content-actions";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { basePath, requireStaff } from "@/lib/auth";
import { AWAITING_CLIENT_STATUSES, NEEDS_TEAM_ACTION_STATUSES } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { loadClientNames, loadContentFileCounts, loadContentPreviews } from "@/server/queries";

export async function ApprovalsList() {
  const actor = await requireStaff();
  const base = basePath(actor.role);
  const supabase = await createClient();

  const [{ data: waiting }, { data: needsAction }] = await Promise.all([
    supabase
      .from("contents")
      .select("*")
      .in("status", AWAITING_CLIENT_STATUSES)
      .order("updated_at", { ascending: false }),
    supabase
      .from("contents")
      .select("*")
      .in("status", NEEDS_TEAM_ACTION_STATUSES)
      .order("updated_at", { ascending: false }),
  ]);

  const all = [...(needsAction ?? []), ...(waiting ?? [])];
  const ids = all.map((content) => content.id);

  const [previews, counts, names] = await Promise.all([
    loadContentPreviews(supabase, ids),
    loadContentFileCounts(supabase, ids),
    loadClientNames(
      supabase,
      all.map((content) => content.client_id),
    ),
  ]);

  const feedback =
    ids.length > 0
      ? (
          await supabase
            .from("approvals")
            .select("content_id, comment, created_at")
            .in("content_id", ids)
            .order("created_at", { ascending: false })
        ).data
      : [];

  // Mantem apenas o comentario mais recente de cada conteudo.
  const latestComment = new Map<string, { comment: string; createdAt: string }>();
  for (const entry of feedback ?? []) {
    if (!entry.comment || latestComment.has(entry.content_id)) continue;
    latestComment.set(entry.content_id, {
      comment: entry.comment,
      createdAt: entry.created_at,
    });
  }

  return (
    <>
      <PageHeader
        title="Aprovacoes"
        description="O que esta com o cliente e o que voltou pedindo ajuste."
      />

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
          <MessageSquareWarning className="size-4 text-amber-500" aria-hidden />
          Precisam de ajuste
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600 tabular-nums">
            {(needsAction ?? []).length}
          </span>
        </h2>

        {(needsAction ?? []).length === 0 ? (
          <EmptyState title="Nada aguardando ajuste" description="Nenhum retorno pendente do cliente." />
        ) : (
          <div className="space-y-3">
            {(needsAction ?? []).map((content) => {
              const comment = latestComment.get(content.id);
              return (
                <div key={content.id}>
                  <ContentCard
                    content={content}
                    previewUrl={previews.get(content.id) ?? null}
                    fileCount={counts.get(content.id) ?? 0}
                    clientName={names.get(content.client_id)}
                    href={`${base}/content/${content.id}`}
                    actions={
                      <StaffContentActions
                        contentId={content.id}
                        status={content.status}
                        basePath={base}
                      />
                    }
                  />
                  {comment ? (
                    <div className="mx-4 -mt-px rounded-b-xl border border-t-0 border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-xs font-medium text-amber-700">
                        Retorno do cliente · {formatDateTime(comment.createdAt)}
                      </p>
                      <p className="mt-1 text-sm text-amber-900">{comment.comment}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
          <CheckCircle2 className="size-4 text-accent" aria-hidden />
          Aguardando o cliente
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600 tabular-nums">
            {(waiting ?? []).length}
          </span>
        </h2>

        {(waiting ?? []).length === 0 ? (
          <EmptyState
            title="Nenhum conteudo aguardando aprovacao"
            description="Envie um conteudo para o cliente avaliar."
          />
        ) : (
          <div className="space-y-3">
            {(waiting ?? []).map((content) => (
              <ContentCard
                key={content.id}
                content={content}
                previewUrl={previews.get(content.id) ?? null}
                fileCount={counts.get(content.id) ?? 0}
                clientName={names.get(content.client_id)}
                href={`${base}/content/${content.id}`}
                actions={
                  <StaffContentActions
                    contentId={content.id}
                    status={content.status}
                    basePath={base}
                  />
                }
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
