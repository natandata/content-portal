"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { IconButton } from "@/components/ui/button";
import { cancelScheduledReportAction } from "@/server/actions/instagram-scheduled-reports";
import { formatDate } from "@/lib/utils";
import type { InstagramScheduledReportRow } from "@/types/database";

/** Lista dos agendamentos avulsos pendentes de um cliente, com botao de cancelar. */
export function InstagramScheduledReportsList({ schedules }: { schedules: InstagramScheduledReportRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (schedules.length === 0) return null;

  function cancel(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await cancelScheduledReportAction(id);
      if (!result.ok) {
        toast.error(result.error);
        setPendingId(null);
        return;
      }
      toast.success("Agendamento cancelado.");
      router.refresh();
    });
  }

  return (
    <ul className="space-y-1.5">
      {schedules.map((schedule) => (
        <li
          key={schedule.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm"
        >
          <span className="text-ink-700">
            Relatorio de {schedule.period_months} meses agendado para {formatDate(schedule.scheduled_date)}
          </span>
          <IconButton
            label="Cancelar agendamento"
            onClick={() => cancel(schedule.id)}
            disabled={pendingId === schedule.id}
          >
            <X className="size-4" />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}
