import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiProvider } from '../generated/prisma/enums';
import { AiCallError, completeWithKey } from './ai-providers';

const answer = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body, { status }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('completeWithKey', () => {
  it('asks Claude with the key and joins its text parts', async () => {
    const spy = answer(200, {
      content: [
        { type: 'text', text: 'One ' },
        { type: 'tool_use' },
        { type: 'text', text: 'two' },
      ],
    });
    await expect(completeWithKey(AiProvider.ANTHROPIC, 'sk-ant', 'claude-x', 'Hi')).resolves.toBe(
      'One two',
    );
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init!.headers as Record<string, string>)['x-api-key']).toBe('sk-ant');
    expect(JSON.parse(init!.body as string)).toMatchObject({
      model: 'claude-x',
      messages: [{ role: 'user', content: 'Hi' }],
    });
  });

  it('asks OpenAI with a bearer key', async () => {
    const spy = answer(200, { choices: [{ message: { content: 'Hello' } }] });
    await expect(completeWithKey(AiProvider.OPENAI, 'sk-oa', 'gpt-x', 'Hi')).resolves.toBe('Hello');
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init!.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-oa');
  });

  it('says what went wrong in one sentence', async () => {
    answer(401, {});
    await expect(completeWithKey(AiProvider.OPENAI, 'k', 'm', 'Hi')).rejects.toThrow(/refused/);
    answer(500, {});
    await expect(completeWithKey(AiProvider.OPENAI, 'k', 'm', 'Hi')).rejects.toThrow(
      /answered 500/,
    );
    answer(200, { choices: [] });
    await expect(completeWithKey(AiProvider.OPENAI, 'k', 'm', 'Hi')).rejects.toBeInstanceOf(
      AiCallError,
    );
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(completeWithKey(AiProvider.ANTHROPIC, 'k', 'm', 'Hi')).rejects.toThrow(
      /not reachable/,
    );
  });
});
