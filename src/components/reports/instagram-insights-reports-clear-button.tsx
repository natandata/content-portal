"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eraser } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { clearInstagramInsightsReportsAction } from "@/server/actions/instagram-report-cleanup";

/** Apaga de uma vez todos os relatorios de insights do cliente -- testes acumulam varios rapido. */
export function InstagramInsightsReportsClearButton({ clientId, count }: { clientId: string; count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      const result = await clearInstagramInsightsReportsAction(clientId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Relatorios limpos.");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Eraser className="size-4" aria-hidden />
        Limpar relatorios
      </Button>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Limpar relatorios"
        description={`Isso apaga os ${count} relatorio(s) de insights deste cliente da tela. Se algum ja foi enviado como PDF em Documentos, o documento la continua intacto.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void handleConfirm()}>
              Limpar {count} relatorio(s)
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </>
  );
}
