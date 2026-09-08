"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, IconButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { deleteInstagramPublicReportAction } from "@/server/actions/instagram-report-cleanup";

/** Exclui um unico relatorio de perfil publico (Apify). */
export function InstagramPublicReportDeleteButton({
  reportId,
  clientId,
}: {
  reportId: string;
  clientId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      const result = await deleteInstagramPublicReportAction(reportId, clientId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Relatorio excluido.");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <IconButton label="Excluir relatorio" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" />
      </IconButton>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Excluir relatorio"
        description="Este relatorio de perfil publico some da tela. Nao afeta nenhum documento em Documentos."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void handleConfirm()}>
              Excluir relatorio
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </>
  );
}
