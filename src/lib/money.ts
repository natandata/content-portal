/**
 * Conversao de dinheiro entre o banco e a Stripe, e calculo da comissao da
 * plataforma.
 *
 * `invoices.amount` e `numeric(12,2)` (reais, com centavos); a Stripe trabalha
 * com inteiro em centavos. Toda a conversao mora aqui para nao existirem duas
 * versoes da regra de arredondamento espalhadas pelo codigo.
 *
 * Sem import da Stripe de proposito: este modulo tambem e usado por componente
 * de cliente para exibir a comissao.
 */

/** Comissao inicial de todo profissional novo. Espelha o default da coluna. */
export const DEFAULT_PLATFORM_FEE_PERCENT = 1;

/** Teto de digitacao no painel do admin. Espelha o check da coluna: 0 a 100. */
export const MAX_PLATFORM_FEE_PERCENT = 100;

/** Acima disso a Stripe recusa a cobranca; falhar aqui e melhor que falhar la. */
const MAX_AMOUNT_CENTS = 99_999_999;

/**
 * Reais para centavos. O `toFixed(2)` antes da multiplicacao defende contra um
 * float que chegue como 1234.5599999 — o valor vem de `numeric(12,2)`, entao
 * nunca deveria ter mais de duas casas, mas a serializacao passa por JSON.
 */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valor da cobranca invalido.");
  }

  const cents = Math.round(Number(amount.toFixed(2)) * 100);

  if (cents <= 0 || cents > MAX_AMOUNT_CENTS) {
    throw new Error("Valor da cobranca fora do limite aceito pela Stripe.");
  }

  return cents;
}

/**
 * Comissao da plataforma, em centavos. A sobra do arredondamento fica com a
 * plataforma: o liquido do profissional e sempre exatamente `valor - comissao`,
 * um inteiro, que e o numero que ele precisa bater na conciliacao dele.
 */
export function applicationFeeCents(amountCents: number, feePercent: number): number {
  if (!Number.isFinite(feePercent) || feePercent <= 0) return 0;

  const fee = Math.round((amountCents * feePercent) / 100);
  return Math.min(Math.max(fee, 0), amountCents);
}

/** "1%" / "2,5%" — o percentual como o admin digitou, sem zeros a toa. */
export function formatFeePercent(percent: number, locale = "pt-BR"): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(percent)}%`;
}
