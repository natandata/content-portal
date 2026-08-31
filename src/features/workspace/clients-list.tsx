import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

import { ClientFormModal } from "@/components/clients/client-form-modal";
import { ClientsGallery } from "@/components/clients/clients-gallery";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { basePath, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadClientsGallery } from "@/server/queries";

export async function ClientsList({ professionalId }: { professionalId?: string } = {}) {
  const actor = await requireStaff();
  const base = basePath(actor.role);
  const supabase = await createClient();

  const clients = await loadClientsGallery(supabase, { professionalId });

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

  const scopedProfessional = professionalId
    ? professionals.find((professional) => professional.id === professionalId)
    : undefined;

  return (
    <>
      <PageHeader
        breadcrumb={
          professionalId ? (
            <Link
              href={`/admin/professionals/${professionalId}`}
              className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft className="size-4" aria-hidden />
              {scopedProfessional?.name ?? "Profissional"}
            </Link>
          ) : undefined
        }
        title="Clientes"
        description={
          scopedProfessional
            ? `Clientes atendidos por ${scopedProfessional.name}.`
            : "Cada cliente entra na plataforma com o proprio codigo de acesso."
        }
        actions={
          <ClientFormModal
            role={actor.role}
            professionals={professionalOptions}
            defaultProfessionalId={professionalId}
          />
        }
      />

      {clients.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="Nenhum cliente cadastrado"
          description="Crie o primeiro cliente para gerar o codigo de acesso e comecar a enviar conteudos."
          action={
            <ClientFormModal
              role={actor.role}
              professionals={professionalOptions}
              defaultProfessionalId={professionalId}
            />
          }
        />
      ) : (
        <ClientsGallery clients={clients} basePath={base} />
      )}
    </>
  );
}
