import { describe, expect, it } from 'vitest';
import { classifyMail, suggestedStatus } from './classify';
import type { Candidate } from './match-job';
import { companyKey, matchJob } from './match-job';
import { makeState, readState } from './oauth-state';
import { decryptToken, encryptToken, keyFrom } from './token-crypto';

describe('token-crypto', () => {
  const key = keyFrom('secret');

  it('round-trips and never stores the plain text', () => {
    const stored = encryptToken('1//refresh-token', key);
    expect(stored).not.toContain('refresh-token');
    expect(decryptToken(stored, key)).toBe('1//refresh-token');
  });

  it('gives a different text each time', () => {
    expect(encryptToken('a', key)).not.toBe(encryptToken('a', key));
  });

  it('refuses a changed text, another key or a broken text', () => {
    const stored = encryptToken('abc', key);
    const [iv, tag, data] = stored.split('.');
    const flipped = Buffer.from(data ?? '', 'base64');
    flipped[0] = (flipped[0] ?? 0) ^ 1;
    expect(() => decryptToken(`${iv}.${tag}.${flipped.toString('base64')}`, key)).toThrow();
    expect(() => decryptToken(stored, keyFrom('other'))).toThrow();
    expect(() => decryptToken('nonsense', key)).toThrow('Malformed');
  });
});

describe('oauth-state', () => {
  const now = new Date('2026-11-03T12:00:00Z');

  it('gives back the user who started the sign-in', () => {
    expect(readState(makeState(7, 's', now), 's', now)).toBe(7);
  });

  it('rejects a forged, expired, wrong-secret or malformed state', () => {
    const state = makeState(7, 's', now);
    const forged = state.replace(/^7\./, '8.');
    expect(readState(forged, 's', now)).toBeNull();
    expect(readState(state, 'other', now)).toBeNull();
    expect(readState(state, 's', new Date('2026-11-03T12:11:00Z'))).toBeNull();
    expect(readState('x', 's', now)).toBeNull();
    expect(readState('7.1.short', 's', now)).toBeNull();
  });
});

describe('classifyMail', () => {
  it.each([
    ['Unfortunately we will not be moving forward with your application', 'REJECTED'],
    [
      'Leider müssen wir Ihnen mitteilen, dass wir uns für andere Bewerber entschieden haben',
      'REJECTED',
    ],
    ['Absage zu Ihrer Bewerbung', 'REJECTED'],
    ['We would like to invite you to an interview next week', 'INTERVIEWING'],
    ['Einladung zum Vorstellungsgespräch', 'INTERVIEWING'],
    ["We're pleased to offer you the position. Job offer attached", 'OFFER'],
    ['Ihr Arbeitsvertrag liegt bei', 'OFFER'],
    ['Thank you for applying! We received your application.', 'RECEIVED'],
    ['Vielen Dank für Ihre Bewerbung', 'RECEIVED'],
    ['Weekly newsletter: ten tips', null],
  ])('%s -> %s', (text, expected) => {
    expect(classifyMail(text)).toBe(expected);
  });

  it('treats a rejection that mentions an interview as a rejection', () => {
    expect(
      classifyMail(
        'Unfortunately, after the interview we chose other candidates for the next step',
      ),
    ).toBe('REJECTED');
  });
});

describe('suggestedStatus', () => {
  it('moves forward only', () => {
    expect(suggestedStatus('INTERVIEWING', 'APPLIED')).toBe('INTERVIEWING');
    expect(suggestedStatus('OFFER', 'INTERVIEWING')).toBe('OFFER');
    expect(suggestedStatus('INTERVIEWING', 'OFFER')).toBeNull();
    expect(suggestedStatus('INTERVIEWING', 'INTERVIEWING')).toBeNull();
  });

  it('suggests a rejection from anywhere in the process, but not twice', () => {
    expect(suggestedStatus('REJECTED', 'APPLIED')).toBe('REJECTED');
    expect(suggestedStatus('REJECTED', 'OFFER')).toBe('REJECTED');
    expect(suggestedStatus('REJECTED', 'REJECTED')).toBeNull();
    expect(suggestedStatus('REJECTED', 'NONE')).toBeNull();
  });

  it('suggests nothing for an acknowledgement or an unknown mail', () => {
    expect(suggestedStatus('RECEIVED', 'APPLIED')).toBeNull();
    expect(suggestedStatus(null, 'APPLIED')).toBeNull();
    expect(suggestedStatus('INTERVIEWING', 'REJECTED')).toBeNull();
  });
});

describe('companyKey', () => {
  it('drops legal forms and punctuation', () => {
    expect(companyKey('Acme GmbH')).toBe('acme');
    expect(companyKey('Acme-Tech Inc.')).toBe('acme tech');
    expect(companyKey('Müller & Söhne KG')).toBe('müller söhne');
  });
});

describe('matchJob', () => {
  const day = (d: number) => new Date(`2026-10-${String(d).padStart(2, '0')}T10:00:00Z`);
  const candidates: Candidate[] = [
    { jobId: 'a', company: 'Acme GmbH', status: 'APPLIED', since: day(20) },
    { jobId: 'a2', company: 'Acme GmbH', status: 'APPLIED', since: day(25) },
    { jobId: 'b', company: 'Globex', status: 'APPLIED', since: day(20) },
    { jobId: 'c', company: 'Ab', status: 'APPLIED', since: day(20) },
  ];
  const mail = (over: Partial<Parameters<typeof matchJob>[0]>) => ({
    from: 'HR <hr@example.org>',
    subject: '',
    snippet: '',
    receivedAt: day(28),
    ...over,
  });

  it('finds the company in the subject, snippet or sender name', () => {
    expect(matchJob(mail({ subject: 'Your application at Globex' }), candidates)?.jobId).toBe('b');
    expect(matchJob(mail({ snippet: 'Hello from the Globex team' }), candidates)?.jobId).toBe('b');
    expect(matchJob(mail({ from: 'Globex Careers <x@y.org>' }), candidates)?.jobId).toBe('b');
  });

  it("finds the company in the sender's web address", () => {
    expect(matchJob(mail({ from: 'jobs@mail.globex.com' }), candidates)?.jobId).toBe('b');
    expect(matchJob(mail({ from: 'no-address' }), candidates)).toBeNull();
  });

  it('takes the most recent application when a company has two', () => {
    expect(matchJob(mail({ subject: 'Acme update' }), candidates)?.jobId).toBe('a2');
  });

  it('ignores mail from before the application, whole-word misses and tiny names', () => {
    expect(matchJob(mail({ subject: 'Globex', receivedAt: day(10) }), candidates)).toBeNull();
    expect(matchJob(mail({ subject: 'Globexity news' }), candidates)).toBeNull();
    expect(matchJob(mail({ subject: 'Ab' }), candidates)).toBeNull();
  });
});
