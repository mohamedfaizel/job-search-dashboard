export interface PromptInput {
  title: string;
  company: string;
  city: string | null;
  /** ISO 639-1 code of the job ad, e.g. "de". */
  language: string | null;
  missingSkills: string[];
  missingKeywords: string[];
  resume: string;
  description: string | null;
}

const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

function languageName(code: string | null): string | null {
  if (!code) return null;
  try {
    return languageNames.of(code) ?? null;
  } catch {
    return null;
  }
}

const list = (items: string[]) =>
  items.length ? items.map((item) => `- ${item}`).join('\n') : '- (none)';

/**
 * A prompt to paste into Claude (desktop or web) that tailors your resume to one job. Writing it
 * there uses your Claude subscription instead of API credits. The rules keep the resume honest:
 * only what is true for you goes in.
 */
export function buildResumePrompt(input: PromptInput): string {
  const language = languageName(input.language);
  const where = input.city ? ` in ${input.city}` : '';
  const resume = input.resume.trim()
    ? input.resume.trim()
    : '(I have not added my resume here yet. Ask me for it before you start.)';

  return `Please tailor my resume for this job.

Job: ${input.title} at ${input.company}${where}
${language ? `Write the whole resume in ${language}, the language of the job ad.` : 'Write the resume in the language of the job ad.'}

Skills the job asks for that my resume does not show yet:
${list(input.missingSkills)}

Keywords from the job ad that my resume does not use yet:
${list(input.missingKeywords)}

Rules:
- Add a skill or keyword only if my resume or experience really supports it. Never invent employers, job titles, dates, degrees, certificates or numbers.
- If something on the lists is not true for me, leave it out and name it at the end under "Skipped".
- Keep my real employers, titles and dates.
- Where it is true for me, use the job ad's own words, so applicant tracking systems (ATS) find them.
- ATS-friendly layout: plain headings (Summary, Skills, Experience, Education), no tables, columns, icons or images.
- One to two pages.

My current resume:
"""
${resume}
"""

The job ad:
"""
${input.description?.trim() || '(No description saved.)'}
"""`;
}
