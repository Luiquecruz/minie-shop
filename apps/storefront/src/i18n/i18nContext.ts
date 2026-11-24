import { createContext } from 'react';
import { enMessages, type MessageKey } from './en';
import { ptBRMessages } from './pt-BR';

export type SupportedLocale = 'en' | 'pt-BR';

export interface LocaleOption {
  code: SupportedLocale;
  label: string;
}

export const SUPPORTED_LOCALES: readonly LocaleOption[] = [
  { code: 'en', label: 'EN' },
  { code: 'pt-BR', label: 'PT-BR' },
];

export const DEFAULT_LOCALE: SupportedLocale = 'en';
export const LOCALE_STORAGE_KEY = 'minieshop_locale';

export function isSupportedLocale(value: string): value is SupportedLocale {
  return value === 'en' || value === 'pt-BR';
}

const dictionaries: Record<SupportedLocale, Record<MessageKey, string>> = {
  en: enMessages,
  'pt-BR': ptBRMessages,
};

/**
 * Pure translation helper supporting parameter interpolation across locales.
 */
export function translate(
  key: MessageKey,
  params?: Record<string, string | number>,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  const dictionary = dictionaries[locale] ?? enMessages;
  const template = dictionary[key] ?? enMessages[key];
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (acc, [paramKey, paramValue]) =>
      acc.replaceAll(`{${paramKey}}`, () => String(paramValue)),
    template,
  );
}

export interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (
    key: MessageKey,
    params?: Record<string, string | number>,
  ) => string;
}

export const defaultI18nContextValue: I18nContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key, params) => translate(key, params, DEFAULT_LOCALE),
};

export const I18nContext = createContext<I18nContextValue>(
  defaultI18nContextValue,
);
