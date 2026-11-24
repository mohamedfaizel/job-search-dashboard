import type { ApplicationStatus } from '../generated/prisma/enums';

/** What an employer's email means for your application. */
export type MailKind = 'REJECTED' | 'INTERVIEWING' | 'OFFER' | 'RECEIVED';

/**
 * Plain phrase lists, English and German, checked in this order: a rejection that mentions
 * "interview" is still a rejection, and "we received your application" is only an
 * acknowledgement (no status change). No AI: you approve every suggestion anyway.
 */
const RULES: { kind: MailKind; phrases: RegExp }[] = [
  {
    kind: 'REJECTED',
    phrases:
      /\b(unfortunately|regret to inform|not (be )?(moving|moved|proceed\w*) forward|decided (not )?to (move|proceed|pursue)|other candidates|not selected|will not be (moving|proceeding)|position has been filled|leider|absage|nicht berücksichtigen|nicht weiter(verfolgen|machen)|anderen bewerber|andere kandidat|entschieden wir uns (für|gegen)|müssen wir ihnen (leider )?(mitteilen|absagen)|bewerbung (leider )?nicht)\b/i,
  },
  {
    kind: 'OFFER',
    phrases:
      /\b(job offer|offer of employment|pleased to offer|happy to offer|we'?d like to offer you|vertragsangebot|angebot für die stelle|freuen uns,? ihnen (ein|das) angebot|arbeitsvertrag)\b/i,
  },
  {
    kind: 'INTERVIEWING',
    phrases:
      /\b(invite you to (an? )?(interview|call|chat)|schedule (an? |a )?(interview|call|chat)|interview (invitation|invite)|like to (speak|talk|meet)|next (step|round)|video call|phone (call|screen)|availability for|einladung zum (vorstellungs)?gespräch|vorstellungsgespräch|kennenlerngespräch|telefonisches gespräch|gesprächstermin|termin(e)? (für|vorschlagen)|lernen sie gerne kennen|lernen wir sie gerne kennen)\b/i,
  },
  {
    kind: 'RECEIVED',
    phrases:
      /\b(received your application|thank you for (applying|your application|your interest)|application (has been )?received|eingang ihrer bewerbung|bewerbung (ist )?(bei uns )?eingegangen|vielen dank für ihre bewerbung|danke für ihre bewerbung)\b/i,
  },
];

export function classifyMail(text: string): MailKind | null {
  for (const rule of RULES) {
    if (rule.phrases.test(text)) return rule.kind;
  }
  return null;
}

/**
 * A mail clear enough for the app to move the job by itself: it is a rejection or an interview
 * invitation and nothing else (a rejection that also talks about a next round, or an offer, is
 * not clear, so it stays a suggestion for you to answer).
 */
export function clearMailKind(text: string): 'REJECTED' | 'INTERVIEWING' | null {
  const kinds = RULES.filter((rule) => rule.kind !== 'RECEIVED' && rule.phrases.test(text)).map(
    (rule) => rule.kind,
  );
  if (kinds.length !== 1) return null;
  const [kind] = kinds;
  return kind === 'REJECTED' || kind === 'INTERVIEWING' ? kind : null;
}

const ORDER: ApplicationStatus[] = ['SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED'];

/**
 * The status to suggest, or null when the email changes nothing: an acknowledgement, a
 * mail that goes backwards (an "interview" mail after an offer), or the status you already have.
 */
export function suggestedStatus(
  kind: MailKind | null,
  current: ApplicationStatus,
): ApplicationStatus | null {
  if (!kind || kind === 'RECEIVED') return null;
  if (current === 'REJECTED') return null;
  if (kind === 'REJECTED') return current === 'NONE' ? null : 'REJECTED';
  if (ORDER.indexOf(kind) <= ORDER.indexOf(current)) return null;
  return kind;
}
