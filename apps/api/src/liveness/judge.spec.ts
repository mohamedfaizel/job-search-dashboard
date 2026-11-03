import { describe, expect, it } from 'vitest';
import type { FetchedPage } from './judge';
import { judge, pageText } from './judge';
import { isPrivateAddress } from './safe-fetch';

const AD = 'https://jobs.example.com/acme/123-frontend-developer';
const filler = '<p>We build things and want you to help. '.repeat(10) + '</p>';

const page = (over: Partial<FetchedPage> = {}): FetchedPage => ({
  status: 200,
  url: AD,
  finalUrl: AD,
  body: `<html><body><h1>Frontend developer</h1>${filler}<button>Apply now</button></body></html>`,
  ...over,
});

describe('judge', () => {
  it('calls a normal job ad open', () => {
    expect(judge(page())).toEqual({ result: 'OPEN', reason: 'LOOKS_OPEN' });
  });

  it('calls 404 and 410 closed', () => {
    expect(judge(page({ status: 404 }))).toEqual({ result: 'CLOSED', reason: 'NOT_FOUND' });
    expect(judge(page({ status: 410 })).result).toBe('CLOSED');
  });

  it('is unsure when the site blocks robots or fails', () => {
    for (const status of [401, 403, 429, 999]) {
      expect(judge(page({ status }))).toEqual({ result: 'UNKNOWN', reason: 'BLOCKED' });
    }
    expect(judge(page({ status: 503 }))).toEqual({ result: 'UNKNOWN', reason: 'SERVER_ERROR' });
  });

  it('reads "no longer available" in English and German', () => {
    const closed = (text: string) =>
      judge(page({ body: `<html><body>${filler}<div class="alert">${text}</div></body></html>` }));
    expect(closed('Sorry, this job is no longer available.')).toEqual({
      result: 'CLOSED',
      reason: 'SAYS_CLOSED',
    });
    expect(closed('No longer accepting applications').result).toBe('CLOSED');
    expect(closed('Diese Stellenanzeige ist leider nicht mehr verfügbar').result).toBe('CLOSED');
    expect(closed('Die Stelle ist bereits besetzt.').result).toBe('CLOSED');
  });

  it('ignores the words inside scripts', () => {
    const body = `<html><body>${filler}<script>var msg = "job is no longer available";</script></body></html>`;
    expect(judge(page({ body })).result).toBe('OPEN');
  });

  it('calls a redirect to the home page or an error page closed', () => {
    expect(judge(page({ finalUrl: 'https://jobs.example.com/' }))).toEqual({
      result: 'CLOSED',
      reason: 'REDIRECTED',
    });
    expect(judge(page({ finalUrl: 'https://jobs.example.com/jobs?error=true' })).result).toBe(
      'CLOSED',
    );
    expect(judge(page({ finalUrl: 'https://jobs.example.com/job-expired' })).result).toBe('CLOSED');
  });

  it('is unsure when it is sent to a sign-in page', () => {
    expect(judge(page({ finalUrl: 'https://www.linkedin.com/authwall?trk=x' }))).toEqual({
      result: 'UNKNOWN',
      reason: 'BLOCKED',
    });
  });

  it('is unsure about a page built by JavaScript', () => {
    const body = '<html><body><div id="root"></div><script src="app.js"></script></body></html>';
    expect(judge(page({ body }))).toEqual({ result: 'UNKNOWN', reason: 'NO_CONTENT' });
  });
});

describe('pageText', () => {
  it('drops tags and decodes German letters', () => {
    expect(pageText('<p>Nicht mehr verf&uuml;gbar</p>')).toBe('nicht mehr verfügbar');
  });
});

describe('isPrivateAddress', () => {
  it('refuses addresses inside a network', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.1',
      '192.168.1.5',
      '169.254.169.254',
      '::1',
      'fd00::1',
      '::ffff:127.0.0.1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '172.32.0.1', '2606:4700::1111']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});
