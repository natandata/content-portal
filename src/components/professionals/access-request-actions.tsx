"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  approveAccessRequestAction,
  rejectAccessRequestAction,
} from "@/server/actions/professionals";

export function AccessRequestActions({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="success"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await approveAccessRequestAction(userId);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success(`${name} agora tem acesso.`);
              router.refresh();
            })
          }
        >
          <Check className="size-4" aria-hidden />
          Aprovar
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
        >
          <X className="size-4" aria-hidden />
          Recusar
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Recusar solicitacao"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await rejectAccessRequestAction(userId);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Solicitacao recusada.");
                  setConfirmOpen(false);
                  router.refresh();
                })
              }
            >
              Recusar e remover
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          A conta de <strong className="text-ink-900">{name}</strong> sera removida e o email
          ficara livre para uma nova solicitacao. Esta acao nao pode ser desfeita.
        </p>
      </Modal>
    </>
  );
}
