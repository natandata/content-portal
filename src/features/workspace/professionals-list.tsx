import Link from "next/link";
import { ChevronRight, UserCog, UserPlus } from "lucide-react";

import { AccessRequestActions } from "@/components/professionals/access-request-actions";
import { ProfessionalFormModal } from "@/components/professionals/professional-form-modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Card, PageHeader } from "@/components/ui/layout";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeDay, initials } from "@/lib/utils";

export async function ProfessionalsList() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: allProfessionals }, { data: clients }] = await Promise.all([
    supabase.from("users").select("*").eq("role", "professional").order("name"),
    supabase.from("clients").select("professional_id"),
  ]);

  // Quem se cadastrou pela tela de login fica separado, aguardando decisao.
  const pendingRequests = (allProfessionals ?? []).filter((p) => p.status === "pending");
  const professionals = (allProfessionals ?? []).filter((p) => p.status !== "pending");

  const clientCount = new Map<string, number>();
  for (const client of clients ?? []) {
    if (!client.professional_id) continue;
    clientCount.set(client.professional_id, (clientCount.get(client.professional_id) ?? 0) + 1);
  }

  const rows = professionals;

  return (
    <>
      <PageHeader
        title="Profissionais"
        description="Quem opera a gestao de conteudo e quais clientes atende."
        actions={<ProfessionalFormModal />}
      />

      {pendingRequests.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
            <UserPlus className="size-4 text-amber-500" aria-hidden />
            Solicitacoes de acesso
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 tabular-nums">
              {pendingRequests.length}
            </span>
          </h2>

          <Card padded={false}>
            <ul className="divide-y divide-line">
              {pendingRequests.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center gap-4 px-4 py-3.5 sm:px-5"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-xs font-semibold text-amber-700">
                    {initials(request.name)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{request.name}</p>
                    <p className="truncate text-xs text-ink-500">
                      {request.email}
                      {request.requested_at ? (
                        <>
                          <span className="text-ink-300"> · </span>
                          {formatRelativeDay(request.requested_at)}
                        </>
                      ) : null}
                    </p>
                  </div>

                  <AccessRequestActions userId={request.id} name={request.name} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={<UserCog className="size-5" />}
          title="Nenhum profissional cadastrado"
          description="Crie um acesso para quem vai produzir e enviar os conteudos."
          action={<ProfessionalFormModal />}
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {rows.map((professional) => (
              <li
                key={professional.id}
                className="flex flex-wrap items-center gap-4 px-4 py-3.5 sm:px-5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600">
                  {initials(professional.name)}
                </span>

                <Link
                  href={`/admin/professionals/${professional.id}`}
                  className="focus-ring min-w-0 flex-1 rounded"
                >
                  <p className="truncate text-sm font-medium text-ink-900">{professional.name}</p>
                  <p className="truncate text-xs text-ink-500">{professional.email}</p>
                </Link>

                <span className="text-xs text-ink-500 tabular-nums">
                  {clientCount.get(professional.id) ?? 0} cliente(s)
                </span>

                {professional.status === "inactive" ? (
                  <Badge tone="neutral">Inativo</Badge>
                ) : (
                  <Badge tone="success">Ativo</Badge>
                )}

                <ProfessionalFormModal professional={professional} />

                <Link
                  href={`/admin/professionals/${professional.id}`}
                  aria-label={`Gerenciar ${professional.name}`}
                  className="focus-ring rounded p-1 text-ink-400 hover:text-ink-900"
                >
                  <ChevronRight className="size-5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
