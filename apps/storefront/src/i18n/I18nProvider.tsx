import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { MessageKey } from './en';
import {
  DEFAULT_LOCALE,
  I18nContext,
  isSupportedLocale,
  LOCALE_STORAGE_KEY,
  translate,
  type I18nContextValue,
  type SupportedLocale,
} from './i18nContext';

function getInitialLocale(initialLocale?: SupportedLocale): SupportedLocale {
  if (initialLocale && isSupportedLocale(initialLocale)) {
    return initialLocale;
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored && isSupportedLocale(stored)) {
        return stored;
      }
    }
  } catch (error: unknown) {
    console.warn('Failed to read locale from localStorage:', error);
  }

  return DEFAULT_LOCALE;
}

export interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: SupportedLocale;
}

/**
 * Provides reactive locale state (`en` | `pt-BR`), persists selection in
 * `localStorage` (`minieshop_locale`), and synchronizes `<html lang>`.
 */
export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() =>
    getInitialLocale(initialLocale),
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((nextLocale: SupportedLocale): void => {
    if (!isSupportedLocale(nextLocale)) return;
    setLocaleState(nextLocale);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
      }
    } catch (error: unknown) {
      console.warn('Failed to persist locale to localStorage:', error);
    }
  }, []);

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>): string =>
      translate(key, params, locale),
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
