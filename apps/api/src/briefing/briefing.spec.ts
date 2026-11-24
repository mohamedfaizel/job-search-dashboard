import { describe, expect, it } from 'vitest';
import { briefingText, hasNews, isBriefingDue } from './briefing';

const none = { newJobs: 0, kits: 0, followUps: 0, interviews: 0, replies: 0 };

describe('briefingText', () => {
  it('puts the two first news in the title and the best job underneath', () => {
    const text = briefingText(
      { newJobs: 4, kits: 3, followUps: 2, interviews: 1, replies: 1 },
      'en',
      { title: 'Data Engineer', company: 'HelloFresh', fit: 86 },
    );
    expect(text.title).toBe('Good morning: 4 new jobs, 3 kits ready');
    expect(text.body).toBe(
      '1 interview today · 2 follow-ups due · 1 employer reply\nBest: Data Engineer · HelloFresh · 86%',
    );
  });

  it('speaks German and singular', () => {
    expect(briefingText({ ...none, newJobs: 1 }, 'de').title).toBe('Guten Morgen: 1 neuer Job');
  });

  it('knows when there is nothing', () => {
    expect(hasNews(none)).toBe(false);
    expect(hasNews({ ...none, replies: 1 })).toBe(true);
  });
});

describe('isBriefingDue', () => {
  const at = (h: number, m: number) => {
    const d = new Date(2026, 10, 25, h, m);
    return d;
  };
  it('is due from its time on, once a day', () => {
    expect(isBriefingDue('07:30', null, at(7, 29))).toBe(false);
    expect(isBriefingDue('07:30', null, at(7, 30))).toBe(true);
    expect(isBriefingDue('07:30', null, at(9, 0))).toBe(true);
    expect(isBriefingDue('07:30', at(7, 31), at(9, 0))).toBe(false);
    expect(isBriefingDue('07:30', new Date(2026, 10, 24, 7, 30), at(7, 30))).toBe(true);
    expect(isBriefingDue('bad', null, at(9, 0))).toBe(false);
  });
});

describe('briefingText in every form', () => {
  const all = { newJobs: 2, kits: 2, followUps: 2, interviews: 2, replies: 2 };
  const one = { newJobs: 1, kits: 1, followUps: 1, interviews: 1, replies: 1 };
  const best = { title: 'Data Engineer', company: 'Acme', fit: 90 };

  it('writes every count in German, with the best job', () => {
    const text = briefingText(all, 'de', best);
    expect(text.title).toBe('Guten Morgen: 2 neue Jobs, 2 Kits fertig');
    expect(text.body).toBe(
      '2 Interviews heute · 2× nachfassen · 2 Antworten von Arbeitgebern\nTop: Data Engineer · Acme · 90 %',
    );
    expect(briefingText(one, 'de').body).toBe(
      '1 Interview heute · 1× nachfassen · 1 Antwort von Arbeitgebern',
    );
    expect(briefingText(one, 'de').title).toBe('Guten Morgen: 1 neuer Job, 1 Kit fertig');
  });

  it('writes every count in English, one of each', () => {
    const text = briefingText(one, 'en');
    expect(text.title).toBe('Good morning: 1 new job, 1 kit ready');
    expect(text.body).toBe('1 interview today · 1 follow-up due · 1 employer reply');
    expect(briefingText(all, 'en').body).toBe(
      '2 interviews today · 2 follow-ups due · 2 employer replies',
    );
  });
});
