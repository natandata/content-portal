"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ExternalLink, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { disconnectInstagramAction, startInstagramConnectAction } from "@/server/actions/instagram-connect";

export function InstagramConnectButton({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition();

  return (
    <Button
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await startInstagramConnectAction(clientId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          window.location.assign(result.data.url);
        })
      }
    >
      <ExternalLink className="size-4" aria-hidden />
      Conectar Instagram
    </Button>
  );
}

export function InstagramDisconnectButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await disconnectInstagramAction(clientId);
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
