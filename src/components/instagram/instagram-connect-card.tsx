import { AlertTriangle, Instagram } from "lucide-react";

import {
  InstagramConnectButton,
  InstagramDisconnectButton,
  InstagramSetPrincipalButton,
} from "@/components/instagram/instagram-connect-button";
import { Badge } from "@/components/ui/badge";
import { CardHeader } from "@/components/ui/layout";
import { composioConfig } from "@/lib/env";
import { loadInstagramConnectionStatus } from "@/server/actions/instagram-connect";

/**
 * Contas Instagram Business/Creator do CLIENTE (nao do profissional) --
 * alimentam o relatorio 2 (insights). Um cliente pode ter mais de uma conta
 * conectada; a marcada "Principal" e a que entra no relatorio automatico
 * mensal. Mesmo desenho de estados de `meeting-settings.tsx`: nao
 * configurado / nao conectado / conectado.
 */
export async function InstagramConnectCard({ clientId }: { clientId: string }) {
  const configured = Boolean(composioConfig());
  const connections = configured ? await loadInstagramConnectionStatus(clientId) : [];

  return (
    <>
      <CardHeader
        title="Conexao Instagram"
        description="Conta(s) Instagram Business/Creator do cliente -- necessarias para o relatorio de insights abaixo. Login real via Meta, nunca usuario e senha."
        actions={
          <Badge tone={connections.length > 0 ? "success" : "neutral"}>
            {connections.length > 0 ? `${connections.length} conectada(s)` : "Nao conectado"}
          </Badge>
        }
      />

      {!configured ? (
        <p className="flex items-start gap-2 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Ainda nao configurado nesta instalacao.
        </p>
      ) : (
        <div className="space-y-4">
          {connections.length > 0 ? (
            <ul className="space-y-2">
              {connections.map((connection) => (
                <li
                  key={connection.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm text-ink-700">
                    <Instagram className="size-4 shrink-0 text-ink-400" aria-hidden />
                    <span>
                      {connection.instagramUsername ? (
                        <>
                          <strong className="font-medium">@{connection.instagramUsername}</strong>
                          {connection.label ? <span className="text-ink-500"> · {connection.label}</span> : null}
                        </>
                      ) : (
                        connection.label ?? "Conta conectada (username indisponivel)"
                      )}
                    </span>
                    {connection.isPrincipal ? <Badge tone="info">Principal</Badge> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {!connection.isPrincipal ? (
                      <InstagramSetPrincipalButton clientId={clientId} connectionId={connection.id} />
                    ) : null}
                    <InstagramDisconnectButton clientId={clientId} connectionId={connection.id} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-600">
              O cliente (ou voce, em nome dele) autoriza pela propria tela de login da Meta -- o app nunca ve nem
              guarda a senha. Precisa ser uma conta Business ou Creator; conta Pessoal nao e suportada pela Meta.
            </p>
          )}
          <InstagramConnectButton clientId={clientId} hasConnections={connections.length > 0} />
        </div>
      )}
    </>
  );
}
