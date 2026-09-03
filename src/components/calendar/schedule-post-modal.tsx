"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ContentStatusBadge } from "@/components/ui/badge";
import { Field, FormError, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { updateContentScheduleAction } from "@/server/actions/contents";
import type { CalendarPost } from "@/features/workspace/calendar-board";

export function SchedulePostModal({
  post,
  open,
  onClose,
}: {
  post: CalendarPost | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Cada post aberto (ou reaberto) parte dos proprios valores salvos.
  useEffect(() => {
    if (!open || !post) return;
    setDate(post.scheduledDate ?? "");
    setTime(post.scheduledTime?.slice(0, 5) ?? "");
    setError(null);
  }, [open, post]);

  async function submit() {
    if (!post) return;
    setError(null);

    if (!date) {
      setError("Informe a data do post.");
      return;
    }

    setBusy(true);
    try {
      const result = await updateContentScheduleAction(post.id, {
        scheduledDate: date,
        scheduledTime: time || "",
      });
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

  if (!post) return null;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={post.title}
      description={post.clientName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Fechar
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Salvar agendamento
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ContentStatusBadge status={post.status} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" htmlFor="schedule-date" required>
            <Input
              id="schedule-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={busy}
            />
          </Field>
          <Field label="Horario" htmlFor="schedule-time" hint="Opcional">
            <Input
              id="schedule-time"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              disabled={busy}
            />
          </Field>
        </div>

        <a
          href={`/professional/content/${post.id}`}
          className="text-sm font-medium text-accent hover:underline"
        >
          Abrir conteudo completo →
        </a>

        <FormError>{error}</FormError>
      </div>
    </Modal>
  );
}
