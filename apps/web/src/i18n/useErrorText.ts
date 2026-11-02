import { API_URL, getErrorCode, getErrorMessage } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

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
      // fetch() throws a TypeError when the API can't be reached at all.
      if (error instanceof TypeError) return t('NETWORK', { url: API_URL });
      return getErrorMessage(error);
    },
    [t],
  );
}
