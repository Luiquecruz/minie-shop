import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CurrencyCode, CurrencyConfig } from '../../types';
import type { RootState } from '../index';
import {
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
  isCurrencyCode,
} from '../../utils/currency';

export interface CurrencyState {
  currentCurrency: CurrencyCode;
}

export const initialCurrencyState: CurrencyState = {
  currentCurrency: DEFAULT_CURRENCY,
};

export const currencySlice = createSlice({
  name: 'currency',
  initialState: initialCurrencyState,
  reducers: {
    setCurrency: (state, action: PayloadAction<CurrencyCode>) => {
      const newCurrency = action.payload;
      if (isCurrencyCode(newCurrency)) {
        state.currentCurrency = newCurrency;
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
