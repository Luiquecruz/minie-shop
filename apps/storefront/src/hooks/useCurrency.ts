import type { CurrencyCode, CurrencyConfig } from '../types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  selectCurrentCurrency,
  selectCurrencyConfig,
  setCurrency,
} from '../store/slices/currencySlice';
import {
  SUPPORTED_CURRENCIES,
  formatCurrencyWithCode,
  convertCurrency,
} from '../utils/currency';

export interface UseCurrencyReturn {
  currentCurrency: CurrencyCode;
  currencyConfig: CurrencyConfig;
  changeCurrency: (currencyCode: CurrencyCode) => void;
  formatPrice: (valueInBrl: number) => string;
  convertPrice: (valueInBrl: number) => number;
  supportedCurrencies: Record<CurrencyCode, CurrencyConfig>;
}

/**
 * Custom hook to consume and manage the multi-currency engine via Redux Toolkit.
 */
export function useCurrency(): UseCurrencyReturn {
  const dispatch = useAppDispatch();
  const currentCurrency = useAppSelector(selectCurrentCurrency);
  const currencyConfig = useAppSelector(selectCurrencyConfig);

  const changeCurrency = (currencyCode: CurrencyCode): void => {
    dispatch(setCurrency(currencyCode));
  };

  const formatPrice = (valueInBrl: number): string => {
    return formatCurrencyWithCode(valueInBrl, currentCurrency);
  };

  const convertPrice = (valueInBrl: number): number => {
    return convertCurrency(valueInBrl, currentCurrency);
  };

  return {
    currentCurrency,
    currencyConfig,
    changeCurrency,
    formatPrice,
    convertPrice,
    supportedCurrencies: SUPPORTED_CURRENCIES,
  };
}

export default useCurrency;
