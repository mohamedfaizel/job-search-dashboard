import { getErrorCode, getErrorMessage } from '@jobsearch/data';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';
import { API_URL } from './api';

/** A failed request as a sentence in the app's language (the API's own text as a fallback). */
export function useErrorText() {
  const t = useTranslations('Errors');
  return useCallback(
    (error: unknown): string => {
      const known = getErrorCode(error);
      if (known && t.has(known.code)) return t(known.code, known.params);
      // fetch() throws a TypeError when the API can't be reached at all.
      if (error instanceof TypeError) return t('NETWORK', { url: API_URL });
      return t('unknown', { message: getErrorMessage(error) });
    },
    [t],
  );
}
