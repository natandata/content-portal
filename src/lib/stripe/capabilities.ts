/**
 * Leitura do estado da conta Connect do profissional.
 *
 * Sem import da Stripe: e usado tanto no servidor quanto em componente de
 * cliente para desenhar badges.
 */

import type { BadgeTone } from "@/lib/domain";
import type { ProfessionalPaymentAccountRow } from "@/types/database";

/** Metodos que o Checkout pode oferecer. Ordem = ordem de exibicao. */
export const STRIPE_METHODS = ["card", "boleto", "pix"] as const;
export type StripeMethod = (typeof STRIPE_METHODS)[number];

/** Nome da capacidade na Stripe correspondente a cada metodo. */
const CAPABILITY_BY_METHOD: Record<StripeMethod, string> = {
  card: "card_payments",
  boleto: "boleto_payments",
  pix: "pix_payments",
};

export const METHOD_LABEL: Record<StripeMethod, string> = {
  card: "Cartao de credito",
  boleto: "Boleto",
  pix: "Pix",
};

/**
 * Estado de uma capacidade. "unrequested" e o que a Stripe devolve quando nunca
 * foi pedida; tratamos igual a "inactive" na hora de cobrar.
 */
export type CapabilityState = "active" | "pending" | "inactive" | "unrequested";

export const CAPABILITY_LABEL: Record<CapabilityState, string> = {
  active: "Disponivel",
  pending: "Em analise pela Stripe",
  inactive: "Nao disponivel",
  unrequested: "Nao disponivel",
};

export const CAPABILITY_TONE: Record<CapabilityState, BadgeTone> = {
  active: "success",
  pending: "warning",
  inactive: "neutral",
  unrequested: "neutral",
};

export type ConnectStatus = "not_connected" | "incomplete" | "restricted" | "active";

export const CONNECT_STATUS_LABEL: Record<ConnectStatus, string> = {
  not_connected: "Nao conectado",
  incomplete: "Cadastro incompleto",
  restricted: "Com pendencia",
  active: "Ativo",
};

export const CONNECT_STATUS_TONE: Record<ConnectStatus, BadgeTone> = {
  not_connected: "neutral",
  incomplete: "warning",
  restricted: "danger",
  active: "success",
};

type AccountRow = ProfessionalPaymentAccountRow | null | undefined;

export function capabilityState(account: AccountRow, method: StripeMethod): CapabilityState {
  const raw = account?.capabilities?.[CAPABILITY_BY_METHOD[method]];
  if (raw === "active" || raw === "pending" || raw === "inactive") return raw;
  return "unrequested";
}

/**
 * Metodos que podem entrar no Checkout agora. Capacidade negada simplesmente
 * some da lista — no Brasil o Pix e liberado por convite, entao ficar de fora
 * e o caso esperado, nao um erro.
 */
export function paymentMethodTypesFor(account: AccountRow): StripeMethod[] {
  if (!account?.charges_enabled) return [];
  return STRIPE_METHODS.filter((method) => capabilityState(account, method) === "active");
}

export function canChargeWithStripe(account: AccountRow): boolean {
  return paymentMethodTypesFor(account).length > 0;
}

export function connectStatusOf(account: AccountRow): ConnectStatus {
  if (!account?.stripe_account_id) return "not_connected";
  if (!account.details_submitted) return "incomplete";
  if (!account.charges_enabled || account.requirements_disabled_reason) return "restricted";
  return "active";
}
