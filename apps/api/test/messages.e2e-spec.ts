import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PER_HOUR } from '../src/messages/messages.service';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const MINE = `query { myMessages { unread items { fromAdmin authorName topic body } } }`;
const SEND = `mutation ($input: SendMessageInput!) { sendMessage(input: $input) { id topic body } }`;
const READ_MINE = `mutation { markMyMessagesRead }`;
const LIST = `query { adminConversations { userId name email lastBody lastFromAdmin unread } }`;
const THREAD = `query ($userId: Int!) { adminConversation(userId: $userId) { fromAdmin body } }`;
const REPLY = `mutation ($input: ReplyMessageInput!) { replyMessage(input: $input) { fromAdmin authorName body } }`;
const BELL = `query { notifications { unread items { kind searchName } } }`;

interface Mine {
  myMessages: {
    unread: number;
    items: { fromAdmin: boolean; authorName: string; topic: string | null; body: string }[];
  };
}
interface Convos {
  adminConversations: {
    userId: number;
    unread: number;
    lastBody: string;
    lastFromAdmin: boolean;
  }[];
}

describe('messages', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
  });

  it('lets a user write in, an admin answer, and rings the user’s bell', async () => {
    const sent = await t.asUser(SEND, { input: { topic: 'QUESTION', body: '  Is Fit % live?  ' } });
    expect(sent.data).toMatchObject({ sendMessage: { topic: 'QUESTION', body: 'Is Fit % live?' } });

    const before = await t.gql<Convos>(LIST);
    expect(before.data!.adminConversations).toEqual([
      expect.objectContaining({
        userId: 2,
        name: 'User',
        email: 'user@example.com',
        lastBody: 'Is Fit % live?',
        lastFromAdmin: false,
        unread: 1,
      }),
    ]);
    // Opening the conversation marks it read for every admin.
    const thread = await t.gql(THREAD, { userId: 2 });
    expect(thread.data).toEqual({
      adminConversation: [{ fromAdmin: false, body: 'Is Fit % live?' }],
    });
    expect((await t.gql<Convos>(LIST)).data!.adminConversations[0]!.unread).toBe(0);

    const reply = await t.gql(REPLY, { input: { userId: 2, body: 'Yes, every hour.' } });
    expect(reply.data).toEqual({
      replyMessage: { fromAdmin: true, authorName: 'Admin', body: 'Yes, every hour.' },
    });

    const mine = await t.asUser<Mine>(MINE);
    expect(mine.data!.myMessages).toEqual({
      unread: 1,
      items: [
        { fromAdmin: false, authorName: '', topic: 'QUESTION', body: 'Is Fit % live?' },
        { fromAdmin: true, authorName: 'Admin', topic: null, body: 'Yes, every hour.' },
      ],
    });
    expect((await t.asUser(BELL)).data).toEqual({
      notifications: { unread: 1, items: [{ kind: 'MESSAGE_REPLY', searchName: 'Admin' }] },
    });
    expect((await t.asUser(READ_MINE)).data).toEqual({ markMyMessagesRead: 1 });
    expect((await t.asUser<Mine>(MINE)).data!.myMessages.unread).toBe(0);
    // Each user only sees their own conversation.
    expect((await t.gql<Mine>(MINE)).data!.myMessages.items).toEqual([]);
  });

  it('keeps the admin side for admins only', async () => {
    await t.asUser(SEND, { input: { topic: 'BROKEN', body: 'The PDF is blank' } });
    for (const [query, vars] of [
      [LIST, {}],
      [THREAD, { userId: 2 }],
      [REPLY, { input: { userId: 2, body: 'hi' } }],
    ] as const) {
      const res = await t.asUser(query, vars);
      expect(res.errors?.[0]?.extensions).toMatchObject({ apiCode: 'ADMIN_ONLY' });
    }
    expect((await t.anonymous(MINE)).errors?.[0]?.extensions).toMatchObject({
      apiCode: 'LOGIN_REQUIRED',
    });
  });

  it('refuses empty or long messages, answers to nobody, and floods', async () => {
    const empty = await t.asUser(SEND, { input: { topic: 'SUGGESTION', body: '   ' } });
    expect(empty.errors?.[0]?.extensions).toMatchObject({ apiCode: 'MESSAGE_LENGTH' });
    const long = await t.asUser(SEND, { input: { topic: 'SUGGESTION', body: 'x'.repeat(2001) } });
    expect(long.errors).toBeDefined();

    const nobody = await t.gql(REPLY, { input: { userId: 2, body: 'Hello' } });
    expect(nobody.errors?.[0]?.extensions).toMatchObject({ apiCode: 'CONVERSATION_NOT_FOUND' });
    const noThread = await t.gql(THREAD, { userId: 2 });
    expect(noThread.errors?.[0]?.extensions).toMatchObject({ apiCode: 'CONVERSATION_NOT_FOUND' });

    for (let i = 0; i < PER_HOUR; i++) {
      await t.asUser(SEND, { input: { topic: 'QUESTION', body: `Question ${String(i)}` } });
    }
    const flood = await t.asUser(SEND, { input: { topic: 'QUESTION', body: 'One more' } });
    expect(flood.errors?.[0]?.extensions).toMatchObject({
      apiCode: 'MESSAGE_LIMIT',
      apiParams: { max: PER_HOUR },
    });
  });

  it('deletes a user’s messages with their account', async () => {
    await t.asUser(SEND, { input: { topic: 'QUESTION', body: 'Bye' } });
    await t.prisma.user.delete({ where: { id: 2 } });
    expect(await t.prisma.message.count()).toBe(0);
  });
});
