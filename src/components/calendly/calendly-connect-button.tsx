"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ExternalLink, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { disconnectCalendlyAction, startCalendlyConnectAction } from "@/server/actions/calendly-connect";

export function CalendlyConnectButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await startCalendlyConnectAction();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          window.location.assign(result.data.url);
        })
      }
    >
      <ExternalLink className="size-4" aria-hidden />
      Conectar Calendly
    </Button>
  );
}

export function CalendlyDisconnectButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await disconnectCalendlyAction();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Calendly desconectado.");
          router.refresh();
        })
      }
    >
      <Unlink className="size-4" aria-hidden />
      Desconectar
    </Button>
  );
}
