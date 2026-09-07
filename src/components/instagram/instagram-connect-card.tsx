import { AlertTriangle, Instagram } from "lucide-react";

import { InstagramConnectButton, InstagramDisconnectButton } from "@/components/instagram/instagram-connect-button";
import { Badge } from "@/components/ui/badge";
import { CardHeader } from "@/components/ui/layout";
import { composioConfig } from "@/lib/env";
import { loadInstagramConnectionStatus } from "@/server/actions/instagram-connect";

/**
 * Conexao OAuth do Instagram Business/Creator do CLIENTE (nao do
 * profissional) -- alimenta o relatorio 2 (insights). Mesmo desenho de
 * estados de `meeting-settings.tsx`: nao configurado / nao conectado /
 * conectado.
 */
export async function InstagramConnectCard({ clientId }: { clientId: string }) {
  const configured = Boolean(composioConfig());
  const status = configured
    ? await loadInstagramConnectionStatus(clientId)
    : { connected: false, instagramUsername: null };

  return (
    <>
      <CardHeader
        title="Conexao Instagram"
        description="Conta Instagram Business/Creator do cliente -- necessaria para o relatorio de insights abaixo. Login real via Meta, nunca usuario e senha."
        actions={<Badge tone={status.connected ? "success" : "neutral"}>{status.connected ? "Conectado" : "Nao conectado"}</Badge>}
      />

      {!configured ? (
        <p className="flex items-start gap-2 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Ainda nao configurado nesta instalacao.
        </p>
      ) : status.connected ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-ink-600">
            <Instagram className="size-4 shrink-0 text-ink-400" aria-hidden />
            {status.instagramUsername ? `@${status.instagramUsername}` : "Conta conectada"}
          </p>
          <InstagramDisconnectButton clientId={clientId} />
        </div>
      ) : (
        <div className="flex flex-col items-start gap-4">
          <p className="text-sm text-ink-600">
            O cliente (ou voce, em nome dele) autoriza pela propria tela de login da Meta -- o app nunca ve nem
            guarda a senha. Precisa ser uma conta Business ou Creator; conta Pessoal nao e suportada pela Meta.
          </p>
          <InstagramConnectButton clientId={clientId} />
        </div>
      )}
    </>
  );
}
