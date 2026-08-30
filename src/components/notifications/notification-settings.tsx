"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { pushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push-client";
import {
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "@/server/actions/notifications";

type Status = "checking" | "unsupported" | "denied" | "on" | "off";

/**
 * Liga/desliga notificacoes neste aparelho. Fica em Configuracoes e e o mesmo
 * fluxo do convite pos-tour — so que repetivel, a qualquer momento.
 */
export function NotificationSettings({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const t = getDictionary(locale).notifications;
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!pushSupported()) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }

      const registration = await navigator.serviceWorker.ready.catch(() => null);
      const existing = await registration?.pushManager.getSubscription();
      if (!cancelled) setStatus(existing ? "on" : "off");
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const subscription = await subscribeToPush();
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Inscricao incompleta.");
      }
      const result = await subscribeToPushAction({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStatus("on");
      toast.success(t.enabledToast);
    } catch {
      // Negar a permissao do navegador tambem cai aqui.
      setStatus(Notification.permission === "denied" ? "denied" : "off");
      toast.error(t.enableError);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await unsubscribeFromPushAction(endpoint);
      setStatus("off");
      toast.success(t.disabledToast);
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking") {
    return <p className="text-sm text-ink-500">{t.checking}</p>;
  }

  if (status === "unsupported") {
    return <p className="text-sm text-ink-500">{t.unsupported}</p>;
  }

  if (status === "denied") {
    return <p className="text-sm text-ink-500">{t.denied}</p>;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        {status === "on" ? (
          <Bell className="size-4 text-emerald-600" aria-hidden />
        ) : (
          <BellOff className="size-4 text-ink-400" aria-hidden />
        )}
        <div>
          <p className="text-sm font-medium text-ink-900">
            {status === "on" ? t.onThisDevice : t.offThisDevice}
          </p>
          <p className="text-xs text-ink-500">{t.settingsHint}</p>
        </div>
      </div>

      <Button
        variant={status === "on" ? "outline" : "primary"}
        size="sm"
        loading={busy}
        onClick={() => void (status === "on" ? disable() : enable())}
      >
        {status === "on" ? t.disable : t.enable}
      </Button>
    </div>
  );
}
