import de from './de.json';
import en from './en.json';

/**
 * The phone app's words, in English and German. Keys mirror the web app where they overlap, and
 * like the web app they live in JSON files (one per language).
 */
export const messages = { en, de };

export type Locale = keyof typeof messages;

/** The app's language: German for a German phone (or account), otherwise English. */
export function pickLocale(...wanted: (string | null | undefined)[]): Locale {
  return wanted.find((code): code is Locale => code === 'en' || code === 'de') ?? 'en';
}
