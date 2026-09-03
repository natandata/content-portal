import "server-only";

import Stripe from "stripe";

import { stripeSecretKey } from "@/lib/env";

/**
 * Cliente da Stripe, ou `null` quando a chave nao esta configurada.
 *
 * Mesmo contrato de `vapidConfig()` e `cronSecret()`: sem variavel de ambiente
 * a funcionalidade fica desligada e quem chama falha fechado. Nunca lanca no
 * import, porque o CI roda typecheck sem nenhuma variavel de ambiente.
 */

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (cached) return cached;

  const key = stripeSecretKey();
  if (!key) return null;

  cached = new Stripe(key, {
    // Fixa para o comportamento nao mudar sozinho quando a Stripe publica uma
    // versao nova. Trocar so junto com um upgrade consciente do SDK.
    apiVersion: "2026-08-26.dahlia",
    appInfo: { name: "content-portal" },
  });

  return cached;
}
