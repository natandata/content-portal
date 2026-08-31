"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { deleteClientAction } from "@/server/actions/clients";

interface Props {
  clientId: string;
  clientName: string;
  redirectTo?: string;
}

export function ClientDeleteButton({ clientId, clientName, redirectTo = "/professional/clients" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirmDelete() {
    setBusy(true);

    try {
      const result = await deleteClientAction(clientId);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Cliente deletado com sucesso.");
      setOpen(false);
      router.push(redirectTo);
    } catch (err) {
      toast.error("Erro ao deletar cliente.");
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-destructive"
      >
        <Trash2 className="size-4" aria-hidden />
        Deletar cliente
      </Button>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Deletar cliente"
        description={`Tem certeza que deseja deletar "${clientName}"? Esta acao nao pode ser desfeita.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => void handleConfirmDelete()}
            >
              Deletar cliente
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </>
  );
}
