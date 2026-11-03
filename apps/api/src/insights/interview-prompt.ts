import type { PromptInput } from './prompt';

const list = (items: string[]) =>
  items.length ? items.map((item) => `- ${item}`).join('\n') : '- (none)';

/** Which language to coach in: the ad's, so the practice answers are in the interview's language. */
function languageLine(input: PromptInput): string {
  if (input.resumeLanguage === 'de') {
    const level = input.germanLevel ? ` (${input.germanLevel})` : '';
    return `The job asks for German${level}, so the interview is probably in German. Write the questions and the model answers in German, and add a short English hint after each question. Keep my sentences simple: they must match my real German level below, not a higher one.`;
  }
  return "The job doesn't ask for German, so the interview is probably in English. Write everything in English.";
}

/**
 * The interview prep prompt: paste it into Claude (desktop or web) and one reply brings likely
 * questions with answers built from your real resume, an honest plan for your gaps, and questions
 * to ask them. Like the Apply kit prompt it uses your Claude subscription, not API credits, and
 * Claude may only use what is in your resume.
 */
export function buildInterviewPrompt(input: PromptInput): string {
  const where = input.city ? ` in ${input.city}` : '';
  const resume = input.resume.trim()
    ? input.resume.trim()
    : '(I have not added my resume here yet. Ask me for it before you start.)';
  const gaps = [...new Set([...input.missingSkills, ...input.missingKeywords.slice(0, 5)])];
  const languages = input.languages.length
    ? `\n\nMy languages, with my real levels (never claim a higher one):\n${list(input.languages)}`
    : '';

  return `Please prepare me for an interview for this job. Be my interview coach.

Job: ${input.title} at ${input.company}${where}
${languageLine(input)}

Rules: use only what is in my resume below. Never invent employers, projects, numbers, titles or skills for me. Where my resume is thin, say so and give me an honest way to answer instead of a made-up story.${languages}

Skills and keywords in the job ad that my resume does not show (my likely gaps):
${list(gaps)}

Write these six parts, each with a heading:
1. What they care about: the five things in the ad that matter most, one line each.
2. Tell me about yourself: a 60-second answer for this role, built from my resume.
3. Likely questions: eight questions. Three about the technical skills of the role, three behavioural (situation, what I did, result, using real examples from my resume) and two about my gaps. For each one: why they ask, and a short model answer from my resume.
4. My gaps: for each gap above, an honest way to answer if they ask, and one thing I can learn this week to close it.
5. Questions for them: five good questions I can ask the interviewer.
6. Research checklist: what to read about ${input.company} before the interview.

My resume:
"""
${resume}
"""

The job ad:
"""
${input.description?.trim() || '(No description saved.)'}
"""

Reply with the six parts in plain text or Markdown and nothing before them.`;
}
