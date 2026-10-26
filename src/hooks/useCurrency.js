import { useSelector, useDispatch } from 'react-redux';
import {
  selectCurrentCurrency,
  selectCurrencyConfig,
  setCurrency,
} from '../store/slices/currencySlice.js';
import {
  SUPPORTED_CURRENCIES,
  formatCurrencyWithCode,
  convertCurrency,
} from '../utils/currency.js';

/**
 * Custom hook to consume and manage the multi-currency engine via Redux Toolkit.
 */
export function useCurrency() {
  const dispatch = useDispatch();
  const currentCurrency = useSelector(selectCurrentCurrency);
  const currencyConfig = useSelector(selectCurrencyConfig);

  const changeCurrency = (currencyCode) => {
    dispatch(setCurrency(currencyCode));
  };

  const formatPrice = (valueInBrl) => {
    return formatCurrencyWithCode(valueInBrl, currentCurrency);
  };

  const convertPrice = (valueInBrl) => {
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
