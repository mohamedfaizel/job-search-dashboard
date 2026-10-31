import JSZip from 'jszip';
import type { ResumeBlock, ResumeDoc } from './resume-doc';

/**
 * Uses your own Word resume as the template. A .docx file is a zip of XML files; the text is in
 * word/document.xml as paragraphs (<w:p>) made of runs (<w:r>) of text, each with its own
 * formatting (<w:pPr> for the paragraph, <w:rPr> for the run).
 *
 * The tailored resume keeps everything above your first section heading exactly as it is (your
 * name, contact details, photo, header table), and your page setup, fonts, styles, headers and
 * footers. Below that, each new heading, entry, bullet and paragraph copies the formatting of
 * the matching paragraph in your file, with Claude's new words in it.
 */

/** Section headings we recognise, in the languages the app supports. Lower case. */
const HEADINGS = new Set(
  [
    // English
    'summary',
    'profile',
    'professional summary',
    'profile summary',
    'about me',
    'objective',
    'career objective',
    'skills',
    'technical skills',
    'core skills',
    'key skills',
    'it skills',
    'competencies',
    'core competencies',
    'experience',
    'work experience',
    'professional experience',
    'relevant experience',
    'employment',
    'employment history',
    'work history',
    'career history',
    'education',
    'qualifications',
    'languages',
    'projects',
    'certifications',
    'certificates',
    'courses',
    'training',
    'publications',
    'awards',
    'achievements',
    'interests',
    'hobbies',
    'references',
    'volunteering',
    'volunteer experience',
    'personal details',
    'personal information',
    'tools',
    'internships',
    // German
    'profil',
    'kurzprofil',
    'über mich',
    'zusammenfassung',
    'kenntnisse',
    'fähigkeiten',
    'kompetenzen',
    'it-kenntnisse',
    'edv-kenntnisse',
    'fachkenntnisse',
    'berufserfahrung',
    'berufliche erfahrung',
    'berufspraxis',
    'praktische erfahrung',
    'werdegang',
    'beruflicher werdegang',
    'ausbildung',
    'bildung',
    'bildungsweg',
    'studium',
    'schulbildung',
    'sprachen',
    'sprachkenntnisse',
    'projekte',
    'zertifikate',
    'zertifizierungen',
    'weiterbildung',
    'weiterbildungen',
    'fortbildungen',
    'interessen',
    'hobbys',
    'referenzen',
    'ehrenamt',
    'persönliche daten',
    'erfolge',
    'praktika',
    // French, Spanish, Italian, Dutch, Portuguese, Polish
    'profil professionnel',
    'compétences',
    'expérience',
    'expérience professionnelle',
    'formation',
    'langues',
    'projets',
    'perfil',
    'experiencia',
    'experiencia profesional',
    'educación',
    'formación',
    'idiomas',
    'habilidades',
    'proyectos',
    'profilo',
    'esperienza',
    'esperienza professionale',
    'istruzione',
    'formazione',
    'lingue',
    'competenze',
    'progetti',
    'profiel',
    'werkervaring',
    'ervaring',
    'opleiding',
    'talen',
    'vaardigheden',
    'projecten',
    'experiência',
    'experiência profissional',
    'formação',
    'competências',
    'projetos',
    'doświadczenie',
    'doświadczenie zawodowe',
    'wykształcenie',
    'języki',
    'umiejętności',
    'projekty',
  ].map((h) => h.normalize('NFC')),
);

/** Headings of the section that lists your jobs: its first entry is the model for entries. */
const EXPERIENCE =
  /experience|employment|work history|career history|berufserfahrung|erfahrung|werdegang|berufspraxis|expérience|experiencia|esperienza|ervaring|experiência|doświadczenie/i;

/** A bullet typed by hand at the start of a paragraph. */
const LITERAL_BULLET = /^\s*([•●▪◦‣–-])\s*/;

/** Separators between job title and company, in the order we look for them. */
const SEPARATORS = [' | ', ' – ', ' — ', ' · ', ' - ', ', ', ' at ', ' bei '];

