import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/** The career-page tools the API reads, as people know them. */
const TOOLS: Record<string, string> = { greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby' };

/** "greenhouse:stripe: 404 Not Found" or "lever:netflix: fetch failed". */
const BOARD = /^(greenhouse|lever|ashby):([^:\s]+): (.*)$/;
/** "120 postings fit; only the newest 100 were saved. …" */
const TOO_MANY = /^(\d+) postings fit; only the newest (\d+) were saved/;

/** "stripe" → "Stripe", "open-ai" → "Open Ai". */
function companyName(slug: string): string {
  return slug.replace(/[-_.]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * An import's warnings come from the API as short technical lines. This says them in plain words,
 * in your language. A line it doesn't know is shown as it is.
 */
export function useWarningText() {
  const t = useTranslations('ImportWarnings');
  return useCallback(
    (warning: string): string => {
      const board = BOARD.exec(warning);
      if (board) {
        const [, tool = '', slug = '', reason = ''] = board;
        const values = { company: companyName(slug), tool: TOOLS[tool] ?? tool };
        return reason.startsWith('404') ? t('boardNotFound', values) : t('boardDown', values);
      }
      const tooMany = TOO_MANY.exec(warning);
      if (tooMany) return t('tooMany', { fit: tooMany[1] ?? '', saved: tooMany[2] ?? '' });
      return warning;
    },
    [t],
  );
}
