import Link from "next/link";
import { ArrowRight, FileText, Images } from "lucide-react";

import { ContentCard } from "@/components/content/content-card";
import { ApprovalActions } from "@/components/content/approval-actions";
import { ContractStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui/layout";
import { requireClientActor } from "@/lib/auth";
import { AWAITING_CLIENT_STATUSES } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { loadContentFileCounts, loadContentPreviews } from "@/server/queries";
import type { ContentStatus } from "@/types/database";

export async function ClientDashboard() {
  const actor = await requireClientActor();
  const supabase = await createClient();

  const [{ data: pending }, { data: statusRows }, { data: contracts }] = await Promise.all([
    supabase
      .from("contents")
      .select("*")
      .in("status", AWAITING_CLIENT_STATUSES)
      .order("updated_at", { ascending: false }),
    supabase.from("contents").select("status"),
    supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const rows = pending ?? [];
  const ids = rows.map((row) => row.id);

  const [previews, counts] = await Promise.all([
    loadContentPreviews(supabase, ids),
    loadContentFileCounts(supabase, ids),
  ]);

  const tally = (statuses: ContentStatus[]) =>
    (statusRows ?? []).filter((row) => statuses.includes(row.status)).length;

  const contract = (contracts ?? [])[0];

  return (
    <>
      <PageHeader
        title={`Ola, ${actor.client.name.split(" ")[0]}`}
        description="Aqui estao os conteudos que aguardam a sua avaliacao."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Aguardando voce" value={rows.length} tone="warning" />
        <StatCard label="Aprovados" value={tally(["approved", "published"])} tone="success" />
        <StatCard
          label="Em alteracao"
          value={tally(["revision_requested", "rejected"])}
          tone="info"
        />
        <StatCard label="Total recebido" value={statusRows?.length ?? 0} />
      </div>

      <Card className="mb-6">
        <CardHeader title="Contrato" />
        {contract ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-900">{contract.title}</p>
              <ContractStatusBadge status={contract.status} className="mt-1.5" />
            </div>
            <Link
              href="/client/contract"
              className="focus-ring inline-flex items-center gap-1.5 rounded text-sm font-medium text-accent"
            >
              <FileText className="size-4" aria-hidden />
              Abrir contrato
            </Link>
          </div>
        ) : (
          <p className="text-sm text-ink-500">Nenhum contrato disponivel ate o momento.</p>
        )}
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-ink-900">Aguardando aprovacao</h2>
          <Link
            href="/client/content"
            className="focus-ring inline-flex items-center gap-1 rounded text-sm font-medium text-accent"
          >
            Ver todos
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Images className="size-5" />}
            title="Nada aguardando voce"
            description="Assim que um novo conteudo for enviado, ele aparece aqui."
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
                actions={
                  <ApprovalActions
                    contentId={content.id}
                    status={content.status}
                    viewHref={`/client/content/${content.id}`}
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
