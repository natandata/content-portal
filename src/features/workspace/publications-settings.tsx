import { Share2 } from "lucide-react";

import { InstagramConnectCard } from "@/components/instagram/instagram-connect-card";
import { SocialConnectionsCard } from "@/components/services/social-connections-card";
import { Card } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { basePath, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadSocialConnectionsStatus } from "@/server/actions/social-connect";

import { ClientSwitcher } from "./client-switcher";

/**
 * Central de publicacao: Instagram + as 5 redes adicionais (TikTok,
 * LinkedIn, Facebook, Pinterest, YouTube), tudo num so lugar em vez de
 * espalhado entre a aba Relatorios (so Instagram) e a aba Visao Geral de
 * cada cliente (as outras 5). Cada conexao continua sendo por CLIENTE --
 * essa tela so junta o seletor de cliente com os dois cartoes de conexao.
 */
export async function PublicationsSettings({
  clientId,
  professionalId,
}: {
  clientId?: string;
  professionalId?: string;
}) {
  const actor = await requireStaff();
  const base = basePath(actor.role);
  const supabase = await createClient();

  let clientsQuery = supabase.from("clients").select("id, company_name").order("company_name");
  if (professionalId) clientsQuery = clientsQuery.eq("professional_id", professionalId);
  const { data: clients } = await clientsQuery;

  const options = (clients ?? []).map((client) => ({ id: client.id, companyName: client.company_name }));
  const selectedId = clientId ?? options[0]?.id;

  return (
    <>
      <PageHeader
        title="Publicacoes"
        description="Conecte as redes sociais de cada cliente -- Instagram, TikTok, LinkedIn, Facebook, Pinterest e YouTube."
      />

      {options.length === 0 ? (
        <EmptyState
          icon={<Share2 className="size-5" />}
          title="Nenhum cliente cadastrado"
          description="Cadastre um cliente antes de conectar redes sociais."
        />
      ) : (
        <>
          <div className="mb-6">
            <ClientSwitcher
              basePath={`${base}/settings/publications`}
              clients={options}
              selectedClientId={selectedId}
              professionalId={professionalId}
            />
          </div>

          {selectedId ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <InstagramConnectCard clientId={selectedId} />
              </Card>
              <SocialConnectionsWrapper clientId={selectedId} />
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

async function SocialConnectionsWrapper({ clientId }: { clientId: string }) {
  const connections = await loadSocialConnectionsStatus(clientId);
  return <SocialConnectionsCard clientId={clientId} connections={connections} />;
}
