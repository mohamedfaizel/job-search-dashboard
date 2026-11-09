/**
 * Recruiter message drafts, filled from your profile and the job (no AI). Like the resume, they
 * are in German only when the job needs German; otherwise in English. They use only facts you
 * saved: your headline, years of experience, the job's skills you have, and your first
 * achievement.
 */

export type DraftId = 'connect' | 'recruiter' | 'thanks';

export interface DraftInput {
  /** "de" writes German drafts (polite "Sie" form), anything else English. */
  language: string;
  firstName: string;
  fullName: string;
  headline: string;
  yearsExperience: number | null;
  /** Skills the ad asks for that you have, most important first. */
  skills: string[];
  /** One true result to mention, e.g. your first achievement. */
  achievement: string;
  title: string;
  company: string;
  /** Who you write to; empty for "Dear hiring team". */
  recipient: string;
}

/** LinkedIn's limit for a note with a connection request. */
export const CONNECT_LIMIT = 300;

/** "A", "A and B", "A, B and C" (German: "und"). */
export function listWords(items: string[], language: string): string {
  const and = language === 'de' ? 'und' : 'and';
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${and} ${items.at(-1) ?? ''}`;
}

/** "Data Analyst (m/w/d)" → "Data Analyst": the gender tag belongs in ads, not in messages. */
const plainTitle = (title: string) =>
  title.replaceAll(/\s*\((?:[mwfdx*]\s*\/\s*){1,3}[mwfdx*]\)/gi, '').trim();

/** The first variant that fits LinkedIn's limit, or the shortest. */
/** "a Data Analyst", "an Analytics Engineer". */
const withArticle = (words: string) => `${/^[aeiou]/i.test(words) ? 'an' : 'a'} ${words}`;

const fitting = (variants: string[]) =>
  variants.find((v) => v.length <= CONNECT_LIMIT) ?? variants.at(-1) ?? '';

function english(input: DraftInput): Record<DraftId, string> {
  const title = plainTitle(input.title);
  const name = input.recipient.trim();
  const hi = name ? `Hi ${name}` : 'Hi';
  const dear = name ? `Hello ${name},` : 'Dear hiring team,';
  const years = input.yearsExperience ? ` with ${input.yearsExperience} years of experience` : '';
  const who = input.headline ? `${withArticle(input.headline)}${years}` : `someone${years}`;
  const skills = listWords(input.skills.slice(0, 3), 'en');
  const inSkills = skills ? ` in ${listWords(input.skills.slice(0, 2), 'en')}` : '';
  const me = input.firstName ? `I'm ${input.firstName}, ` : "I'm ";
  const result = input.achievement
    ? ` One result I'm proud of: ${input.achievement.replace(/\.$/, '')}.`
    : '';
  const sign = input.fullName ? `\n${input.fullName}` : '';

  return {
    connect: fitting([
      `${hi}, ${me}${who}${inSkills}. I just saw the ${title} role at ${input.company} and would love to connect and learn more about the team. Thank you!`,
      `${hi}, ${me}${who}. I saw the ${title} role at ${input.company} and would love to connect. Thank you!`,
      `${hi}, I saw the ${title} role at ${input.company} and would love to connect. Thank you!`,
    ]),
    recruiter: `${dear}

I'm interested in the ${title} role at ${input.company}. I'm ${who}${skills ? `, working with ${skills}` : ''}.${result}

I'd be glad to send my resume or have a short call to see if I'm a good fit. Could you tell me more about the team and the next steps?

Best regards,${sign}`,
    thanks: `${dear}

Thank you for taking the time to talk with me about the ${title} role today. I enjoyed learning more about ${input.company} and the team, and I'm even more excited about the role now.

If you need anything else from me, just let me know.

Best regards,${sign}`,
  };
}

