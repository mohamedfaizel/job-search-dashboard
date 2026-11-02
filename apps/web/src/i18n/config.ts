/** The languages the app is translated into. Each has a messages/<locale>.json file. */
export const LOCALES = ['en', 'de'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** The cookie that remembers your language in this browser (the server reads it too). */
export const LOCALE_COOKIE = 'locale';

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/**
 * The language for a first visit: German when the browser asks for German first, else
 * English. After that, the cookie decides.
 */
export function localeFromHeader(acceptLanguage: string | null): Locale {
  const first = acceptLanguage?.split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('de') ? 'de' : DEFAULT_LOCALE;
}

/** Remembers the language in this browser for a year. */
export function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Dates are shown in this time zone. The server and the browser must agree on one, or a date
 * near midnight could render differently on each. Job dates only need the day, so UTC is enough.
 */
export const TIME_ZONE = 'UTC';
