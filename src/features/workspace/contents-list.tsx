import Link from "next/link";
import { ArrowLeft, Images } from "lucide-react";

import { ContentCard } from "@/components/content/content-card";
import { StaffContentActions } from "@/components/content/staff-content-actions";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { basePath, requireStaff } from "@/lib/auth";
import { CONTENT_STATUS_LABEL, CONTENT_STATUS_ORDER } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import {
  loadClientNames,
  loadContentDownloadFiles,
  loadContentFileCounts,
  loadContentPreviews,
  loadProfessionalClientIds,
} from "@/server/queries";
import type { ContentStatus } from "@/types/database";

import { ContentFilters } from "./content-filters";

export async function ContentsList({
  clientId,
  status,
  professionalId,
  sort,
}: {
  clientId?: string;
  status?: string;
  professionalId?: string;
  /** "asc" (padrao, mais proximo primeiro) ou "desc" -- ordena por data prevista de postagem. */
  sort?: string;
}) {
  const actor = await requireStaff();
  const base = basePath(actor.role);
  const supabase = await createClient();

  const statusFilter = CONTENT_STATUS_ORDER.includes(status as ContentStatus)
    ? (status as ContentStatus)
    : undefined;
  const sortDirection: "asc" | "desc" = sort === "desc" ? "desc" : "asc";
  const ascending = sortDirection === "asc";

  let query = supabase
    .from("contents")
    .select("*")
    .order("scheduled_date", { ascending, nullsFirst: false })
    .order("scheduled_time", { ascending, nullsFirst: false })
    .limit(120);

  if (clientId) {
    query = query.eq("client_id", clientId);
  } else if (professionalId) {
    const clientIds = await loadProfessionalClientIds(supabase, professionalId);
    query = query.in("client_id", clientIds.length > 0 ? clientIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (statusFilter) query = query.eq("status", statusFilter);

  let clientsQuery = supabase.from("clients").select("id, company_name").order("company_name");
  if (professionalId) clientsQuery = clientsQuery.eq("professional_id", professionalId);

  const [{ data: contents }, { data: clients }] = await Promise.all([query, clientsQuery]);

  const currentClient = clientId ? (clients ?? []).find((client) => client.id === clientId) : undefined;

  const rows = contents ?? [];
  const ids = rows.map((row) => row.id);

  const [previews, counts, names, downloadFiles] = await Promise.all([
    loadContentPreviews(supabase, ids),
    loadContentFileCounts(supabase, ids),
    loadClientNames(
      supabase,
      rows.map((row) => row.client_id),
    ),
    loadContentDownloadFiles(supabase, ids),
  ]);

  return (
    <>
      <PageHeader
        breadcrumb={
          currentClient ? (
            <Link
              href={`${base}/clients/${currentClient.id}`}
              className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft className="size-4" aria-hidden />
              {currentClient.company_name}
            </Link>
          ) : undefined
        }
        title="Conteudos"
        description="Cada card traz a capa, o status e as acoes na base."
        actions={<LinkButton href={`${base}/content/new`}>Novo conteudo</LinkButton>}
      />

      <ContentFilters
        basePath={`${base}/content`}
        clients={(clients ?? []).map((client) => ({
          id: client.id,
          companyName: client.company_name,
        }))}
        statuses={CONTENT_STATUS_ORDER.map((value) => ({
          value,
          label: CONTENT_STATUS_LABEL[value],
        }))}
        selectedClientId={clientId}
        selectedStatus={statusFilter}
        selectedSort={sortDirection}
        professionalId={professionalId}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Images className="size-5" />}
          title="Nenhum conteudo por aqui"
          description="Ajuste os filtros ou envie o primeiro conteudo deste cliente."
          action={<LinkButton href={`${base}/content/new`}>Novo conteudo</LinkButton>}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((content) => (
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
                  downloadUrls={downloadFiles.get(content.id) ?? []}
                />
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
