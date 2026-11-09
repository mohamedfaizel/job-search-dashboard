import type { BuilderDoc } from '@jobsearch/data';
import {
  bulletsToSkillRows,
  historyReducer,
  isLanguagesSection,
  lineDiff,
  move,
  presetTitle,
  skillBullets,
  startHistory,
} from './docOps';

const doc = (name: string): BuilderDoc => ({ name, headline: '', contact: [], sections: [] });

describe('builder edits', () => {
  it('moves an item to another place', () => {
    expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(move(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(move(['a'], 0, 3)).toEqual(['a']);
  });

  it('makes quick typing in one field a single Undo step', () => {
    let state = startHistory(doc(''));
    state = historyReducer(state, { type: 'change', doc: doc('A'), field: 'name', at: 1000 });
    state = historyReducer(state, { type: 'change', doc: doc('Ad'), field: 'name', at: 1200 });
    state = historyReducer(state, { type: 'change', doc: doc('Ada'), field: 'name', at: 1400 });
    // A pause starts a new step.
    state = historyReducer(state, { type: 'change', doc: doc('Ada L'), field: 'name', at: 5000 });
    expect(state.past.map((d) => d.name)).toEqual(['', 'Ada']);

    state = historyReducer(state, { type: 'undo' });
    expect(state.present.name).toBe('Ada');
    state = historyReducer(state, { type: 'redo' });
    expect(state.present.name).toBe('Ada L');
  });

  it('titles new sections in the resume language and knows the Languages section', () => {
    expect(presetTitle('experience', 'de')).toBe('Berufserfahrung');
    expect(presetTitle('experience', 'fr')).toBe('Experience');
    expect(isLanguagesSection(' Sprachen ')).toBe(true);
  });
});

describe('lineDiff', () => {
  it('marks what was removed and added, and keeps the lines that stayed', () => {
    expect(lineDiff('## Skills\n- React\n- Redux', '## Skills\n- React\n- TypeScript')).toEqual([
      { kind: 'same', text: '## Skills' },
      { kind: 'same', text: '- React' },
      { kind: 'removed', text: '- Redux' },
      { kind: 'added', text: '- TypeScript' },
    ]);
  });

  it('shows a new line in the middle and ignores blank lines', () => {
    expect(lineDiff('a\n\nc', 'a\nb\n\nc')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'added', text: 'b' },
      { kind: 'same', text: 'c' },
    ]);
  });

  it('is all removed and all added for unrelated texts', () => {
    expect(lineDiff('x', 'y').map((l) => l.kind)).toEqual(['removed', 'added']);
  });
});

describe('skills rows from bullets', () => {
  const blocks = [
    {
      id: 'b',
      kind: 'bullets' as const,
      items: ['**Frontend**: React, Vue 3', 'Testing: Jest, Vitest', 'Fast learner'],
    },
    { id: 'p', kind: 'paragraph' as const, text: 'Languages: TypeScript' },
  ];

  it('counts the bullets that read "Label: list"', () => {
    expect(skillBullets(blocks)).toBe(2);
    expect(skillBullets([blocks[1]!])).toBe(0);
  });

  it('turns them into rows without ** marks and keeps the other bullets', () => {
    const rows = bulletsToSkillRows(blocks);
    expect(rows.map((b) => (b.kind === 'paragraph' ? b.text : b.kind))).toEqual([
      'Frontend: React, Vue 3',
      'Testing: Jest, Vitest',
      'bullets',
      'Languages: TypeScript',
    ]);
    expect(rows[2]).toMatchObject({ id: 'b', items: ['Fast learner'] });
    expect(bulletsToSkillRows([blocks[1]!])).toEqual([blocks[1]]);
  });
});
