import type { SavedAnswer } from '@jobsearch/data';
import {
  effectiveAnswer,
  followUpPrompt,
  matchSaved,
  parseAnswers,
  progress,
  stretchLine,
} from './claudeAnswers';

const saved = (id: number, question: string, answer: string): SavedAnswer => ({
  id,
  question,
  answer,
  updatedAt: '2026-11-05T12:00:00.000Z',
});
const bank = [
  saved(1, 'Salary per year?', '65.000 € gross'),
  saved(2, 'Real experience with WCAG?', 'Yes: audits at Airbus (2021-22)'),
];

describe('parseAnswers', () => {
  it('reads saved decisions and ignores anything that is not an object', () => {
    expect(parseAnswers('{"a":{"choice":"keep"}}')).toEqual({ a: { choice: 'keep' } });
    expect(parseAnswers('')).toEqual({});
    expect(parseAnswers('[1]')).toEqual({});
    expect(parseAnswers('null')).toEqual({});
  });
});

describe('matchSaved', () => {
  it('finds your earlier answer when Claude words the question differently', () => {
    expect(matchSaved('Is 65.000 € gross per year right? Claude assumed yes.', bank)?.id).toBe(1);
    expect(matchSaved('What is your salary per year?', bank)?.answer).toBe('65.000 € gross');
    expect(matchSaved('Do you have real experience with WCAG? Where?', bank)?.id).toBe(2);
  });

  it('gives nothing for a different question, an empty bank or only filler words', () => {
    expect(matchSaved('Which year did you finish school?', bank)).toBeNull();
    expect(matchSaved('Salary per year?', [])).toBeNull();
    expect(matchSaved('Is it?', bank)).toBeNull();
  });
});

describe('effectiveAnswer', () => {
  it('prefers your own answer, even an empty one, over the saved one', () => {
    expect(effectiveAnswer('Salary per year?', { answer: '70k' }, bank, true)).toEqual({
      answer: '70k',
      saved: false,
    });
    expect(effectiveAnswer('Salary per year?', { answer: '' }, bank, true)).toEqual({
      answer: '',
      saved: false,
    });
  });

  it('fills in a saved answer only when filling in is on', () => {
    expect(effectiveAnswer('Salary per year?', undefined, bank, true)).toEqual({
      answer: '65.000 € gross',
      saved: true,
    });
    expect(effectiveAnswer('Salary per year?', undefined, bank, false)).toEqual({
      answer: '',
      saved: false,
    });
  });
});

const sections = {
  stretches: ['Led the team', 'React 19', 'Ran a 2020 startup'],
  questions: ['Salary per year?', 'Which year did you finish school?'],
};

describe('followUpPrompt', () => {
  it('lists your decisions and answers, and asks for the whole reply again', () => {
    const prompt = followUpPrompt(
      sections,
      {
        'Led the team': { choice: 'keep' },
        'React 19': { choice: 'soften', text: 'React 19 (side project)' },
        'Ran a 2020 startup': { choice: 'drop' },
        'Which year did you finish school?': { answer: ' 2012 ' },
      },
      bank,
      true,
    );
    expect(prompt).toContain('- Keep: Led the team');
    expect(prompt).toContain(
      '- Soften: React 19\n  Write it like this instead: React 19 (side project)',
    );
    expect(prompt).toContain('- Drop: Ran a 2020 startup');
    expect(prompt).toContain('- Salary per year?\n  65.000 € gross');
    expect(prompt).toContain('- Which year did you finish school?\n  2012');
    expect(prompt).toContain('send the whole reply again');
  });

  it('leaves out undecided lines and unanswered questions', () => {
    const prompt = followUpPrompt(sections, {}, [], true);
    expect(prompt).not.toContain('stretches');
    expect(prompt).not.toContain('Your questions');
  });

  it('asks Claude for the softer words when you chose Soften without writing them', () => {
    const prompt = followUpPrompt(
      sections,
      { 'React 19': { choice: 'soften', text: ' ' } },
      [],
      true,
    );
    expect(prompt).toContain('- Soften: React 19\n  Make it more modest');
  });
});

describe('stretchLine', () => {
  const resume = '## Experience\n- **Led the team** of three on the checkout\n- Built dashboards';
  it('finds the resume line holding the words Claude quoted', () => {
    expect(stretchLine('"Led the team": you were one of three.', resume)).toBe(
      'Led the team of three on the checkout',
    );
  });
  it('gives the quoted words, or nothing, when no line holds them', () => {
    expect(stretchLine('Is “six banks” right?', resume)).toBe('six banks');
    expect(stretchLine('React 19: only in a side project.', resume)).toBe('');
  });
});

describe('progress', () => {
  it('counts decisions and answers, and which answers were filled in', () => {
    expect(progress(sections, {}, bank, true)).toEqual({ answered: 1, filled: 1 });
    expect(
      progress(
        sections,
        { 'Led the team': { choice: 'keep' }, 'Salary per year?': { answer: '' } },
        bank,
        true,
      ),
    ).toEqual({ answered: 1, filled: 0 });
    expect(progress(sections, {}, bank, false)).toEqual({ answered: 0, filled: 0 });
  });
});