export class DocxTemplateError extends Error {}

/** What we found in your file, for the profile page. */
export interface DocxReport {
  /** The file can be used as a template. */
  usable: boolean;
  /** The section headings found, in order. */
  sections: string[];
  /** Things that won't carry over, in plain words. */
  warnings: string[];
}

/** One paragraph's formatting, to copy. */
interface Prototype {
  pPr: string;
  rPr: string;
  /** Formatting of the text after a tab, e.g. dates on the right of a job title. */
  afterTabRPr: string | null;
  /** The paragraph's own text, to learn its separator. */
  text: string;
  /** A bullet typed by hand ("• "), kept in front of each new bullet. */
  literalBullet: string | null;
}

interface Analysis {
  report: DocxReport;
  /** Everything above the first heading, verbatim. */
  top: string[];
  /** The final <w:sectPr> (page size, margins, headers and footers). */
  sectPr: string;
  heading: Prototype | null;
  title: Prototype | null;
  meta: Prototype | null;
  bullet: Prototype | null;
  body: Prototype | null;
  /** All headings in your file are in capitals, so new ones are too. */
  upperCaseHeadings: boolean;
  /** Index in `top` and text of each paragraph above the first heading. */
  topTexts: { index: number; text: string }[];
}

// ---- reading the XML ----------------------------------------------------------------------

/** End index (exclusive) of the element that opens at `start`, counting nested same tags. */
function elementEnd(xml: string, start: number, tag: string): number {
  const re = new RegExp(`<(/?)${tag}(?=[\\s>/])[^>]*?(/?)>`, 'g');
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    if (m[1]) depth--;
    else if (!m[2]) depth++;
    if (depth === 0) return m.index + m[0].length;
  }
  return xml.length;
}

/** The top-level child elements of an XML fragment. */
function children(xml: string): string[] {
  const out: string[] = [];
  const open = /<([\w:]+)(?=[\s>/])[^>]*?(\/?)>/g;
  let m = open.exec(xml);
  while (m) {
    const tag = m[1] ?? '';
    const end = m[2] ? m.index + m[0].length : elementEnd(xml, m.index, tag);
    out.push(xml.slice(m.index, end));
    open.lastIndex = end;
    m = open.exec(xml);
  }
  return out;
}

/** The first <tag>…</tag> inside `xml`, whole, or ''. */
function first(xml: string, tag: string): string {
  const start = new RegExp(`<${tag}(?=[\\s>/])`).exec(xml)?.index;
  return start === undefined ? '' : xml.slice(start, elementEnd(xml, start, tag));
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

/** The visible text of a paragraph; a tab is "\t". */
function textOf(p: string): string {
  let out = '';
  for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)) {
    out += m[1] !== undefined ? decode(m[1]) : m[0] === '<w:tab/>' ? '\t' : '\n';
  }
  return out;
}

/** The runs of a paragraph, with their formatting and text. */
function runsOf(p: string): { rPr: string; text: string; tab: boolean }[] {
  return [...p.matchAll(/<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g)].map((m) => {
    const inner = m[1] ?? '';
    return { rPr: first(inner, 'w:rPr'), text: textOf(inner), tab: inner.includes('<w:tab/>') };
  });
}

const normal = (text: string) =>
  text
    .normalize('NFC')
    .replace(/[:：]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

function isHeading(p: string, text: string): boolean {
  if (!text.trim() || text.length > 60) return false;
  if (HEADINGS.has(normal(text))) return true;
  const style = /<w:pStyle w:val="([^"]+)"/.exec(p)?.[1] ?? '';
  return /^(heading|berschrift|titre|t[ií]tulo|kop)\s*[12]$/i.test(style);
}

function isBullet(p: string, text: string): boolean {
  if (/<w:numPr>/.test(p)) return true;
  const style = /<w:pStyle w:val="([^"]+)"/.exec(p)?.[1] ?? '';
  return /list|aufz|liste|lista|opsomming/i.test(style) || LITERAL_BULLET.test(text);
}

