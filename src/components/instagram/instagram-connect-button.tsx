"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, Star, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import {
  disconnectInstagramAction,
  setPrincipalInstagramConnectionAction,
  startInstagramConnectAction,
} from "@/server/actions/instagram-connect";

/** Botao de conectar + campo opcional de rotulo, para distinguir quando o cliente tiver mais de uma conta. */
export function InstagramConnectButton({ clientId, hasConnections }: { clientId: string; hasConnections: boolean }) {
  const [label, setLabel] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-end gap-2">
      {hasConnections ? (
        <div className="min-w-0">
          <label className="field-label" htmlFor={`instagram-label-${clientId}`}>
            Apelido (opcional)
          </label>
          <Input
            id={`instagram-label-${clientId}`}
            placeholder="Ex.: Loja principal"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            disabled={pending}
            className="max-w-[220px]"
          />
        </div>
      ) : null}
      <Button
        loading={pending}
        onClick={() =>
          start(async () => {
            const result = await startInstagramConnectAction(clientId, label);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            window.location.assign(result.data.url);
          })
        }
      >
        <ExternalLink className="size-4" aria-hidden />
        {hasConnections ? "Conectar outra conta" : "Conectar Instagram"}
      </Button>
    </div>
  );
}

export function InstagramDisconnectButton({ clientId, connectionId }: { clientId: string; connectionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await disconnectInstagramAction(clientId, connectionId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Instagram desconectado.");
          router.refresh();
        })
      }
    >
      <Unlink className="size-4" aria-hidden />
      Desconectar
    </Button>
  );
}

export function InstagramSetPrincipalButton({ clientId, connectionId }: { clientId: string; connectionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await setPrincipalInstagramConnectionAction(clientId, connectionId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Conta principal atualizada.");
          router.refresh();
        })
      }
    >
      <Star className="size-4" aria-hidden />
      Tornar principal
    </Button>
  );
}
