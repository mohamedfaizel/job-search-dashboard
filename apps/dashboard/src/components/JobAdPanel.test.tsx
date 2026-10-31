import { render, screen } from '@testing-library/react';
import { highlight } from './JobAdPanel';

describe('highlight', () => {
  const terms = [
    { term: 'react', inResume: true, relatedTo: null },
    { term: 'java', inResume: false, relatedTo: null },
  ];

  it('marks whole words: green for what you have, red for what you miss', () => {
    render(<p>{highlight('React and Java, but not JavaScript.', terms, true)}</p>);

    const marks = screen.getAllByTitle(/resume/);
    expect(marks.map((m) => [m.textContent, m.title])).toEqual([
      ['React', 'In your resume'],
      ['Java', 'Missing from your resume'],
    ]);
  });

  it('counts everything as missing without a resume', () => {
    render(<p>{highlight('React', terms, false)}</p>);
    expect(screen.getByTitle('Missing from your resume')).toHaveTextContent('React');
  });
});
