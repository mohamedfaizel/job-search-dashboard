import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp } from './helpers';

const RM_URL = 'http://resume-matcher.test';

const STATUS = /* GraphQL */ `
  query Status($checkAi: Boolean) {
    resumeMatcherStatus(checkAi: $checkAi) {
      configured
      reachable
      aiConfigured
      aiHealthy
      message
    }
  }
`;

// Fake Resume-Matcher container.
const server = setupServer(
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
      message: 'Resume-Matcher is running.',
    });
  });

  it('checks the AI provider on request', async () => {
    const res = await t.asUser<{ resumeMatcherStatus: Record<string, unknown> }>(STATUS, {
      checkAi: true,
    });

    expect(res.data?.resumeMatcherStatus).toMatchObject({ aiConfigured: true, aiHealthy: true });
  });
});
