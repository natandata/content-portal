"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cancelInvoiceRecurrenceAction, deleteInvoiceAction, markInvoicePaidAction } from "@/server/actions/invoices";
import type { InvoiceMethod, InvoiceStatus } from "@/types/database";

export function InvoiceStaffActions({
  invoiceId,
  status,
  method,
  recurrenceActive = false,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  method: InvoiceMethod;
  /** true quando esta cobranca pertence a uma serie recorrente que ainda vai gerar proximos ciclos. */
  recurrenceActive?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paidConfirmOpen, setPaidConfirmOpen] = useState(false);
  const [cancelRecurrenceOpen, setCancelRecurrenceOpen] = useState(false);

  function cancelRecurrence() {
    startTransition(async () => {
      const result = await cancelInvoiceRecurrenceAction(invoiceId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Recorrencia cancelada -- os proximos ciclos nao serao mais gerados.");
      setCancelRecurrenceOpen(false);
      router.refresh();
    });
  }

  function markPaid() {
    startTransition(async () => {
      const result = await markInvoicePaidAction(invoiceId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cobranca marcada como paga.");
      setPaidConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status === "open" ? (
          <Button
            size="sm"
            variant="success"
            loading={pending}
            // Em cobranca online a confirmacao vem da propria Stripe. Marcar na
            // mao aqui so muda o nosso registro — nao move dinheiro nenhum —,
            // entao pede confirmacao antes.
            onClick={() => (method === "stripe" ? setPaidConfirmOpen(true) : markPaid())}
          >
            <CheckCircle2 className="size-4" aria-hidden />
            Cobranca paga
          </Button>
        ) : null}

        {recurrenceActive ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setCancelRecurrenceOpen(true)}>
            Cancelar recorrencia
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

      <Modal
        open={paidConfirmOpen}
        onClose={() => setPaidConfirmOpen(false)}
        title="Marcar como paga na mao?"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPaidConfirmOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button variant="success" loading={pending} onClick={markPaid}>
              Marcar como paga
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          Esta e uma cobranca de pagamento online: quando o cliente paga pelo portal, ela se
          marca sozinha. Marcar aqui muda so o registro do sistema — nao cobra e nao transfere
          nada na Stripe. Use isto apenas se o cliente pagou por fora.
        </p>
      </Modal>

      <Modal
        open={cancelRecurrenceOpen}
        onClose={() => setCancelRecurrenceOpen(false)}
        title="Cancelar recorrencia"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelRecurrenceOpen(false)} disabled={pending}>
              Voltar
            </Button>
            <Button variant="danger" loading={pending} onClick={cancelRecurrence}>
              Cancelar recorrencia
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          As cobrancas ja geradas continuam valendo normalmente. So os proximos ciclos deixam de
          ser criados.
        </p>
      </Modal>
    </>
  );
}
