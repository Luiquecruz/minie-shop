import { useCallback } from 'react';
import { formatCents } from '../utils/money';

/**
 * Formats integer cents at the UI display boundary.
 * Client-side currency conversion is intentionally disabled (ADR-0017);
 * backend multi-currency pricing is queued for Phase 6.1.
 */
export function useCurrency() {
  const formatPrice = useCallback(
    (amountCents: number, currency: string = 'BRL'): string =>
      formatCents(amountCents, currency),
    [],
  );

  return {
    currentCurrency: 'BRL' as const,
    formatPrice,
  };
}

export default useCurrency;
