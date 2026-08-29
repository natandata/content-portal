import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";

import { ClientFormModal } from "@/components/clients/client-form-modal";
import { CopyCode } from "@/components/clients/copy-code";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Card, PageHeader } from "@/components/ui/layout";
import { basePath, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { initials } from "@/lib/utils";

export async function ClientsList() {
  const actor = await requireStaff();
  const base = basePath(actor.role);
  const supabase = await createClient();

  const { data: clients } = await supabase.from("clients").select("*").order("company_name");

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

  const professionalOptions = professionals.map((professional) => ({
    id: professional.id,
    name: professional.name,
  }));

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cada cliente entra na plataforma com o proprio codigo de acesso."
        actions={<ClientFormModal role={actor.role} professionals={professionalOptions} />}
      />

      {!clients || clients.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="Nenhum cliente cadastrado"
          description="Crie o primeiro cliente para gerar o codigo de acesso e comecar a enviar conteudos."
          action={<ClientFormModal role={actor.role} professionals={professionalOptions} />}
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {clients.map((client) => (
              <li key={client.id} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600">
                  {initials(client.company_name)}
                </span>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`${base}/clients/${client.id}`}
                    className="focus-ring block rounded"
                  >
                    <p className="truncate text-sm font-medium text-ink-900">
                      {client.company_name}
                    </p>
                    <p className="truncate text-xs text-ink-500">{client.name}</p>
                  </Link>
                </div>

                {client.status === "inactive" ? (
                  <Badge tone="neutral" className="hidden sm:inline-flex">
                    Inativo
                  </Badge>
                ) : null}

                <div className="hidden sm:block">
                  <CopyCode code={client.access_code} />
                </div>

                <Link
                  href={`${base}/clients/${client.id}`}
                  aria-label={`Abrir ${client.company_name}`}
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
