import { AlertTriangle, Video } from "lucide-react";

import { GoogleConnectButton, GoogleDisconnectButton } from "@/components/google/google-connect-button";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { googleOAuthConfig } from "@/lib/env";
import { loadGoogleConnectionStatus } from "@/server/actions/google-connect";

const ERROR_MESSAGE: Record<string, string> = {
  denied: "Voce cancelou a conexao no Google.",
  invalid_state: "A conexao expirou ou foi aberta em outra aba. Tente de novo.",
  session: "Sua sessao expirou durante a conexao. Entre novamente e tente de novo.",
  not_configured: "Reunioes por Google Meet ainda nao foram configuradas nesta instalacao.",
  no_refresh_token:
    "O Google nao devolveu a autorizacao completa. Revogue o acesso do app em myaccount.google.com/permissions e tente conectar de novo.",
  no_email: "Nao foi possivel identificar o e-mail da conta Google.",
  save_failed: "A conexao funcionou, mas nao foi possivel salvar. Tente de novo.",
  exchange_failed: "Falha ao confirmar a conexao com o Google. Tente de novo.",
};

/**
 * Tela do profissional para conectar o Google Calendar. So depois disso o
 * cliente consegue pedir (ou aprovar) reuniao — sem conta conectada, o
 * botao de solicitar reuniao fica desabilitado do lado do cliente.
 */
export async function MeetingSettings({ error }: { error?: string }) {
  const actor = await requireStaff();
  const configured = Boolean(googleOAuthConfig());

  const status =
    actor.role === "professional"
      ? await loadGoogleConnectionStatus(actor.authUser.id)
      : { connected: false, googleEmail: null };

  return (
    <>
      <PageHeader
        title="Reunioes por Google Meet"
        description="Conecte sua agenda para o cliente marcar reuniao direto pelo portal, com o link do Meet gerado sozinho."
      />

      {!configured ? (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <div className="flex gap-3">
            <AlertTriangle className="size-5 shrink-0 text-amber-600" aria-hidden />
            <p className="text-sm text-amber-800">
              Reunioes por Google Meet ainda nao foram configuradas nesta instalacao. Fale com o administrador.
            </p>
          </div>
        </Card>
      ) : null}

      {error && ERROR_MESSAGE[error] ? (
        <Card className="mb-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{ERROR_MESSAGE[error]}</p>
        </Card>
      ) : null}

      {actor.role !== "professional" ? (
        <Card>
          <p className="text-sm text-ink-500">
            Cada profissional conecta a propria agenda em Configuracoes. O admin nao marca reuniao em nome de ninguem.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink-900">Sua agenda Google</h2>
            <Badge tone={status.connected ? "success" : "neutral"}>
              {status.connected ? "Conectada" : "Nao conectada"}
            </Badge>
          </div>

          {status.connected ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm text-ink-600">
                <Video className="size-4 shrink-0 text-ink-400" aria-hidden />
                {status.googleEmail}
              </p>
              <p className="text-xs text-ink-500">
                Toda reuniao aprovada entra nessa agenda, com Google Meet e o cliente convidados automaticamente.
              </p>
              <GoogleDisconnectButton />
            </div>
          ) : (
            <div className="flex flex-col items-start gap-4">
              <p className="text-sm text-ink-600">
                A Google pede login e permissao para criar eventos na sua agenda — nada alem disso e acessado.
              </p>
              <GoogleConnectButton />
            </div>
          )}
        </Card>
      )}
    </>
  );
}
