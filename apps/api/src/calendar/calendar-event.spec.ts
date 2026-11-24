import { describe, expect, it } from 'vitest';
import { interviewEvent } from './calendar-event';

const base = {
  title: 'Data Engineer',
  company: 'Acme',
  at: new Date('2026-12-01T09:00:00.000Z'),
  jobLink: 'http://localhost:3001/jobs?job=a',
  adUrl: null,
  prep: null,
};

describe('interviewEvent', () => {
  it('makes a one-hour event with the job link', () => {
    const event = interviewEvent(base);
    expect(event.summary).toBe('Interview: Data Engineer · Acme');
    expect(event.start.dateTime).toBe('2026-12-01T09:00:00.000Z');
    expect(event.end.dateTime).toBe('2026-12-01T10:00:00.000Z');
    expect(event.description).toContain(
      'Open in Job Search Hunter: http://localhost:3001/jobs?job=a',
    );
    expect(event.description).not.toContain('Job ad');
    expect(event.description).not.toContain('prep');
  });

  it('adds the ad and your prep, cut when long', () => {
    const event = interviewEvent({ ...base, adUrl: 'https://acme.de/job', prep: 'x'.repeat(5000) });
    expect(event.description).toContain('Job ad: https://acme.de/job');
    expect(event.description).toContain('Your interview prep:');
    expect(event.description.length).toBeLessThan(4300);
    expect(event.description.endsWith('…')).toBe(true);
  });
});
