import type { BuilderBlock, BuilderDoc, BuilderProject, BuilderSection } from '@jobsearch/data';

/**
 * Small, pure edits to a resume in the builder. Each returns a new doc, so the page can keep
 * the old one for Undo.
 */

/** A contact "item" that starts a new line in the PDF's header (the API's CONTACT_BREAK). */
export const CONTACT_BREAK = '\n';

export const newId = () => Math.random().toString(36).slice(2, 10);

/** Moves the item at `from` to `to` (both indexes in the list before the move). */
export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

export function replaceAt<T>(list: T[], index: number, item: T): T[] {
  return list.map((current, i) => (i === index ? item : current));
}

export function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

export function insertAt<T>(list: T[], index: number, item: T): T[] {
  return [...list.slice(0, index), item, ...list.slice(index)];
}

export function updateSection(
  doc: BuilderDoc,
  id: string,
  change: (section: BuilderSection) => BuilderSection,
): BuilderDoc {
  return { ...doc, sections: doc.sections.map((s) => (s.id === id ? change(s) : s)) };
}

/** A copy with new ids, so both can be edited, moved and deleted on their own. */
export function copySection(section: BuilderSection, title: string): BuilderSection {
  return {
    ...section,
    id: newId(),
    title,
    blocks: section.blocks.map(copyBlock),
  };
}

/** A copy of a block (a company, say) with new ids, to start the next one from it. */
export function copyBlock(block: BuilderBlock): BuilderBlock {
  if (block.kind !== 'entry') return { ...block, id: newId() };
  return {
    ...block,
    id: newId(),
    projects: (block.projects ?? []).map((p) => ({ ...p, id: newId() })),
  };
}

export const newProject = (): BuilderProject => ({
  id: newId(),
  name: '',
  tech: '',
  bullets: [''],
});

export function newBlock(kind: BuilderBlock['kind']): BuilderBlock {
  if (kind === 'paragraph') return { id: newId(), kind, text: '' };
  if (kind === 'bullets') return { id: newId(), kind, items: [''] };
  return {
    id: newId(),
    kind,
    title: '',
    org: '',
    meta: '',
    bullets: [''],
    lines: [],
    projects: [],
  };
}

/** What a new section of a kind starts with: a job list gets an empty job, and so on. */
export type SectionPreset =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certificates'
  | 'volunteering'
  | 'custom';

export const SECTION_PRESETS: SectionPreset[] = [
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certificates',
  'volunteering',
  'custom',
];

const PRESET_BLOCK: Record<SectionPreset, BuilderBlock['kind']> = {
  summary: 'paragraph',
  experience: 'entry',
  education: 'entry',
  skills: 'bullets',
  projects: 'entry',
  certificates: 'bullets',
  volunteering: 'entry',
  custom: 'bullets',
};

export function newSection(preset: SectionPreset, title: string): BuilderSection {
  return { id: newId(), title, hidden: false, blocks: [newBlock(PRESET_BLOCK[preset])] };
}

const LANGUAGE_TITLES =
  /^(languages?|language skills|sprachen|sprachkenntnisse|langues|idiomas|lingue|talen|języki|línguas)$/i;

/**
 * The Languages section always lists the languages on My profile with your real levels (the
 * API fills it in on every save), so the builder shows it locked. Same list as the API's
 * builder-doc.ts.
 */
export const isLanguagesSection = (title: string) => LANGUAGE_TITLES.test(title.trim());

/** All the words of a resume, as the job match reads them (hidden sections are not in the PDF). */
export function docText(doc: BuilderDoc): string {
  const parts = [doc.name, doc.headline, ...doc.contact];
  for (const section of doc.sections) {
    if (section.hidden) continue;
    parts.push(section.title);
    for (const block of section.blocks) {
      if (block.kind === 'paragraph') parts.push(block.text);
      else if (block.kind === 'bullets') parts.push(...block.items);
      else {
        parts.push(block.title, block.org, block.meta, ...block.lines, ...block.bullets);
        for (const project of block.projects ?? []) {
          parts.push(project.name, project.tech, ...project.bullets);
        }
      }
    }
  }
  return parts.join('\n');
}

