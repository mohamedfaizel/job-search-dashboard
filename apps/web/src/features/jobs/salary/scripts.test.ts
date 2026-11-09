import { bonusFor, money, salaryScripts, spokenTitle } from './scripts';

/** Intl puts a no-break space before €; compare with plain spaces. */
const plain = (text: string) => text.replaceAll('\u00a0', ' ');

describe('salary scripts', () => {
  it('formats money in the script language', () => {
    expect(money(76000, 'EUR', 'en')).toBe('€76,000');
    expect(plain(money(76000, 'EUR', 'de'))).toBe('76.000 €');
  });

  it('drops the gender tag from the title', () => {
    expect(spokenTitle('Data Analyst (m/w/d)')).toBe('Data Analyst');
    expect(spokenTitle('Data Analyst (W/M/D)')).toBe('Data Analyst');
  });

  it('asks for the gap as a bonus, or 5%, at least 1,000', () => {
    expect(bonusFor(76000, 70000)).toBe(6000);
    expect(bonusFor(76000, null)).toBe(4000);
    expect(bonusFor(10000, 80000)).toBe(1000);
  });

  it('writes English or German scripts with your numbers', () => {
    const base = { currency: 'EUR', title: 'Data Analyst', company: 'Acme', ask: 76000 };
    const en = salaryScripts({ ...base, language: 'en', offer: 70000 });
    expect(en.expectation).toContain('around €76,000');
    expect(en.counter).toContain('the offer of €70,000');
    expect(en.extras).toContain('signing bonus of €6,000');

    const de = salaryScripts({ ...base, language: 'de', offer: null });
    expect(plain(de.expectation)).toContain('etwa 76.000 € brutto im Jahr');
    expect(de.counter).toContain('Vielen Dank für Ihr Angebot, ich freue mich');
    expect(plain(de.extras)).toContain('Antrittsprämie von 4.000 €');
  });
});
