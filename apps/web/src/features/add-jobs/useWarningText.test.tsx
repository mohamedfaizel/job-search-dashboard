import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import { Intl } from '../../test/intl';
import { useWarningText } from './useWarningText';

function warningText(locale: Locale) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Intl locale={locale}>{children}</Intl>
  );
  return renderHook(() => useWarningText(), { wrapper }).result.current;
}

describe('useWarningText', () => {
  it('says a career page problem in plain words', () => {
    const en = warningText('en');
    expect(en('greenhouse:stripe: fetch failed')).toBe(
      'Stripe (Greenhouse): the career page isn’t answering right now. Try again later.',
    );
    expect(en('ashby:open-ai: 404 Not Found')).toBe(
      'Open Ai (Ashby): no career page found under this name. Check the spelling.',
    );
    expect(en('120 postings fit; only the newest 100 were saved. Narrow the job title.')).toBe(
      '120 jobs fit; only the newest 100 were saved. Narrow the job title or places.',
    );
  });

  it('speaks German, and keeps a line it does not know', () => {
    const de = warningText('de');
    expect(de('lever:netflix: 500 Internal Server Error')).toBe(
      'Netflix (Lever): die Karriereseite antwortet gerade nicht. Versuche es später erneut.',
    );
    expect(de('Something new')).toBe('Something new');
  });
});
