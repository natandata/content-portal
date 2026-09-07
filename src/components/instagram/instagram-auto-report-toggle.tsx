"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Repeat } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { saveInstagramReportSettingsAction } from "@/server/actions/instagram-report-settings";

const PERIOD_OPTIONS = [3, 6, 9] as const;
const DAY_OPTIONS = Array.from({ length: 28 }, (_, index) => index + 1);

/**
 * Liga/desliga o relatorio automatico mensal do cliente (roda contra a
 * conta principal, ver `InstagramConnectCard`). Nao existe "switch" no
 * design system ainda -- botao + badge de estado, mesmo espirito dos outros
 * cartoes de conexao desta tela.
 */
export function InstagramAutoReportToggle({
  clientId,
  enabled,
  periodMonths,
  day,
}: {
  clientId: string;
  enabled: boolean;
  periodMonths: 3 | 6 | 9;
  day: number;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]>(periodMonths);
  const [dayOfMonth, setDayOfMonth] = useState(day);
  const [pending, start] = useTransition();

  function save(nextEnabled: boolean, nextPeriod: (typeof PERIOD_OPTIONS)[number], nextDay: number) {
    start(async () => {
      const result = await saveInstagramReportSettingsAction({
        clientId,
        autoReportEnabled: nextEnabled,
        autoReportPeriodMonths: nextPeriod,
        autoReportDay: nextDay,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(nextEnabled ? "Relatorio automatico ligado." : "Relatorio automatico desligado.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2.5">
      <Repeat className="size-4 shrink-0 text-ink-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900">Relatorio automatico mensal</p>
        <p className="text-xs text-ink-500">
          Gera um relatorio novo em PDF todo mes para a conta principal e entrega em Documentos, sem precisar clicar.
        </p>
      </div>

      {enabled ? (
        <>
          <div>
            <label className="field-label" htmlFor={`auto-report-day-${clientId}`}>
              Dia do mes
            </label>
            <Select
              id={`auto-report-day-${clientId}`}
              value={dayOfMonth}
              onChange={(event) => {
                const next = Number(event.target.value);
                setDayOfMonth(next);
                save(true, period, next);
              }}
              disabled={pending}
              className="max-w-[110px]"
            >
              {DAY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  Dia {option}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="field-label" htmlFor={`auto-report-period-${clientId}`}>
              Janela
            </label>
            <Select
              id={`auto-report-period-${clientId}`}
              value={period}
              onChange={(event) => {
                const next = Number(event.target.value) as (typeof PERIOD_OPTIONS)[number];
                setPeriod(next);
                save(true, next, dayOfMonth);
              }}
              disabled={pending}
              className="max-w-[160px]"
            >
              {PERIOD_OPTIONS.map((months) => (
                <option key={months} value={months}>
                  Janela de {months} meses
                </option>
              ))}
            </Select>
          </div>
        </>
      ) : null}

      <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Ligado" : "Desligado"}</Badge>
      <Button
        variant="secondary"
        size="sm"
        loading={pending}
        onClick={() => save(!enabled, period, dayOfMonth)}
      >
        {enabled ? "Desligar" : "Ligar"}
      </Button>
    </div>
  );
}
