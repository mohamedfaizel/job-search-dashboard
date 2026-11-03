import { splitList } from './split-list';

describe('splitList', () => {
  it('splits on commas and drops blanks', () => {
    expect(splitList(' react, node.js ,, ')).toEqual(['react', 'node.js']);
  });
});
