import type { MoneyDTO } from '@minieshop/contracts';

const DEFAULT_LOCALE = 'pt-BR';
const DEFAULT_CURRENCY = 'BRL';

/**
 * Formats an integer-cents MoneyDTO at the UI display boundary.
 *
 * Project rule:
 * - All monetary values in domain, cart, shipping, and discount logic are
 *   strictly integer cents (never floating-point currency values).
 * - The frontend NEVER computes currency conversion rates; it formats the
 *   exact MoneyDTO returned by the API (backend multi-currency pricing is
 *   queued for Phase 6.1).
 */
export function formatMoney(
  money: MoneyDTO,
  locale: string = DEFAULT_LOCALE,
): string {
  const safeCents = Number.isFinite(money.amount) ? Math.trunc(money.amount) : 0;
  const currency = money.currency || DEFAULT_CURRENCY;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(safeCents / 100);
}

/**
 * Convenience helper for formatting integer cents in a known ISO-4217 currency.
 */
export function formatCents(
  amountCents: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  return formatMoney({ amount: amountCents, currency }, locale);
}
