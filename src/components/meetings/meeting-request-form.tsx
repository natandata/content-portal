"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import { requestMeetingAction } from "@/server/actions/meetings";

/**
 * Um unico formulario serve os dois lados: quem abre e que vira
 * `requested_by` na action (ela le a sessao, nao um parametro daqui).
 *
 * Com `calendlyEventType` preenchido, o profissional ja tem Calendly
 * conectado com um tipo de reuniao escolhido — os campos de data/hora somem
 * porque a pessoa vai escolher um horario livre direto na Calendly, so
 * precisa confirmar o e-mail de contato.
 */
export function MeetingRequestForm({
  clientId,
  defaultEmail,
  locale = "pt-BR",
  calendlyEventType = null,
}: {
  clientId: string;
  defaultEmail?: string;
  locale?: Locale;
  calendlyEventType?: { name: string; durationMinutes: number } | null;
}) {
  const dict = getDictionary(locale).meetings;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const result = await requestMeetingAction({
        clientId,
        contactEmail: email,
        proposedDate: calendlyEventType ? undefined : date,
        proposedTime: calendlyEventType ? undefined : time,
        message,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(dict.sentToast);
      setOpen(false);
      setMessage("");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" aria-hidden />
        {calendlyEventType ? dict.calendlyRequestButton : dict.requestButton}
      </Button>

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={dict.modalTitle}
        description={dict.modalDescription}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              {dict.cancel}
            </Button>
            <Button loading={pending} onClick={submit}>
              {dict.submit}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {calendlyEventType ? (
            <div className="rounded-lg border border-line bg-canvas p-3 text-sm text-ink-600 sm:col-span-2">
              <p className="font-medium text-ink-900">{calendlyEventType.name}</p>
              <p className="text-xs text-ink-500">
                {calendlyEventType.durationMinutes} min · {dict.calendlyEventSummary}
              </p>
            </div>
          ) : (
            <>
              <Field label={dict.fieldDate} htmlFor="meeting-date" required>
                <Input
                  id="meeting-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  disabled={pending}
                />
              </Field>
              <Field label={dict.fieldTime} htmlFor="meeting-time" required>
                <Input
                  id="meeting-time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  disabled={pending}
                />
              </Field>
            </>
          )}
          <Field label={dict.fieldEmail} htmlFor="meeting-email" required className="sm:col-span-2">
            <Input
              id="meeting-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@exemplo.com"
              disabled={pending}
            />
          </Field>
          <Field label={dict.fieldMessage} htmlFor="meeting-message" className="sm:col-span-2">
            <Textarea
              id="meeting-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              disabled={pending}
            />
          </Field>
        </div>

        {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
      </Modal>
    </>
  );
}
