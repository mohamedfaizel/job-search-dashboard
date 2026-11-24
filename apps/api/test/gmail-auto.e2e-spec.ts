import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GmailClient } from '../src/gmail/gmail.client';
import type { MailMessage } from '../src/gmail/gmail.client';
import { makeState } from '../src/gmail/oauth-state';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const KEY = 'test-gmail-key';
const SYNC = `mutation { syncGmail { suggestions moved } }`;
const BELL = /* GraphQL */ `
  query {
    notifications {
      items {
        id
        kind
        count
        undone
        jobs {
          id
          status
        }
      }
    }
  }
`;

interface Bell {
  notifications: {
    items: {
      id: number;
      kind: string;
      count: number;
      undone: boolean;
      jobs: { id: string; status: string | null }[];
    }[];
  };
}

const mail = (id: string, from: string, snippet: string): MailMessage => ({
  id,
  from,
  subject: 'Your application',
  snippet,
  receivedAt: new Date(),
});

describe('Gmail moves clear cases by itself', () => {
  let t: TestApp;
  let client: GmailClient;
  let mails: MailMessage[];

  beforeAll(async () => {
    t = await createTestApp({
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GMAIL_TOKEN_KEY: KEY,
    });
    client = t.app.get(GmailClient);
    vi.spyOn(client, 'accessToken').mockResolvedValue('access');
    vi.spyOn(client, 'recentMail').mockImplementation(() => Promise.resolve(mails));
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
    for (const [id, company] of [
      ['acme', 'Acme GmbH'],
      ['globex', 'Globex AG'],
      ['initech', 'Initech'],
    ] as const) {
      await t.prisma.job.create({
        data: {
          id,
          title: `Developer at ${company}`,
          source: 'MANUAL',
          postedAt: new Date(),
          company: { create: { name: company } },
          listedFor: { create: { userId: 2 } },
          applications: { create: { userId: 2, status: 'APPLIED' } },
        },
      });
    }
    vi.spyOn(client, 'exchangeCode').mockResolvedValueOnce({
      email: 'me@gmail.com',
      refreshToken: 'refresh',
    });
    await request(t.server)
      .get('/gmail/callback')
      .query({ code: 'abc', state: makeState(2, KEY) });
    mails = [
      mail('m1', 'Acme <jobs@acme.de>', 'Unfortunately we decided not to move forward.'),
      mail('m2', 'Globex <hr@globex.com>', 'We would like to invite you to an interview.'),
      // A rejection that also talks about a next round: not clear, so it waits for you.
      mail('m3', 'Initech <hr@initech.com>', 'Unfortunately the next round is full.'),
    ];
  });

  const statusOf = async (jobId: string) =>
    (
      await t.prisma.application.findUniqueOrThrow({
        where: { userId_jobId: { userId: 2, jobId } },
      })
    ).status;

  it('moves clear emails, leaves unclear ones as suggestions, and tells the bell', async () => {
    const sync = await t.asUser<{ syncGmail: { suggestions: number; moved: number } }>(SYNC);
    expect(sync.data!.syncGmail).toEqual({ suggestions: 1, moved: 2 });
    expect(await statusOf('acme')).toBe('REJECTED');
    expect(await statusOf('globex')).toBe('INTERVIEWING');
    expect(await statusOf('initech')).toBe('APPLIED');

    const bell = await t.asUser<Bell>(BELL);
    const item = bell.data!.notifications.items[0]!;
    expect(item).toMatchObject({ kind: 'MAIL_AUTO', count: 2, undone: false });
    expect(item.jobs).toEqual(
      expect.arrayContaining([
        { id: 'acme', status: 'REJECTED' },
        { id: 'globex', status: 'INTERVIEWING' },
      ]),
    );

    // Reading the same mail again moves nothing twice.
    const again = await t.asUser<{ syncGmail: { moved: number } }>(SYNC);
    expect(again.data!.syncGmail.moved).toBe(0);
  });

  it('Undo puts the jobs back, but not one you moved yourself since', async () => {
    await t.asUser(SYNC);
    await t.prisma.application.update({
      where: { userId_jobId: { userId: 2, jobId: 'globex' } },
      data: { status: 'OFFER' },
    });
    const { id } = (await t.asUser<Bell>(BELL)).data!.notifications.items[0]!;
    const undo = await t.asUser<{ undoMailAuto: boolean }>(
      `mutation ($id: Int!) { undoMailAuto(notificationId: $id) }`,
      { id },
    );
    expect(undo.data).toEqual({ undoMailAuto: true });
    expect(await statusOf('acme')).toBe('APPLIED');
    expect(await statusOf('globex')).toBe('OFFER');
    expect((await t.asUser<Bell>(BELL)).data!.notifications.items[0]!.undone).toBe(true);

    const foreign = await t.gql(`mutation ($id: Int!) { undoMailAuto(notificationId: $id) }`, {
      id,
    });
    expect(foreign.errors?.[0]?.extensions?.['apiCode']).toBe('NOTIFICATION_NOT_FOUND');
  });

  it('only suggests when you turned it off, or when two clear mails disagree', async () => {
    const off = await t.asUser<{ setMailAutoStatus: boolean }>(
      `mutation { setMailAutoStatus(on: false) }`,
    );
    expect(off.data).toEqual({ setMailAutoStatus: false });
    const profile = await t.asUser<{ myProfile: { mailAutoStatus: boolean } }>(
      `query { myProfile { mailAutoStatus } }`,
    );
    expect(profile.data!.myProfile.mailAutoStatus).toBe(false);
    const sync = await t.asUser<{ syncGmail: { suggestions: number; moved: number } }>(SYNC);
    expect(sync.data!.syncGmail).toEqual({ suggestions: 3, moved: 0 });

    await t.asUser(`mutation { setMailAutoStatus(on: true) }`);
    await t.prisma.mailSuggestion.deleteMany();
    mails = [
      mail('m4', 'Acme <jobs@acme.de>', 'Unfortunately we decided not to move forward.'),
      mail('m5', 'Acme <jobs@acme.de>', 'We would like to invite you to an interview.'),
      mail('m6', 'Globex <hr@globex.com>', 'We would like to invite you to an interview.'),
      mail(
        'm7',
        'Globex <hr@globex.com>',
        'Interview invitation: please send your availability for a call.',
      ),
    ];
    const mixed = await t.asUser<{ syncGmail: { suggestions: number; moved: number } }>(SYNC);
    expect(mixed.data!.syncGmail).toEqual({ suggestions: 2, moved: 1 });
    expect(await statusOf('acme')).toBe('APPLIED');
    expect(await statusOf('globex')).toBe('INTERVIEWING');
    expect(await t.prisma.mailSuggestion.count({ where: { state: 'PENDING' } })).toBe(2);
  });
});
