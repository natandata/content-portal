"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { deleteContractAction, setContractStatusAction } from "@/server/actions/contracts";
import type { ContractStatus } from "@/types/database";

export function ContractStaffActions({
  contractId,
  status,
}: {
  contractId: string;
  status: ContractStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function update(next: ContractStatus, message: string) {
    startTransition(async () => {
      const result = await setContractStatusAction(contractId, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(message);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status === "under_review" || status === "signed" ? (
          <Button
            size="sm"
            variant="success"
            loading={pending}
            onClick={() => update("approved", "Contrato conferido e aprovado.")}
          >
            <CheckCircle2 className="size-4" aria-hidden />
            Confirmar recebimento
          </Button>
        ) : null}

        {status === "approved" ? (
          <Button
            size="sm"
            variant="outline"
            loading={pending}
            onClick={() => update("under_review", "Contrato voltou para conferencia.")}
          >
            <RotateCcw className="size-4" aria-hidden />
            Reabrir conferencia
          </Button>
        ) : null}

        {status !== "replaced" ? (
          <Button
            size="sm"
            variant="outline"
            loading={pending}
            onClick={() => update("replaced", "Contrato marcado como substituido.")}
          >
            Marcar como substituido
          </Button>
        ) : null}

        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="size-4" aria-hidden />
          Excluir
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Excluir contrato"
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
                  const result = await deleteContractAction(contractId);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Contrato excluido.");
                  setConfirmOpen(false);
                  router.refresh();
                })
              }
            >
              Excluir definitivamente
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          O PDF original e o contrato assinado serao removidos do armazenamento.
        </p>
      </Modal>
    </>
  );
}
