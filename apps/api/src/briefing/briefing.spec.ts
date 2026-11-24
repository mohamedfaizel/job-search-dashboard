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
