import { promptSections, replyParts, checkSections } from './reply';

describe('replyParts', () => {
  it('finds the parts between the marker lines', () => {
    const reply =
      '=== RESUME ===\n# Jane\n=== COVER LETTER ===\nDear team\n=== FORM ANSWERS ===\n\n=== CHECK ===\nok';
    expect(replyParts(reply)).toEqual({ resume: true, coverLetter: true, formAnswers: false });
  });

  it('reads markers in bold or as headings, as Claude sometimes writes them', () => {
    expect(replyParts('**=== RESUME ===**\nx\n## === COVER LETTER ===\ny')).toEqual({
      resume: true,
      coverLetter: true,
      formAnswers: false,
    });
  });

  it('treats text without markers as a plain resume, and empty text as nothing', () => {
    expect(replyParts('Jane Doe, React developer')).toEqual({
      resume: true,
      coverLetter: false,
      formAnswers: false,
    });
    expect(replyParts('  ')).toEqual({ resume: false, coverLetter: false, formAnswers: false });
  });
});

describe('promptSections', () => {
  it('cuts the prompt at its headings and keeps quoted text in one piece', () => {
    const prompt =
      'Please tailor my resume.\n\nSkills the job asks for:\n- GraphQL\n\nMy current resume:\n"""\nJane\n\nReact\n"""';
    expect(promptSections(prompt)).toEqual([
      { title: '', body: 'Please tailor my resume.' },
      { title: 'Skills the job asks for', body: '- GraphQL' },
      { title: 'My current resume', body: 'Jane\n\nReact' },
    ]);
  });
});

describe('checkSections', () => {
  it('keeps one section when Claude repeats a label', () => {
    expect(checkSections('- Ask me: your school.\n- Ask me: your start month.')).toEqual([
      { label: 'Ask me', items: ['your school.', 'your start month.'] },
    ]);
  });

  it('reads Claude’s CHECK part by label, one item per numbered point', () => {
    expect(
      checkSections(
        '- Placed: graphql (Replace)\n- Skipped: (none)\n- Stretches: (1) "Led": one of three. (2) React 19.\n- **Ask me**: Your school?\n  And the year?',
      ),
    ).toEqual([
      { label: 'Placed', items: ['graphql (Replace)'] },
      { label: 'Stretches', items: ['"Led": one of three.', 'React 19.'] },
      { label: 'Ask me', items: ['Your school?', 'And the year?'] },
    ]);
    expect(checkSections('')).toEqual([]);
  });
});
