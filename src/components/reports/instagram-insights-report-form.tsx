"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";

const PERIOD_OPTIONS = [3, 6, 9] as const;

export function InstagramInsightsReportForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [periodMonths, setPeriodMonths] = useState<(typeof PERIOD_OPTIONS)[number]>(3);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const response = await fetch("/api/reports/instagram-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, periodMonths }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !result?.ok) {
        toast.error(result?.error ?? "Nao foi possivel gerar o relatorio.");
        return;
      }

      toast.success("Relatorio de insights gerado.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="field-label" htmlFor="instagram-insights-period">
          Periodo
        </label>
        <Select
          id="instagram-insights-period"
          value={periodMonths}
          onChange={(event) => setPeriodMonths(Number(event.target.value) as (typeof PERIOD_OPTIONS)[number])}
          disabled={busy}
          className="max-w-[160px]"
        >
          {PERIOD_OPTIONS.map((months) => (
            <option key={months} value={months}>
              Ultimos {months} meses
            </option>
          ))}
        </Select>
      </div>
      <Button loading={busy} onClick={() => void submit()}>
        <Sparkles className="size-4" aria-hidden />
        Gerar relatorio
      </Button>
    </div>
  );
}