/** The term appears as a word of its own ("go" is not in "google"); case does not matter. */
export function mentions(text: string, term: string): boolean {
  const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(text);
}

const SKILLS_TITLE =
  /^(skills|core skills|key skills|technical skills|core competencies|competencies|kenntnisse|fähigkeiten|kompetenzen|fachkenntnisse|skills (&|und) kompetenzen)$/i;

const EXPERIENCE_TITLE =
  /^(experience|work experience|professional experience|berufserfahrung|erfahrung|beruflicher werdegang)$/i;

/** True for the work history, where a new entry is "the next company". */
export const isExperienceSection = (title: string) => EXPERIENCE_TITLE.test(title.trim());

/** True for a Skills section by its title, in the languages the app supports. */
export const isSkillsSection = (title: string) => SKILLS_TITLE.test(title.trim());

/** "Frontend: React, Vue" or "**Frontend**: React" → label and list; no label gives all as list. */
export function splitSkill(text: string): { label: string; list: string } {
  const match = /^\s*(?:\*\*)?([^:*]{1,40}?)(?:\*\*)?\s*:(?:\*\*)?\s+(.+)$/.exec(text);
  return match
    ? { label: (match[1] ?? '').trim(), list: match[2] ?? '' }
    : { label: '', list: text };
}

/** Back to one line of text: "Label: list", or just the list when there is no label. */
export const joinSkill = (label: string, list: string) =>
  label.trim() ? `${label.trim()}: ${list}` : list;

/**
 * Adds a skill you have to the Skills section: as a new line in its first list, or in a new
 * Skills section when there is none. `title` names the new section.
 */
export function addSkill(doc: BuilderDoc, term: string, title: string): BuilderDoc {
  const at = doc.sections.findIndex((s) => SKILLS_TITLE.test(s.title.trim()));
  if (at < 0) {
    const section = newSection('skills', title);
    const block = section.blocks[0];
    if (block?.kind === 'bullets') block.items = [term];
    return { ...doc, sections: [...doc.sections, section] };
  }
  return updateSection(doc, doc.sections[at]?.id ?? '', (section) => {
    const list = section.blocks.findIndex((b) => b.kind === 'bullets');
    if (list < 0) return { ...section, blocks: [...section.blocks, newBlock('bullets')] };
    return {
      ...section,
      blocks: section.blocks.map((b, i) =>
        i === list && b.kind === 'bullets'
          ? { ...b, items: [...b.items.filter((item) => item.trim()), term] }
          : b,
      ),
    };
  });
}

/**
 * Adds a true line (from your achievements) as a bullet of your latest job: the first job or
 * project in the resume. Without one it goes into the first list of bullets.
 */
export function addBullet(doc: BuilderDoc, text: string): BuilderDoc {
  for (const section of doc.sections) {
    const entry = section.blocks.find((b) => b.kind === 'entry');
    if (entry?.kind === 'entry') {
      return updateSection(doc, section.id, (s) => ({
        ...s,
        blocks: s.blocks.map((b) =>
          b.id === entry.id && b.kind === 'entry'
            ? { ...b, bullets: [...b.bullets.filter((x) => x.trim()), text] }
            : b,
        ),
      }));
    }
  }
  for (const section of doc.sections) {
    const list = section.blocks.find((b) => b.kind === 'bullets');
    if (list?.kind === 'bullets' && !isLanguagesSection(section.title)) {
      return updateSection(doc, section.id, (s) => ({
        ...s,
        blocks: s.blocks.map((b) =>
          b.id === list.id && b.kind === 'bullets'
            ? { ...b, items: [...b.items.filter((x) => x.trim()), text] }
            : b,
        ),
      }));
    }
  }
  return doc;
}

