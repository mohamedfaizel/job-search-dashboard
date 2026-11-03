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
  /** Your achievements bank from My profile: true facts with numbers, one per line. */
  achievements: string[];
}

/** The lines of your achievements bank, without list marks or empty lines. */
export function achievementLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•–]|\d+[.)])\s+/, '').trim())
    .filter(Boolean);
}

/** Your achievements bank as a prompt part, or nothing when it is empty. */
export function achievementsPart(achievements: string[]): string {
  return achievements.length
    ? `\n\nMy achievements bank (true facts, with their real numbers). Use the ones that fit this job, in the right job of my resume, and never change a number:\n${list(achievements)}`
    : '';
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
3. Keywords from the job ad (the ad's own phrases): use the ad's exact word where it means the same as what I really did, because ATS keyword matching is often literal (the ad says "reusable UI components" and I built reusable React components: write "reusable UI components with React"). Put them in the summary, the first bullet of each job and the skills, as normal words in real sentences. Never use a keyword only to raise a score, and never stuff, repeat or hide them.
4. A skill with no connection to my experience: leave it out.

Never invent employers, job titles, dates, degrees, certificates or numbers. Keep my real employers, titles and dates.
Interview test: I must be able to explain every line in an interview without saying "well, what I actually meant was...". Moving my most relevant work first and using the ad's words for the same thing is fine. Making adjacent work sound like the ad's exact task, or mixing study and job experience into one claim, is a stretch: list it under Stretches in the CHECK part.`;

/**
 * Writing rules from the best tailoring guides (ai-job-search's writing style guide): what makes a
 * resume read like a person wrote it, not a keyword machine.
 */
const WRITING_RULES = `How to write:
- Summary: 3 to 4 lines that say which role I am targeting and why I fit this one, with one or two proof points that match the ad's most important requirements. If the job is outside my usual field, open with the one sentence that connects my background to their problem.
- Bullets: start with a strong verb, show the result (numbers only when they are in my resume), vary how they start. 4 to 5 bullets for my latest job, 2 to 3 for the one before, 1 to 2 for older ones.
- Skills: 4 to 6 groups with bold labels; use the ad's own name for a group when it truly fits.
- Banned words and phrases: passionate, leverage, synergy, drive results, hit the ground running, team player, results-driven, dynamic, cutting-edge, I believe I would be a great fit. Show it with an example instead.
- No em dashes (—). Use commas or full stops.
- Active voice, confident, no apologising ("I think I could"). Plain words, short sentences.
- A degree or course I have not finished says so in its own entry: "In progress, expected MM/YYYY".`;

/**
 * The resume comes back in one Markdown shape, so the download can put it into the PDF
 * template you picked (apps/api/src/documents/resume-doc.ts reads it).
 */
const LAYOUT = `Layout: ATS-friendly, one column. At most two pages (one page if I have less than 3 years of experience); when it is too long, cut the lines least relevant to this job first, wherever they are. Most relevant experience first. Write the resume in Markdown in exactly this shape (section headings in the resume's language), so my job tracker can put it into my PDF template:
# Full Name
Headline: the job title I am applying as
City, Country | phone | email | LinkedIn or website
## Summary
Two to four sentences.
## Skills
- **Group:** skill, skill, skill
## Experience
### Job title | Company
City | MM/YYYY - MM/YYYY
- What I did, with a result
## Education
### Degree | School
MM/YYYY - MM/YYYY
## Languages
- Language: level
Dates: a plain hyphen (-) between start and end, never a long dash (– or —), and always both a start and an end ("today" for my current job): many ATS systems drop dates they cannot split.
My email and phone as plain text in the contact line, not only behind a link.
No tables, columns, icons or images, and no styling other than **bold**.`;

const CHECK_PART = `- Related: the terms you added under rule 2, each with the experience it is tied to.
- Skipped: the terms you left out, each with one line why.
- Stretches: each line I might struggle to explain in an interview, with why, and ask me: keep, soften or drop?`;

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
  `- A cover letter for this job: 200 to 300 words, to the hiring team at ${company}. Three short paragraphs: why this role and this company, what I can do for them (two or three real examples from my resume as proof, looking forward, not repeating my resume), and a short confident close. Same honesty and writing rules as the resume, and no company facts you are not sure of. Start with the greeting and end with the sign-off and my name: my tracker adds my address, the date, the company and the subject line.
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

  return `Please tailor my resume for this job, then write a cover letter and the answers for the application form. Goal: a resume a hiring manager believes and an ATS reads correctly. Cover the job's must-have skills first, then use the ad's own words wherever they truly describe my work.

Job: ${input.title} at ${input.company}${where}
${writeIn}

Skills the job asks for that my resume does not show yet:
${list(input.missingSkills)}

Keywords from the job ad that my resume does not use yet (use the ones that truly fit, as natural words, see rule 3):
${list(input.missingKeywords)}${mustAddPart(input.mustAdd)}

Other skills I have (not all of them are in my resume):
${list(input.otherSkills)}${achievementsPart(input.achievements)}

${TERM_RULES}

${WRITING_RULES}

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

/** What Claude wrote for a job, as saved: the draft the review prompt checks. */
export interface DraftReply {
  resume: string;
  coverLetter: string;
  formAnswers: string;
}

const REVIEW_CHECK = `- Changes: what you changed and why, one line each.
- Removed: claims you took out because my resume does not support them.
- Stretches: lines still worth a second look, with why, and ask me: keep, soften or drop?
- Missing: must-have requirements of the job my experience does not cover (do not fake them; tell me how to answer them in an interview).`;

/**
 * The review prompt: a second pass where Claude reads the draft as the hiring manager would,
 * checks every claim against your own resume, and returns the fixed documents in the same marker
 * format, so pasting the reply saves the improved version over the draft. Modelled on
 * ai-job-search's drafter-reviewer workflow.
 */
export function buildReviewPrompt(input: PromptInput, draft: DraftReply): string {
  const where = input.city ? ` in ${input.city}` : '';
  const language = input.resumeLanguage === 'de' ? 'German' : 'English';
  const source = input.resume.trim() || '(I have not added my resume here yet.)';
  const part = (text: string) => text.trim() || '(empty)';
  return `Please review my application for ${input.title} at ${input.company}${where} as the hiring manager for this job would, then fix it.

Do these checks, in order:
1. Facts: compare every employer, title, date, degree, number and skill in the draft with my own resume, my other skills and my achievements below. Anything they do not support must go, or be rewritten to what they do support.
2. Requirements: list the job ad's must-have requirements and check each one is shown in the draft where my experience really covers it.
3. Hiring manager's eye: would you believe each line? Is the summary specific to this role? Do the first lines show proof for the ad's most important needs? Is anything vague, repeated, generic or a cliché?
4. Rules: check the draft follows every rule below (writing, keywords, layout, dates, length, languages). Fix whatever does not.

${TERM_RULES}

${WRITING_RULES}

${languagesRule(input.languages)}

${LAYOUT}

Keep everything in ${language}. Keep what is already good: change only what a check found.

My own resume (the source of truth for facts):
"""
${source}
"""

Other skills I have:
${list(input.otherSkills)}${achievementsPart(input.achievements)}

My application facts:
${list(input.facts)}

The job ad:
"""
${input.description?.trim() || '(No description saved.)'}
"""

THE DRAFT TO REVIEW

Resume:
"""
${part(draft.resume)}
"""

Cover letter:
"""
${part(draft.coverLetter)}
"""

Form answers:
"""
${part(draft.formAnswers)}
"""

Reply with the improved versions of all three in exactly this format, with these four marker lines in English as written, so my job tracker can save them over the draft:
${marker('RESUME')}
(the improved resume, complete)
${marker('COVER LETTER')}
(the improved cover letter, complete)
${marker('FORM ANSWERS')}
(one "Question: answer" per line)
${marker('CHECK')}
${REVIEW_CHECK}`;
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

Keywords from its ad that my resume does not use yet (use the ones that truly fit, as natural words, see rule 3):
${list(job.missingKeywords)}${mustAddPart(job.mustAdd)}

The job ad:
"""
${ad.length > QUEUE_AD_CHARS ? `${ad.slice(0, QUEUE_AD_CHARS)} […]` : ad}
"""`;
    })
    .join('\n\n');

  return `Please do this for each of the ${count} below: tailor my resume for the job, then write a cover letter and the answers for its application form. Goal for each job: a resume a hiring manager believes and an ATS reads correctly. Cover its must-have skills first, then use the ad's own words wherever they truly describe my work.

${TERM_RULES}

${WRITING_RULES}

${languagesRule(first.languages)}

${LAYOUT}

For each job, also write, in that job's language:
${coverAndAnswers('the company')}

${resumeBlocks}

Other skills I have (not all of them are in my resume):
${list(first.otherSkills)}${achievementsPart(first.achievements)}

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
