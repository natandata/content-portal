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
}: {
  clientId: string;
  enabled: boolean;
  periodMonths: 3 | 6 | 9;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]>(periodMonths);
  const [pending, start] = useTransition();

  function save(nextEnabled: boolean, nextPeriod: (typeof PERIOD_OPTIONS)[number]) {
    start(async () => {
      const result = await saveInstagramReportSettingsAction({
        clientId,
        autoReportEnabled: nextEnabled,
        autoReportPeriodMonths: nextPeriod,
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
          Gera um relatorio novo todo mes para a conta principal, sem precisar clicar.
        </p>
      </div>

      {enabled ? (
        <Select
          value={period}
          onChange={(event) => {
            const next = Number(event.target.value) as (typeof PERIOD_OPTIONS)[number];
            setPeriod(next);
            save(true, next);
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
      ) : null}

      <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Ligado" : "Desligado"}</Badge>
      <Button
        variant="secondary"
        size="sm"
        loading={pending}
        onClick={() => save(!enabled, period)}
      >
        {enabled ? "Desligar" : "Ligar"}
      </Button>
    </div>
  );
}
