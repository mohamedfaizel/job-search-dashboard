import request from 'supertest';
import type { MockInstance } from 'vitest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessRevokedError, GmailClient } from '../src/gmail/gmail.client';
import type { MailMessage } from '../src/gmail/gmail.client';
import { GmailService } from '../src/gmail/gmail.service';
import { makeState } from '../src/gmail/oauth-state';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const KEY = 'test-gmail-key';

const STATUS = `query { gmailStatus { configured accounts { id email lastError lastSyncAt } } }`;
const SYNC = `mutation { syncGmail { accounts suggestions warnings } }`;
const SUGGESTIONS = `query { mailSuggestions {
  id jobId company currentStatus status accountEmail subject
} }`;
const APPROVE = `mutation ($id: Int!) { approveMailSuggestion(id: $id) }`;
const DISMISS = `mutation ($id: Int!) { dismissMailSuggestion(id: $id) }`;
const DISCONNECT = `mutation ($id: Int!) { disconnectGmail(id: $id) }`;

describe('Gmail suggestions', () => {
  let t: TestApp;
  let client: GmailClient;
  let mails: MailMessage[];
  let accessToken: MockInstance<GmailClient['accessToken']>;
  let revoke: MockInstance<GmailClient['revoke']>;
  let jobId: string;

  beforeAll(async () => {
    t = await createTestApp({
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GMAIL_TOKEN_KEY: KEY,
      WEB_URL: 'http://web.test',
    });
    client = t.app.get(GmailClient);
    accessToken = vi.spyOn(client, 'accessToken').mockResolvedValue('access');
    vi.spyOn(client, 'recentMail').mockImplementation(() => Promise.resolve(mails));
    revoke = vi.spyOn(client, 'revoke').mockResolvedValue(undefined);
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
    const job = await t.prisma.job.create({
      data: {
        title: 'Frontend developer',
        source: 'MANUAL',
        postedAt: new Date(),
        company: { create: { name: 'Acme GmbH' } },
      },
    });
    jobId = job.id;
    await t.prisma.application.create({ data: { userId: 2, jobId, status: 'APPLIED' } });
    mails = [
      {
        id: 'm1',
        from: 'Acme Recruiting <jobs@acme.de>',
        subject: 'Your application',
        snippet: 'Unfortunately we will not be moving forward with your application.',
        receivedAt: new Date(),
      },
      {
        id: 'm2',
        from: 'Newsletter <news@other.com>',
        subject: 'Ten tips',
        snippet: 'Unfortunately you missed our sale',
        receivedAt: new Date(),
      },
    ];
  });

  async function connect(email = 'me@gmail.com', userId = 2) {
    const callback = vi
      .spyOn(client, 'exchangeCode')
      .mockResolvedValueOnce({ email, refreshToken: `refresh-${email}` });
    const res = await request(t.server)
      .get('/gmail/callback')
      .query({ code: 'abc', state: makeState(userId, KEY) });
    callback.mockClear();
    return res;
  }

  it('says it is configured and starts with no accounts', async () => {
    const { data } = await t.asUser<{ gmailStatus: { configured: boolean; accounts: unknown[] } }>(
      STATUS,
    );
    expect(data!.gmailStatus).toEqual({ configured: true, accounts: [] });
  });

  it('needs a login', async () => {
    const res = await t.anonymous(STATUS);
    expect(res.errors?.[0]?.extensions?.['apiCode']).toBe('LOGIN_REQUIRED');
    await request(t.server).get('/gmail/connect').expect(401);
  });

  it('sends you to Google with a read-only scope', async () => {
    const res = await request(t.server)
      .get('/gmail/connect')
      .set('Cookie', t.cookieFor('USER'))
      .expect(302);
    const url = new URL(res.headers['location'] as string);
    expect(url.host).toBe('accounts.google.com');
    expect(url.searchParams.get('scope')).toContain('gmail.readonly');
    expect(url.searchParams.get('scope')).not.toContain('gmail.send');
    expect(url.searchParams.get('access_type')).toBe('offline');
  });

  it('connects an account and keeps the refresh token scrambled', async () => {
    const res = await connect();
    expect(res.headers['location']).toBe('http://web.test/profile?gmail=connected');
    const { data } = await t.asUser<{ gmailStatus: { accounts: { email: string }[] } }>(STATUS);
    expect(data!.gmailStatus.accounts.map((a) => a.email)).toEqual(['me@gmail.com']);
    const stored = await t.prisma.gmailAccount.findFirstOrThrow();
    expect(stored.refreshToken).not.toContain('refresh-me@gmail.com');
  });

  it('connects several accounts, and the same one twice only once', async () => {
    await connect('me@gmail.com');
    await connect('other@gmail.com');
    await connect('me@gmail.com');
    const { data } = await t.asUser<{ gmailStatus: { accounts: { email: string }[] } }>(STATUS);
    expect(data!.gmailStatus.accounts.map((a) => a.email)).toEqual([
      'me@gmail.com',
      'other@gmail.com',
    ]);
  });

  it('keeps the old token when Google sends no new one, and fails for a new account', async () => {
    await connect();
    vi.spyOn(client, 'exchangeCode').mockResolvedValueOnce({
      email: 'me@gmail.com',
      refreshToken: null,
    });
    const again = await request(t.server)
      .get('/gmail/callback')
      .query({ code: 'abc', state: makeState(2, KEY) });
    expect(again.headers['location']).toBe('http://web.test/profile?gmail=connected');

    vi.spyOn(client, 'exchangeCode').mockResolvedValueOnce({
      email: 'new@gmail.com',
      refreshToken: null,
    });
    const fresh = await request(t.server)
      .get('/gmail/callback')
      .query({ code: 'abc', state: makeState(2, KEY) });
    expect(fresh.headers['location']).toBe('http://web.test/profile?gmail=error');
  });

  it('rejects a callback with a bad state, a denial, or a failed exchange', async () => {
    const bad = await request(t.server).get('/gmail/callback').query({ code: 'x', state: 'nope' });
    expect(bad.headers['location']).toBe('http://web.test/profile?gmail=error');
    const denied = await request(t.server)
      .get('/gmail/callback')
      .query({ error: 'access_denied', state: makeState(2, KEY) });
    expect(denied.headers['location']).toBe('http://web.test/profile?gmail=denied');
    vi.spyOn(client, 'exchangeCode').mockRejectedValueOnce(new Error('boom'));
    const failed = await request(t.server)
      .get('/gmail/callback')
      .query({ code: 'x', state: makeState(2, KEY) });
    expect(failed.headers['location']).toBe('http://web.test/profile?gmail=error');
    expect(await t.prisma.gmailAccount.count()).toBe(0);
  });

  it('suggests Rejected for the matching job only, and shows it to its owner only', async () => {
    await connect();
    const sync = await t.asUser<{
      syncGmail: { accounts: number; suggestions: number; warnings: string[] };
    }>(SYNC);
    expect(sync.data!.syncGmail).toEqual({ accounts: 1, suggestions: 1, warnings: [] });

    const list = await t.asUser<{ mailSuggestions: { jobId: string; status: string }[] }>(
      SUGGESTIONS,
    );
    expect(list.data!.mailSuggestions).toMatchObject([
      {
        jobId,
        company: 'Acme GmbH',
        currentStatus: 'APPLIED',
        status: 'REJECTED',
        accountEmail: 'me@gmail.com',
      },
    ]);
    const other = await t.gql<{ mailSuggestions: unknown[] }>(SUGGESTIONS);
    expect(other.data!.mailSuggestions).toEqual([]);
    // The application did not change by itself.
    expect((await t.prisma.application.findFirstOrThrow()).status).toBe('APPLIED');
  });

  it('does not suggest the same email twice', async () => {
    await connect();
    await t.asUser(SYNC);
    const again = await t.asUser<{ syncGmail: { suggestions: number } }>(SYNC);
    expect(again.data!.syncGmail.suggestions).toBe(0);
    expect(await t.prisma.mailSuggestion.count()).toBe(1);
  });

  it('approving moves the job in the tracker', async () => {
    await connect();
    await t.asUser(SYNC);
    const id = (await t.prisma.mailSuggestion.findFirstOrThrow()).id;
    const res = await t.asUser<{ approveMailSuggestion: boolean }>(APPROVE, { id });
    expect(res.data!.approveMailSuggestion).toBe(true);
    expect((await t.prisma.application.findFirstOrThrow()).status).toBe('REJECTED');
    const list = await t.asUser<{ mailSuggestions: unknown[] }>(SUGGESTIONS);
    expect(list.data!.mailSuggestions).toEqual([]);
    const twice = await t.asUser(APPROVE, { id });
    expect(twice.errors?.[0]?.extensions?.['apiCode']).toBe('SUGGESTION_ANSWERED');
  });

  it('dismissing leaves the tracker alone and the email never comes back', async () => {
    await connect();
    await t.asUser(SYNC);
    const id = (await t.prisma.mailSuggestion.findFirstOrThrow()).id;
    await t.asUser(DISMISS, { id });
    expect((await t.prisma.application.findFirstOrThrow()).status).toBe('APPLIED');
    await t.asUser(SYNC);
    const list = await t.asUser<{ mailSuggestions: unknown[] }>(SUGGESTIONS);
    expect(list.data!.mailSuggestions).toEqual([]);
  });

  it("cannot answer someone else's suggestion", async () => {
    await connect();
    await t.asUser(SYNC);
    const id = (await t.prisma.mailSuggestion.findFirstOrThrow()).id;
    const res = await t.gql(APPROVE, { id });
    expect(res.errors?.[0]?.extensions?.['apiCode']).toBe('SUGGESTION_NOT_FOUND');
    const missing = await t.asUser(DISMISS, { id: 999 });
    expect(missing.errors?.[0]?.extensions?.['apiCode']).toBe('SUGGESTION_NOT_FOUND');
  });

  it('ignores mail for jobs you have not applied to', async () => {
    await t.prisma.application.update({
      where: { userId_jobId: { userId: 2, jobId } },
      data: { status: 'SAVED' },
    });
    await connect();
    const sync = await t.asUser<{ syncGmail: { suggestions: number } }>(SYNC);
    expect(sync.data!.syncGmail.suggestions).toBe(0);
  });

  it('reports an account whose access was revoked, and keeps the others working', async () => {
    await connect('gone@gmail.com');
    await connect('ok@gmail.com');
    accessToken.mockRejectedValueOnce(new AccessRevokedError('revoked'));
    const sync = await t.asUser<{ syncGmail: { suggestions: number; warnings: string[] } }>(SYNC);
    expect(sync.data!.syncGmail.suggestions).toBe(1);
    expect(sync.data!.syncGmail.warnings).toEqual([
      'gone@gmail.com: Access was revoked. Connect this account again.',
    ]);
    const { data } = await t.asUser<{
      gmailStatus: { accounts: { email: string; lastError: string | null }[] };
    }>(STATUS);
    expect(data!.gmailStatus.accounts.map((a) => [a.email, a.lastError !== null])).toEqual([
      ['gone@gmail.com', true],
      ['ok@gmail.com', false],
    ]);
  });

  it('reports a Gmail outage without leaking details', async () => {
    await connect();
    accessToken.mockRejectedValueOnce(new Error('Gmail answered 500'));
    const sync = await t.asUser<{ syncGmail: { warnings: string[] } }>(SYNC);
    expect(sync.data!.syncGmail.warnings).toEqual([
      'me@gmail.com: Gmail could not be read. Try again later.',
    ]);
  });

  it('removes an account together with its suggestions, and only your own', async () => {
    await connect();
    await t.asUser(SYNC);
    const id = (await t.prisma.gmailAccount.findFirstOrThrow()).id;
    const foreign = await t.gql(DISCONNECT, { id });
    expect(foreign.errors?.[0]?.extensions?.['apiCode']).toBe('GMAIL_ACCOUNT_NOT_FOUND');
    const res = await t.asUser<{ disconnectGmail: boolean }>(DISCONNECT, { id });
    expect(res.data!.disconnectGmail).toBe(true);
    expect(await t.prisma.gmailAccount.count()).toBe(0);
    expect(await t.prisma.mailSuggestion.count()).toBe(0);
    expect(revoke).toHaveBeenCalledWith('refresh-me@gmail.com');
  });

  it('checks every account of every user once an hour', async () => {
    await connect();
    await connect('admin@gmail.com', 1);
    await t.app.get(GmailService).syncEveryone();
    expect(await t.prisma.gmailAccount.count({ where: { lastSyncAt: { not: null } } })).toBe(2);
    expect(await t.prisma.mailSuggestion.count()).toBe(1);
  });
});

describe('Gmail not set up', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', WEB_URL: '' });
  });
  afterAll(async () => {
    await t.app.close();
  });

  it('says so, and sends /gmail/connect back to the profile', async () => {
    const { data } = await t.asUser<{ gmailStatus: { configured: boolean } }>(STATUS);
    expect(data!.gmailStatus.configured).toBe(false);
    const res = await request(t.server)
      .get('/gmail/connect')
      .set('Cookie', t.cookieFor('USER'))
      .expect(302);
    expect(res.headers['location']).toBe('http://localhost:3001/profile?gmail=not-configured');
    await t.app.get(GmailService).syncEveryone();
  });
});
