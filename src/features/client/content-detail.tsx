import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ApprovalActions } from "@/components/content/approval-actions";
import { ContentMedia } from "@/components/content/content-media";
import { HistoryTimeline } from "@/components/content/history-timeline";
import { ContentStatusBadge } from "@/components/ui/badge";
import { Card, CardHeader, PageHeader } from "@/components/ui/layout";
import { requireClientActor } from "@/lib/auth";
import { CONTENT_TYPE_LABEL } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { loadContentFiles } from "@/server/queries";

export async function ClientContentDetail({ contentId }: { contentId: string }) {
  await requireClientActor();
  const supabase = await createClient();

  const { data: content } = await supabase
    .from("contents")
    .select("*")
    .eq("id", contentId)
    .maybeSingle();

  if (!content || content.status === "draft") notFound();

  const [files, { data: history }] = await Promise.all([
    loadContentFiles(supabase, contentId),
    supabase
      .from("approval_history")
      .select("*")
      .eq("content_id", contentId)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href="/client/content"
            className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Conteudos
          </Link>
        }
        title={content.title}
        description={`${CONTENT_TYPE_LABEL[content.type]} · ${formatDate(content.scheduled_date)}`}
        actions={<ContentStatusBadge status={content.status} />}
      />

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
          <CardHeader title="O que voce quer fazer?" />
          <ApprovalActions contentId={content.id} status={content.status} />
        </Card>

        {content.caption ? (
          <Card>
            <CardHeader title="Legenda" />
            <p className="whitespace-pre-wrap text-sm text-ink-700">{content.caption}</p>
          </Card>
        ) : null}

        {content.description ? (
          <Card>
            <CardHeader title="Descricao" />
            <p className="whitespace-pre-wrap text-sm text-ink-700">{content.description}</p>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Historico" />
          <HistoryTimeline entries={history ?? []} />
        </Card>
      </div>
    </>
  );
}
