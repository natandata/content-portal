"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { deleteInvoiceAction, markInvoicePaidAction } from "@/server/actions/invoices";
import type { InvoiceStatus } from "@/types/database";

export function InvoiceStaffActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: InvoiceStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status === "open" ? (
          <Button
            size="sm"
            variant="success"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await markInvoicePaidAction(invoiceId);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Cobranca marcada como paga.");
                router.refresh();
              })
            }
          >
            <CheckCircle2 className="size-4" aria-hidden />
            Cobranca paga
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
        title="Excluir cobranca"
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
                  const result = await deleteInvoiceAction(invoiceId);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Cobranca excluida.");
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
          O cliente deixa de ver esta cobranca. Se houver boleto anexado, o PDF tambem e removido.
        </p>
      </Modal>
    </>
  );
}
