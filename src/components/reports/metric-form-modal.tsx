"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { createMetricAction, updateMetricAction } from "@/server/actions/client-metrics";
import type { ClientMetricRow } from "@/types/database";

export function MetricFormModal({
  clientId,
  metric,
  trigger,
}: {
  clientId: string;
  metric?: ClientMetricRow;
  trigger?: (open: () => void) => React.ReactNode;
}) {
  const router = useRouter();
  const isEditing = Boolean(metric);

  const [open, setOpen] = useState(false);
  const [metricName, setMetricName] = useState(metric?.metric_name ?? "");
  const [metricValue, setMetricValue] = useState(metric ? String(metric.metric_value) : "");
  const [periodMonth, setPeriodMonth] = useState(metric?.period_date?.slice(0, 7) ?? "");
  const [notes, setNotes] = useState(metric?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    if (isEditing) return;
    setMetricName("");
    setMetricValue("");
    setPeriodMonth("");
    setNotes("");
  }

  async function submit() {
    setError(null);

    if (!metricName.trim()) {
      setError("Informe o nome da metrica.");
      return;
    }
    if (!metricValue || Number.isNaN(Number(metricValue))) {
      setError("Informe um valor numerico.");
      return;
    }
    if (!periodMonth) {
      setError("Informe o mes de referencia.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        clientId,
        metricName,
        metricValue,
        periodDate: `${periodMonth}-01`,
        notes,
      };
      const result = metric
        ? await updateMetricAction(metric.id, payload)
        : await createMetricAction(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(isEditing ? "Metrica atualizada." : "Metrica cadastrada.");
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Nova metrica
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={isEditing ? "Editar metrica" : "Nova metrica"}
        description="Cadastre uma metrica do cliente para um mes de referencia."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button loading={busy} onClick={() => void submit()}>
              {isEditing ? "Salvar alteracoes" : "Cadastrar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="Metrica"
            htmlFor="metric-name"
            hint='Ex.: "Seguidores", "Alcance", "Engajamento (%)"'
            required
          >
            <Input
              id="metric-name"
              value={metricName}
              onChange={(event) => setMetricName(event.target.value)}
              disabled={busy}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor" htmlFor="metric-value" required>
              <Input
                id="metric-value"
                type="number"
                step="any"
                inputMode="decimal"
                value={metricValue}
                onChange={(event) => setMetricValue(event.target.value)}
                disabled={busy}
              />
            </Field>

            <Field label="Mes de referencia" htmlFor="metric-period" required>
              <Input
                id="metric-period"
                type="month"
                value={periodMonth}
                onChange={(event) => setPeriodMonth(event.target.value)}
                disabled={busy}
              />
            </Field>
          </div>

          <Field label="Observacoes" htmlFor="metric-notes">
            <Textarea
              id="metric-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={busy}
            />
          </Field>

          <FormError>{error}</FormError>
        </div>
      </Modal>
    </>
  );
}