/** True when this job's section differs from the master's section with the same id. */
export function sectionChanged(section: BuilderSection, master: BuilderDoc): boolean {
  const same = master.sections.find((s) => s.id === section.id);
  return !same || JSON.stringify(same) !== JSON.stringify(section);
}

/** Your achievements bank as lines: one fact per line, without list marks. */
export function achievementLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);
}

/** Undo history: the doc as it is, the ones before it, and the ones you undid. */
export interface History {
  past: BuilderDoc[];
  present: BuilderDoc;
  future: BuilderDoc[];
  /** When the last change was recorded; quick typing in one field is one Undo step. */
  at: number;
  /** The field the last change was in. */
  field: string | null;
}

const MAX_UNDO = 100;
/** Changes in the same field closer together than this are one Undo step. */
const TYPING_PAUSE_MS = 800;

export type HistoryAction =
  | { type: 'change'; doc: BuilderDoc; field: string | null; at: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; doc: BuilderDoc };

export function startHistory(doc: BuilderDoc): History {
  return { past: [], present: doc, future: [], at: 0, field: null };
}

export function historyReducer(state: History, action: HistoryAction): History {
  switch (action.type) {
    case 'change': {
      const sameTyping =
        action.field !== null &&
        action.field === state.field &&
        action.at - state.at < TYPING_PAUSE_MS;
      return {
        past: sameTyping ? state.past : [...state.past, state.present].slice(-MAX_UNDO),
        present: action.doc,
        future: [],
        at: action.at,
        field: action.field,
      };
    }
    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        at: 0,
        field: null,
      };
    }
    case 'redo': {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
        at: 0,
        field: null,
      };
    }
    case 'reset':
      // A resume read again: Undo brings the one before back.
      return {
        past: [...state.past, state.present].slice(-MAX_UNDO),
        present: action.doc,
        future: [],
        at: 0,
        field: null,
      };
  }
}

/** A new section's title, in the resume's own language (not the screen's). */
const PRESET_TITLES: Record<string, Record<SectionPreset, string>> = {
  en: {
    summary: 'Summary',
    experience: 'Experience',
    education: 'Education',
    skills: 'Skills',
    projects: 'Projects',
    certificates: 'Certificates',
    volunteering: 'Volunteering',
    custom: 'New section',
  },
  de: {
    summary: 'Profil',
    experience: 'Berufserfahrung',
    education: 'Ausbildung',
    skills: 'Kenntnisse',
    projects: 'Projekte',
    certificates: 'Zertifikate',
    volunteering: 'Ehrenamt',
    custom: 'Neuer Abschnitt',
  },
};

export function presetTitle(preset: SectionPreset, language: string): string {
  return (PRESET_TITLES[language] ?? PRESET_TITLES['en'])?.[preset] ?? preset;
}

export interface DiffLine {
  kind: 'same' | 'removed' | 'added';
  text: string;
}

/**
 * The lines of a section before and after, in one list: lines in both are `same`, the rest were
 * `removed` or are `added`. A plain longest-common-subsequence, enough for a section's size.
 */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  // lengths[i][j] = longest common run of a[i..] and b[j..]
  const lengths = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  const at = (i: number, j: number) => lengths[i]?.[j] ?? 0;
  for (let i = a.length - 1; i >= 0; i--) {
    const row = lengths[i] ?? [];
    for (let j = b.length - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] ?? '' });
      i++;
      j++;
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      out.push({ kind: 'removed', text: a[i++] ?? '' });
    } else {
      out.push({ kind: 'added', text: b[j++] ?? '' });
    }
  }
  while (i < a.length) out.push({ kind: 'removed', text: a[i++] ?? '' });
  while (j < b.length) out.push({ kind: 'added', text: b[j++] ?? '' });
  return out.filter((line) => line.kind !== 'same' || line.text.trim() !== '');
}
