import type { CurrencyCode } from '../../types';
import { DEFAULT_CURRENCY, isCurrencyCode } from '../../utils/currency';

const STORAGE_KEY = 'minieshop_currency';

export function loadPersistedCurrency(): CurrencyCode {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isCurrencyCode(stored)) {
        return stored;
      }
    }
  } catch (error: unknown) {
    console.warn('Failed to read currency from localStorage:', error);
  }
  return DEFAULT_CURRENCY;
}

export function savePersistedCurrency(currency: CurrencyCode): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, currency);
    }
  } catch (error: unknown) {
    console.warn('Failed to persist currency to localStorage:', error);
  }
}
