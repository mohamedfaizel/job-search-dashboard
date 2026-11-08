import type { BuilderDoc } from '@jobsearch/data';
import { historyReducer, isLanguagesSection, move, presetTitle, startHistory } from './docOps';

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
