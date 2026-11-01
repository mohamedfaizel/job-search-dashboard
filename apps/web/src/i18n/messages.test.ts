import de from '../../messages/de.json';
import en from '../../messages/en.json';
import { localeFromHeader } from './config';

/** Every key path in a messages file, like "Nav.jobs". */
function keys(messages: object, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('messages', () => {
  it('has every English text in German too, and nothing extra', () => {
    expect(keys(de).sort()).toEqual(keys(en).sort());
  });

  it('has no empty texts', () => {
    const empty = (m: object) =>
      keys(m).filter((path) => {
        const value = path
          .split('.')
          .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], m);
        return typeof value !== 'string' || !value.trim();
      });
    expect(empty(en)).toEqual([]);
    expect(empty(de)).toEqual([]);
  });
});

describe('localeFromHeader', () => {
  it('picks German only when the browser asks for it first', () => {
    expect(localeFromHeader('de-DE,de;q=0.9,en;q=0.8')).toBe('de');
    expect(localeFromHeader('en-US,de;q=0.5')).toBe('en');
    expect(localeFromHeader(null)).toBe('en');
  });
});
