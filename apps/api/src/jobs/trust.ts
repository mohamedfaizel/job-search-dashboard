/**
 * "Is this job real?": plain checks for ghost and scam ads (no AI, no credits).
 *
 * Strong signs (WARNING) are things real employers almost never do: ask you to pay, ask for bank
 * or ID details up front, or talk only through a chat app. Weak signs (CAUTION) are worth a look
 * but common in honest ads too: the same ad posted again and again, an ad open for months, a
 * private email address, pay that sounds too good, or an ad with almost no text.
 */

export type TrustLevel = 'OK' | 'CAUTION' | 'WARNING';

export type TrustFlag =
  | 'ASKS_PAYMENT'
  | 'ASKS_PERSONAL_DATA'
  | 'CHAT_APP_ONLY'
  | 'REPOSTED'
  | 'OLD_AD'
  | 'PRIVATE_EMAIL'
  | 'TOO_GOOD'
  | 'SHORT_AD';

const STRONG: ReadonlySet<TrustFlag> = new Set([
  'ASKS_PAYMENT',
  'ASKS_PERSONAL_DATA',
  'CHAT_APP_ONLY',
]);

/** An open ad older than this is a possible "ghost job" kept up to collect resumes. */
export const OLD_AD_DAYS = 45;
/** Earlier ads with the same title at the same company, looked back this far. */
export const REPOST_LOOKBACK_DAYS = 365;
/** Ads shorter than this say too little about the job to judge it. */
export const SHORT_AD_CHARS = 300;

const DAY_MS = 24 * 60 * 60 * 1000;

const PATTERNS: [TrustFlag, RegExp][] = [
  [
    'ASKS_PAYMENT',
    new RegExp(
      [
        '(?:pay|send|deposit|transfer)\\s+(?:a\\s+|the\\s+|an\\s+)?(?:small\\s+|one-time\\s+|refundable\\s+)?(?:fee|deposit|payment)',
        '(?:application|registration|training|processing|onboarding|starter)\\s+(?:fee|kit costs?)',
        'western union|moneygram|gift ?cards?',
        'buy (?:your own |the )?(?:equipment|starter kit)',
        '(?:bearbeitungs|anmelde|ausbildungs|vermittlungs|schulungs)gebühr',
        'vorkasse',
        'startpaket (?:kaufen|erwerben|bezahlen)',
      ].join('|'),
      'i',
    ),
  ],
  [
    'ASKS_PERSONAL_DATA',
    new RegExp(
      [
        '(?:send|provide|share|include)\\s+(?:us\\s+)?(?:your\\s+)?(?:bank (?:account|details)|credit card|social security|ssn|passport (?:copy|number)|copy of your (?:passport|id))',
        '(?:bankverbindung|kontodaten|kreditkarte|kopie (?:ihres|deines) (?:personalausweises|reisepasses))\\s+(?:mit|vorab|schicken|senden|zusenden)',
      ].join('|'),
      'i',
    ),
  ],
  [
    'CHAT_APP_ONLY',
    new RegExp(
      [
        '(?:contact|message|text|apply|reach)\\s+(?:us\\s+|me\\s+)?(?:only\\s+)?(?:on|via|through|by)\\s+(?:whatsapp|telegram|signal)',
        '(?:whatsapp|telegram|signal)\\s+(?:only|interview)',
        '(?:nur\\s+)?(?:per|über|via)\\s+(?:whatsapp|telegram|signal)\\s+(?:bewerben|melden|kontaktieren|schreiben)',
      ].join('|'),
      'i',
    ),
  ],
  [
    'PRIVATE_EMAIL',
    /[\w.+-]+@(?:gmail|googlemail|yahoo|hotmail|outlook|live|aol|icloud|gmx|web|t-online|proton(?:mail)?)\.[a-z.]{2,6}\b/i,
  ],
  [
    'TOO_GOOD',
    new RegExp(
      [
        'earn (?:up to )?[$€£]\\s?\\d[\\d,.]*\\s*(?:k\\s*)?(?:per|a|/)\\s*(?:day|week)',
        'no experience (?:needed|required|necessary)[^.\\n]{0,60}[$€£]\\s?\\d',
        'easy money|get rich|unlimited (?:income|earnings)',
        'bis zu \\d[\\d.]*\\s?€\\s+(?:pro|am|die)\\s+(?:tag|woche)',
        'schnelles geld',
      ].join('|'),
      'i',
    ),
  ],
];

/** "Data Analyst (m/w/d)" and "data analyst" are the same ad. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replaceAll(/\((?:[mwfdx*]\s*\/\s*){1,3}[mwfdx*]\)/g, ' ')
    .replaceAll(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export interface TrustJob {
  title: string;
  description: string | null;
  postedAt: Date;
  postingStatus: string;
}

export interface TrustResult {
  level: TrustLevel;
  flags: TrustFlag[];
  /** Earlier ads with the same title at the same company. */
  reposts: number;
  /** When the first of those was posted; null when there are none. */
  firstPostedAt: Date | null;
  ageDays: number;
}

/**
 * Checks one ad. `earlier` holds the company's other ads posted before this one (any title):
 * the ones with the same title count as reposts.
 */
export function checkTrust(
  job: TrustJob,
  earlier: { title: string; postedAt: Date }[],
  now: Date,
): TrustResult {
  const flags: TrustFlag[] = [];
  const text = job.description ?? '';
  for (const [flag, pattern] of PATTERNS) {
    if (pattern.test(text)) flags.push(flag);
  }

  const title = normalizeTitle(job.title);
  const since = job.postedAt.getTime() - REPOST_LOOKBACK_DAYS * DAY_MS;
  const reposts = earlier.filter(
    (e) =>
      e.postedAt < job.postedAt &&
      e.postedAt.getTime() >= since &&
      normalizeTitle(e.title) === title,
  );
  if (reposts.length > 0) flags.push('REPOSTED');
  const firstPostedAt = reposts.reduce<Date | null>(
    (first, e) => (first === null || e.postedAt < first ? e.postedAt : first),
    null,
  );

  const ageDays = Math.max(0, Math.floor((now.getTime() - job.postedAt.getTime()) / DAY_MS));
  if (job.postingStatus === 'active' && ageDays > OLD_AD_DAYS) flags.push('OLD_AD');
  if (text.trim().length < SHORT_AD_CHARS) flags.push('SHORT_AD');

  let level: TrustLevel = 'OK';
  if (flags.some((f) => STRONG.has(f))) level = 'WARNING';
  else if (flags.length > 0) level = 'CAUTION';

  // Strong signs first, so the popup shows the worst news at the top.
  flags.sort((a, b) => Number(STRONG.has(b)) - Number(STRONG.has(a)));
  return { level, flags, reposts: reposts.length, firstPostedAt, ageDays };
}
