/**
 * The prompt for Claude that works the keywords you ticked (the ones the AI match says are
 * missing and you really have) into your resume. It stays in English whatever your language: it
 * is for Claude, not for you. Ticks are only for this prompt; they never change your profile.
 */
export function keywordPrompt(keywords: string[]): string {
  return `The following keywords from the job advertisement are missing from my resume, and I confirm that I have these keywords:
${keywords.map((k) => `- ${k}`).join('\n')}

Integrate these keywords into my resume using the following rules, in this exact priority order:

1. REPLACE (first priority)
If an existing bullet point already describes the same skill, responsibility or experience, replace vague wording with the relevant keyword. Preserve the original meaning while making the experience more specific.

2. RESTRUCTURE (second priority)
If no existing bullet directly matches, identify the closest relevant experience and restructure that bullet to incorporate the keyword naturally. Maintain the original factual meaning. Do not invent responsibilities, projects, achievements, technologies or metrics.

3. ADD (last priority)
If the keyword genuinely fits nowhere in the experience section, add it to the most appropriate section:
- CORE COMPETENCIES
- ENGINEERING EXCELLENCE

Additional requirements:
- Use each keyword at least once, where it is true and fits.
- Prioritise natural language over keyword stuffing.
- Preserve all existing achievements, measurable results, project details, employer names, job titles and employment dates.
- Do not duplicate keywords unnecessarily.
- Maintain the existing resume structure, professional tone and ATS-friendly formatting.
- Keep my page limit and all my headings.
- Do not introduce related technologies or skills that I have not confirmed.
- Do not weaken strong achievement bullets just to accommodate keywords.

Reply with the full resume only. After the resume, list each keyword and where it was placed (Replace, Restructure or Add).`;
}
