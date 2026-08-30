import Link from "next/link";
import { ArrowRight, Banknote, FileText, Images } from "lucide-react";

import { ContentCard } from "@/components/content/content-card";
import { ApprovalActions } from "@/components/content/approval-actions";
import { ContractStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui/layout";
import { requireClientActor } from "@/lib/auth";
import { BulletinWidget } from "@/features/bulletin/bulletin-widget";
import {
  ActiveProjectsWidget,
  PublicationsCalendarWidget,
  RecentActivityWidget,
} from "@/features/client/dashboard-widgets";
import { AWAITING_CLIENT_STATUSES } from "@/lib/domain";
import { getServerDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadContentFileCounts, loadContentPreviews } from "@/server/queries";
import type { ContentStatus } from "@/types/database";

export async function ClientDashboard() {
  const actor = await requireClientActor();
  const supabase = await createClient();
  const { locale, dict } = await getServerDictionary();

  const [{ data: pending }, { data: statusRows }, { data: contracts }, { count: openInvoicesCount }] =
    await Promise.all([
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
      supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "open"),
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
        title={dict.dashboard.hello(actor.client.name.split(" ")[0] ?? actor.client.name)}
        description={dict.dashboard.subtitle}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={dict.dashboard.awaitingYou} value={rows.length} tone="warning" />
        <StatCard
          label={dict.dashboard.approved}
          value={tally(["approved", "published"])}
          tone="success"
        />
        <StatCard
          label={dict.dashboard.inRevision}
          value={tally(["revision_requested", "rejected"])}
          tone="info"
        />
        <StatCard label={dict.dashboard.totalReceived} value={statusRows?.length ?? 0} />
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <PublicationsCalendarWidget supabase={supabase} locale={locale} />
        <ActiveProjectsWidget supabase={supabase} locale={locale} />
      </div>

      <div className="mb-6">
        <RecentActivityWidget supabase={supabase} locale={locale} />
      </div>

      <BulletinWidget
        supabase={supabase}
        basePath="/client"
        isAdmin={false}
        locale={locale}
      />

      <div className="mb-6 grid gap-5 sm:grid-cols-2">
        <Card>
          <CardHeader title={dict.dashboard.documentsCard} />
          {contract ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">{contract.title}</p>
                <ContractStatusBadge status={contract.status} locale={locale} className="mt-1.5" />
              </div>
              <Link
                href="/client/documents"
                className="focus-ring inline-flex items-center gap-1.5 rounded text-sm font-medium text-accent"
              >
                <FileText className="size-4" aria-hidden />
                {dict.dashboard.openDocuments}
              </Link>
            </div>
          ) : (
            <p className="text-sm text-ink-500">{dict.dashboard.noDocuments}</p>
          )}
        </Card>

        {/*
         * "Cobrancas" fica fora da barra inferior do celular (grid-cols-5 ja
         * no limite) e do menu de topo em telas pequenas — esse link e o
         * unico jeito de chegar la pelo celular, entao fica sempre visivel
         * aqui, nao so quando ha algo em aberto.
         */}
        <Card>
          <CardHeader title={dict.dashboard.paymentsCard} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-600">
              {(openInvoicesCount ?? 0) > 0
                ? dict.dashboard.paymentsOpenCount(openInvoicesCount ?? 0)
                : dict.dashboard.noOpenPayments}
            </p>
            <Link
              href="/client/payments"
              className="focus-ring inline-flex items-center gap-1.5 rounded text-sm font-medium text-accent"
            >
              <Banknote className="size-4" aria-hidden />
              {dict.dashboard.openPayments}
            </Link>
          </div>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-ink-900">
            {dict.dashboard.awaitingApprovalSection}
          </h2>
          <Link
            href="/client/content"
            className="focus-ring inline-flex items-center gap-1 rounded text-sm font-medium text-accent"
          >
            {dict.dashboard.seeAll}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Images className="size-5" />}
            title={dict.dashboard.noPending}
            description={dict.content.empty}
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
      </section>
    </>
  );
}
