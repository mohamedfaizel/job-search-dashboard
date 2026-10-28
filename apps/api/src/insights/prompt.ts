export interface PromptInput {
  title: string;
  company: string;
  city: string | null;
  /** ISO 639-1 code of the job ad, e.g. "de". */
  language: string | null;
  missingSkills: string[];
  missingKeywords: string[];
  /** The Skills list on My profile: tools you have that may not be in the resume. */
  otherSkills: string[];
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
 * there uses your Claude subscription instead of API credits. Claude may add a term that is
 * closely related to your real experience (Apollo next to GraphQL), but never invents employers,
 * titles, dates or numbers, and lists what it added as related so you can check it.
 */
export function buildResumePrompt(input: PromptInput): string {
  const language = languageName(input.language);
  const where = input.city ? ` in ${input.city}` : '';
  const resume = input.resume.trim()
    ? input.resume.trim()
    : '(I have not added my resume here yet. Ask me for it before you start.)';

  return `Please tailor my resume for this job. Goal: use at least 85% of the skills and keywords below, as long as each one is honest for me.

Job: ${input.title} at ${input.company}${where}
${language ? `Write the whole resume in ${language}, the language of the job ad.` : 'Write the resume in the language of the job ad.'}

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

Layout: ATS-friendly, plain headings (Summary, Skills, Experience, Education), no tables, columns, icons or images. Up to three pages, most relevant experience first.

At the end, after the resume, write two short lists so I can check them:
- Related: the terms you added under rule 2, each with the experience it is tied to.
- Skipped: the terms you left out, each with one line why.

My current resume:
"""
${resume}
"""

The job ad:
"""
${input.description?.trim() || '(No description saved.)'}
"""`;
}
