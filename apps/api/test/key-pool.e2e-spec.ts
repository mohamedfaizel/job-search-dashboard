import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSearchResponse } from './fixtures/load';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const JOBHUNTER_URL = 'https://jobhunter.test/v1';

const POOL = /* GraphQL */ `
  query {
    keyPool {
      free
      assigned
      empty
      limit
      autoApprove
      keys {
        id
        status
        holder
        used
        credits
        note
      }
      requests {
        id
        name
        email
      }
    }
  }
`;
const ADD = /* GraphQL */ `
  mutation ($input: AddPoolKeysInput!) {
    addPoolKeys(input: $input) {
      added
      duplicates
      invalid
    }
  }
`;
const MINE = /* GraphQL */ `
  query {
    myPoolKey {
      state
      limit
      used
      note
      askAgainAt
      poolEmpty
    }
  }
`;
const REQUEST = 'mutation { requestPoolKey { state limit used poolEmpty } }';
const GIVE_BACK = 'mutation { givePoolKeyBack { state } }';
const APPROVE = 'mutation ($id: Int!) { approveKeyRequest(id: $id) { assigned free } }';
const DENY = /* GraphQL */ `
  mutation ($input: DenyKeyRequestInput!) {
    denyKeyRequest(input: $input) {
      requests {
        id
      }
    }
  }
`;
const TAKE_BACK =
  'mutation ($id: Int!, $passOn: Boolean) { takeBackPoolKey(id: $id, passOn: $passOn) { free assigned } }';
const BELL = 'query { notifications { items { kind searchName count refId } } }';
const SYNC = /* GraphQL */ `
  mutation ($pageSize: Int, $maxPages: Int) {
    syncJobs(input: { titles: ["frontend"], pageSize: $pageSize, maxPages: $maxPages }) {
      creditsCharged
    }
  }
`;

// Fake JobHunter: remembers each search's token and page size, and says 3 credits per page.
const calls: { token: string | null; limit: number }[] = [];
let creditsLeft = 766;
const server = setupServer(
  http.post(`${JOBHUNTER_URL}/jobs/search`, async ({ request }) => {
    const body = (await request.json()) as { limit: number };
    calls.push({ token: request.headers.get('authorization'), limit: body.limit });
    const page = loadSearchResponse();
    page.metadata.credits_remaining = creditsLeft;
    return HttpResponse.json(page);
  }),
);

type Pool = {
  keyPool: {
    free: number;
    assigned: number;
    empty: number;
    keys: { id: number; status: string; holder: string | null; used: number }[];
    requests: { id: number; name: string }[];
  };
};

