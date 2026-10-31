import { languageName } from '../profile/resumes';

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
  /** The language `resume` is written in (ISO 639-1), e.g. "de" for your German master resume. */
  resumeIn: string;
  /** Missing terms you said you have ("I have this"): Claude must put them in the resume. */
  mustAdd: string[];
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

const TERM_RULES = `How to handle each skill or keyword:
1. Supported: my resume or my other skills show it. Use it, in the job ad's own words.
2. Related: it is closely tied to something I have done (same ecosystem, or the usual tool for it), for example Apollo with GraphQL, Next.js with React, Jest with unit testing, Kubernetes with Docker. Add it next to that experience, e.g. "GraphQL APIs with Apollo Client".
3. General job-ad words (teamwork, efficiency, platforms, business impact): work them naturally into the summary and bullet points.
4. No connection to my experience: leave it out.

Never invent employers, job titles, dates, degrees, certificates or numbers. Keep my real employers, titles and dates.`;

const LAYOUT =
  'Layout: ATS-friendly, plain headings (Summary, Skills, Experience, Education), no tables, columns, icons or images. Up to three pages, most relevant experience first.';

const CHECK_PART = `- Related: the terms you added under rule 2, each with the experience it is tied to.
- Skipped: the terms you left out, each with one line why.`;

/** The "I have this" terms, or nothing when there are none (so the prompt stays short). */
const mustAddPart = (terms: string[], resume = 'my resume') =>
  terms.length
    ? `\n\nSkills I really have that ${resume} does not show yet. They MUST be in the new resume: in the Skills section, and next to the experience where I used them when that is clear from my resume:\n${list(terms)}`
    : '';

const languagesRule = (languages: string[]) =>
  languages.length
    ? `My languages, with my real levels. List them in a Languages section exactly like this, never higher:\n${list(languages)}`
    : 'Keep any language levels from my resume exactly as they are. Never raise them.';

const coverAndAnswers = (company: string) =>
  `- A cover letter for this job: 200 to 300 words, to the hiring team at ${company}. Three short paragraphs: why this role, what I bring (two or three real examples from my resume), and a short close. Same honesty rules as the resume.
- Answers to the questions application forms usually ask, 1 to 3 sentences each: why ${company}, why I fit this role, why I am looking for a new job, salary expectation, notice period or earliest start, work permit, willingness to relocate. Take the facts from my list below and never change them. When a fact is missing, write "(fill in)".`;

/** Which language to write in, and whether my resume needs translating first. */
function writeInLine(input: PromptInput): string {
  const translate =
    input.resumeIn === input.resumeLanguage
      ? ''
      : ` My resume below is in ${languageName(input.resumeIn)}: translate it.`;
  if (input.resumeLanguage === 'de') {
    const level = input.germanLevel ? ` (${input.germanLevel})` : '';
    return translate
      ? `Write the whole resume in German: the job asks for German${level}. Translate my resume and use the job ad's own German words.`
      : `Write the whole resume in German: the job asks for German${level}. My resume below is already in German: keep its wording and use the job ad's own German words.`;
  }
  return `Write the resume in English: the job doesn't ask for German.${translate}`;
}

/**
 * The Apply kit prompt: paste it into Claude (desktop or web) and one reply brings the resume
 * tailored to the job, a cover letter and answers to the usual form questions. Writing it there
 * uses your Claude subscription instead of API credits. Claude may add a term that is closely
 * related to your real experience (Apollo next to GraphQL), but never invents employers, titles,
 * dates or numbers, and lists what it added as related so you can check it. The reply comes back
 * between marker lines, so pasting it into the job splits it into its parts.
 */
