import { normalizeTitle } from '../jobs/trust';

/**
 * Salary research from the jobs we already have (no AI, no credits): the salaries of similar
 * jobs in the same country, as a low / typical / high range, and a number to ask for.
 */

/**
 * The rate the app uses everywhere to turn euros into the US dollars jobs are stored in (and
 * JobHunter's salary filter takes). A rough rate is enough; update it if the euro moves a lot.
 */
export const EUR_TO_USD = 1.08;

/** Countries that pay in euros: their ranges and scripts are in EUR. */
const EURO_COUNTRIES = new Set([
  'AT',
  'BE',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
]);

/** Fewer similar titles than this, and we compare with the whole job function instead. */
export const MIN_SAMPLE = 3;

/** Words that say the level, not the job: "Senior Data Analyst" is still a data analyst. */
const LEVEL_WORDS = new Set([
  'senior',
  'sr',
  'junior',
  'jr',
  'lead',
  'principal',
  'staff',
  'head',
  'mid',
  'level',
  'entry',
  'i',
  'ii',
  'iii',
  'and',
  'of',
  'the',
  'for',
  'in',
  'mit',
  'und',
  'für',
  'fur',
  'im',
  'als',
  'remote',
  'hybrid',
  'werkstudent',
  'praktikant',
  'intern',
  'm',
  'w',
  'd',
  'f',
  'x',
]);

export type SalaryBasis = 'TITLE' | 'FUNCTION' | 'NONE';

export interface SalaryJob {
  id: string;
  title: string;
  company: string;
  jobFunction: string | null;
  salaryMinUsd: number | null;
  salaryMaxUsd: number | null;
  salaryEstimated: boolean;
  postedAt: Date;
}

export interface SalaryExample {
  jobId: string;
  title: string;
  company: string;
  min: number | null;
  max: number | null;
}

export interface SalaryRange {
  currency: 'EUR' | 'USD';
  basis: SalaryBasis;
  sampleSize: number;
  estimatedCount: number;
  low: number | null;
  median: number | null;
  high: number | null;
  jobMin: number | null;
  jobMax: number | null;
  ask: number | null;
  examples: SalaryExample[];
}

export const currencyFor = (countryCode: string | null): 'EUR' | 'USD' =>
  countryCode && EURO_COUNTRIES.has(countryCode.toUpperCase()) ? 'EUR' : 'USD';

/** The words that name the job, without level words or gender tags. */
export function titleWords(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(' ')
      .filter((w) => w && !LEVEL_WORDS.has(w)),
  );
}

/** Two titles are similar when most of their job words are the same (Jaccard ≥ 0.6). */
export function similarTitles(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared) >= 0.6;
}

/** One number per job: the middle of its range, or the one end it gives. */
function midpoint(job: Pick<SalaryJob, 'salaryMinUsd' | 'salaryMaxUsd'>): number | null {
  const { salaryMinUsd: min, salaryMaxUsd: max } = job;
  if (min !== null && max !== null) return (min + max) / 2;
  return min ?? max;
}

/** Linear-interpolated quantile of sorted numbers. */
function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const below = sorted[Math.floor(pos)] ?? 0;
  const above = sorted[Math.ceil(pos)] ?? below;
  return below + (above - below) * (pos - Math.floor(pos));
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const ceilTo = (n: number, step: number) => Math.ceil(n / step) * step;

/**
 * The market range for `job` from `others` (jobs with a salary, same country). Similar titles
 * first; when there are too few, the same job function. Amounts are yearly, in the country's
 * currency, rounded to 1,000. The ask is the higher of the market's high end and the ad's top,
 * rounded up: start high, there is room to come down, never up.
 */
export function salaryRange(
  job: Pick<SalaryJob, 'id' | 'title' | 'jobFunction' | 'salaryMinUsd' | 'salaryMaxUsd'> & {
    countryCode: string | null;
  },
  others: SalaryJob[],
): SalaryRange {
  const currency = currencyFor(job.countryCode);
  const local = (usd: number | null) =>
    usd === null ? null : roundTo(currency === 'EUR' ? usd / EUR_TO_USD : usd, 1000);

  const pool = others.filter((o) => o.id !== job.id && midpoint(o) !== null);
  const words = titleWords(job.title);
  let basis: SalaryBasis = 'TITLE';
  let sample = pool.filter((o) => similarTitles(words, titleWords(o.title)));
  if (sample.length < MIN_SAMPLE && job.jobFunction) {
    const byFunction = pool.filter((o) => o.jobFunction === job.jobFunction);
    if (byFunction.length > sample.length) {
      basis = 'FUNCTION';
      sample = byFunction;
    }
  }
  if (sample.length === 0) basis = 'NONE';

  const mids = sample.map((o) => midpoint(o) as number).sort((a, b) => a - b);
  const has = mids.length > 0;
  const low = has ? local(quantile(mids, 0.25)) : null;
  const median = has ? local(quantile(mids, 0.5)) : null;
  const high = has ? local(quantile(mids, 0.75)) : null;
  const jobMin = local(job.salaryMinUsd);
  const jobMax = local(job.salaryMaxUsd);

  const top = Math.max(high ?? 0, jobMax ?? 0, jobMin ?? 0);
  const ask = top > 0 ? ceilTo(top, 1000) : null;

  const examples = [...sample]
    .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime())
    .slice(0, 5)
    .map((o) => ({
      jobId: o.id,
      title: o.title,
      company: o.company,
      min: local(o.salaryMinUsd),
      max: local(o.salaryMaxUsd),
    }));

  return {
    currency,
    basis,
    sampleSize: sample.length,
    estimatedCount: sample.filter((o) => o.salaryEstimated).length,
    low,
    median,
    high,
    jobMin,
    jobMax,
    ask,
    examples,
  };
}
