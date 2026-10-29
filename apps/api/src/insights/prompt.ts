export interface PromptInput {
  title: string;
  company: string;
  city: string | null;
  /** "de" when the job needs German, else "en". */
  resumeLanguage: 'de' | 'en';
  /** The German level the ad asks for, e.g. "B2". */
  germanLevel: string | null;
  /** Your languages with your real level, from My profile, e.g. "German A2". */
  languages: string[];
  missingSkills: string[];
  missingKeywords: string[];
  /** The Skills list on My profile: tools you have that may not be in the resume. */
  otherSkills: string[];
  resume: string;
  description: string | null;
  /** Your Application answers from My profile, e.g. "Notice period: 1 month". Empty ones left out. */
  facts: string[];
  /** Short answers you reuse on applications (free text from My profile). */
  savedAnswers: string;
}

/** The marker lines Claude is asked to put between the parts of its reply, in this order. */
export const REPLY_PARTS = ['RESUME', 'COVER LETTER', 'FORM ANSWERS', 'CHECK'] as const;
export type ReplyPart = (typeof REPLY_PARTS)[number];
const marker = (part: ReplyPart) => `=== ${part} ===`;

const list = (items: string[]) =>
  items.length ? items.map((item) => `- ${item}`).join('\n') : '- (none)';

/**
 * The Apply kit prompt: paste it into Claude (desktop or web) and one reply brings the resume
 * tailored to the job, a cover letter and answers to the usual form questions. Writing it there
 * uses your Claude subscription instead of API credits. Claude may add a term that is closely
 * related to your real experience (Apollo next to GraphQL), but never invents employers, titles,
 * dates or numbers, and lists what it added as related so you can check it. The reply comes back
 * between marker lines, so pasting it into the job splits it into its parts.
 */
export function buildResumePrompt(input: PromptInput): string {
  const writeIn =
    input.resumeLanguage === 'de'
      ? `Write the whole resume in German: the job asks for German${input.germanLevel ? ` (${input.germanLevel})` : ''}. Translate my resume and use the job ad's own German words.`
      : "Write the resume in English: the job doesn't ask for German.";
  const languages = input.languages.length
    ? `My languages, with my real levels. List them in a Languages section exactly like this, never higher:\n${list(input.languages)}`
    : 'Keep any language levels from my resume exactly as they are. Never raise them.';
  const where = input.city ? ` in ${input.city}` : '';
  const resume = input.resume.trim()
    ? input.resume.trim()
    : '(I have not added my resume here yet. Ask me for it before you start.)';

  const sameLanguage = input.resumeLanguage === 'de' ? 'in German' : 'in English';
  const savedAnswers = input.savedAnswers.trim()
    ? `\n\nMy saved answers (reuse their wording where they fit):\n"""\n${input.savedAnswers.trim()}\n"""`
    : '';

  return `Please tailor my resume for this job, then write a cover letter and the answers for the application form. Goal: use at least 85% of the skills and keywords below, as long as each one is honest for me.

Job: ${input.title} at ${input.company}${where}
${writeIn}

Skills the job asks for that my resume does not show yet:
${list(input.missingSkills)}

Keywords from the job ad that my resume does not use yet:
${list(input.missingKeywords)}

Other skills I have (not all of them are in my resume):
${list(input.otherSkills)}

How to handle each skill or keyword:
1. Supported: my resume or my other skills show it. Use it, in the job ad's own words.
2. Related: it is closely tied to something I have done (same ecosystem, or the usual tool for it), for example Apollo with GraphQL, Next.js with React, Jest with unit testing, Kubernetes with Docker. Add it next to that experience, e.g. "GraphQL APIs with Apollo Client".
3. General job-ad words (teamwork, efficiency, platforms, business impact): work them naturally into the summary and bullet points.
4. No connection to my experience: leave it out.

Never invent employers, job titles, dates, degrees, certificates or numbers. Keep my real employers, titles and dates.

${languages}

Layout: ATS-friendly, plain headings (Summary, Skills, Experience, Education), no tables, columns, icons or images. Up to three pages, most relevant experience first.

My current resume:
"""
${resume}
"""

The job ad:
"""
${input.description?.trim() || '(No description saved.)'}
"""

Then write, ${sameLanguage}:
- A cover letter for this job: 200 to 300 words, to the hiring team at ${input.company}. Three short paragraphs: why this role, what I bring (two or three real examples from my resume), and a short close. Same honesty rules as the resume.
- Answers to the questions application forms usually ask, 1 to 3 sentences each: why ${input.company}, why I fit this role, why I am looking for a new job, salary expectation, notice period or earliest start, work permit, willingness to relocate. Take the facts from my list below and never change them. When a fact is missing, write "(fill in)".

My application facts:
${list(input.facts)}${savedAnswers}

Reply in exactly this format, with these four marker lines in English as written, so my job tracker can split your reply:
${marker('RESUME')}
(the resume)
${marker('COVER LETTER')}
(the cover letter)
${marker('FORM ANSWERS')}
(one "Question: answer" per line)
${marker('CHECK')}
- Related: the terms you added under rule 2, each with the experience it is tied to.
- Skipped: the terms you left out, each with one line why.`;
}

const MARKER_LINE = /^[ \t#*_>]*=+\s*(RESUME|COVER LETTER|FORM ANSWERS|CHECK)\s*=+[ \t*_]*$/gim;

/**
 * Splits Claude's Apply kit reply at its marker lines. Text without markers is all resume, so a
 * plain resume can still be pasted. The CHECK part is for you to read, so it is not kept.
 */
export function splitReply(text: string): Record<'resume' | 'coverLetter' | 'formAnswers', string> {
  const found = [...text.matchAll(MARKER_LINE)];
  if (!found.some((m) => m[1]?.toUpperCase() === 'RESUME')) {
    return { resume: text.trim(), coverLetter: '', formAnswers: '' };
  }
  const parts: Partial<Record<ReplyPart, string>> = {};
  found.forEach((match, i) => {
    const part = match[1]?.toUpperCase() as ReplyPart;
    const start = match.index + match[0].length;
    const end = found[i + 1]?.index ?? text.length;
    parts[part] = text.slice(start, end).trim();
  });
  return {
    resume: parts.RESUME ?? '',
    coverLetter: parts['COVER LETTER'] ?? '',
    formAnswers: parts['FORM ANSWERS'] ?? '',
  };
}

/** Your Application answers as "Label: value" lines for the prompt. Empty answers are left out. */
export function applicationFacts(
  profile: {
    address: string;
    workPermit: string;
    noticePeriod: string;
    salaryExpectation: string;
    relocation: string;
    yearsExperience: number | null;
  } | null,
): string[] {
  if (!profile) return [];
  const facts: [string, string][] = [
    ['Location', profile.address],
    [
      'Years of experience',
      profile.yearsExperience === null ? '' : String(profile.yearsExperience),
    ],
    ['Work permit', profile.workPermit],
    ['Notice period / earliest start', profile.noticePeriod],
    ['Salary expectation', profile.salaryExpectation],
    ['Relocation', profile.relocation],
  ];
  return facts
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `${label}: ${value.trim()}`);
}
