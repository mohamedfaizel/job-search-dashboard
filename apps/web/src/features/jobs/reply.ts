/**
 * Helpers for Claude's Apply kit reply and prompt. The API splits the reply the same way
 * (apps/api/src/insights/prompt.ts, splitReply), so what you see here is what gets saved.
 */

const MARKER_LINE = /^[ \t#*_>]*=+\s*(RESUME|COVER LETTER|FORM ANSWERS|CHECK)\s*=+[ \t*_]*$/gim;

export interface ReplyParts {
  resume: boolean;
  coverLetter: boolean;
  formAnswers: boolean;
}

/**
 * Which parts a pasted reply has. Text without marker lines counts as a plain resume, as it
 * does on save.
 */
export function replyParts(text: string): ReplyParts {
  if (!text.trim()) return { resume: false, coverLetter: false, formAnswers: false };
  const found = [...text.matchAll(MARKER_LINE)];
  const names = found.map((m) => m[1]?.toUpperCase());
  if (!names.includes('RESUME')) return { resume: true, coverLetter: false, formAnswers: false };
  const filled = (name: string) =>
    found.some((m, i) => {
      if (m[1]?.toUpperCase() !== name) return false;
      const end = found[i + 1]?.index ?? text.length;
      return text.slice(m.index + m[0].length, end).trim().length > 0;
    });
  return {
    resume: filled('RESUME'),
    coverLetter: filled('COVER LETTER'),
    formAnswers: filled('FORM ANSWERS'),
  };
}

export interface PromptSection {
  /** The line that introduces the section, without its colon. Empty for the opening lines. */
  title: string;
  body: string;
}

/**
 * Cuts the prompt into its sections ("Job", "Skills the job asks for…", "My current resume"),
 * so it can be read as headings instead of one long text. Blank lines inside a """ quote (your
 * resume, the job ad) don't end a section.
 */
export function promptSections(prompt: string): PromptSection[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let quoted = false;
  for (const line of prompt.split('\n')) {
    if (line.trim() === '"""') quoted = !quoted;
    if (!quoted && line.trim() === '') {
      if (current.length) blocks.push(current.join('\n'));
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join('\n'));

  return blocks.map((block) => {
    const [first = '', ...rest] = block.split('\n');
    // "Skills the job asks for…:" or "How to handle each skill or keyword:" opens a section.
    const heading = /^([^:]{3,120}):\s*$/.exec(first);
    if (heading?.[1] && rest.length) {
      return { title: heading[1], body: rest.join('\n').replace(/^"""\n?|\n?"""$/g, '') };
    }
    return { title: '', body: block };
  });
}

/** Starts a file download from the API (it sends the file name). */
export function startDownload(url: string) {
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', '');
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
}

export interface CheckSection {
  /** "Stretches", "Ask me", "Placed"… as Claude wrote it. */
  label: string;
  items: string[];
}

/**
 * Claude's CHECK part, by its "- Label: …" lines. Numbered items ("(1) … (2) …") become one item
 * each; "(none)" leaves the section out. Lines without a label belong to the one above.
 */
export function checkSections(text: string): CheckSection[] {
  const sections: { label: string; body: string }[] = [];
  let current: { label: string; body: string } | undefined;
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const head = /^[-*•]\s*\**([^:*]{2,40})\**:\s*(.*)$/.exec(line);
    if (head) {
      // Claude may repeat a label ("- Ask me: …" once per question): keep one section for it.
      const label = head[1]?.trim() ?? '';
      const same = sections.find((s) => s.label.toLowerCase() === label.toLowerCase());
      if (same) same.body += `\n${head[2] ?? ''}`;
      else sections.push({ label, body: head[2] ?? '' });
      current = same ?? sections[sections.length - 1];
    } else if (current) current.body += `\n${line.replace(/^[-*•]\s*/, '')}`;
  }
  return sections
    .map(({ label, body }) => ({
      label,
      items: body
        .split(/\s*\(\d+\)\s*|\n/)
        .map((item) => item.trim())
        .filter((item) => item && !/^\(?none\)?\.?$/i.test(item)),
    }))
    .filter((section) => section.items.length > 0);
}
