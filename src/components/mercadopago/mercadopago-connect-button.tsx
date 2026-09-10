"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ExternalLink, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { disconnectMercadoPagoAction, startMercadoPagoConnectAction } from "@/server/actions/mercadopago-connect";

export function MercadoPagoConnectButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await startMercadoPagoConnectAction();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          window.location.assign(result.data.url);
        })
      }
    >
      <ExternalLink className="size-4" aria-hidden />
      Conectar Mercado Pago
    </Button>
  );
}

export function MercadoPagoDisconnectButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await disconnectMercadoPagoAction();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Mercado Pago desconectado.");
          router.refresh();
        })
      }
    >
      <Unlink className="size-4" aria-hidden />
      Desconectar
    </Button>
  );
}
