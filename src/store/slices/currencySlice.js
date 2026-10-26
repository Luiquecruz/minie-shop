import { createSlice } from '@reduxjs/toolkit';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from '../../utils/currency.js';

const STORAGE_KEY = 'minieshop_currency';

const getInitialCurrency = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_CURRENCIES[stored]) {
        return stored;
      }
    }
  } catch (error) {
    console.warn('Failed to read currency from localStorage:', error);
  }
  return DEFAULT_CURRENCY;
};

const initialState = {
  currentCurrency: getInitialCurrency(),
};

export const currencySlice = createSlice({
  name: 'currency',
  initialState,
  reducers: {
    setCurrency: (state, action) => {
      const newCurrency = action.payload;
      if (SUPPORTED_CURRENCIES[newCurrency]) {
        state.currentCurrency = newCurrency;
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(STORAGE_KEY, newCurrency);
          }
        } catch (error) {
          console.warn('Failed to persist currency to localStorage:', error);
        }
      }
    },
  },
});

export const { setCurrency } = currencySlice.actions;

export const selectCurrentCurrency = (state) => state.currency.currentCurrency;
export const selectCurrencyConfig = (state) =>
  SUPPORTED_CURRENCIES[state.currency.currentCurrency] ||
  SUPPORTED_CURRENCIES[DEFAULT_CURRENCY];

export default currencySlice.reducer;
