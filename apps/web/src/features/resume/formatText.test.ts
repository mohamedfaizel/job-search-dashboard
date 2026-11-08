import { addLink, clearMarks, toggleMark } from './formatText';

const sel = (value: string, text: string) => {
  const start = value.indexOf(text);
  return { value, start, end: start + text.length };
};

describe('formatText', () => {
  it('puts bold around the selection and takes it off again', () => {
    const bold = toggleMark(sel('Frontend: React', 'Frontend'), '**');
    expect(bold.value).toBe('**Frontend**: React');
    expect(bold.value.slice(bold.start, bold.end)).toBe('Frontend');
    // Selecting the text inside the stars, or including them, both unbold it.
    expect(toggleMark(bold, '**').value).toBe('Frontend: React');
    expect(toggleMark(sel('**Frontend**: React', '**Frontend**'), '**').value).toBe(
      'Frontend: React',
    );
  });

  it('puts the marks around the cursor when nothing is selected', () => {
    const edit = toggleMark({ value: 'ab', start: 1, end: 1 }, '*');
    expect(edit).toEqual({ value: 'a**b', start: 2, end: 2 });
  });

  it('does not treat bold as italic', () => {
    const italic = toggleMark(sel('**Frontend**', 'Frontend'), '*');
    expect(italic.value).toBe('***Frontend***');
    expect(toggleMark(sel('*Vue*', 'Vue'), '*').value).toBe('Vue');
    expect(toggleMark(sel('*Vue*', '*Vue*'), '*').value).toBe('Vue');
  });

  it('makes a link, adding https:// when it is missing', () => {
    expect(addLink(sel('See my site', 'my site'), 'example.com').value).toBe(
      'See [my site](https://example.com)',
    );
    expect(addLink({ value: '', start: 0, end: 0 }, 'https://example.com').value).toBe(
      '[example.com](https://example.com)',
    );
  });

  it('clears all the marks of the field', () => {
    const value = '**Bold** and *italic* and [link](https://x.com) and __more__';
    expect(clearMarks({ value, start: 0, end: 4 }).value).toBe('Bold and italic and link and more');
  });
});
