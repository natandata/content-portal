"use client";

import { useEffect } from "react";

/**
 * Revalida o cache de badges de notificação quando a página de pagamentos
 * é visitada, fazendo o badge de "Cobrancas" desaparecer da navegação.
 */
export function RevalidateInvoicesBadge() {
  useEffect(() => {
    // Trigger revalidation by making a fetch request to revalidate the badges cache
    fetch("/api/revalidate?tag=nav-badges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch(() => {
      // Silently fail if revalidation endpoint is not available
    });
  }, []);

  return null;
}
