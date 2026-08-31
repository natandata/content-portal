import { Images } from "lucide-react";

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
}: {
  clientId?: string;
  status?: string;
  professionalId?: string;
}) {
  const actor = await requireStaff();
  const base = basePath(actor.role);
  const supabase = await createClient();

  const statusFilter = CONTENT_STATUS_ORDER.includes(status as ContentStatus)
    ? (status as ContentStatus)
    : undefined;

  let query = supabase
    .from("contents")
    .select("*")
    .order("updated_at", { ascending: false })
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

  const rows = contents ?? [];
  const ids = rows.map((row) => row.id);

  const [previews, counts, names] = await Promise.all([
    loadContentPreviews(supabase, ids),
    loadContentFileCounts(supabase, ids),
    loadClientNames(
      supabase,
      rows.map((row) => row.client_id),
    ),
  ]);

  return (
    <>
      <PageHeader
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
                />
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
