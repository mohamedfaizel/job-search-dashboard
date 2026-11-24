import { AiProvider, ApiKeyKind } from '../generated/prisma/enums';

/**
 * The two AI providers you can pick in Settings > API keys, and how each one is named where it
 * matters: its key in our store, its name in Resume-Matcher, and the model used when you
 * leave the model box empty.
 */
export const AI_PROVIDERS = {
  [AiProvider.ANTHROPIC]: {
    kind: ApiKeyKind.ANTHROPIC,
    rmName: 'anthropic',
    defaultModel: 'claude-sonnet-5-5',
    modelsUrl: 'https://api.anthropic.com/v1/models?limit=1000',
  },
  [AiProvider.OPENAI]: {
    kind: ApiKeyKind.OPENAI,
    rmName: 'openai',
    defaultModel: 'gpt-5-mini',
    modelsUrl: 'https://api.openai.com/v1/models',
  },
} as const;

export function providerOfKind(kind: ApiKeyKind): AiProvider | null {
  if (kind === ApiKeyKind.ANTHROPIC) return AiProvider.ANTHROPIC;
  if (kind === ApiKeyKind.OPENAI) return AiProvider.OPENAI;
  return null;
}

const CHECK_TIMEOUT_MS = 15_000;

/**
 * Checks an AI key for free: listing the provider's models costs nothing, and it also tells
 * whether the model you typed exists for this key. Returns null when all is well, else what
 * went wrong in one sentence.
 */
export async function checkAiKey(
  provider: AiProvider,
  key: string,
  model: string,
): Promise<string | null> {
  const { modelsUrl } = AI_PROVIDERS[provider];
  const headers: Record<string, string> =
    provider === AiProvider.ANTHROPIC
      ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
      : { Authorization: `Bearer ${key}` };
  let res: Response;
  try {
    res = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
  } catch {
    return `${new URL(modelsUrl).host} is not reachable. Try again in a minute.`;
  }
  if (res.status === 401 || res.status === 403) {
    return 'The key was refused (401): it is wrong, revoked or has no access.';
  }
  if (!res.ok) return `The provider answered ${res.status}. Try again in a minute.`;
  const body = (await res.json().catch(() => null)) as { data?: { id?: unknown }[] } | null;
  const ids = (body?.data ?? [])
    .map((m) => m.id)
    .filter((id): id is string => typeof id === 'string');
  // An alias such as claude-sonnet-5-5 stands for a dated id such as claude-sonnet-5-5-20261001.
  const known = ids.some((id) => id === model || id.startsWith(`${model}-`));
  if (ids.length > 0 && !known) {
    return `The model "${model}" is not available for this key.`;
  }
  return null;
}

const COMPLETE_TIMEOUT_MS = 90_000;

/** Why an AI call did not give an answer, in one sentence the screen can show. */
export class AiCallError extends Error {}

/**
 * Asks the provider one question with the user's own key and returns the answer as text. This is
 * what "Improve with my key" uses; it costs the user's credits, so it runs only on a click.
 */
export async function completeWithKey(
  provider: AiProvider,
  key: string,
  model: string,
  prompt: string,
  options: { maxTokens?: number; timeoutMs?: number } = {},
): Promise<string> {
  const maxTokens = options.maxTokens ?? 4096;
  const anthropic = provider === AiProvider.ANTHROPIC;
  let res: Response;
  try {
    res = await fetch(
      anthropic
        ? 'https://api.anthropic.com/v1/messages'
        : 'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(anthropic
            ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
            : { Authorization: `Bearer ${key}` }),
        },
        body: JSON.stringify(
          anthropic
            ? { model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }
            : { model, messages: [{ role: 'user', content: prompt }] },
        ),
        signal: AbortSignal.timeout(options.timeoutMs ?? COMPLETE_TIMEOUT_MS),
      },
    );
  } catch {
    throw new AiCallError('The AI provider is not reachable. Try again in a minute.');
  }
  if (res.status === 401 || res.status === 403) {
    throw new AiCallError('The key was refused (401): it is wrong, revoked or has no access.', {
      cause: 'KEY_REFUSED',
    });
  }
  if (!res.ok) throw new AiCallError(`The AI provider answered ${String(res.status)}.`);
  const body = (await res.json().catch(() => null)) as {
    content?: { type?: string; text?: string }[];
    choices?: { message?: { content?: string } }[];
  } | null;
  const text = anthropic
    ? (body?.content ?? [])
        .filter((part) => part.type === 'text')
        .map((part) => part.text ?? '')
        .join('')
    : (body?.choices?.[0]?.message?.content ?? '');
  if (!text.trim()) throw new AiCallError('The AI provider sent an empty answer.');
  return text;
}
