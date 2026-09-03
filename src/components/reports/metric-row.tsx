"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, IconButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MetricFormModal } from "@/components/reports/metric-form-modal";
import { deleteMetricAction } from "@/server/actions/client-metrics";
import { formatDate } from "@/lib/utils";
import type { ClientMetricRow } from "@/types/database";

/** Uma linha de metrica — grid, nao <tr>, porque o Modal de exclusao (div
 * position:fixed) nao pode morar dentro de um <tr> (HTML invalido). */
export function MetricRow({ metric, clientId }: { metric: ClientMetricRow; clientId: string }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      const result = await deleteMetricAction(metric.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Metrica excluida.");
      setDeleteOpen(false);
      router.refresh();
    } finally {
      setDeleteBusy(false);
    }
  }

  const periodLabel = new Date(`${metric.period_date}T00:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="grid grid-cols-[1.2fr_0.8fr_1fr_1.4fr_auto] items-center gap-3 border-b border-line px-1 py-3 text-sm last:border-0">
      <span className="truncate font-medium text-ink-900">{metric.metric_name}</span>
      <span className="tabular-nums text-ink-800">{metric.metric_value.toLocaleString("pt-BR")}</span>
      <span className="capitalize text-ink-500">{periodLabel}</span>
      <span className="truncate text-ink-500">{metric.notes ?? "—"}</span>
      <div className="flex items-center justify-end gap-1">
        <MetricFormModal
          clientId={clientId}
          metric={metric}
          trigger={(openModal) => (
            <IconButton label="Editar metrica" onClick={openModal}>
              <Pencil className="size-4" />
            </IconButton>
          )}
        />
        <IconButton label="Excluir metrica" onClick={() => setDeleteOpen(true)} className="text-destructive">
          <Trash2 className="size-4" />
        </IconButton>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => !deleteBusy && setDeleteOpen(false)}
        title="Excluir metrica"
        description={`Tem certeza que deseja excluir "${metric.metric_name}" (${formatDate(metric.period_date)})?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
              Cancelar
            </Button>
            <Button variant="danger" loading={deleteBusy} onClick={() => void handleDelete()}>
              Excluir
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </div>
  );
}
