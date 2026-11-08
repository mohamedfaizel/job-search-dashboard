import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSearchResponse } from './fixtures/load';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const JOBHUNTER_URL = 'https://jobhunter.test/v1';

const MY_KEYS = /* GraphQL */ `
  query {
    myApiKeys {
      kind
      last4
      model
      credits
    }
  }
`;
const SAVE = /* GraphQL */ `
  mutation ($input: SaveApiKeyInput!) {
    saveApiKey(input: $input) {
      kind
      last4
    }
  }
`;
const DELETE = /* GraphQL */ `
  mutation ($kind: ApiKeyKind!) {
    deleteApiKey(kind: $kind)
  }
`;
const TEST = /* GraphQL */ `
  mutation ($kind: ApiKeyKind!) {
    testApiKey(kind: $kind) {
      ok
      credits
      error
    }
  }
`;
const SYNC = /* GraphQL */ `
  mutation {
    syncJobs(input: { titles: ["frontend"] }) {
      created
    }
  }
`;

// Fake JobHunter that remembers which token each search came with.
const tokens: (string | null)[] = [];
const server = setupServer(
  // Free key checks: the providers list their models, or refuse the key.
  http.get('https://api.anthropic.com/v1/models', ({ request }) =>
    request.headers.get('x-api-key') === 'sk-ant-good-key'
      ? HttpResponse.json({
          data: [{ id: 'claude-sonnet-5-5-20261001' }, { id: 'claude-haiku-5-5' }],
        })
      : new HttpResponse(null, { status: 401 }),
  ),
  http.get('https://api.openai.com/v1/models', () =>
    HttpResponse.json({ data: [{ id: 'gpt-5-mini' }, { id: 'gpt-5' }] }),
  ),
  http.post(`${JOBHUNTER_URL}/jobs/search`, ({ request }) => {
    tokens.push(request.headers.get('authorization'));
    return HttpResponse.json(loadSearchResponse());
  }),
);

