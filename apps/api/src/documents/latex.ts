/**
 * Turns resume text into LaTeX safely. Every character LaTeX treats as a command (\ { } $ & # ^
 * _ ~ %) is escaped, so text from Claude or a user can never run LaTeX code; the only markup
 * that comes through is Markdown bold, italics and links.
 */
const SPECIAL: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  $: '\\$',
  '&': '\\&',
  '#': '\\#',
  '^': '\\textasciicircum{}',
  _: '\\_',
  '~': '\\textasciitilde{}',
  '%': '\\%',
};

/** Escapes plain text. */
export function esc(text: string): string {
  return text
    .replace(/[\\{}$&#^_~%]/g, (c) => SPECIAL[c] ?? c)
    .replace(/\xa0/g, '~')
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, ''); // invisible characters never reach the PDF
}

/** Escapes a URL for \href: only %, # and \ need care there. */
function escUrl(url: string): string {
  return url.replace(/[\\{}]/g, '').replace(/[%#&]/g, (c) => `\\${c}`);
}

const INLINE = /\*\*(.+?)\*\*|__(.+?)__|(?<![\w*])\*(?!\s)(.+?)\*(?!\w)|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Escapes text and keeps Markdown **bold**, *italics* and [links](https://…). */
export function inline(text: string): string {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    out += esc(text.slice(last, m.index));
    const [, bold1, bold2, italic, label, url] = m;
    if (bold1 ?? bold2) out += `\\textbf{${inline(bold1 ?? bold2 ?? '')}}`;
    else if (italic) out += `\\emph{${inline(italic)}}`;
    else if (label && url) out += linkTo(url, inline(label));
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

/** A clickable link, only for web and mail links. */
function linkTo(url: string, label: string): string {
  return /^(https?:\/\/|mailto:)/i.test(url) ? `\\href{${escUrl(url)}}{${label}}` : label;
}

/**
 * One contact item, linked when it is an email or a web address ("linkedin.com/in/me" becomes a
 * link to https://linkedin.com/in/me).
 */
export function contactItem(item: string): string {
  const text = item.trim();
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(text)) return linkTo(`mailto:${text}`, esc(text));
  if (/^(https?:\/\/)?(www\.)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(text) && !/^\+?\d/.test(text)) {
    const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    return linkTo(url, esc(text.replace(/^https?:\/\/(www\.)?/i, '')));
  }
  return inline(text);
}
