import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import {
  createTestApp,
  resetDatabase,
  rmConfigHandlers,
  saveAiKey,
  seedTestUsers,
} from './helpers';

const RM_URL = 'http://resume-matcher.test';

const STATUS = /* GraphQL */ `
  query Status($checkAi: Boolean) {
    resumeMatcherStatus(checkAi: $checkAi) {
      configured
      reachable
      aiConfigured
      aiHealthy
      aiProvider
      aiModel
      message
    }
  }
`;

// Fake Resume-Matcher container.
const rmLog: string[] = [];
const server = setupServer(
  ...rmConfigHandlers(RM_URL, rmLog),
  http.get(`${RM_URL}/api/v1/health`, () => HttpResponse.json({ status: 'healthy' })),
  http.get(`${RM_URL}/api/v1/status`, () =>
    HttpResponse.json({
      status: 'ready',
      llm_configured: true,
      llm_healthy: true,
      has_master_resume: false,
    }),
  ),
);

describe('resumeMatcherStatus', () => {
  let t: TestApp;

  beforeAll(async () => {
    // Let local requests (supertest -> our API) through; only Resume-Matcher is faked.
    server.listen({ onUnhandledFrame: 'bypass' });
    t = await createTestApp({ RESUME_MATCHER_URL: RM_URL });
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
    await saveAiKey(t.asUser, 'sk-ant-user-two');
  });

  afterAll(async () => {
    server.close();
    await t.app.close();
  });

  it('needs a login', async () => {
    const res = await t.anonymous(STATUS);
    expect(res.errors?.[0]?.message).toBe('Please log in');
  });

  it('tells a regular user whether Resume-Matcher is running', async () => {
    const res = await t.asUser<{ resumeMatcherStatus: Record<string, unknown> }>(STATUS);

    expect(res.data?.resumeMatcherStatus).toEqual({
      configured: true,
      reachable: true,
      aiConfigured: null,
      aiHealthy: null,
      aiProvider: 'Claude',
      aiModel: 'claude-sonnet-5-5',
      message: 'Resume-Matcher is running.',
    });
  });

  it('checks your AI with your own key on request', async () => {
    const res = await t.asUser<{ resumeMatcherStatus: Record<string, unknown> }>(STATUS, {
      checkAi: true,
    });

    expect(res.data?.resumeMatcherStatus).toMatchObject({ aiConfigured: true, aiHealthy: true });
    expect(rmLog).toEqual([
      'keys {"anthropic":"sk-ant-user-two"}',
      'llm anthropic claude-sonnet-5-5',
      'keys {"anthropic":"","openai":""}',
    ]);
  });

  it('switches to OpenAI with the model you typed', async () => {
    rmLog.length = 0;
    await t.asUser(
      `mutation { saveApiKey(input: { kind: OPENAI, value: "sk-openai-two", model: "gpt-5" }) { kind } }`,
    );
    const picked = await t.asUser<{ setAiProvider: { aiProvider: string } }>(
      `mutation { setAiProvider(provider: OPENAI) { aiProvider } }`,
    );
    expect(picked.data?.setAiProvider.aiProvider).toBe('OPENAI');

    await t.asUser(STATUS, { checkAi: true });

    expect(rmLog.slice(0, 2)).toEqual(['keys {"openai":"sk-openai-two"}', 'llm openai gpt-5']);
  });

  it('says to add a key when you have none', async () => {
    const res = await t.gql<{ resumeMatcherStatus: Record<string, unknown> }>(STATUS, {
      checkAi: true,
    });

    expect(res.data?.resumeMatcherStatus).toMatchObject({ aiConfigured: false, aiProvider: null });
  });
});