/** Formatting worth copying: no section breaks, tracked changes or hidden text. */
function cleanPPr(pPr: string, keepNumbering: boolean): string {
  let out = pPr
    .replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/g, '')
    .replace(/<w:pPrChange[\s\S]*?<\/w:pPrChange>/g, '')
    .replace(/<w:pageBreakBefore\/>/g, '')
    .replace(/\sw:rsid\w*="[^"]*"/g, '');
  if (!keepNumbering) out = out.replace(/<w:numPr>[\s\S]*?<\/w:numPr>/g, '');
  return out.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/g, (r) => cleanRPr(r));
}

function cleanRPr(rPr: string): string {
  return rPr
    .replace(/<w:rPrChange[\s\S]*?<\/w:rPrChange>/g, '')
    .replace(/<w:(vanish|webHidden|specVanish)\/>/g, '')
    .replace(/\sw:rsid\w*="[^"]*"/g, '');
}

function prototype(p: string, keepNumbering = false): Prototype {
  const pPr = first(p, 'w:pPr');
  const runs = runsOf(p).filter((r) => r.text.trim() || r.tab);
  const tabAt = runs.findIndex((r) => r.tab);
  const firstText = runs.find((r) => r.text.trim());
  const afterTab = tabAt >= 0 ? runs.slice(tabAt).find((r) => r.text.trim()) : undefined;
  const text = textOf(p);
  return {
    pPr: cleanPPr(pPr, keepNumbering),
    rPr: cleanRPr(firstText?.rPr ?? ''),
    afterTabRPr: afterTab && afterTab !== firstText ? cleanRPr(afterTab.rPr) : null,
    text,
    literalBullet: LITERAL_BULLET.exec(text)?.[1] ?? null,
  };
}

const isParagraph = (el: string) => el.startsWith('<w:p>') || el.startsWith('<w:p ');

function analyse(documentXml: string): Analysis {
  const bodyStart = documentXml.indexOf('<w:body>');
  const bodyEnd = documentXml.lastIndexOf('</w:body>');
  if (bodyStart < 0 || bodyEnd < 0) throw new DocxTemplateError('This is not a Word document');
  const elements = children(documentXml.slice(bodyStart + '<w:body>'.length, bodyEnd));
  const sectPr = elements.at(-1)?.startsWith('<w:sectPr') ? (elements.pop() ?? '') : '';

  const firstHeading = elements.findIndex((el) => isParagraph(el) && isHeading(el, textOf(el)));
  const top = firstHeading < 0 ? elements : elements.slice(0, firstHeading);
  const rest = firstHeading < 0 ? [] : elements.slice(firstHeading);

  const warnings: string[] = [];
  const sections: { title: string; paragraphs: string[] }[] = [];
  let hasTable = false;
  for (const el of rest) {
    if (!isParagraph(el)) {
      if (el.startsWith('<w:tbl')) hasTable = true;
      continue;
    }
    if (el.includes('<w:txbxContent')) hasTable = true;
    const text = textOf(el);
    if (isHeading(el, text)) sections.push({ title: text.trim(), paragraphs: [el] });
    else if (text.trim()) sections.at(-1)?.paragraphs.push(el);
  }
  if (hasTable) {
    warnings.push(
      'Tables and text boxes below your header become normal paragraphs in the tailored resume.',
    );
  }
  if (top.some((el) => /<w:(vanish|specVanish)\/>/.test(el))) {
    warnings.push(
      'The top of your file has hidden text. It stays in the Word file: remove it in Word if you did not mean it.',
    );
  }

  const headingP = sections[0]?.paragraphs[0];
  const content = sections.flatMap((s) => s.paragraphs.slice(1));
  const bulletP = content.find((p) => isBullet(p, textOf(p)));

  // The first job: the first paragraphs before a bullet in the experience section.
  const jobs =
    sections.find((s) => EXPERIENCE.test(s.title)) ??
    sections.find((s) => s.paragraphs.slice(1).some((p) => isBullet(p, textOf(p))));
  const jobLines = (jobs?.paragraphs.slice(1) ?? []).filter((p) => !isBullet(p, textOf(p)));
  const titleP = jobLines[0];
  const firstBulletInJobs = jobs?.paragraphs.findIndex((p, i) => i > 0 && isBullet(p, textOf(p)));
  const metaP =
    jobLines[1] && jobs && jobs.paragraphs.indexOf(jobLines[1]) < (firstBulletInJobs ?? -1)
      ? jobLines[1]
      : undefined;
  const bodyP =
    sections
      .filter((s) => s !== jobs)
      .flatMap((s) => s.paragraphs.slice(1))
      .find((p) => !isBullet(p, textOf(p))) ?? metaP;

  if (!headingP) {
    warnings.unshift(
      'No section headings found, like “Experience” or “Berufserfahrung”. Put each heading in its own line, not in a table or text box.',
    );
  } else if (!bulletP) {
    warnings.push('No bullet points found, so bullets start with “•” in your normal text style.');
  }

  const headingTexts = sections.map((s) => s.title).filter((t) => /\p{L}/u.test(t));
  return {
    report: { usable: !!headingP, sections: sections.map((s) => s.title), warnings },
    top,
    sectPr,
    heading: headingP ? prototype(headingP) : null,
    title: titleP ? prototype(titleP) : null,
    meta: metaP ? prototype(metaP) : null,
    bullet: bulletP ? prototype(bulletP, true) : null,
    body: bodyP ? prototype(bodyP) : null,
    upperCaseHeadings: headingTexts.length > 0 && headingTexts.every((t) => t === t.toUpperCase()),
    topTexts: top
      .map((el, index) => ({ index, text: isParagraph(el) ? textOf(el).trim() : '' }))
      .filter((t) => t.text),
  };
}

