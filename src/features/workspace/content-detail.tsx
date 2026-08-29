import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ContentMedia } from "@/components/content/content-media";
import { HistoryTimeline } from "@/components/content/history-timeline";
import { StaffContentActions } from "@/components/content/staff-content-actions";
import { ContentStatusBadge } from "@/components/ui/badge";
import { Card, CardHeader, PageHeader } from "@/components/ui/layout";
import { basePath, requireStaff } from "@/lib/auth";
import { CONTENT_TYPE_LABEL } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { loadContentFiles } from "@/server/queries";

import { FeedQuickAdd } from "./feed-quick-add";

export async function ContentDetail({ contentId }: { contentId: string }) {
  const actor = await requireStaff();
  const base = basePath(actor.role);
  const supabase = await createClient();

  const { data: content } = await supabase
    .from("contents")
    .select("*")
    .eq("id", contentId)
    .maybeSingle();

  if (!content) notFound();

  const [files, { data: client }, { data: history }, { data: feedItem }] = await Promise.all([
    loadContentFiles(supabase, contentId),
    supabase.from("clients").select("id, company_name").eq("id", content.client_id).maybeSingle(),
    supabase
      .from("approval_history")
      .select("*")
      .eq("content_id", contentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("feed_items")
      .select("id, position")
      .eq("content_id", contentId)
      .maybeSingle(),
  ]);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href={`${base}/content`}
            className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Conteudos
          </Link>
        }
        title={content.title}
        description={`${CONTENT_TYPE_LABEL[content.type]} · ${client?.company_name ?? "Cliente"}`}
        actions={<ContentStatusBadge status={content.status} />}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <ContentMedia
            type={content.type}
            title={content.title}
            files={files.map((file) => ({
              id: file.id,
              url: file.url,
              fileType: file.file_type,
              position: file.position,
            }))}
          />

          <Card>
            <CardHeader title="Acoes" />
            <StaffContentActions
              contentId={content.id}
              status={content.status}
              basePath={base}
              onDeletedHref={`${base}/content`}
            />
            <div className="mt-4 border-t border-line pt-4">
              <FeedQuickAdd
                clientId={content.client_id}
                contentId={content.id}
                feedItemId={feedItem?.id ?? null}
                position={feedItem?.position ?? null}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Historico" description="Tudo que aconteceu com este conteudo." />
            <HistoryTimeline entries={history ?? []} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Detalhes" />
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-ink-500">Tipo</dt>
                <dd className="text-ink-900">{CONTENT_TYPE_LABEL[content.type]}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Data prevista</dt>
                <dd className="text-ink-900">{formatDate(content.scheduled_date)}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Arquivos</dt>
                <dd className="text-ink-900">{files.length}</dd>
              </div>
              {content.description ? (
                <div>
                  <dt className="text-ink-500">Descricao</dt>
                  <dd className="whitespace-pre-wrap text-ink-900">{content.description}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          {content.caption ? (
            <Card>
              <CardHeader title="Legenda" />
              <p className="whitespace-pre-wrap text-sm text-ink-700">{content.caption}</p>
            </Card>
          ) : null}

          {content.internal_notes ? (
            <Card>
              <CardHeader title="Observacao interna" description="Nao visivel para o cliente." />
              <p className="whitespace-pre-wrap text-sm text-ink-700">{content.internal_notes}</p>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
