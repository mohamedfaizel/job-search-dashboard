/**
 * Master resumes in more than one language. Your main master resume is in one language
 * (`Profile.resumeLanguage`); you can add the same resume in others (`LanguageResume`). A job is
 * checked against the resume in its own language, so a German ad is compared with German words
 * instead of showing every German keyword as missing.
 */

/** The languages a resume can be in, by ISO 639-1 code. Add a line to support another one. */
export const RESUME_LANGUAGES: Record<string, string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  nl: 'Dutch',
  pt: 'Portuguese',
  pl: 'Polish',
};

export const languageName = (code: string) => RESUME_LANGUAGES[code] ?? code;

export interface MasterResumes {
  /** Language of the main master resume. */
  language: string;
  text: string;
  /** Your resume in other languages, by code. */
  others: Map<string, string>;
}

/**
 * The master resume to use for a language: the one written in it when you have it, otherwise
 * the main one. Returns the text and the language it is in.
 */
export function resumeFor(
  resumes: MasterResumes,
  language: string | null,
): { text: string; language: string } {
  if (language && language !== resumes.language) {
    const other = resumes.others.get(language);
    if (other?.trim()) return { text: other, language };
  }
  return { text: resumes.text, language: resumes.language };
}

/**
 * A prompt that turns your main master resume into another language with Claude, keeping every
 * fact. Paste Claude's answer into that language's resume on My profile.
 */
export function buildTranslationPrompt(input: {
  resume: string;
  from: string;
  to: string;
  languages: string[];
}): string {
  const to = languageName(input.to);
  const headings =
    input.to === 'de'
      ? '\nUse the usual German CV headings (Profil, Berufserfahrung, Ausbildung, Kenntnisse, Sprachen) and German date formats (MM/JJJJ).'
      : '';
  const levels = input.languages.length
    ? `My languages, with my real levels. Keep them exactly like this, never higher:\n${input.languages.map((l) => `- ${l}`).join('\n')}`
    : 'Keep every language level exactly as it is. Never raise it.';
  return `Please translate my resume from ${languageName(input.from)} into ${to}, for job applications in ${to}.

Rules:
- Keep every employer, job title, date, degree, number and link exactly as it is. Translate job titles only where a ${to} title is common, and keep the original in brackets when unsure.
- Keep tool and technology names (React, TypeScript, Figma, …) as they are.
- Do not add, remove or improve anything: same facts, same order, same length.
- Use the words a ${to} recruiter and an ATS look for, not word-for-word translation.${headings}

${levels}

Reply with only the translated resume as plain text, no notes before or after it.

My resume:
"""
${input.resume.trim()}
"""`;
}