describe('Key pool', () => {
  let t: TestApp;

  beforeAll(async () => {
    server.listen({ onUnhandledFrame: 'bypass' });
    t = await createTestApp({ JOBHUNTER_API_URL: JOBHUNTER_URL, JOBHUNTER_API_TOKEN: '' });
  });
  afterAll(async () => {
    await t.app.close();
    server.close();
  });
  beforeEach(async () => {
    calls.length = 0;
    creditsLeft = 766;
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
  });

  const addKeys = (keys: string) => t.gql(ADD, { input: { keys, note: 'Seeker plan' } });

  it('adds pasted keys once, encrypted, and never sends them back', async () => {
    const res = await addKeys('jp_pool_one_1111\njp_pool_two_2222, jp_pool_one_1111 short');
    expect(res.data).toEqual({ addPoolKeys: { added: 2, duplicates: 1, invalid: 1 } });
    expect((await addKeys('jp_pool_two_2222')).data).toEqual({
      addPoolKeys: { added: 0, duplicates: 1, invalid: 0 },
    });

    const rows = await t.prisma.poolKey.findMany();
    expect(rows.map((row) => row.secret).join()).not.toContain('jp_pool');
    const pool = await t.gql(POOL);
    expect(JSON.stringify(pool.data)).not.toMatch(/jp_pool|1111|2222/);
    expect(pool.data).toMatchObject({
      keyPool: { free: 2, assigned: 0, empty: 0, limit: 500, autoApprove: true },
    });
  });

  it('is for admins only', async () => {
    const res = await t.asUser(POOL);
    expect(res.errors?.[0]?.extensions?.['apiCode']).toBe('ADMIN_ONLY');
  });

  it("gives a user's first request a key at once, with the 500 limit", async () => {
    await addKeys('jp_pool_one_1111');
    expect((await t.asUser(REQUEST)).data).toEqual({
      requestPoolKey: { state: 'APPROVED', limit: 500, used: 0, poolEmpty: true },
    });
    expect((await t.asUser(BELL)).data).toMatchObject({
      notifications: { items: [{ kind: 'KEY_APPROVED', count: 500 }] },
    });
    const pool = await t.gql<Pool>(POOL);
    expect(pool.data?.keyPool).toMatchObject({
      free: 0,
      assigned: 1,
      keys: [{ status: 'ASSIGNED', holder: 'User' }],
    });
    // The admins hear the pool is running low, but no request waits for them.
    expect((await t.gql(BELL)).data).toMatchObject({
      notifications: { items: [{ kind: 'POOL_LOW', count: 0 }] },
    });
  });

  it('imports with the lent key and stops at the limit', async () => {
    await addKeys('jp_pool_one_1111');
    await t.asUser(REQUEST);
    await t.gql('mutation { updateAppSettings(input: { poolKeyLimit: 10 }) { poolKeyLimit } }');

    // 25 jobs a page, 3 pages would cost up to 75: cut down to one page of 10.
    expect((await t.asUser(SYNC, { pageSize: 25, maxPages: 3 })).errors).toBeUndefined();
    expect(calls).toEqual([{ token: 'Bearer jp_pool_one_1111', limit: 10 }]);
    expect((await t.asUser(MINE)).data).toMatchObject({ myPoolKey: { used: 3 } });

    await t.prisma.poolKey.updateMany({ data: { used: 10 } });
    const res = await t.asUser(SYNC, { pageSize: 25, maxPages: 1 });
    expect(res.errors?.[0]?.extensions?.['apiCode']).toBe('POOL_LIMIT_REACHED');
  });

  it('tells the holder when the key runs empty', async () => {
    await addKeys('jp_pool_one_1111');
    await t.asUser(REQUEST);
    creditsLeft = 0;
    await t.asUser(SYNC, { pageSize: 25, maxPages: 1 });
    expect((await t.asUser(BELL)).data).toMatchObject({
      notifications: { items: [{ kind: 'KEY_EMPTY' }, { kind: 'KEY_APPROVED' }] },
    });
    expect((await t.gql<Pool>(POOL)).data?.keyPool).toMatchObject({ empty: 1, assigned: 0 });
  });

  it('lets admins approve a later request from the bell', async () => {
    await addKeys('jp_pool_one_1111 jp_pool_two_2222');
    await t.asUser(REQUEST);
    expect((await t.asUser(GIVE_BACK)).data).toEqual({ givePoolKeyBack: { state: 'NONE' } });

    // Not the first request any more: it waits for an admin.
    expect((await t.asUser(REQUEST)).data).toMatchObject({ requestPoolKey: { state: 'PENDING' } });
    const bell = await t.gql<{ notifications: { items: { kind: string; refId: number }[] } }>(BELL);
    const ask = bell.data?.notifications.items.find((item) => item.kind === 'KEY_REQUEST');
    expect(ask).toMatchObject({ searchName: 'User', count: 2 });

    expect((await t.gql(APPROVE, { id: ask?.refId })).data).toEqual({
      approveKeyRequest: { assigned: 1, free: 1 },
    });
    expect((await t.asUser(MINE)).data).toMatchObject({ myPoolKey: { state: 'APPROVED' } });
    // A second admin clicking the same bell is told it is done.
    const again = await t.gql(APPROVE, { id: ask?.refId });
    expect(again.errors?.[0]?.extensions?.['apiCode']).toBe('KEY_REQUEST_DONE');
  });

  it('keeps a request waiting while the pool is empty', async () => {
    const res = await t.asUser(REQUEST);
    expect(res.data).toMatchObject({ requestPoolKey: { state: 'PENDING', poolEmpty: true } });
    const pool = await t.gql<Pool>(POOL);
    const id = pool.data?.keyPool.requests[0]?.id;
    expect((await t.gql(APPROVE, { id })).errors?.[0]?.extensions?.['apiCode']).toBe('POOL_EMPTY');
  });

  it('shows a no with its note and a date to ask again', async () => {
    await t.gql(
      'mutation { updateAppSettings(input: { poolAutoApprove: false }) { poolAutoApprove } }',
    );
    await addKeys('jp_pool_one_1111');
    await t.asUser(REQUEST);
    const pool = await t.gql<Pool>(POOL);
    const id = pool.data?.keyPool.requests[0]?.id;
    expect((await t.gql(DENY, { input: { id, note: 'Try Arbeitsagentur first' } })).data).toEqual({
      denyKeyRequest: { requests: [] },
    });

    const mine = await t.asUser<{ myPoolKey: { state: string; note: string; askAgainAt: string } }>(
      MINE,
    );
    expect(mine.data?.myPoolKey).toMatchObject({
      state: 'DENIED',
      note: 'Try Arbeitsagentur first',
    });
    expect(new Date(mine.data?.myPoolKey.askAgainAt ?? 0).getTime()).toBeGreaterThan(Date.now());
    const again = await t.asUser(REQUEST);
    expect(again.errors?.[0]?.extensions?.['apiCode']).toBe('POOL_ASK_LATER');
  });

  it('returns the lent key when the user saves their own token', async () => {
    await addKeys('jp_pool_one_1111');
    await t.asUser(REQUEST);
    await t.asUser(
      'mutation { saveApiKey(input: { kind: JOBHUNTER, value: "jp_own_token" }) { kind } }',
    );

    expect((await t.asUser(MINE)).data).toMatchObject({ myPoolKey: { state: 'NONE' } });
    expect((await t.gql<Pool>(POOL)).data?.keyPool).toMatchObject({ free: 1, assigned: 0 });
    const res = await t.asUser(REQUEST);
    expect(res.errors?.[0]?.extensions?.['apiCode']).toBe('POOL_HAS_OWN_KEY');
  });

  it('takes a key back and passes it on to the next waiting user', async () => {
    await addKeys('jp_pool_one_1111');
    await t.asUser(REQUEST);
    await t.prisma.user.create({
      data: { id: 3, email: 'cara@example.com', name: 'Cara', passwordHash: 'x' },
    });
    await t.prisma.keyRequest.create({ data: { userId: 3 } });
    const pool = await t.gql<Pool>(POOL);
    const keyId = pool.data?.keyPool.keys[0]?.id;

    expect((await t.gql(TAKE_BACK, { id: keyId, passOn: true })).data).toEqual({
      takeBackPoolKey: { free: 0, assigned: 1 },
    });
    expect((await t.gql<Pool>(POOL)).data?.keyPool.keys[0]).toMatchObject({ holder: 'Cara' });
    expect((await t.asUser(BELL)).data).toMatchObject({
      notifications: { items: [{ kind: 'KEY_TAKEN_BACK' }, { kind: 'KEY_APPROVED' }] },
    });
  });
  it('cancels a waiting request', async () => {
    await t.asUser(REQUEST);
    expect((await t.asUser('mutation { cancelPoolKeyRequest { state } }')).data).toEqual({
      cancelPoolKeyRequest: { state: 'NONE' },
    });
    expect((await t.gql<Pool>(POOL)).data?.keyPool.requests).toEqual([]);
  });

  it('removes a key, telling its holder, and says when a key or request is gone', async () => {
    await addKeys('jp_pool_one_1111');
    await t.asUser(REQUEST);
    const keyId = (await t.gql<Pool>(POOL)).data?.keyPool.keys[0]?.id;

    const passOn = await t.gql(TAKE_BACK, { id: keyId, passOn: true });
    expect(passOn.errors?.[0]?.extensions?.['apiCode']).toBe('POOL_NO_REQUEST');
    expect(
      (await t.gql('mutation ($id: Int!) { removePoolKey(id: $id) { free } }', { id: keyId })).data,
    ).toEqual({ removePoolKey: { free: 0 } });
    expect((await t.asUser(BELL)).data).toMatchObject({
      notifications: { items: [{ kind: 'KEY_TAKEN_BACK' }, { kind: 'KEY_APPROVED' }] },
    });

    const gone = await t.gql(TAKE_BACK, { id: 999, passOn: false });
    expect(gone.errors?.[0]?.extensions?.['apiCode']).toBe('POOL_KEY_NOT_FOUND');
    const removeGone = await t.gql('mutation { removePoolKey(id: 999) { free } }');
    expect(removeGone.errors?.[0]?.extensions?.['apiCode']).toBe('POOL_KEY_NOT_FOUND');
    const noRequest = await t.gql(APPROVE, { id: 999 });
    expect(noRequest.errors?.[0]?.extensions?.['apiCode']).toBe('KEY_REQUEST_NOT_FOUND');
  });

  it('tells the holder once when an import reaches the limit', async () => {
    await addKeys('jp_pool_one_1111');
    await t.asUser(REQUEST);
    await t.gql('mutation { updateAppSettings(input: { poolKeyLimit: 3 }) { poolKeyLimit } }');
    await t.asUser(SYNC, { pageSize: 25, maxPages: 1 });
    expect((await t.asUser(BELL)).data).toMatchObject({
      notifications: { items: [{ kind: 'KEY_LIMIT', count: 3 }, { kind: 'KEY_APPROVED' }] },
    });
  });

  it('closes a request when the user saved their own token meanwhile', async () => {
    await t.gql(
      'mutation { updateAppSettings(input: { poolAutoApprove: false }) { poolAutoApprove } }',
    );
    await addKeys('jp_pool_one_1111');
    await t.asUser(REQUEST);
    const id = (await t.gql<Pool>(POOL)).data?.keyPool.requests[0]?.id;
    await t.prisma.keyRequest.update({ where: { id: id ?? 0 }, data: { status: 'PENDING' } });
    await t.asUser(
      'mutation { saveApiKey(input: { kind: JOBHUNTER, value: "jp_own_token" }) { kind } }',
    );
    // saveApiKey cancels it; put it back to see the admin side catch it too.
    await t.prisma.keyRequest.update({ where: { id: id ?? 0 }, data: { status: 'PENDING' } });
    const res = await t.gql(APPROVE, { id });
    expect(res.errors?.[0]?.extensions?.['apiCode']).toBe('KEY_REQUEST_DONE');
  });
});
