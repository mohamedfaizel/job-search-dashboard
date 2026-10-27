import { ConfigService } from '@nestjs/config';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ResumeMatcherClient } from './resume-matcher.client';
import { ResumeMatcherService } from './resume-matcher.service';

const RM_URL = 'http://resume-matcher.test';

// Fake Resume-Matcher. Each test adds the answers it needs with server.use().
const calls: string[] = [];
const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  calls.length = 0;
});
afterAll(() => {
  server.close();
});

const healthy = http.get(`${RM_URL}/api/v1/health`, () => {
  calls.push('health');
  return HttpResponse.json({ status: 'healthy' });
});
const statusWith = (llm: { llm_configured: boolean; llm_healthy: boolean }) =>
  http.get(`${RM_URL}/api/v1/status`, () => {
    calls.push('status');
    return HttpResponse.json({ status: 'ready', has_master_resume: false, ...llm });
  });

function serviceWith(url: string | undefined) {
  const client = new ResumeMatcherClient(new ConfigService({ RESUME_MATCHER_URL: url }));
  return new ResumeMatcherService(client);
}

describe('ResumeMatcherService.getStatus', () => {
  it('reports the feature as off when RESUME_MATCHER_URL is not set', async () => {
    const status = await serviceWith(undefined).getStatus(true);

    expect(status).toMatchObject({ configured: false, reachable: false, aiHealthy: null });
    expect(status.message).toContain('RESUME_MATCHER_URL');
    expect(calls).toEqual([]);
  });

  it('only calls /health unless the AI check is asked for', async () => {
    server.use(healthy, statusWith({ llm_configured: true, llm_healthy: true }));

    const status = await serviceWith(`${RM_URL}/`).getStatus(false);

    expect(status).toEqual({
      configured: true,
      reachable: true,
      aiConfigured: null,
      aiHealthy: null,
      message: 'Resume-Matcher is running.',
    });
    // /status sends a paid test message to the AI provider, so it must not run here.
    expect(calls).toEqual(['health']);
  });

  it('checks the AI provider when asked', async () => {
    server.use(healthy, statusWith({ llm_configured: true, llm_healthy: true }));

    const status = await serviceWith(RM_URL).getStatus(true);

    expect(status).toMatchObject({ reachable: true, aiConfigured: true, aiHealthy: true });
    expect(status.message).toBe('Resume-Matcher is running and the AI provider answered.');
    expect(calls).toEqual(['health', 'status']);
  });

  it('says to add the key when none is set', async () => {
    server.use(healthy, statusWith({ llm_configured: false, llm_healthy: false }));

    const status = await serviceWith(RM_URL).getStatus(true);

    expect(status).toMatchObject({ aiConfigured: false, aiHealthy: false });
    expect(status.message).toContain('ANTHROPIC_API_KEY');
  });

  it('says how to start it when the container is down', async () => {
    server.use(http.get(`${RM_URL}/api/v1/health`, () => HttpResponse.error()));

    const status = await serviceWith(RM_URL).getStatus(true);

    expect(status).toMatchObject({ configured: true, reachable: false, aiHealthy: null });
    expect(status.message).toBe(
      `Resume-Matcher at ${RM_URL} is not reachable. Start it with pnpm rm:up.`,
    );
  });

  it('reports an HTTP error from the AI check', async () => {
    server.use(
      healthy,
      http.get(`${RM_URL}/api/v1/status`, () => new HttpResponse(null, { status: 500 })),
    );

    const status = await serviceWith(RM_URL).getStatus(true);

    expect(status).toMatchObject({ reachable: true, aiHealthy: null });
    expect(status.message).toContain('/status failed: 500');
  });
});
