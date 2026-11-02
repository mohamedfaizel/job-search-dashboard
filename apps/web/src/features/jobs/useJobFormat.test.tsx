import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Intl } from '@/test/intl';
import { useJobFormat } from './useJobFormat';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-02T12:00:00.000Z');
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

function format(locale: 'en' | 'de') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Intl locale={locale}>{children}</Intl>
  );
  return renderHook(() => useJobFormat(), { wrapper }).result.current;
}

describe('useJobFormat', () => {
  it('writes salaries in each language', () => {
    const en = format('en');
    expect(en.salary(90_000, 120_000)).toBe('$90k - $120k');
    expect(en.salary(90_000, 90_000)).toBe('$90k');
    expect(en.salary(90_000, null)).toBe('$90k+');
    expect(en.salary(null, 120_000)).toBe('Up to $120k');
    expect(en.salary(null, null)).toBe('');

    const de = format('de');
    expect(de.salary(90_000, 120_000)).toBe('90 Tsd. $ – 120 Tsd. $');
    expect(de.salary(90_000, null)).toBe('ab 90 Tsd. $');
    expect(de.salary(null, 120_000)).toBe('bis 120 Tsd. $');
  });

  it('says how long ago a job was posted', () => {
    const en = format('en');
    expect([0, 3, 21, 90, 800].map((days) => en.timeAgo(ago(days), NOW))).toEqual([
      'Today',
      '3 d ago',
      '3 w ago',
      '3 mo ago',
      '2 y ago',
    ]);
    const de = format('de');
    expect([0, 3, 21, 90, 800].map((days) => de.timeAgo(ago(days), NOW))).toEqual([
      'Heute',
      'vor 3 T.',
      'vor 3 Wo.',
      'vor 3 Mon.',
      'vor 2 J.',
    ]);
  });

  it('names dates, countries, languages and statuses in your language', () => {
    const de = format('de');
    expect(de.date('2026-10-24T12:00:00.000Z')).toBe('24. Okt. 2026');
    expect(de.country('de')).toBe('Deutschland');
    expect(de.language('EN')).toBe('Englisch');
    expect(de.status('INTERVIEWING')).toBe('Im Gespräch');
    expect(de.jobName({ title: 'Dev', company: { name: 'Acme' } })).toBe('Dev bei Acme');
    // A code typed by hand that isn't a real one shows as it is.
    expect(de.country('not a code')).toBe('NOT A CODE');

    expect(format('en').date('2026-10-24T12:00:00.000Z')).toBe('Oct 24, 2026');
  });
});
