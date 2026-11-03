import type { ApplicationStatus } from '../generated/prisma/enums';

export interface Candidate {
  jobId: string;
  company: string;
  status: ApplicationStatus;
  /** When the application was added: mail from before it can't be about it. */
  since: Date;
}

export interface Mail {
  from: string;
  subject: string;
  snippet: string;
  receivedAt: Date;
}

const LEGAL_FORMS =
  /\b(gmbh|ag|se|kg|ug|mbh|co|inc|llc|ltd|limited|corp|corporation|plc|bv|nv|sarl|sas|oy|ab|as|group|holding)\b\.?/gi;

/** "Acme GmbH & Co. KG" -> "acme". Letters and digits only, so "Acme-Tech" finds "acme tech". */
export function companyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(LEGAL_FORMS, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function words(text: string): string {
  return ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
}

/** "Jobs <jobs@acme-tech.com>" -> "acmetech": what a company's own address looks like. */
function senderDomain(from: string): string {
  const at = from.lastIndexOf('@');
  if (at < 0) return '';
  const host = from.slice(at + 1).replace(/[>\s].*$/, '');
  const parts = host.toLowerCase().split('.');
  // Everything before the ending (.com, .de), so "mail.acme.de" still holds "acme".
  return parts
    .slice(0, -1)
    .join('')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * The job a mail is about: the application whose company is named in the sender, subject or
 * snippet (or the sender's web address). When one company has several jobs, the most recently changed application wins.
 * Companies with very short names (1-2 letters) never match, they would hit everything.
 */
export function matchJob(mail: Mail, candidates: Candidate[]): Candidate | null {
  const haystack = words(`${mail.from} ${mail.subject} ${mail.snippet}`);
  const domain = senderDomain(mail.from);
  let best: Candidate | null = null;
  for (const candidate of candidates) {
    if (mail.receivedAt < candidate.since) continue;
    const key = companyKey(candidate.company);
    if (key.length < 3) continue;
    const found =
      haystack.includes(` ${key} `) || (domain !== '' && domain.includes(key.replaceAll(' ', '')));
    if (found && (!best || candidate.since > best.since)) best = candidate;
  }
  return best;
}
