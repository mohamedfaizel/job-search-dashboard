import { describe, expect, it } from 'vitest';
import { buildNegotiationPrompt } from './negotiation-prompt';
import type { SalaryJob } from './salary';
import { currencyFor, salaryRange, similarTitles, titleWords } from './salary';

let n = 0;
const ad = (
  title: string,
  min: number | null,
  max: number | null,
  over: Partial<SalaryJob> = {},
): SalaryJob => ({
  id: `j${++n}`,
  title,
  company: 'Acme',
  jobFunction: 'Data',
  salaryMinUsd: min,
  salaryMaxUsd: max,
  salaryEstimated: false,
  postedAt: new Date(2026, 9, n),
  ...over,
});

const job = {
  id: 'me',
  title: 'Senior Data Analyst (m/w/d)',
  jobFunction: 'Data',
  salaryMinUsd: 64800,
  salaryMaxUsd: 75600,
  countryCode: 'DE',
};

describe('titles', () => {
  it('ignores level words and gender tags', () => {
    expect([...titleWords('Senior Data Analyst (m/w/d)')]).toEqual(['data', 'analyst']);
    expect(similarTitles(titleWords('Data Analyst'), titleWords('Junior Data Analyst'))).toBe(true);
    expect(similarTitles(titleWords('Data Analyst'), titleWords('Data Engineer'))).toBe(false);
    expect(similarTitles(new Set(), titleWords('Data Analyst'))).toBe(false);
  });
});

describe('salaryRange', () => {
  it('ranges similar titles in euros and asks for at least the high end', () => {
    const r = salaryRange(job, [
      ad('Data Analyst', 54000, 64800), // mid 59400 USD = 55000 EUR
      ad('Data Analyst', 64800, 75600, { salaryEstimated: true }), // 70200 = 65000
      ad('Junior Data Analyst', null, 81000), // 81000 = 75000
      ad('Data Analyst', 86400, null), // 86400 = 80000
      ad('Data Engineer', 108000, 129600),
      ad('Data Analyst', null, null),
      { ...ad('Data Analyst', 1, 1), id: 'me' },
    ]);
    expect(r).toMatchObject({
      currency: 'EUR',
      basis: 'TITLE',
      sampleSize: 4,
      estimatedCount: 1,
      low: 62000,
      median: 70000,
      high: 76000,
      jobMin: 60000,
      jobMax: 70000,
      ask: 76000,
    });
    expect(r.examples).toHaveLength(4);
    expect(r.examples[0]).toMatchObject({ title: 'Data Analyst', min: 80000, max: null });
  });

  it('falls back to the job function, then to nothing', () => {
    const others = [ad('BI Developer', 100000, 100000), ad('Data Engineer', 120000, 120000)];
    const r = salaryRange(
      { ...job, countryCode: 'US', salaryMinUsd: null, salaryMaxUsd: null },
      others,
    );
    expect(r).toMatchObject({
      currency: 'USD',
      basis: 'FUNCTION',
      sampleSize: 2,
      median: 110000,
      ask: 115000,
    });

    const none = salaryRange(
      { ...job, jobFunction: null, salaryMinUsd: null, salaryMaxUsd: null },
      others,
    );
    expect(none).toMatchObject({
      basis: 'NONE',
      sampleSize: 0,
      low: null,
      median: null,
      high: null,
      ask: null,
    });
  });

  it('knows euro countries', () => {
    expect(currencyFor('at')).toBe('EUR');
    expect(currencyFor('GB')).toBe('USD');
    expect(currencyFor(null)).toBe('USD');
  });
});

describe('buildNegotiationPrompt', () => {
  const range = salaryRange(job, [ad('Data Analyst', 54000, 64800, { salaryEstimated: true })]);
  const base = {
    title: 'Data Analyst',
    company: 'Acme',
    city: 'Berlin',
    language: 'en',
    range,
    expectation: '65k',
    yearsExperience: 4,
    languages: ['German A2'],
    achievements: 'Cut report time by 50%',
  };

  it('gives Claude the numbers, my facts and the five parts', () => {
    const prompt = buildNegotiationPrompt(base);
    expect(prompt).toContain('Job: Data Analyst at Acme in Berlin');
    expect(prompt).toContain("The ad's salary: 60,000 EUR to 70,000 EUR a year.");
    expect(prompt).toContain(
      'Market data from 1 ads for similar job titles in the same country (1 of them are estimates',
    );
    expect(prompt).toContain('My salary expectation so far: 65k');
    expect(prompt).toContain('German A2');
    expect(prompt).toContain('Cut report time by 50%');
    expect(prompt).toContain('## 5. Besides money');
    expect(prompt).toContain('Write everything in English.');
  });

  it('writes German scripts for German ads and copes with no data', () => {
    const empty = salaryRange(
      { ...job, jobFunction: null, salaryMinUsd: null, salaryMaxUsd: null },
      [],
    );
    const prompt = buildNegotiationPrompt({
      ...base,
      city: null,
      language: 'de',
      range: empty,
      expectation: '',
      yearsExperience: null,
      languages: [],
      achievements: '',
    });
    expect(prompt).toContain('write the scripts and the email in German');
    expect(prompt).toContain('The ad gives no salary.');
    expect(prompt).toContain('Market data: none in my job list');
    expect(prompt).toContain('- (nothing saved yet)');
    expect(prompt).not.toContain('My app suggests');
  });
});