// ---- writing the XML ----------------------------------------------------------------------

const escapeXml = (text: string) =>
  text
    // Nothing invisible, and only characters XML allows.
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Adds or removes bold or italics in a run's formatting, in the order Word expects. */
function withStyle(rPr: string, bold: boolean | null, italic: boolean | null): string {
  let inner = rPr.replace(/^<w:rPr>|<\/w:rPr>$/g, '');
  const set = (on: boolean | null, tags: string[]) => {
    if (on === null) return '';
    for (const t of tags) inner = inner.replace(new RegExp(`<w:${t}(?:\\s[^>]*)?/>`, 'g'), '');
    return on ? tags.map((t) => `<w:${t}/>`).join('') : '';
  };
  const add = set(bold, ['b', 'bCs']) + set(italic, ['i', 'iCs']);
  // rStyle and rFonts come first in a run's formatting; bold and italics right after.
  const lead = /^(?:<w:rStyle[^>]*\/>)?(?:<w:rFonts[^>]*\/>)?/.exec(inner)?.[0] ?? '';
  inner = lead + add + inner.slice(lead.length);
  return inner ? `<w:rPr>${inner}</w:rPr>` : '';
}

const run = (rPr: string, text: string) =>
  `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;

/** Runs for one line of Markdown: **bold**, *italics* and [links](…) become plain styled text. */
function runs(rPr: string, text: string): string {
  const inline = /\*\*(.+?)\*\*|__(.+?)__|(?<![\w*])\*(?!\s)(.+?)\*(?!\w)|\[([^\]]+)\]\([^)\s]+\)/g;
  let out = '';
  let last = 0;
  for (const m of text.matchAll(inline)) {
    if (m.index > last) out += run(rPr, text.slice(last, m.index));
    const [, bold1, bold2, italic, label] = m;
    if (bold1 ?? bold2) out += run(withStyle(rPr, true, null), bold1 ?? bold2 ?? '');
    else if (italic) out += run(withStyle(rPr, null, true), italic);
    else out += run(rPr, label ?? '');
    last = m.index + m[0].length;
  }
  if (last < text.length) out += run(rPr, text.slice(last));
  return out;
}

const paragraph = (proto: Prototype, content: string) => `<w:p>${proto.pPr}${content}</w:p>`;

const PLAIN: Prototype = { pPr: '', rPr: '', afterTabRPr: null, text: '', literalBullet: null };

/** The separator your file uses between job title and company. */
const separatorIn = (text: string) => SEPARATORS.find((s) => text.includes(s)) ?? ' | ';

function blockXml(a: Analysis, b: ResumeBlock): string {
  const body = a.body ?? PLAIN;
  const bullet = (text: string) =>
    a.bullet
      ? paragraph(
          a.bullet,
          runs(a.bullet.rPr, (a.bullet.literalBullet ? `${a.bullet.literalBullet} ` : '') + text),
        )
      : paragraph(body, runs(body.rPr, `• ${text}`));
  switch (b.kind) {
    case 'paragraph':
      return paragraph(body, runs(body.rPr, b.text));
    case 'bullets':
      return b.items.map(bullet).join('');
    case 'entry': {
      const title = a.title ?? body;
      const head = b.org ? `${b.title}${separatorIn(title.text)}${b.org}` : b.title;
      let xml: string;
      if (b.meta && title.afterTabRPr !== null) {
        // Your file puts the dates on the right of the title, after a tab.
        xml = paragraph(
          title,
          `${runs(title.rPr, head)}<w:r>${title.rPr}<w:tab/></w:r>${runs(title.afterTabRPr, b.meta)}`,
        );
      } else {
        xml = paragraph(title, runs(title.rPr, head));
        if (b.meta) xml += paragraph(a.meta ?? body, runs((a.meta ?? body).rPr, b.meta));
      }
      return (
        xml +
        b.lines.map((l) => paragraph(body, runs(body.rPr, l))).join('') +
        b.bullets.map(bullet).join('')
      );
    }
  }
}

function headingXml(a: Analysis, title: string): string {
  const h = a.heading ?? PLAIN;
  return paragraph(h, runs(h.rPr, a.upperCaseHeadings ? title.toLocaleUpperCase() : title));
}

/** One paragraph with new text in the formatting of its first run (for the headline). */
function retext(p: string, text: string): string {
  const pPr = first(p, 'w:pPr');
  const rPr = runsOf(p).find((r) => r.text.trim())?.rPr ?? '';
  const open = /^<w:p(?:\s[^>]*)?>/.exec(p)?.[0] ?? '<w:p>';
  return `${open}${pPr}${runs(rPr, text)}</w:p>`;
}

/** Words that make a line a job title: "Senior Frontend Engineer", "Entwickler". */
const ROLE =
  /developer|engineer|entwickler|designer|manager|analyst|consultant|berater|specialist|spezialist|architect|lead|ingenieur|scientist|administrator|programmer|programmierer|tester|owner|director|leiter|referent|sachbearbeiter|kaufm|assist|d[ée]veloppeu|desarrollador|sviluppatore|ontwikkelaar|desenvolvedor|programista/i;

/** The headline paragraph in your file's header, if there is one. */
function headlineIn(
  texts: { index: number; text: string }[],
  known: string[],
): { index: number; text: string } | undefined {
  const wanted = new Set(known.map(normal).filter(Boolean));
  const byProfile = texts.find((t) => wanted.has(normal(t.text)));
  if (byProfile) return byProfile;
  // The line right under your name, when it names a role and isn't a contact line.
  const second = texts[1];
  if (
    second &&
    second.text.length <= 80 &&
    ROLE.test(second.text) &&
    !/@|https?:|www\.|linkedin|github|\|\s|\d{4,}/i.test(second.text)
  ) {
    return second;
  }
  return undefined;
}

// ---- the file around the text ---------------------------------------------------------------

const xmlText = (s: string) => escapeXml(s).replace(/"/g, '&quot;');

/** Document properties that name only you: no old author, company, comments or keywords. */
function coreXml(props: DocxProps): string {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlText(props.title)}</dc:title><dc:creator>${xmlText(props.author)}</dc:creator><cp:lastModifiedBy>${xmlText(props.author)}</cp:lastModifiedBy><dc:language>${xmlText(props.language)}</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

/** Removes a part of the file, with its content type and the links to it. */
async function removePart(zip: JSZip, path: string, relsPath: string): Promise<void> {
  if (!zip.file(path)) return;
  zip.remove(path);
  const types = await zip.file('[Content_Types].xml')?.async('string');
  if (types) {
    zip.file(
      '[Content_Types].xml',
      types.replace(new RegExp(`<Override PartName="/${path}"[^>]*/>`), ''),
    );
  }
  const rels = await zip.file(relsPath)?.async('string');
  const target = relsPath.startsWith('word/') ? path.replace(/^word\//, '') : path;
  if (rels) {
    zip.file(
      relsPath,
      rels.replace(new RegExp(`<Relationship [^>]*Target="/?${target}"[^>]*/>`, 'g'), ''),
    );
  }
}

export interface DocxProps {
  title: string;
  author: string;
  language: string;
}

async function open(bytes: Buffer): Promise<{ zip: JSZip; xml: string }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new DocxTemplateError('This is not a Word (.docx) file');
  }
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new DocxTemplateError('This is not a Word (.docx) file');
  return { zip, xml };
}

/** What in your Word file can be used as a template. */
export async function analyseDocx(bytes: Buffer): Promise<DocxReport> {
  try {
    return analyse((await open(bytes)).xml).report;
  } catch (error) {
    if (error instanceof DocxTemplateError) {
      return { usable: false, sections: [], warnings: [error.message] };
    }
    throw error;
  }
}

/**
 * Your Word file with the tailored resume in it. When Claude wrote a new headline, it replaces
 * the one in your file, found by `knownHeadlines` (your profile headline) or because the line
 * under your name names a role.
 */
export async function fillDocx(
  bytes: Buffer,
  doc: ResumeDoc,
  props: DocxProps & { knownHeadlines?: string[] },
): Promise<Buffer> {
  const { zip, xml } = await open(bytes);
  const a = analyse(xml);
  if (!a.report.usable) throw new DocxTemplateError(a.report.warnings[0] ?? 'Not usable');

  const top = [...a.top];
  const headline = doc.headline?.trim();
  const at = headlineIn(a.topTexts, props.knownHeadlines ?? []);
  if (headline && at && at.text !== headline) top[at.index] = retext(top[at.index] ?? '', headline);

  const content = doc.sections
    .map(
      (s) => (s.title ? headingXml(a, s.title) : '') + s.blocks.map((b) => blockXml(a, b)).join(''),
    )
    .join('');
  const bodyStart = xml.indexOf('<w:body>') + '<w:body>'.length;
  const bodyEnd = xml.lastIndexOf('</w:body>');
  zip.file(
    'word/document.xml',
    xml.slice(0, bodyStart) + top.join('') + content + a.sectPr + xml.slice(bodyEnd),
  );

  // Clean properties: the title and your name, nothing left over from older versions.
  zip.file('docProps/core.xml', coreXml(props));
  const app = await zip.file('docProps/app.xml')?.async('string');
  if (app) {
    zip.file(
      'docProps/app.xml',
      app.replace(
        /<(Company|Manager|HyperlinkBase)>[^<]*<\/\1>|<(Company|Manager|HyperlinkBase)\/>/g,
        '',
      ),
    );
  }
  await removePart(zip, 'docProps/custom.xml', '_rels/.rels');
  // Comments on your old text would point at nothing.
  if (!/<w:comment(Reference|RangeStart)/.test(top.join(''))) {
    for (const part of [
      'word/comments.xml',
      'word/commentsExtended.xml',
      'word/commentsIds.xml',
      'word/commentsExtensible.xml',
      'word/people.xml',
    ]) {
      await removePart(zip, part, 'word/_rels/document.xml.rels');
    }
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
