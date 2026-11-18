import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CurrencyCode, CurrencyConfig } from '../../types';
import type { RootState } from '../index';
import {
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
  isCurrencyCode,
} from '../../utils/currency';

const STORAGE_KEY = 'minieshop_currency';

export interface CurrencyState {
  currentCurrency: CurrencyCode;
}

const getInitialCurrency = (): CurrencyCode => {
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
};

const initialState: CurrencyState = {
  currentCurrency: getInitialCurrency(),
};

export const currencySlice = createSlice({
  name: 'currency',
  initialState,
  reducers: {
    setCurrency: (state, action: PayloadAction<CurrencyCode>) => {
      const newCurrency = action.payload;
      if (isCurrencyCode(newCurrency)) {
        state.currentCurrency = newCurrency;
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(STORAGE_KEY, newCurrency);
          }
        } catch (error: unknown) {
          console.warn('Failed to persist currency to localStorage:', error);
        }
      }
    },
  },
});

export const { setCurrency } = currencySlice.actions;

export const selectCurrentCurrency = (state: RootState): CurrencyCode =>
  state.currency.currentCurrency;

export const selectCurrencyConfig = (state: RootState): CurrencyConfig =>
  SUPPORTED_CURRENCIES[state.currency.currentCurrency] ||
  SUPPORTED_CURRENCIES[DEFAULT_CURRENCY];

export default currencySlice.reducer;
