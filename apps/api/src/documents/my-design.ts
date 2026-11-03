/**
 * "My design": the look of your own resume, kept as a few safe settings and typeset in LaTeX
 * like the built-in templates. Claude reads your resume file (you attach it in Claude) and
 * answers with these settings as JSON; we never take LaTeX from the reply, only these values,
 * so nothing in a reply can run as LaTeX code.
 */
export interface MyDesign {
  /** sans (like Arial/Calibri), serif (like Times/Garamond) or latin (Computer Modern). */
  font: 'sans' | 'serif' | 'latin';
  /** The main colour, six hex digits. */
  accent: string;
  nameSize: 'normal' | 'large' | 'huge';
  nameStyle: 'bold' | 'caps' | 'smallcaps' | 'plain';
  nameColour: 'accent' | 'black';
  align: 'left' | 'centre';
  /** How section headings look: a line under, a bar before, or just the words. */
  headingStyle: 'rule' | 'bar' | 'plain';
  headingCase: 'normal' | 'upper';
  headingColour: 'accent' | 'black';
  /** Where a job's dates sit: on the right of its title line, or on the line below. */
  dates: 'right' | 'below';
  /** The company name on the first line of a job, the job title under it. */
  companyFirst: boolean;
  density: 'normal' | 'compact';
  /** Skills come before work experience. */
  skillsFirst: boolean;
  /** Your resume has a photo. */
  photo: boolean;
  /** Your resume uses two columns (we always make one, so ATS reads it in order). */
  twoColumns: boolean;
}

export const DEFAULT_DESIGN: MyDesign = {
  font: 'sans',
  accent: '1F4E79',
  nameSize: 'large',
  nameStyle: 'bold',
  nameColour: 'accent',
  align: 'left',
  headingStyle: 'rule',
  headingCase: 'normal',
  headingColour: 'accent',
  dates: 'below',
  companyFirst: false,
  density: 'normal',
  skillsFirst: false,
  photo: false,
  twoColumns: false,
};

/** The allowed values of each setting, for the prompt and for checking the reply. */
const CHOICES: { [K in keyof MyDesign]: readonly MyDesign[K][] | 'hex' | 'boolean' } = {
  font: ['sans', 'serif', 'latin'],
  accent: 'hex',
  nameSize: ['normal', 'large', 'huge'],
  nameStyle: ['bold', 'caps', 'smallcaps', 'plain'],
  nameColour: ['accent', 'black'],
  align: ['left', 'centre'],
  headingStyle: ['rule', 'bar', 'plain'],
  headingCase: ['normal', 'upper'],
  headingColour: ['accent', 'black'],
  dates: ['right', 'below'],
  companyFirst: 'boolean',
  density: ['normal', 'compact'],
  skillsFirst: 'boolean',
  photo: 'boolean',
  twoColumns: 'boolean',
};

/** The model for the prompt: every setting with its allowed values. */
function schemaLines(): string {
  return Object.entries(CHOICES)
    .map(([key, allowed]) => {
      const values =
        allowed === 'hex'
          ? '"RRGGBB" (six hex digits of the main colour, e.g. "1F4E79"; "222222" when it is black and white)'
          : allowed === 'boolean'
            ? 'true or false'
            : allowed.map((v) => `"${v}"`).join(' | ');
      return `  "${key}": ${values}`;
    })
    .join(',\n');
}

/**
 * The prompt you paste into Claude with your resume file attached. Its reply is one JSON object
 * with the settings above.
 */
export function buildDesignPrompt(): string {
  return `I attached my resume. Please look only at its design (not its words) and describe it with the settings below, so my job tracker can rebuild the same look as a clean, one-column, ATS-friendly template.

What each setting means:
- font: sans for Arial, Calibri, Helvetica, Lato and similar; serif for Times, Garamond, Cambria, Georgia and similar; latin for the classic LaTeX / Computer Modern look.
- accent: the main colour of the name, headings or lines.
- nameSize: how big my name is compared with the text (normal, large, huge).
- nameStyle: bold, caps (ALL CAPITALS), smallcaps, or plain.
- align: is the header (name and contact) on the left or centred?
- headingStyle: rule (a line under or over the heading), bar (a coloured block or bar before it), or plain.
- headingCase: upper when headings are in CAPITALS, else normal.
- dates: right when a job's dates are on the right of its title line, below when they are on their own line.
- companyFirst: true when the company name comes before the job title.
- density: compact when the type is small and tight, else normal.
- skillsFirst: true when the skills section comes before work experience.
- photo: true when there is a photo.
- twoColumns: true when the page has a sidebar or two columns.

Reply with only this JSON, nothing before or after it:
{
${schemaLines()}
}`;
}

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  // "center" is how Americans spell it.
  const normal = v === 'center' ? 'centre' : v;
  return (allowed as readonly string[]).includes(normal) ? (normal as T) : fallback;
};

const flag = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean'
    ? value
    : value === 'true'
      ? true
      : value === 'false'
        ? false
        : fallback;

const hex = (value: unknown, fallback: string): string => {
  const v = typeof value === 'string' ? value.replace(/^#/, '').toUpperCase() : '';
  return /^[0-9A-F]{6}$/.test(v) ? v : fallback;
};

/** Thrown when a reply has no JSON object in it. */
export class DesignReplyError extends Error {}

/**
 * Reads Claude's reply (JSON, maybe inside a ```json fence or with words around it) into a
 * design. Unknown keys are ignored and a bad or missing value takes the default, so a reply
 * never breaks the template.
 */
export function parseDesign(reply: string): MyDesign {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start < 0 || end <= start) throw new DesignReplyError('No JSON object in the reply');
  let raw: unknown;
  try {
    raw = JSON.parse(reply.slice(start, end + 1));
  } catch {
    throw new DesignReplyError('The JSON in the reply could not be read');
  }
  if (!raw || typeof raw !== 'object') throw new DesignReplyError('The reply is not an object');
  return toDesign(raw as Record<string, unknown>);
}

/** A stored design (JSON column) as a design, with defaults for anything missing or wrong. */
export function toDesign(raw: Record<string, unknown> | null | undefined): MyDesign {
  const r = raw ?? {};
  const d = DEFAULT_DESIGN;
  return {
    font: pick(r.font, ['sans', 'serif', 'latin'], d.font),
    accent: hex(r.accent, d.accent),
    nameSize: pick(r.nameSize, ['normal', 'large', 'huge'], d.nameSize),
    nameStyle: pick(r.nameStyle, ['bold', 'caps', 'smallcaps', 'plain'], d.nameStyle),
    nameColour: pick(r.nameColour, ['accent', 'black'], d.nameColour),
    align: pick(r.align, ['left', 'centre'], d.align),
    headingStyle: pick(r.headingStyle, ['rule', 'bar', 'plain'], d.headingStyle),
    headingCase: pick(r.headingCase, ['normal', 'upper'], d.headingCase),
    headingColour: pick(r.headingColour, ['accent', 'black'], d.headingColour),
    dates: pick(r.dates, ['right', 'below'], d.dates),
    companyFirst: flag(r.companyFirst, d.companyFirst),
    density: pick(r.density, ['normal', 'compact'], d.density),
    skillsFirst: flag(r.skillsFirst, d.skillsFirst),
    photo: flag(r.photo, d.photo),
    twoColumns: flag(r.twoColumns, d.twoColumns),
  };
}
