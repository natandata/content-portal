import { AlertTriangle, Video } from "lucide-react";

import { CalendlyConnectButton, CalendlyDisconnectButton } from "@/components/calendly/calendly-connect-button";
import { CalendlyEventTypePicker } from "@/components/calendly/calendly-event-type-picker";
import { GoogleConnectButton, GoogleDisconnectButton } from "@/components/google/google-connect-button";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { calendlyOAuthConfig, googleOAuthConfig } from "@/lib/env";
import { loadCalendlyConnectionStatus } from "@/server/actions/calendly-connect";
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
  calendly_denied: "Voce cancelou a conexao no Calendly.",
  calendly_invalid_state: "A conexao expirou ou foi aberta em outra aba. Tente de novo.",
  calendly_session: "Sua sessao expirou durante a conexao. Entre novamente e tente de novo.",
  calendly_exchange_failed: "Falha ao confirmar a conexao com o Calendly. Tente de novo.",
  calendly_no_user: "Nao foi possivel identificar sua conta Calendly.",
  calendly_save_failed: "A conexao funcionou, mas nao foi possivel salvar. Tente de novo.",
};

/**
 * Tela do profissional para conectar a agenda usada nas reunioes marcadas
 * pelo portal — Google Meet e Calendly convivem aqui, um cartao cada. Sem
 * nenhuma das duas conectadas, o pedido de reuniao continua funcionando no
 * fluxo manual (propor data, a outra parte aprova).
 */
export async function MeetingSettings({ error }: { error?: string }) {
  const actor = await requireStaff();
  const googleConfigured = Boolean(googleOAuthConfig());
  const calendlyConfigured = Boolean(calendlyOAuthConfig());

  const [googleStatus, calendlyStatus] =
    actor.role === "professional"
      ? await Promise.all([
          loadGoogleConnectionStatus(actor.authUser.id),
          loadCalendlyConnectionStatus(actor.authUser.id),
        ])
      : [{ connected: false, googleEmail: null }, { connected: false, eventTypeUri: null, eventTypeName: null, eventTypeDuration: null }];

  return (
    <>
      <PageHeader
        title="Reunioes"
        description="Conecte uma agenda para o cliente marcar reuniao direto pelo portal — Google Meet ou Calendly, o que voce ja usar."
      />

      {error && ERROR_MESSAGE[error] ? (
        <Card className="mb-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{ERROR_MESSAGE[error]}</p>
        </Card>
      ) : null}

      {actor.role !== "professional" ? (
        <Card>
          <p className="text-sm text-ink-500">
            Cada profissional conecta a propria agenda em Configuracoes. O admin nao marca reuniao em nome de
            ninguem.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink-900">Google Meet</h2>
              <Badge tone={googleStatus.connected ? "success" : "neutral"}>
                {googleStatus.connected ? "Conectado" : "Nao conectado"}
              </Badge>
            </div>

            {!googleConfigured ? (
              <p className="flex items-start gap-2 text-sm text-amber-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                Ainda nao configurado nesta instalacao.
              </p>
            ) : googleStatus.connected ? (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm text-ink-600">
                  <Video className="size-4 shrink-0 text-ink-400" aria-hidden />
                  {googleStatus.googleEmail}
                </p>
                <p className="text-xs text-ink-500">
                  Reuniao aprovada por proposta manual entra nessa agenda, com o Meet gerado sozinho.
                </p>
                <GoogleDisconnectButton />
              </div>
            ) : (
              <div className="flex flex-col items-start gap-4">
                <p className="text-sm text-ink-600">
                  Cliente propoe (ou recebe) uma data especifica; a outra parte aprova. O evento nasce na sua
                  agenda Google.
                </p>
                <GoogleConnectButton />
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink-900">Calendly</h2>
              <Badge tone={calendlyStatus.connected ? "success" : "neutral"}>
                {calendlyStatus.connected ? "Conectado" : "Nao conectado"}
              </Badge>
            </div>

            {!calendlyConfigured ? (
              <p className="flex items-start gap-2 text-sm text-amber-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                Ainda nao configurado nesta instalacao.
              </p>
            ) : calendlyStatus.connected ? (
              <div className="space-y-3">
                <p className="text-xs text-ink-500">
                  Sem aprovacao manual: quem pede reuniao ve sua disponibilidade real e escolhe um horario livre.
                </p>
                <CalendlyEventTypePicker currentEventTypeUri={calendlyStatus.eventTypeUri} />
                {calendlyStatus.eventTypeName ? (
                  <p className="text-xs text-ink-500">
                    Em uso: <strong className="text-ink-700">{calendlyStatus.eventTypeName}</strong> (
                    {calendlyStatus.eventTypeDuration} min)
                  </p>
                ) : (
                  <p className="text-xs text-amber-700">
                    Escolha um tipo de reuniao acima para o Calendly comecar a funcionar no portal.
                  </p>
                )}
                <CalendlyDisconnectButton />
              </div>
            ) : (
              <div className="flex flex-col items-start gap-4">
                <p className="text-sm text-ink-600">
                  A Calendly pede login e permissao para ler seus tipos de evento e gerar links de agendamento —
                  nada alem disso e acessado.
                </p>
                <CalendlyConnectButton />
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
