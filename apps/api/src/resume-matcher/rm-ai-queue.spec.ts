import { ConfigService } from '@nestjs/config';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ApiKeysService } from '../api-keys/api-keys.service';
import type { PrismaService } from '../prisma/prisma.service';
import { ResumeMatcherClient } from './resume-matcher.client';
import { RmAiQueue } from './rm-ai-queue';

const RM_URL = 'http://resume-matcher.test';

// Fake Resume-Matcher that writes down every settings change, in order.
const log: string[] = [];
const server = setupServer(
  http.post(`${RM_URL}/api/v1/config/api-keys`, async ({ request }) => {
    log.push(`keys ${JSON.stringify(await request.json())}`);
    return HttpResponse.json({ message: 'ok', updated_providers: [] });
  }),
  http.put(`${RM_URL}/api/v1/config/llm-api-key`, async ({ request }) => {
    const body = (await request.json()) as { provider: string; model: string; api_base: null };
    log.push(`llm ${body.provider} ${body.model} base=${String(body.api_base)}`);
    return HttpResponse.json({ provider: body.provider, model: body.model, api_key: '…' });
  }),
);
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  log.length = 0;
});
afterAll(() => {
  server.close();
});

/** User 1 picked Claude with a key; user 2 picked OpenAI with its own model; user 3 has no key. */
function queue() {
  const prisma = {
    user: {
      findUnique: ({ where }: { where: { id: number } }) =>
        Promise.resolve({ aiProvider: where.id === 2 ? 'OPENAI' : 'ANTHROPIC' }),
    },
  } as unknown as PrismaService;
  const keys = {
    aiKey: (userId: number, kind: string) =>
      Promise.resolve(
        userId === 1 && kind === 'ANTHROPIC'
          ? { key: 'sk-ant-one', model: null }
          : userId === 2 && kind === 'OPENAI'
            ? { key: 'sk-two', model: 'gpt-5' }
            : null,
      ),
  } as unknown as ApiKeysService;
  const client = new ResumeMatcherClient(new ConfigService({ RESUME_MATCHER_URL: RM_URL }));
  return new RmAiQueue(prisma, keys, client);
}

describe('RmAiQueue', () => {
  it("puts the user's key and model in, runs, and takes the key out again", async () => {
    const q = queue();
    const ai = await q.userAi(1);

    const result = await q.run(ai, () => {
      log.push('run');
      return Promise.resolve(42);
    });

    expect(result).toBe(42);
    expect(log).toEqual([
      'keys {"anthropic":"sk-ant-one"}',
      'llm anthropic claude-sonnet-5-5 base=null',
      'run',
      'keys {"anthropic":"","openai":""}',
    ]);
  });

  it('uses the provider and model each user picked', async () => {
    expect(await queue().userAi(2)).toEqual({ provider: 'OPENAI', model: 'gpt-5', key: 'sk-two' });
  });

  it('asks a user without a key to add one in Settings', async () => {
    await expect(queue().userAi(3)).rejects.toMatchObject({
      response: { code: 'AI_KEY_MISSING' },
    });
  });

  it('runs one at a time, so a run never uses the wrong key', async () => {
    const q = queue();
    const [one, two] = await Promise.all([q.userAi(1), q.userAi(2)]);
    let release!: () => void;
    const first = q.run(one, async () => {
      log.push('run 1 starts');
      await new Promise<void>((resolve) => (release = resolve));
      log.push('run 1 ends');
    });
    const second = q.run(two, () => {
      log.push('run 2');
      return Promise.resolve();
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(log).not.toContain('run 2');
    release();
    await Promise.all([first, second]);

    expect(log.indexOf('run 1 ends')).toBeLessThan(log.indexOf('keys {"openai":"sk-two"}'));
    expect(log.indexOf('keys {"openai":"sk-two"}')).toBeLessThan(log.indexOf('run 2'));
  });

  it('takes the key out and lets the next run go when a run fails', async () => {
    const q = queue();
    const ai = await q.userAi(1);

    await expect(q.run(ai, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await q.run(ai, () => Promise.resolve());

    expect(log.filter((line) => line === 'keys {"anthropic":"","openai":""}')).toHaveLength(2);
  });
});
