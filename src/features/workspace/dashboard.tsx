import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";

import { ContentStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Card, PageHeader, StatCard } from "@/components/ui/layout";
import { LinkButton } from "@/components/ui/button";
import { basePath, requireStaff } from "@/lib/auth";
import { BulletinWidget } from "@/features/bulletin/bulletin-widget";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeDay } from "@/lib/utils";
import { loadClientNames, loadDashboardStats } from "@/server/queries";
import type { ContentStatus } from "@/types/database";

const PENDING_STATUSES: ContentStatus[] = [
  "draft",
  "submitted",
  "awaiting_approval",
  "revision_requested",
  "rejected",
];

export async function WorkspaceDashboard() {
  const actor = await requireStaff();
  const base = basePath(actor.role);
  const supabase = await createClient();

  const [stats, pendingResult] = await Promise.all([
    loadDashboardStats(supabase),
    supabase
      .from("contents")
      .select("id, client_id, title, status, updated_at")
      .in("status", PENDING_STATUSES)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  const pending = pendingResult.data ?? [];
  const clientNames = await loadClientNames(
    supabase,
    pending.map((item) => item.client_id),
  );

  return (
    <>
      <PageHeader
        title={`Ola, ${actor.displayName.split(" ")[0]}`}
        description="Visao rapida do que precisa de atencao hoje."
        actions={<LinkButton href={`${base}/content/new`}>Novo conteudo</LinkButton>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clientes ativos" value={stats.activeClients} />
        <StatCard label="Conteudos pendentes" value={stats.pendingContents} tone="warning" />
        <StatCard label="Aguardando cliente" value={stats.awaitingClient} tone="info" />
        <StatCard label="Aprovados" value={stats.approved} tone="success" />
      </div>

      <BulletinWidget
        supabase={supabase}
        basePath={base}
        isAdmin={actor.role === "admin"}
        locale={DEFAULT_LOCALE}
      />

      <Card padded={false}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Pendencias recentes</h2>
          <Link
            href={`${base}/approvals`}
            className="focus-ring inline-flex items-center gap-1 rounded text-sm font-medium text-accent"
          >
            Ver todas
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        {pending.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Inbox className="size-5" />}
              title="Nada pendente por aqui"
              description="Todos os conteudos estao aprovados ou publicados."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((item) => (
              <li key={item.id}>
                <Link
                  href={`${base}/content/${item.id}`}
                  className="focus-ring flex items-center gap-4 px-5 py-3.5 transition hover:bg-ink-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{item.title}</p>
                    <p className="truncate text-xs text-ink-500">
                      {clientNames.get(item.client_id) ?? "Cliente"}
                    </p>
                  </div>
                  <ContentStatusBadge status={item.status} className="hidden sm:inline-flex" />
                  <span className="w-20 shrink-0 text-right text-xs text-ink-400">
                    {formatRelativeDay(item.updated_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
