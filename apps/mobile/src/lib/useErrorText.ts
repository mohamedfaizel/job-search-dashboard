import { getErrorCode, getErrorMessage } from '@jobsearch/data';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';

/** fetch() throws a TypeError when the server can't be reached at all. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

/** A failed request as a sentence in the app's language (the API's own text as a fallback). */
export function useErrorText() {
  const t = useTranslations('Errors');
  return useCallback(
    (error: unknown): string => {
      const known = getErrorCode(error);
      if (known && t.has(known.code)) return t(known.code, known.params);
      if (isNetworkError(error)) return t('NETWORK');
      return t('unknown', { message: getErrorMessage(error) });
    },
    [t],
  );
}
