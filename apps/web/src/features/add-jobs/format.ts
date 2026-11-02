import { useFormatter } from 'next-intl';
import { useCallback } from 'react';

/**
 * "2 Nov 2026, 14:05" in your language and your own time zone: import times are moments, not
 * just days, so the app-wide UTC would show them off by your offset. Add jobs loads its data in
 * the browser only, so the server never renders these.
 */
export function useDateTime() {
  const format = useFormatter();
  return useCallback(
    (iso: string) =>
      format.dateTime(new Date(iso), {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    [format],
  );
}