describe('API keys (Settings)', () => {
  let t: TestApp;

  beforeAll(async () => {
    server.listen({ onUnhandledFrame: 'bypass' });
    t = await createTestApp({
      JOBHUNTER_API_URL: JOBHUNTER_URL,
      JOBHUNTER_API_TOKEN: 'jp_from_env',
      ANTHROPIC_API_KEY: 'sk-ant-from-env',
      RM_LLM_MODEL: 'claude-haiku-5-5',
    });
  });
  afterAll(async () => {
    await t.app.close();
    server.close();
  });
  beforeEach(async () => {
    tokens.length = 0;
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
  });

  it('saves a key encrypted and shows only its last 4 characters', async () => {
    const saved = await t.asUser(SAVE, {
      input: { kind: 'JOBHUNTER', value: '  jp_user_secret_9F2a ' },
    });
    expect(saved.data).toEqual({ saveApiKey: { kind: 'JOBHUNTER', last4: '9F2a' } });

    const row = await t.prisma.apiKey.findFirstOrThrow({ where: { userId: 2 } });
    expect(row.secret).not.toContain('jp_user_secret');

    const list = await t.asUser(MY_KEYS);
    expect(list.data).toEqual({
      myApiKeys: [{ kind: 'JOBHUNTER', last4: '9F2a', model: null, credits: null }],
    });
  });

  it('refuses something that is not a key', async () => {
    const res = await t.asUser(SAVE, { input: { kind: 'JOBHUNTER', value: 'two words here' } });
    expect(res.errors?.[0]?.extensions?.['apiCode']).toBe('API_KEY_INVALID');
  });

  it("imports with the caller's own token and remembers the credits left", async () => {
    await t.asUser(SAVE, { input: { kind: 'JOBHUNTER', value: 'jp_user_token' } });

    expect((await t.asUser(SYNC)).errors).toBeUndefined();

    expect(tokens).toEqual(['Bearer jp_user_token']);
    const list = await t.asUser<{ myApiKeys: { credits: number }[] }>(MY_KEYS);
    expect(list.data?.myApiKeys[0]?.credits).toBe(766);
  });

  it('asks a user without a token to add one', async () => {
    const res = await t.asUser(SYNC);
    expect(res.errors?.[0]?.extensions?.['apiCode']).toBe('JOBHUNTER_TOKEN_MISSING');
    expect(tokens).toEqual([]);
  });

  it('copies the .env token into the first account once, never to others', async () => {
    const admin = await t.gql(MY_KEYS);
    expect(admin.data).toMatchObject({
      myApiKeys: [
        { kind: 'JOBHUNTER', last4: '_env' },
        { kind: 'ANTHROPIC', last4: '-env', model: 'claude-haiku-5-5' },
      ],
    });
    expect((await t.asUser(MY_KEYS)).data).toEqual({ myApiKeys: [] });

    // Deleted stays deleted, even while .env still has the token.
    expect((await t.gql(DELETE, { kind: 'JOBHUNTER' })).data).toEqual({ deleteApiKey: true });
    expect((await t.gql(MY_KEYS)).data).toMatchObject({ myApiKeys: [{ kind: 'ANTHROPIC' }] });
  });

  it('copies a .env key added later once, after the others were copied', async () => {
    await t.prisma.user.update({ where: { id: 1 }, data: { adoptedEnvKeys: ['JOBHUNTER'] } });

    const admin = await t.gql<{ myApiKeys: { kind: string }[] }>(MY_KEYS);

    expect(admin.data?.myApiKeys.map((key) => key.kind)).toEqual(['ANTHROPIC']);
  });

  it('tests a Claude key for free and checks the model exists', async () => {
    await t.asUser(SAVE, { input: { kind: 'ANTHROPIC', value: 'sk-ant-good-key' } });
    // The default model is an alias of a dated id in the list.
    expect((await t.asUser(TEST, { kind: 'ANTHROPIC' })).data).toEqual({
      testApiKey: { ok: true, credits: null, error: null },
    });

    await t.asUser(`mutation { setApiKeyModel(kind: ANTHROPIC, model: "claude-nope") { model } }`);
    const wrongModel = await t.asUser<{ testApiKey: { ok: boolean; error: string } }>(TEST, {
      kind: 'ANTHROPIC',
    });
    expect(wrongModel.data?.testApiKey).toMatchObject({ ok: false });
    expect(wrongModel.data?.testApiKey.error).toContain('claude-nope');

    await t.asUser(SAVE, { input: { kind: 'ANTHROPIC', value: 'sk-ant-bad-key' } });
    const refused = await t.asUser<{ testApiKey: { ok: boolean; error: string } }>(TEST, {
      kind: 'ANTHROPIC',
    });
    expect(refused.data?.testApiKey.error).toContain('refused');
  });

  it('tests an OpenAI key with the model you typed', async () => {
    await t.asUser(SAVE, { input: { kind: 'OPENAI', value: 'sk-openai-key', model: 'gpt-5' } });

    const res = await t.asUser(TEST, { kind: 'OPENAI' });

    expect(res.data).toEqual({ testApiKey: { ok: true, credits: null, error: null } });
  });

  it('remembers which AI you picked', async () => {
    const me = `query { me { aiProvider } }`;
    expect((await t.asUser(me)).data).toEqual({ me: { aiProvider: 'ANTHROPIC' } });

    await t.asUser(`mutation { setAiProvider(provider: OPENAI) { aiProvider } }`);

    expect((await t.asUser(me)).data).toEqual({ me: { aiProvider: 'OPENAI' } });
  });

  it('tests a JobHunter token with a one-job search', async () => {
    await t.asUser(SAVE, { input: { kind: 'JOBHUNTER', value: 'jp_user_token' } });

    const res = await t.asUser(TEST, { kind: 'JOBHUNTER' });

    expect(res.data).toEqual({ testApiKey: { ok: true, credits: 766, error: null } });
    expect(tokens).toEqual(['Bearer jp_user_token']);
  });

  it("keeps each user's saved searches apart", async () => {
    const create = `mutation { createSavedSearch(input: { name: "Mine", titles: ["x"] }) { id } }`;
    const mine = await t.asUser<{ createSavedSearch: { id: number } }>(create);
    // The same name is fine for someone else.
    expect((await t.gql(create)).errors).toBeUndefined();

    const id = mine.data!.createSavedSearch.id;
    const run = await t.gql(`mutation { runSavedSearch(id: ${id}) { created } }`);
    expect(run.errors?.[0]?.extensions?.['apiCode']).toBe('SAVED_SEARCH_NOT_FOUND');
    const theirs = await t.gql<{ savedSearches: { id: number }[] }>(
      `query { savedSearches { id } }`,
    );
    expect(theirs.data?.savedSearches.map((s) => s.id)).not.toContain(id);
  });

  it('saves notification settings apart from the profile', async () => {
    const res = await t.asUser(
      `mutation { updateNotificationSettings(input: { notifyNewMatches: false, matchFitMin: 75 }) {
        notifyNewMatches matchFitMin } }`,
    );
    expect(res.data).toEqual({
      updateNotificationSettings: { notifyNewMatches: false, matchFitMin: 75 },
    });
  });
});
