import type { BuilderBlock, BuilderDoc, BuilderSection } from '@jobsearch/data';

/**
 * Small, pure edits to a resume in the builder. Each returns a new doc, so the page can keep
 * the old one for Undo.
 */

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
    blocks: section.blocks.map((b) => ({ ...b, id: newId() })),
  };
}

export function newBlock(kind: BuilderBlock['kind']): BuilderBlock {
  if (kind === 'paragraph') return { id: newId(), kind, text: '' };
  if (kind === 'bullets') return { id: newId(), kind, items: [''] };
  return { id: newId(), kind, title: '', org: '', meta: '', bullets: [''], lines: [] };
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
