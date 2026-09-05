"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ExternalLink, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { disconnectGoogleAction, startGoogleConnectAction } from "@/server/actions/google-connect";

export function GoogleConnectButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await startGoogleConnectAction();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          window.location.assign(result.data.url);
        })
      }
    >
      <ExternalLink className="size-4" aria-hidden />
      Conectar Google Calendar
    </Button>
  );
}

export function GoogleDisconnectButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await disconnectGoogleAction();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Google Calendar desconectado.");
          router.refresh();
        })
      }
    >
      <Unlink className="size-4" aria-hidden />
      Desconectar
    </Button>
  );
}
