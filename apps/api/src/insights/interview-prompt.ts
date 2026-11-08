import type { PromptInput } from './prompt';
import { achievementsPart } from './prompt';

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

Rules: use only what is in my resume and my achievements below. Never invent employers, projects, numbers, titles or skills for me. Where my resume is thin, say so and give me an honest way to answer instead of a made-up story.${languages}

Skills and keywords in the job ad that my resume does not show (my likely gaps):
${list(gaps)}

Write these six parts. Start each with its heading exactly as shown, and keep the headings and the labels (Q1., Why they ask:, Answer:, Gap:, Say:, Learn this week:) in English even when you write the rest in German: the app splits your reply by them.
## 1. What they care about
The five things in the ad that matter most, one line each.
## 2. Tell me about yourself
A 60-second answer for this role, built from my resume.
## 3. Likely questions
Eight questions: three about the technical skills of the role, three behavioural (situation, what I did, result, using real examples from my resume) and two about my gaps. Write each one like this:
Q1. <the question>
Why they ask: <one line>
Answer: <a short model answer from my resume>
## 4. My gaps
For each gap above, write:
Gap: <the skill>
Say: <an honest way to answer if they ask>
Learn this week: <one thing I can do to close it>
## 5. Questions for them
Five good questions I can ask the interviewer, one per line starting with "- ".
## 6. Research checklist
What to read about ${input.company} before the interview, one item per line starting with "- [ ] ".

My resume:
"""
${resume}
"""${achievementsPart(input.achievements)}

The job ad:
"""
${input.description?.trim() || '(No description saved.)'}
"""

Reply with the six parts and nothing before them.`;
}

/**
 * The mock interview prompt: Claude plays the interviewer, asks one question at a time and gives
 * feedback after each answer. Works in Claude's voice mode too. In German it speaks simple German
 * at your real level, for jobs whose interview will be in German.
 */
export function buildMockInterviewPrompt(input: PromptInput, language: 'en' | 'de'): string {
  const where = input.city ? ` in ${input.city}` : '';
  const resume = input.resume.trim()
    ? input.resume.trim()
    : '(I have not added my resume here yet. Ask me for it before you start.)';
  const gaps = [...new Set([...input.missingSkills, ...input.missingKeywords.slice(0, 5)])];
  const languages = input.languages.length
    ? `\n\nMy languages, with my real levels:\n${list(input.languages)}`
    : '';
  const languageRule =
    language === 'de'
      ? 'Run the whole interview in German. Speak simple German that matches my real German level below: short sentences, common words, no slang. When I make a German mistake, show the corrected sentence after your feedback. When I write "help", repeat your last question in English.'
      : 'Run the whole interview in English.';

  return `Let's do a mock interview. You are the interviewer for this job, and I am the candidate.

Job: ${input.title} at ${input.company}${where}

How to run it:
- Ask one question at a time, then wait for my answer. Never answer for me.
- Ask eight questions: three about the technical skills of the role, three behavioural ones (situation, what I did, result) and two about my likely gaps.
- After each answer give short feedback: one thing that was good, one thing to improve, and a better version of my answer that uses only facts from my resume. Never invent employers, projects, numbers or skills for me.
- After the eighth answer, end the interview: give each answer a score out of 10 and name the three things I should practise most.
- ${languageRule}${languages}

My likely gaps (skills in the ad that my resume does not show):
${list(gaps)}

My resume:
"""
${resume}
"""${achievementsPart(input.achievements)}

The job ad:
"""
${input.description?.trim() || '(No description saved.)'}
"""

Start now: say hello as the interviewer and ask the first question.`;
}
