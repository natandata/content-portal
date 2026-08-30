"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { pushSupported, subscribeToPush } from "@/lib/push-client";
import {
  dismissNotificationPromptAction,
  subscribeToPushAction,
} from "@/server/actions/notifications";

/**
 * Convite de notificacoes, mostrado uma vez so, depois do tour. Mesma moldura
 * visual do tour (cobre a tela, trava a rolagem) mas de um passo so.
 *
 * Se o navegador nao suporta Web Push (ou a permissao ja veio negada de
 * antes), o convite nunca aparece: marcamos como respondido sem UI, para nao
 * insistir toda vez em um aparelho onde a resposta ja e conhecida.
 */
export function NotificationPrompt({
  locale = DEFAULT_LOCALE,
  onDone,
}: {
  locale?: Locale;
  onDone: () => void;
}) {
  const t = getDictionary(locale).notifications;
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported() || Notification.permission === "denied") {
      void dismissNotificationPromptAction();
      onDone();
      return;
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [ready]);

  async function accept() {
    setBusy(true);
    try {
      const subscription = await subscribeToPush();
      const json = subscription.toJSON();
      if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
        await subscribeToPushAction({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        });
      }
    } catch {
      // Recusou a permissao do navegador — segue sem inscricao, sem travar o fluxo.
    } finally {
      await dismissNotificationPromptAction();
      setBusy(false);
      onDone();
    }
  }

  async function decline() {
    setBusy(true);
    await dismissNotificationPromptAction();
    setBusy(false);
    onDone();
  }

  if (!ready) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-ink-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-6 dark:bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-prompt-title"
    >
      <div className="card w-full max-w-md rounded-b-none p-6 shadow-xl sm:rounded-b-[14px]">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-on-ink">
          <Bell className="size-5" aria-hidden />
        </span>

        <h2 id="notif-prompt-title" className="mt-4 text-lg font-semibold text-ink-900">
          {t.promptTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">{t.promptBody}</p>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void decline()}
            disabled={busy}
            className="focus-ring rounded text-sm text-ink-500 transition hover:text-ink-900"
          >
            {t.later}
          </button>

          <Button loading={busy} onClick={() => void accept()}>
            {t.activate}
          </Button>
        </div>
      </div>
    </div>
  );
}
