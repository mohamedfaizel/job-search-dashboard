import { RESUME_LANGUAGES } from '@jobsearch/data';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';

/**
 * A language's name in the language the app is shown in: "de" is "German" in English and
 * "Deutsch" in German. The browser knows every name (Intl.DisplayNames), so there is no list
 * to translate.
 */
export function useLanguageName(): (code: string) => string {
  const locale = useLocale();
  return useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([locale], { type: 'language' });
    } catch {
      // Very old browsers: fall back to the English names.
    }
    return (code: string) => names?.of(code) ?? RESUME_LANGUAGES[code] ?? code;
  }, [locale]);
}
