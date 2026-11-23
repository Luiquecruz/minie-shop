import { describe, expect, it } from 'vitest';
import { formatCents, formatMoney } from './money';

function normalizeSpaces(value: string): string {
  return value.replace(/\u00a0/g, ' ');
}

describe('formatMoney (integer cents at UI boundary)', () => {
  it('formats BRL cents with pt-BR Intl.NumberFormat', () => {
    expect(normalizeSpaces(formatMoney({ amount: 29990, currency: 'BRL' }))).toBe(
      'R$ 299,90',
    );
    expect(normalizeSpaces(formatMoney({ amount: 0, currency: 'BRL' }))).toBe(
      'R$ 0,00',
    );
    expect(normalizeSpaces(formatMoney({ amount: 123456, currency: 'BRL' }))).toBe(
      'R$ 1.234,56',
    );
  });

  it('formats non-BRL MoneyDTO currency faithfully without computing conversion rates', () => {
    expect(normalizeSpaces(formatMoney({ amount: 5000, currency: 'USD' }))).toContain(
      '50,00',
    );
    expect(normalizeSpaces(formatCents(1990))).toBe('R$ 19,90');
  });
});
