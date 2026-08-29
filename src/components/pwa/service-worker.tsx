"use client";

import { useEffect } from "react";

/**
 * Registra o service worker. Só em producao: em desenvolvimento ele conflita
 * com o Fast Refresh e serve chunks antigos.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Falha ao registrar o service worker:", error);
      });
    };

    // Espera o load para nao competir por banda com o primeiro render.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
