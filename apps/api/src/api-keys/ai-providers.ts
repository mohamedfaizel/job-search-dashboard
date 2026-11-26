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

/** The tokens one AI call used, as the provider reports them. */
export interface AiUsage {
  /** Prompt tokens read at the full price. */
  input: number;
  output: number;
  /** Prompt tokens written to Claude's cache (about 1.25x the input price). */
  cacheWrite: number;
  /** Prompt tokens read from the cache (a tenth of the input price or less). */
  cacheRead: number;
}

/** A prompt in two parts: `start` comes first and, with `cache`, is kept in Claude's cache. */
export interface SplitPrompt {
  start: string;
  job: string;
  /** Mark `start` for Claude's prompt cache. Only worth it when another call reuses it soon. */
  cache: boolean;
}

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
  return (await completeWithUsage(provider, key, model, prompt, options)).text;
}

/** One user message: plain text, or the two parts with the cache mark on the first. */
function anthropicContent(prompt: string | SplitPrompt) {
  if (typeof prompt === 'string') return prompt;
  return [
    {
      type: 'text',
      text: prompt.start,
      ...(prompt.cache ? { cache_control: { type: 'ephemeral' } } : {}),
    },
    { type: 'text', text: prompt.job },
  ];
}

const joined = (prompt: string | SplitPrompt) =>
  typeof prompt === 'string' ? prompt : `${prompt.start}\n\n${prompt.job}`;

/**
 * Like completeWithKey, and also says how many tokens the call used, so the app can show what a
 * kit really cost. A split prompt sends its same-for-every-job part first: Claude can cache it,
 * and OpenAI caches a long same start by itself.
 */
export async function completeWithUsage(
  provider: AiProvider,
  key: string,
  model: string,
  prompt: string | SplitPrompt,
  options: { maxTokens?: number; timeoutMs?: number } = {},
): Promise<{ text: string; usage: AiUsage }> {
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
            ? {
                model,
                max_tokens: maxTokens,
                messages: [{ role: 'user', content: anthropicContent(prompt) }],
              }
            : { model, messages: [{ role: 'user', content: joined(prompt) }] },
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
    usage?: RawUsage;
  } | null;
  const text = anthropic
    ? (body?.content ?? [])
        .filter((part) => part.type === 'text')
        .map((part) => part.text ?? '')
        .join('')
    : (body?.choices?.[0]?.message?.content ?? '');
  if (!text.trim()) throw new AiCallError('The AI provider sent an empty answer.');
  return { text, usage: usageOf(anthropic, body?.usage) };
}

/** Token counts as Claude (input_tokens…) or OpenAI (prompt_tokens…) send them. */
interface RawUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

function usageOf(anthropic: boolean, usage: RawUsage | undefined): AiUsage {
  if (anthropic) {
    return {
      input: usage?.input_tokens ?? 0,
      output: usage?.output_tokens ?? 0,
      cacheWrite: usage?.cache_creation_input_tokens ?? 0,
      cacheRead: usage?.cache_read_input_tokens ?? 0,
    };
  }
  // OpenAI counts cached tokens inside prompt_tokens.
  const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;
  return {
    input: Math.max(0, (usage?.prompt_tokens ?? 0) - cached),
    output: usage?.completion_tokens ?? 0,
    cacheWrite: 0,
    cacheRead: cached,
  };
}
