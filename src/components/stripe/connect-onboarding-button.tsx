"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  openConnectDashboardAction,
  refreshConnectStatusAction,
  startConnectOnboardingAction,
} from "@/server/actions/stripe-connect";

/** Leva para o cadastro hospedado da Stripe. */
export function ConnectOnboardingButton({ label }: { label: string }) {
  const [pending, start] = useTransition();

  return (
    <Button
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await startConnectOnboardingAction();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          window.location.assign(result.data.url);
        })
      }
    >
      <ExternalLink className="size-4" aria-hidden />
      {label}
    </Button>
  );
}

export function ConnectStatusRefresh() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await refreshConnectStatusAction();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Status atualizado.");
          router.refresh();
        })
      }
    >
      <RefreshCw className="size-4" aria-hidden />
      Atualizar status
    </Button>
  );
}

export function ConnectDashboardButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await openConnectDashboardAction();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          window.open(result.data.url, "_blank", "noopener,noreferrer");
        })
      }
    >
      <ExternalLink className="size-4" aria-hidden />
      Ver saldo e repasses
    </Button>
  );
}
