"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { scheduleInstagramReportAction } from "@/server/actions/instagram-scheduled-reports";
import type { InstagramConnectionStatus } from "@/server/actions/instagram-connect";

const PERIOD_OPTIONS = [3, 6, 9] as const;

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function InstagramInsightsReportForm({
  clientId,
  connections,
}: {
  clientId: string;
  connections: InstagramConnectionStatus[];
}) {
  const router = useRouter();
  const principal = connections.find((connection) => connection.isPrincipal) ?? connections[0];
  const [connectionId, setConnectionId] = useState(principal?.id ?? "");
  const [periodMonths, setPeriodMonths] = useState<(typeof PERIOD_OPTIONS)[number]>(3);
  const [busy, setBusy] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleBusy, setScheduleBusy] = useState(false);

  async function submit() {
    if (!connectionId) {
      toast.error("Conecte o Instagram do cliente primeiro.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/reports/instagram-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, connectionId, periodMonths }),
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

  async function submitSchedule() {
    if (!connectionId) {
      toast.error("Conecte o Instagram do cliente primeiro.");
      return;
    }
    if (!scheduleDate) {
      toast.error("Escolha uma data.");
      return;
    }

    setScheduleBusy(true);
    try {
      const result = await scheduleInstagramReportAction({
        clientId,
        connectionId,
        periodMonths,
        scheduledDate: scheduleDate,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Relatorio agendado.");
      setScheduling(false);
      setScheduleDate("");
      router.refresh();
    } finally {
      setScheduleBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {connections.length > 1 ? (
          <div>
            <label className="field-label" htmlFor="instagram-insights-connection">
              Conta
            </label>
            <Select
              id="instagram-insights-connection"
              value={connectionId}
              onChange={(event) => setConnectionId(event.target.value)}
              disabled={busy}
              className="max-w-[220px]"
            >
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.instagramUsername ? `@${connection.instagramUsername}` : connection.label ?? "Conta conectada"}
                  {connection.isPrincipal ? " (principal)" : ""}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

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
        <Button variant="secondary" onClick={() => setScheduling((value) => !value)} disabled={busy}>
          <CalendarPlus className="size-4" aria-hidden />
          Agendar emissao
        </Button>
      </div>

      {scheduling ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-ink-50 p-3">
          <div>
            <label className="field-label" htmlFor="instagram-insights-schedule-date">
              Data da emissao
            </label>
            <Input
              id="instagram-insights-schedule-date"
              type="date"
              min={todayIso()}
              value={scheduleDate}
              onChange={(event) => setScheduleDate(event.target.value)}
              disabled={scheduleBusy}
              className="max-w-[180px]"
            />
          </div>
          <Button size="sm" loading={scheduleBusy} onClick={() => void submitSchedule()}>
            Confirmar agendamento
          </Button>
          <p className="w-full text-xs text-ink-500">
            So a data e garantida -- a emissao roda no proximo cron diario a partir dessa data, sem hora exata.
          </p>
        </div>
      ) : null}
    </div>
  );
}
