import { getErrorCode, getErrorMessage } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/** fetch() throws a TypeError when the API can't be reached at all (server down, no internet). */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

/**
 * Turns a failed request into a sentence in the language you picked. The API sends a code
 * (see apps/api/src/common/api-error.ts) and we look the sentence up under "Errors"; an error
 * without a known code shows the API's own (English) message.
 */
export function useErrorText() {
  const t = useTranslations('Errors');

  return useCallback(
    (error: unknown): string => {
      const known = getErrorCode(error);
      if (known && t.has(known.code)) return t(known.code, known.params);
      if (isNetworkError(error)) return t('NETWORK');
      return getErrorMessage(error);
    },
    [t],
  );
}
