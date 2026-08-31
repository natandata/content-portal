"use client";

import { useEffect } from "react";

import { revalidateBadgesCache } from "@/server/actions/badges";

/**
 * Revalida o cache de badges de notificação quando a página de pagamentos
 * é visitada, fazendo o badge de "Cobrancas" desaparecer da navegação.
 */
export function RevalidateInvoicesBadge() {
  useEffect(() => {
    // Trigger revalidation to clear the badges cache
    revalidateBadgesCache().catch(() => {
      // Silently fail if revalidation is not available
    });
  }, []);

  return null;
}
