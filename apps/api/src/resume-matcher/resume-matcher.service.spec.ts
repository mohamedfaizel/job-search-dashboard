import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { RM_UNAVAILABLE, ResumeMatcherClient } from './resume-matcher.client';
import { ResumeMatcherService } from './resume-matcher.service';
import type { RmAiQueue, UserAi } from './rm-ai-queue';

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
const CLAUDE: UserAi = { provider: 'ANTHROPIC', model: 'claude-sonnet-5-5', key: 'sk-ant-x' };
const statusWith = (llm: { llm_configured: boolean; llm_healthy: boolean }) =>
  http.get(`${RM_URL}/api/v1/status`, () => {
    calls.push('status');
    return HttpResponse.json({ status: 'ready', has_master_resume: false, ...llm });
  });

/** A queue that runs at once: the swap itself is tested in rm-ai-queue.spec.ts. */
function fakeQueue(ai: UserAi | null): RmAiQueue {
  return {
    userAi: () =>
      ai ? Promise.resolve(ai) : Promise.reject(new BadRequestException('Add your key')),
    run: <T>(_ai: UserAi, call: () => Promise<T>) => {
      calls.push('swap');
      return call();
    },
  } as unknown as RmAiQueue;
}

function serviceWith(url: string | undefined, ai: UserAi | null = CLAUDE) {
  // '' rather than undefined, or ConfigService falls back to a RESUME_MATCHER_URL in the shell.
  const client = new ResumeMatcherClient(new ConfigService({ RESUME_MATCHER_URL: url ?? '' }));
  return new ResumeMatcherService(client, fakeQueue(ai));
}

describe('ResumeMatcherService.getStatus', () => {
  it('reports the feature as off when RESUME_MATCHER_URL is not set', async () => {
    const status = await serviceWith(undefined).getStatus(1, true, true);

    expect(status).toMatchObject({ configured: false, reachable: false, aiHealthy: null });
    expect(status.message).toContain('RESUME_MATCHER_URL');
    expect(calls).toEqual([]);
  });

  it('only calls /health unless the AI check is asked for', async () => {
    server.use(healthy, statusWith({ llm_configured: true, llm_healthy: true }));

    const status = await serviceWith(`${RM_URL}/`).getStatus(1, false);

    expect(status).toEqual({
      configured: true,
      reachable: true,
      aiConfigured: null,
      aiHealthy: null,
      aiProvider: 'Claude',
      aiModel: 'claude-sonnet-5-5',
      message: 'Resume-Matcher is running.',
      error: null,
    });
    // /status sends a paid test message to the AI provider, so it must not run here.
    expect(calls).toEqual(['health']);
  });

  it('checks your AI with your key when asked', async () => {
    server.use(healthy, statusWith({ llm_configured: true, llm_healthy: true }));

    const status = await serviceWith(RM_URL).getStatus(1, true);

    expect(status).toMatchObject({ reachable: true, aiConfigured: true, aiHealthy: true });
    expect(status.message).toBe('Resume-Matcher is running and Claude answered.');
    expect(calls).toEqual(['health', 'swap', 'status']);
  });

  it('says to add a key in Settings when you have none, without calling the AI', async () => {
    server.use(healthy, statusWith({ llm_configured: true, llm_healthy: true }));

    const status = await serviceWith(RM_URL, null).getStatus(1, true);

    expect(status).toMatchObject({ aiConfigured: false, aiHealthy: false, aiProvider: null });
    expect(status.message).toContain('no AI key yet');
    expect(calls).toEqual(['health']);
  });

  it('tells an admin how to start it when the container is down', async () => {
    server.use(http.get(`${RM_URL}/api/v1/health`, () => HttpResponse.error()));

    const status = await serviceWith(RM_URL).getStatus(1, true, true);

    expect(status).toMatchObject({ configured: true, reachable: false, aiHealthy: null });
    expect(status.message).toBe(
      `Resume-Matcher at ${RM_URL} is not reachable. Start it with pnpm rm:up.`,
    );
  });

  it('tells a normal user only that it is not available, without the server setup', async () => {
    server.use(http.get(`${RM_URL}/api/v1/health`, () => HttpResponse.error()));

    expect((await serviceWith(RM_URL).getStatus(2, true)).message).toBe(RM_UNAVAILABLE);
    expect((await serviceWith(undefined).getStatus(2, true)).message).toBe(RM_UNAVAILABLE);
  });

  it('reports an HTTP error from the AI check', async () => {
    server.use(
      healthy,
      http.get(`${RM_URL}/api/v1/status`, () => new HttpResponse(null, { status: 500 })),
    );

    const status = await serviceWith(RM_URL).getStatus(1, true);

    expect(status).toMatchObject({ reachable: true, aiHealthy: null });
    expect(status.message).toContain('/status failed: 500');
  });

  it('names your provider and model when it does not answer', async () => {
    server.use(healthy, statusWith({ llm_configured: true, llm_healthy: false }));
    const openai: UserAi = { provider: 'OPENAI', model: 'gpt-5-mini', key: 'sk-x' };

    const status = await serviceWith(RM_URL, openai).getStatus(1, true);

    expect(status).toMatchObject({ aiProvider: 'OpenAI', aiModel: 'gpt-5-mini', aiHealthy: false });
    expect(status.message).toContain('OpenAI (gpt-5-mini) did not answer');
  });
});
