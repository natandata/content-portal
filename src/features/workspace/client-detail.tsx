import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText, Grid3x3, Images } from "lucide-react";

import { ClientAvatarUpload } from "@/components/clients/client-avatar-upload";
import { ClientBrandingForm } from "@/components/clients/client-branding-form";
import { ClientCoverPicker } from "@/components/clients/client-cover-picker";
import { ClientDeleteButton } from "@/components/clients/client-delete-button";
import { ClientDetailTabs } from "@/components/clients/client-detail-tabs";
import { ClientFormModal } from "@/components/clients/client-form-modal";
import { CopyCode } from "@/components/clients/copy-code";
import { ClientContentCalendar } from "@/components/calendar/client-content-calendar";
import { ContentCard } from "@/components/content/content-card";
import { StaffContentActions } from "@/components/content/staff-content-actions";
import { DocumentUploadModal } from "@/components/documents/document-upload-modal";
import { ClientServicesCard } from "@/components/services/client-services-card";
import { Badge, ContractStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui/layout";
import { basePath, requireStaff } from "@/lib/auth";
import { BUCKETS } from "@/lib/paths";
import { signedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import {
  loadClientContentCalendar,
  loadClientServices,
  loadContentFileCounts,
  loadContentPreviews,
} from "@/server/queries";
import type { ContentStatus } from "@/types/database";

export async function ClientDetail({ clientId }: { clientId: string }) {
  const actor = await requireStaff();
  const base = basePath(actor.role);
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) notFound();

  const [{ data: contents }, { data: contracts }, { count: feedCount }] = await Promise.all([
    supabase
      .from("contents")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("contracts")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("feed_items")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
  ]);

  const [services, { data: clientProfile }] = await Promise.all([
    loadClientServices(supabase, clientId),
    supabase.from("client_profiles").select("avatar_path").eq("client_id", clientId).maybeSingle(),
  ]);

  const avatarUrl = clientProfile?.avatar_path
    ? await signedUrl(supabase, BUCKETS.profiles, clientProfile.avatar_path)
    : null;

  const professionals =
    actor.role === "admin"
      ? ((
          await supabase
            .from("users")
            .select("id, name")
            .eq("role", "professional")
            .order("name")
        ).data ?? [])
      : [];

  const { data: statusRows } = await supabase
    .from("contents")
    .select("status")
    .eq("client_id", clientId);

  const tally = (statuses: ContentStatus[]) =>
    (statusRows ?? []).filter((row) => statuses.includes(row.status)).length;

  const rows = contents ?? [];
  const ids = rows.map((row) => row.id);
  const [previews, counts, calendarPosts, { data: branding }] = await Promise.all([
    loadContentPreviews(supabase, ids),
    loadContentFileCounts(supabase, ids),
    loadClientContentCalendar(supabase, clientId),
    supabase.from("client_branding").select("*").eq("client_id", clientId).maybeSingle(),
  ]);

  const activeContract = (contracts ?? [])[0];

  return (
    <>
      <div className="mb-5">
        <ClientCoverPicker clientId={client.id} color={client.cover_color} className="h-24 w-full sm:h-32" />
        <div className="-mt-8 ml-4 sm:-mt-10">
          <ClientAvatarUpload
            clientId={client.id}
            name={client.company_name}
            avatarUrl={avatarUrl}
            size="size-16 sm:size-20"
          />
        </div>
      </div>

      <PageHeader
        breadcrumb={
          <Link
            href={`${base}/clients`}
            className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Clientes
          </Link>
        }
        title={client.company_name}
        description={client.name}
        actions={
          <>
            <ClientDeleteButton
              clientId={client.id}
              clientName={client.company_name}
              redirectTo={`${base}/clients`}
            />
            <ClientFormModal
              role={actor.role}
              professionals={professionals.map((professional) => ({
                id: professional.id,
                name: professional.name,
              }))}
              client={client}
            />
            <LinkButton href={`${base}/content/new?client=${client.id}`}>Novo conteudo</LinkButton>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <CopyCode code={client.access_code} />
        {client.status === "inactive" ? <Badge tone="neutral">Inativo</Badge> : null}
        {client.email ? <span className="text-sm text-ink-500">{client.email}</span> : null}
        {client.phone ? <span className="text-sm text-ink-500">{client.phone}</span> : null}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Conteudos enviados" value={statusRows?.length ?? 0} />
        <StatCard
          label="Aguardando aprovacao"
          value={tally(["submitted", "awaiting_approval"])}
          tone="info"
        />
        <StatCard
          label="Alteracao / reprovado"
          value={tally(["revision_requested", "rejected"])}
          tone="warning"
        />
        <StatCard label="Aprovados" value={tally(["approved", "published"])} tone="success" />
      </div>

      <ClientDetailTabs
        tabs={[
          {
            id: "visao-geral",
            label: "Visao Geral",
            content: (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-5">
                  <Card padded={false}>
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
              <h2 className="text-sm font-semibold text-ink-900">Conteudos recentes</h2>
              <Link
                href={`${base}/content?client=${client.id}`}
                className="focus-ring inline-flex items-center gap-1 rounded text-sm font-medium text-accent"
              >
                Ver todos
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>

            <div className="p-4">
              {rows.length === 0 ? (
                <EmptyState
                  icon={<Images className="size-5" />}
                  title="Nenhum conteudo ainda"
                  description="Envie o primeiro conteudo para este cliente."
                  action={
                    <LinkButton href={`${base}/content/new?client=${client.id}`}>
                      Novo conteudo
                    </LinkButton>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {rows.map((content) => (
                    <ContentCard
                      key={content.id}
                      content={content}
                      previewUrl={previews.get(content.id) ?? null}
                      fileCount={counts.get(content.id) ?? 0}
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
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Documentos"
              actions={
                <DocumentUploadModal
                  clients={[{ id: client.id, companyName: client.company_name }]}
                  defaultClientId={client.id}
                  label="Enviar"
                />
              }
            />

            {activeContract ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{activeContract.title}</p>
                  <p className="text-xs text-ink-500">
                    Enviado em {formatDate(activeContract.uploaded_at ?? activeContract.created_at)}
                  </p>
                </div>
                <ContractStatusBadge status={activeContract.status} />
                <Link
                  href={`${base}/documents`}
                  className="focus-ring flex items-center gap-1.5 rounded text-sm font-medium text-accent"
                >
                  <FileText className="size-4" aria-hidden />
                  Abrir documentos
                </Link>
              </div>
            ) : (
              <p className="text-sm text-ink-500">Nenhum documento enviado ate agora.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Feed" />
            <p className="text-sm text-ink-600">
              <strong className="text-ink-900 tabular-nums">{feedCount ?? 0}</strong> de 30
              posicoes preenchidas.
            </p>
            <Link
              href={`${base}/feed?client=${client.id}`}
              className="focus-ring mt-3 flex items-center gap-1.5 rounded text-sm font-medium text-accent"
            >
              <Grid3x3 className="size-4" aria-hidden />
              Organizar feed
            </Link>
          </Card>

                  <ClientServicesCard clientId={client.id} services={services} />
                </div>
              </div>
            ),
          },
          {
            id: "calendario",
            label: "Calendario",
            content: <ClientContentCalendar posts={calendarPosts} basePath={base} />,
          },
          {
            id: "branding",
            label: "Branding",
            content: <ClientBrandingForm clientId={client.id} branding={branding} basePath={base} />,
          },
        ]}
      />
    </>
  );
}