function german(input: DraftInput): Record<DraftId, string> {
  const title = plainTitle(input.title);
  const name = input.recipient.trim();
  const hi = name ? `Hallo ${name}` : 'Hallo';
  const dear = name ? `Guten Tag ${name},` : 'Sehr geehrte Damen und Herren,';
  const headline = input.headline || 'Fachkraft';
  const years = input.yearsExperience ? ` mit ${input.yearsExperience} Jahren Erfahrung` : '';
  const skills = listWords(input.skills.slice(0, 3), 'de');
  const inSkills = skills ? ` in ${listWords(input.skills.slice(0, 2), 'de')}` : '';
  const me = input.firstName ? `ich bin ${input.firstName}, ` : 'ich bin ';
  const result = input.achievement
    ? ` Ein Ergebnis, auf das ich stolz bin: ${input.achievement.replace(/\.$/, '')}.`
    : '';
  const sign = input.fullName ? `\n${input.fullName}` : '';
  const bring = input.yearsExperience
    ? `Ich bringe ${input.yearsExperience} Jahre Erfahrung als ${headline} mit`
    : `Ich arbeite als ${headline}`;

  return {
    connect: fitting([
      `${hi}, ${me}${headline}${years}${inSkills}. Ich habe die Stelle als ${title} bei ${input.company} gesehen und würde mich gern vernetzen und mehr über das Team erfahren. Vielen Dank!`,
      `${hi}, ${me}${headline}${years}. Ich habe die Stelle als ${title} bei ${input.company} gesehen und würde mich gern vernetzen. Danke!`,
      `${hi}, ich habe die Stelle als ${title} bei ${input.company} gesehen und würde mich gern vernetzen. Danke!`,
    ]),
    recruiter: `${dear}

ich interessiere mich für die Stelle als ${title} bei ${input.company}. ${bring}${skills ? `, unter anderem mit ${skills}` : ''}.${result}

Gern schicke ich Ihnen meinen Lebenslauf oder spreche kurz mit Ihnen darüber, ob ich gut zu der Stelle passe. Können Sie mir mehr über das Team und die nächsten Schritte sagen?

Mit freundlichen Grüßen${sign}`,
    thanks: `${dear}

vielen Dank für das Gespräch heute über die Stelle als ${title}. Ich habe mich gefreut, mehr über ${input.company} und das Team zu erfahren, und die Stelle reizt mich jetzt noch mehr.

Wenn Sie noch etwas von mir brauchen, melden Sie sich gern.

Mit freundlichen Grüßen${sign}`,
  };
}

export function recruiterDrafts(input: DraftInput): Record<DraftId, string> {
  return input.language === 'de' ? german(input) : english(input);
}

/**
 * The prompt for your AI chat: four messages made to measure, from the same facts. Your
 * AI chat may not invent anything about you.
 */
export function messagesPrompt(input: DraftInput & { achievements: string[] }): string {
  const facts = [
    input.fullName && `- Name: ${input.fullName}`,
    input.headline && `- Headline: ${input.headline}`,
    input.yearsExperience !== null && `- Years of experience: ${input.yearsExperience}`,
    input.skills.length > 0 && `- Skills from the ad that I have: ${input.skills.join(', ')}`,
    ...input.achievements.slice(0, 5).map((a) => `- Achievement: ${a}`),
  ].filter(Boolean);
  const language =
    input.language === 'de'
      ? 'The job needs German: write the messages in simple, polite German ("Sie" form), with a one-line English summary after each.'
      : 'Write the messages in English.';
  const to = input.recipient.trim()
    ? `I am writing to ${input.recipient.trim()}.`
    : "I don't know the recruiter's name yet.";

  return `Please write short messages to recruiters for this job. Be warm, confident and brief.

Job: ${plainTitle(input.title)} at ${input.company}
${to}
${language}

About me (true facts only, never invent anything else about me):
${facts.length ? facts.join('\n') : '- (nothing saved yet: ask me for my background first)'}

Write these four, each starting with its heading:
## 1. LinkedIn connection note
At most ${CONNECT_LIMIT} characters, including spaces.
## 2. Message to the recruiter
Before or right after I apply: why I fit, in under 120 words.
## 3. Thank-you after the interview
To send the same day, under 100 words.
## 4. Follow-up after a week without news
Polite and short, under 80 words.`;
}
