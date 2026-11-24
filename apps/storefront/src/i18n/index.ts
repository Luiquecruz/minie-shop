import { useContext } from 'react';
import {
  DEFAULT_LOCALE,
  I18nContext,
  isSupportedLocale,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  translate,
  type I18nContextValue,
  type LocaleOption,
  type SupportedLocale,
} from './i18nContext';
import type { MessageKey } from './en';

export { I18nProvider, type I18nProviderProps } from './I18nProvider';
export {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  translate as t,
  type I18nContextValue,
  type LocaleOption,
  type SupportedLocale,
};
export type { MessageKey };

/**
 * Consumes reactive storefront i18n context (`locale`, `setLocale`, `t`).
 * Safely defaults to English (`en`) when rendered outside `<I18nProvider>`.
 */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
