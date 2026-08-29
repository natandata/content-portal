import { UserCog } from "lucide-react";

import { ProfessionalFormModal } from "@/components/professionals/professional-form-modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Card, PageHeader } from "@/components/ui/layout";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { initials } from "@/lib/utils";

export async function ProfessionalsList() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: professionals }, { data: clients }] = await Promise.all([
    supabase.from("users").select("*").eq("role", "professional").order("name"),
    supabase.from("clients").select("professional_id"),
  ]);

  const clientCount = new Map<string, number>();
  for (const client of clients ?? []) {
    if (!client.professional_id) continue;
    clientCount.set(client.professional_id, (clientCount.get(client.professional_id) ?? 0) + 1);
  }

  const rows = professionals ?? [];

  return (
    <>
      <PageHeader
        title="Profissionais"
        description="Quem opera a gestao de conteudo e quais clientes atende."
        actions={<ProfessionalFormModal />}
      />

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

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{professional.name}</p>
                  <p className="truncate text-xs text-ink-500">{professional.email}</p>
                </div>

                <span className="text-xs text-ink-500 tabular-nums">
                  {clientCount.get(professional.id) ?? 0} cliente(s)
                </span>

                {professional.status === "inactive" ? (
                  <Badge tone="neutral">Inativo</Badge>
                ) : (
                  <Badge tone="success">Ativo</Badge>
                )}

                <ProfessionalFormModal professional={professional} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
