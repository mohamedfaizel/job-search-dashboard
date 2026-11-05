import { deleteLine, insertLine, lineLike, readLine, replaceLine, rewordLine } from './replyEdit';

describe('replyEdit', () => {
  it('reads each Markdown line as name, section, entry, bullet or text', () => {
    expect(readLine('# Ada Lovelace')).toEqual({ kind: 'name', text: 'Ada Lovelace' });
    expect(readLine('## Experience')).toEqual({ kind: 'section', text: 'Experience' });
    expect(readLine('**BERUFSERFAHRUNG**')).toEqual({ kind: 'section', text: 'BERUFSERFAHRUNG' });
    expect(readLine('### Engineer | Acme')).toEqual({ kind: 'entry', text: 'Engineer | Acme' });
    expect(readLine('- Built things')).toEqual({ kind: 'bullet', text: 'Built things' });
    expect(readLine('Berlin | ada@x.de')).toEqual({ kind: 'text', text: 'Berlin | ada@x.de' });
    expect(readLine('  ')).toEqual({ kind: 'blank', text: '' });
  });

  it('keeps the Markdown marks when the words change', () => {
    expect(rewordLine('## Skills', 'Tools')).toBe('## Tools');
    expect(rewordLine('- Old', 'New\nAnother')).toBe('- New\n- Another');
    expect(rewordLine('**SKILLS**', 'TOOLS')).toBe('**TOOLS**');
    expect(rewordLine('Plain', ' Changed ')).toBe('Changed');
  });

  it('replaces, inserts and deletes lines', () => {
    const text = 'a\nb\nc';
    expect(replaceLine(text, 1, 'B')).toBe('a\nB\nc');
    expect(insertLine(text, 0, 'new')).toBe('a\nnew\nb\nc');
    expect(insertLine(text, -1, 'first')).toBe('first\na\nb\nc');
    expect(deleteLine(text, 2)).toBe('a\nb');
    expect(lineLike('  - prev', 'x')).toBe('  - x');
    expect(lineLike('text', 'x')).toBe('x');
  });
});
