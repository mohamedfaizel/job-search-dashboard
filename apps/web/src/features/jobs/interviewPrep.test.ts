import { findGap, listItems, parseGaps, parseQuestions, splitPrep } from './interviewPrep';

describe('splitPrep', () => {
  it('finds the six parts by their headings', () => {
    const parts = splitPrep(
      '## 1. What they care about\nA\n## 2. Tell me about yourself\nB\n## 3. Likely questions\nC\n## 4. My gaps\nD\n## 5. Questions for them\nE\n## 6. Research checklist\nF',
    );
    expect(parts.map((p) => [p.key, p.body])).toEqual([
      ['care', 'A'],
      ['about', 'B'],
      ['questions', 'C'],
      ['gaps', 'D'],
      ['ask', 'E'],
      ['research', 'F'],
    ]);
  });

  it('takes bold or plain headings, but not numbered questions', () => {
    const parts = splitPrep(
      '**1. What they care about**\nA\n2. Tell me about yourself\nB\n3. Likely questions\n4. Why do you want this job?\nC',
    );
    expect(parts.map((p) => p.key)).toEqual(['care', 'about', 'questions']);
    expect(parts[2]?.body).toContain('4. Why do you want this job?');
  });

  it('gives up on a reply with another shape', () => {
    expect(splitPrep('Some notes\n1. What they care about\nA')).toEqual([]);
  });
});

describe('parseQuestions', () => {
  it('reads question, why and a multi-line answer', () => {
    expect(
      parseQuestions(
        'Q1. **Why React?**\n**Why they ask:** fit\nAnswer: Because\n1. it is fast\nQ2. Next?\nAnswer: Yes',
      ),
    ).toEqual([
      { question: 'Why React?', why: 'fit', answer: 'Because\n1. it is fast' },
      { question: 'Next?', why: '', answer: 'Yes' },
    ]);
  });

  it('reads plain numbered questions too', () => {
    expect(parseQuestions('1. First?\nModel answer: A\n2. Second?').map((q) => q.question)).toEqual(
      ['First?', 'Second?'],
    );
  });
});

describe('parseGaps and findGap', () => {
  it('reads each gap and finds it by a chip word', () => {
    const gaps = parseGaps(
      'Gap: Svelte\nSay: honest\nLearn this week: tutorial\n- **Gap:** LLM apps\nSay: x',
    );
    expect(gaps).toEqual([
      { skill: 'Svelte', say: 'honest', learn: 'tutorial' },
      { skill: 'LLM apps', say: 'x', learn: '' },
    ]);
    expect(findGap(gaps, 'llm')).toBe(1);
    expect(findGap(gaps, 'go')).toBe(-1);
    expect(findGap([{ skill: 'Google Cloud', say: '', learn: '' }], 'go')).toBe(-1);
    expect(findGap([{ skill: 'C++', say: '', learn: '' }], 'c++')).toBe(0);
  });
});

describe('listItems', () => {
  it('reads list lines with or without tick boxes', () => {
    expect(listItems('Intro\n- [ ] One\n* Two\n3. Three')).toEqual(['One', 'Two', 'Three']);
  });
});
