"use client";

import { publicEnv } from "@/lib/env";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** VAPID exige a chave publica em bytes, nao na string base64url que ela chega. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/**
 * Pede permissao ao navegador (se ainda nao respondida) e cria a inscricao.
 * A concessao da permissao e o proprio `subscribe()` — nao ha uma chamada
 * separada de "pedir permissao" no padrao Push API.
 */
export async function subscribeToPush(): Promise<PushSubscription> {
  if (!pushSupported()) throw new Error("Este navegador nao suporta notificacoes push.");
  if (!publicEnv.vapidPublicKey) throw new Error("Notificacoes nao configuradas no servidor.");

  const registration = await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicEnv.vapidPublicKey),
  });
}

export async function unsubscribeFromPush(): Promise<string | null> {
  const subscription = await getExistingSubscription();
  if (!subscription) return null;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}