export function buildResumePrompt(input: PromptInput): string {
  const writeIn = writeInLine(input);
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
${list(input.missingKeywords)}${mustAddPart(input.mustAdd)}

Other skills I have (not all of them are in my resume):
${list(input.otherSkills)}

${TERM_RULES}

${languagesRule(input.languages)}

${LAYOUT}

My current resume:
"""
${resume}
"""

The job ad:
"""
${input.description?.trim() || '(No description saved.)'}
"""

Then write, ${sameLanguage}:
${coverAndAnswers(input.company)}

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
${CHECK_PART}`;
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

/** At most this many jobs go into one queue prompt, so Claude's reply stays within one answer. */
export const QUEUE_PROMPT_MAX = 5;
// Long ads are cut, so five of them still fit in one prompt.
const QUEUE_AD_CHARS = 5000;

const jobMarker = (n: number, jobId: string) => `=== JOB ${String(n)}: ${jobId} ===`;

/**
 * One prompt for several queued jobs: your resume, rules and facts once, then each job with its
 * missing terms and ad. Claude replies with a JOB marker line before each job's usual four parts,
 * so the whole reply can be pasted back at once and saved to every job.
 */
export function buildQueuePrompt(jobs: (PromptInput & { jobId: string })[]): string {
  const [first] = jobs;
  if (!first) return '';
  const count = `${String(jobs.length)} job${jobs.length === 1 ? '' : 's'}`;
  // Each master resume once: jobs in German may start from your German one.
  const resumes = new Map<string, string>();
  for (const job of jobs) if (!resumes.has(job.resumeIn)) resumes.set(job.resumeIn, job.resume);
  const several = resumes.size > 1;
  const resumeBlocks = [...resumes]
    .map(([language, text]) => {
      const body = text.trim()
        ? text.trim()
        : '(I have not added my resume here yet. Ask me for it before you start.)';
      const label = several
        ? `My current resume in ${languageName(language)}:`
        : 'My current resume:';
      return `${label}\n"""\n${body}\n"""`;
    })
    .join('\n\n');
  const savedAnswers = first.savedAnswers.trim()
    ? `\n\nMy saved answers (reuse their wording where they fit):\n"""\n${first.savedAnswers.trim()}\n"""`
    : '';

  const jobBlocks = jobs
    .map((job, i) => {
      const where = job.city ? ` in ${job.city}` : '';
      const language =
        job.resumeLanguage === 'de'
          ? `Write everything for this job in German: it asks for German${job.germanLevel ? ` (${job.germanLevel})` : ''}. Use the ad's own German words.`
          : 'Write everything for this job in English.';
      const start = several ? ` Start from my resume in ${languageName(job.resumeIn)}.` : '';
      const ad = job.description?.trim() || '(No description saved.)';
      return `--- JOB ${String(i + 1)} of ${String(jobs.length)}: ${job.title} at ${job.company}${where} (id ${job.jobId}) ---
${language}${start}

Skills it asks for that my resume does not show yet:
${list(job.missingSkills)}

Keywords from its ad that my resume does not use yet:
${list(job.missingKeywords)}${mustAddPart(job.mustAdd)}

The job ad:
"""
${ad.length > QUEUE_AD_CHARS ? `${ad.slice(0, QUEUE_AD_CHARS)} […]` : ad}
"""`;
    })
    .join('\n\n');

  return `Please do this for each of the ${count} below: tailor my resume for the job, then write a cover letter and the answers for its application form. Goal for each job: use at least 85% of its skills and keywords, as long as each one is honest for me.

${TERM_RULES}

${languagesRule(first.languages)}

${LAYOUT}

For each job, also write, in that job's language:
${coverAndAnswers('the company')}

${resumeBlocks}

Other skills I have (not all of them are in my resume):
${list(first.otherSkills)}

My application facts:
${list(first.facts)}${savedAnswers}

THE JOBS

${jobBlocks}

Reply with every job in order, each in exactly this format, with the marker lines in English as written, so my job tracker can split your reply and save each job:
${jobMarker(1, first.jobId)}
${marker('RESUME')}
(the resume)
${marker('COVER LETTER')}
(the cover letter)
${marker('FORM ANSWERS')}
(one "Question: answer" per line)
${marker('CHECK')}
${CHECK_PART}

Then ${jobs.length > 1 ? `the same for the next job, starting with its own line "=== JOB 2: <its id> ===", and so on` : 'nothing else'}. If the reply gets too long, stop after a whole job and tell me which jobs are left, and I will ask you to continue.`;
}

const JOB_MARKER_LINE = /^[ \t#*_>]*=+\s*JOB\s+(\d+)\s*:\s*([^\s=]+)\s*=+[ \t*_]*$/gim;

/**
 * Splits a queue reply at its JOB marker lines into each job's reply, keyed by job id. A job
 * whose marker has a garbled id is matched by its number instead.
 */
export function splitQueueReply(text: string, jobIds: string[]): Map<string, string> {
  const found = [...text.matchAll(JOB_MARKER_LINE)];
  const replies = new Map<string, string>();
  found.forEach((match, i) => {
    const byId = jobIds.includes(match[2] ?? '') ? match[2] : undefined;
    const jobId = byId ?? jobIds[Number(match[1]) - 1];
    const start = match.index + match[0].length;
    const end = found[i + 1]?.index ?? text.length;
    const part = text.slice(start, end).trim();
    if (jobId && part) replies.set(jobId, part);
  });
  return replies;
}
