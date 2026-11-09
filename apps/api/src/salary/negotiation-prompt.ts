import type { SalaryRange } from './salary';

export interface NegotiationInput {
  title: string;
  company: string;
  city: string | null;
  /** The ad's language: "de" writes the scripts in German. */
  language: string | null;
  range: SalaryRange;
  /** "Salary expectation" from My profile › Applications, as you wrote it. */
  expectation: string;
  yearsExperience: number | null;
  /** Your languages with your real level, e.g. "German A2". */
  languages: string[];
  achievements: string;
}

const money = (n: number | null, currency: string) =>
  n === null ? 'unknown' : `${n.toLocaleString('en-US')} ${currency}`;

function marketLines(r: SalaryRange): string {
  if (r.basis === 'NONE')
    return 'Market data: none in my job list for this role. Use what you know of the market.';
  const what = r.basis === 'TITLE' ? 'similar job titles' : 'the same job function';
  const estimated = r.estimatedCount
    ? ` (${r.estimatedCount} of them are estimates, not stated in the ad)`
    : '';
  return `Market data from ${r.sampleSize} ads for ${what} in the same country${estimated}, yearly:
- low (25%): ${money(r.low, r.currency)}
- typical (median): ${money(r.median, r.currency)}
- high (75%): ${money(r.high, r.currency)}`;
}

/**
 * The salary negotiation prompt: paste it into Claude (desktop or web). One reply brings a
 * target and walk-away number, what to say when they ask for your expectation, a counter-offer
 * email and what to ask for besides money. Uses your Claude subscription, not API credits.
 */
export function buildNegotiationPrompt(input: NegotiationInput): string {
  const { range: r } = input;
  const where = input.city ? ` in ${input.city}` : '';
  const german = input.language === 'de';
  const languageLine = german
    ? 'The job ad is in German, so write the scripts and the email in German (simple, polite "Sie" form), with a one-line English summary after each.'
    : 'Write everything in English.';
  const ad =
    r.jobMin !== null || r.jobMax !== null
      ? `The ad's salary: ${money(r.jobMin, r.currency)} to ${money(r.jobMax, r.currency)} a year.`
      : 'The ad gives no salary.';
  const about = [
    input.yearsExperience !== null ? `- Years of experience: ${input.yearsExperience}` : '',
    input.expectation.trim() ? `- My salary expectation so far: ${input.expectation.trim()}` : '',
    input.languages.length
      ? `- Languages (real levels, never claim higher): ${input.languages.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
  const achievements = input.achievements.trim()
    ? `\n\nMy achievements (true facts I can use as reasons):\n${input.achievements.trim()}`
    : '';

  return `Please help me negotiate my salary for this job. Be my salary coach.

Job: ${input.title} at ${input.company}${where}
${ad}
${marketLines(r)}
${r.ask !== null ? `My app suggests asking for about ${money(r.ask, r.currency)}.` : ''}

About me:
${about || '- (nothing saved yet)'}${achievements}

${languageLine}
Rules: use only the facts above. Never invent offers from other companies or numbers I did not give you. Keep every script short enough to say out loud.

Write these five parts, each starting with its heading:
## 1. My numbers
My target (what I ask for), the lowest I should accept, and one line on why, from the market data.
## 2. When they ask for my salary expectation
What to say on the phone or in the interview (2 to 4 sentences), and one line for an online form field.
## 3. When they make an offer below my target
What to say on a call to counter, warmly and confidently.
## 4. Counter-offer email
A short email I can send after a written offer.
## 5. Besides money
Five other things I can ask for if they can't pay more (for example: signing bonus, extra holiday, remote days, learning budget, a salary review after 6 months), with one sentence each on how to ask.`;
}
