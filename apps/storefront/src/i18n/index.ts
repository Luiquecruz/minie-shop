import { enMessages, type MessageKey } from './en';

export type SupportedLocale = 'en';

export const DEFAULT_LOCALE: SupportedLocale = 'en';

const dictionaries: Record<SupportedLocale, Record<MessageKey, string>> = {
  en: enMessages,
};

/**
 * Lightweight base i18n translator (English default for Phase 6).
 * Full multi-locale support + global language selector is planned for Phase 6.1.
 */
export function t(
  key: MessageKey,
  params?: Record<string, string | number>,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  const template = dictionaries[locale][key] ?? enMessages[key];
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (acc, [paramKey, paramValue]) =>
      acc.replaceAll(`{${paramKey}}`, String(paramValue)),
    template,
  );
}

export type { MessageKey };
