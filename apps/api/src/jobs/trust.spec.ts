import { describe, expect, it } from 'vitest';
import { checkTrust, normalizeTitle } from './trust';

const now = new Date('2026-11-09T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
const LONG =
  'We are a growing software company in Berlin looking for a data analyst to join our team. ' +
  'You will build dashboards in Power BI, write SQL against our warehouse, and work with ' +
  'product managers to answer questions about how customers use our app. We offer a ' +
  'permanent contract, 30 days of holiday, and a yearly learning budget.';

const job = (over: Partial<Parameters<typeof checkTrust>[0]> = {}) => ({
  title: 'Data Analyst (m/w/d)',
  description: LONG,
  postedAt: daysAgo(3),
  postingStatus: 'active',
  ...over,
});

describe('normalizeTitle', () => {
  it('ignores gender tags, case and punctuation', () => {
    expect(normalizeTitle('Data Analyst (m/w/d)')).toBe('data analyst');
    expect(normalizeTitle('DATA-ANALYST (w/m/d)')).toBe('data analyst');
    expect(normalizeTitle('Data Analyst')).toBe('data analyst');
  });
});

describe('checkTrust', () => {
  it('finds nothing in a normal, fresh ad', () => {
    expect(checkTrust(job(), [], now)).toEqual({
      level: 'OK',
      flags: [],
      reposts: 0,
      firstPostedAt: null,
      ageDays: 3,
    });
  });

  it('counts earlier ads with the same title as reposts', () => {
    const result = checkTrust(
      job(),
      [
        { title: 'Data Analyst', postedAt: daysAgo(40) },
        { title: 'data analyst (w/m/d)', postedAt: daysAgo(90) },
        { title: 'Data Engineer', postedAt: daysAgo(20) },
        { title: 'Data Analyst', postedAt: daysAgo(500) },
      ],
      now,
    );
    expect(result.level).toBe('CAUTION');
    expect(result.flags).toEqual(['REPOSTED']);
    expect(result.reposts).toBe(2);
    expect(result.firstPostedAt).toEqual(daysAgo(90));
  });

  it('flags old open ads and short ads, but not old closed ones', () => {
    expect(checkTrust(job({ postedAt: daysAgo(60) }), [], now).flags).toEqual(['OLD_AD']);
    expect(
      checkTrust(job({ postedAt: daysAgo(60), postingStatus: 'expired' }), [], now).flags,
    ).toEqual([]);
    expect(checkTrust(job({ description: null }), [], now).flags).toEqual(['SHORT_AD']);
  });

  it('puts scam signs first and calls them a warning', () => {
    const description = `${LONG} Contact us only on WhatsApp. Earn up to $900 per week! There is a small registration fee for the starter kit. Mail jobs.berlin@gmail.com.`;
    const result = checkTrust(
      job({ description }),
      [{ title: 'Data Analyst', postedAt: daysAgo(10) }],
      now,
    );
    expect(result.level).toBe('WARNING');
    expect(result.flags.slice(0, 2)).toEqual(['ASKS_PAYMENT', 'CHAT_APP_ONLY']);
    expect(result.flags).toEqual(expect.arrayContaining(['PRIVATE_EMAIL', 'TOO_GOOD', 'REPOSTED']));
  });

  it('reads German ads too', () => {
    const description = `${LONG} Bitte überweisen Sie die Bearbeitungsgebühr per Vorkasse und senden Sie Ihre Bankverbindung vorab. Nur per WhatsApp bewerben.`;
    const result = checkTrust(job({ description }), [], now);
    expect(result.flags).toEqual(['ASKS_PAYMENT', 'ASKS_PERSONAL_DATA', 'CHAT_APP_ONLY']);
  });

  it('flags requests for bank or ID details', () => {
    const description = `${LONG} Please send us your bank details and a copy of your passport before the interview.`;
    expect(checkTrust(job({ description }), [], now).flags).toEqual(['ASKS_PERSONAL_DATA']);
  });
});
