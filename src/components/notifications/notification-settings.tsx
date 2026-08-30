"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
export function NotificationSettings() {
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
      toast.success("Notificacoes ativadas neste aparelho.");
    } catch {
      // Negar a permissao do navegador tambem cai aqui.
      setStatus(Notification.permission === "denied" ? "denied" : "off");
      toast.error("Nao foi possivel ativar. Verifique a permissao do navegador.");
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
      toast.success("Notificacoes desativadas neste aparelho.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking") {
    return <p className="text-sm text-ink-500">Verificando suporte do navegador...</p>;
  }

  if (status === "unsupported") {
    return (
      <p className="text-sm text-ink-500">
        Este navegador nao suporta notificacoes push. No iPhone, adicione o portal a tela de
        inicio primeiro — o Safari so libera notificacoes para apps instalados.
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="text-sm text-ink-500">
        As notificacoes estao bloqueadas nas configuracoes do navegador para este site. Libere
        por la para poder ativar aqui.
      </p>
    );
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
            {status === "on" ? "Ativadas neste aparelho" : "Desativadas neste aparelho"}
          </p>
          <p className="text-xs text-ink-500">
            Novo conteudo para aprovar, documentos e retorno do cliente.
          </p>
        </div>
      </div>

      <Button
        variant={status === "on" ? "outline" : "primary"}
        size="sm"
        loading={busy}
        onClick={() => void (status === "on" ? disable() : enable())}
      >
        {status === "on" ? "Desativar" : "Ativar"}
      </Button>
    </div>
  );
}
