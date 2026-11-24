import request from 'supertest';
import type { MockInstance } from 'vitest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessRevokedError, GmailClient } from '../src/gmail/gmail.client';
import { makeState } from '../src/gmail/oauth-state';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const KEY = 'test-gmail-key';
const STATUS = `query { googleCalendar { configured email lastError } }`;
const SET_DATE = /* GraphQL */ `
  mutation ($jobId: ID!, $at: DateTime) {
    setInterviewDate(jobId: $jobId, at: $at) {
      interviewAt
      interviewInCalendar
    }
  }
`;

interface Call {
  method: string;
  url: string;
  body: { summary?: string; description?: string; start?: { dateTime: string } } | null;
}

describe('interviews into Google Calendar', () => {
  let t: TestApp;
  let client: GmailClient;
  let accessToken: MockInstance<GmailClient['accessToken']>;
  let revoke: MockInstance<GmailClient['revoke']>;
  let calls: Call[];
  let gone: boolean;
  const real = globalThis.fetch;

  beforeAll(async () => {
    t = await createTestApp({
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GMAIL_TOKEN_KEY: KEY,
      WEB_URL: 'http://web.test',
    });
    client = t.app.get(GmailClient);
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    calls = [];
    gone = false;
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
    accessToken = vi.spyOn(client, 'accessToken').mockResolvedValue('access');
    revoke = vi.spyOn(client, 'revoke').mockResolvedValue(undefined);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes('googleapis.com/calendar')) return real(input, init);
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Call['body']) : null;
      calls.push({ method, url, body });
      if (gone && method === 'PATCH') return Promise.resolve(new Response(null, { status: 404 }));
      if (method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(Response.json({ id: `ev${String(calls.length)}` }));
    });
    await t.prisma.job.create({
      data: {
        id: 'a',
        title: 'Data Engineer',
        source: 'MANUAL',
        url: 'https://acme.de/jobs/1',
        postedAt: new Date(),
        company: { create: { name: 'Acme' } },
        listedFor: { create: { userId: 2 } },
      },
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function connect(email = 'me@gmail.com') {
    vi.spyOn(client, 'exchangeCode').mockResolvedValueOnce({ email, refreshToken: 'refresh' });
    return request(t.server)
      .get('/gmail/callback')
      .query({ code: 'abc', state: `cal.${makeState(2, KEY)}` });
  }

  const setDate = (at: string | null) =>
    t.asUser<{ setInterviewDate: { interviewAt: string | null; interviewInCalendar: boolean } }>(
      SET_DATE,
      { jobId: 'a', at },
    );

  it('asks Google for calendar events only', async () => {
    const res = await request(t.server)
      .get('/gmail/calendar/connect')
      .set('Cookie', t.cookieFor('USER'))
      .expect(302);
    const url = new URL(res.headers['location'] as string);
    expect(url.searchParams.get('scope')).toContain('calendar.events');
    expect(url.searchParams.get('scope')).not.toContain('gmail');
    expect(url.searchParams.get('state')).toMatch(/^cal\./);
  });

  it('connects, adds the interviews you have coming up, and keeps the token scrambled', async () => {
    const soon = new Date(Date.now() + 2 * 86_400_000);
    await t.prisma.application.create({
      data: { userId: 2, jobId: 'a', status: 'INTERVIEWING', interviewAt: soon },
    });
    const res = await connect();
    expect(res.headers['location']).toBe('http://web.test/settings?calendar=connected');
    const { data } = await t.asUser<{ googleCalendar: unknown }>(STATUS);
    expect(data!.googleCalendar).toEqual({
      configured: true,
      email: 'me@gmail.com',
      lastError: null,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'POST' });
    expect(calls[0]!.body!.summary).toBe('Interview: Data Engineer · Acme');
    expect(calls[0]!.body!.description).toContain('http://web.test/jobs?job=a');
    expect(calls[0]!.body!.description).toContain('https://acme.de/jobs/1');
    const stored = await t.prisma.googleCalendar.findUniqueOrThrow({ where: { userId: 2 } });
    expect(stored.refreshToken).not.toContain('refresh');
  });

  it('adds, moves and removes the event as you change the date', async () => {
    await connect();
    const first = await setDate('2026-12-01T09:00:00.000Z');
    expect(first.data!.setInterviewDate.interviewInCalendar).toBe(true);
    await setDate('2026-12-02T10:00:00.000Z');
    const cleared = await setDate(null);
    expect(cleared.data!.setInterviewDate.interviewInCalendar).toBe(false);
    expect(calls.map((call) => call.method)).toEqual(['POST', 'PATCH', 'DELETE']);
    expect(calls[1]!.url).toMatch(/\/events\/ev1$/);
    expect(calls[1]!.body!.start!.dateTime).toBe('2026-12-02T10:00:00.000Z');
  });

  it('makes a new event when you deleted it in Google', async () => {
    await connect();
    await setDate('2026-12-01T09:00:00.000Z');
    gone = true;
    const moved = await setDate('2026-12-03T09:00:00.000Z');
    expect(moved.data!.setInterviewDate.interviewInCalendar).toBe(true);
    expect(calls.map((call) => call.method)).toEqual(['POST', 'PATCH', 'POST']);
  });

  it('saves the date even when Google refuses, and says why in Settings', async () => {
    await connect();
    accessToken.mockRejectedValue(new AccessRevokedError('revoked'));
    const set = await setDate('2026-12-01T09:00:00.000Z');
    expect(set.errors).toBeUndefined();
    expect(set.data!.setInterviewDate).toMatchObject({ interviewInCalendar: false });
    const { data } = await t.asUser<{ googleCalendar: { lastError: string } }>(STATUS);
    expect(data!.googleCalendar.lastError).toMatch(/Connect the calendar again/);
  });

  it('does nothing without a calendar, and disconnects', async () => {
    await setDate('2026-12-01T09:00:00.000Z');
    expect(calls).toEqual([]);
    await connect();
    const off = await t.asUser<{ disconnectGoogleCalendar: boolean }>(
      `mutation { disconnectGoogleCalendar }`,
    );
    expect(off.data).toEqual({ disconnectGoogleCalendar: true });
    expect(revoke).toHaveBeenCalledWith('refresh');
    const app = await t.prisma.application.findUniqueOrThrow({
      where: { userId_jobId: { userId: 2, jobId: 'a' } },
    });
    expect(app.calendarEventId).toBeNull();
  });
});
