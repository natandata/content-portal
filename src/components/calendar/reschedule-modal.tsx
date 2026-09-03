"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { updateContentScheduleAction } from "@/server/actions/contents";
import { setTaskDueDateAction } from "@/server/actions/tasks";
import type { CalendarEntry } from "@/features/workspace/calendar-board";

/**
 * Reagenda um item do calendario. Post tem data + hora e leva para a tela do
 * conteudo; tarefa tem so prazo e leva para o quadro.
 */
export function RescheduleModal({
  entry,
  open,
  onClose,
}: {
  entry: CalendarEntry | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !entry) return;
    setDate(entry.date);
    setTime(entry.time?.slice(0, 5) ?? "");
    setError(null);
  }, [open, entry]);

  async function submit() {
    if (!entry) return;
    setError(null);

    if (!date) {
      setError(entry.kind === "post" ? "Informe a data do post." : "Informe o prazo.");
      return;
    }

    setBusy(true);
    try {
      const result =
        entry.kind === "post"
          ? await updateContentScheduleAction(entry.id, {
              scheduledDate: date,
              scheduledTime: time || "",
            })
          : await setTaskDueDateAction(entry.id, date);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!entry) return null;

  const isPost = entry.kind === "post";

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={entry.title}
      description={entry.subtitle ?? undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Fechar
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge tone={entry.tone}>{entry.statusLabel}</Badge>
          <Badge tone="neutral">{isPost ? "Post" : "Tarefa"}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={isPost ? "Data" : "Prazo"} htmlFor="reschedule-date" required>
            <Input
              id="reschedule-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={busy}
            />
          </Field>

          {isPost ? (
            <Field label="Horario" htmlFor="reschedule-time" hint="Opcional">
              <Input
                id="reschedule-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                disabled={busy}
              />
            </Field>
          ) : null}
        </div>

        <a
          href={isPost ? `/professional/content/${entry.id}` : "/professional/tasks"}
          className="text-sm font-medium text-accent hover:underline"
        >
          {isPost ? "Abrir conteudo completo" : "Abrir no quadro de tarefas"} →
        </a>

        <FormError>{error}</FormError>
      </div>
    </Modal>
  );
}
