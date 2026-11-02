import { ClientError, GraphQLClient } from 'graphql-request';

const DEFAULT_API_URL = 'http://localhost:3000/graphql';

/**
 * Where the API runs. The Vite apps read VITE_API_URL and the Next.js app reads
 * NEXT_PUBLIC_API_URL; both bundlers write the value into the code at build time.
 */
export const API_URL: string = viteApiUrl() ?? nextApiUrl() ?? DEFAULT_API_URL;

function viteApiUrl(): string | undefined {
  // Next.js has no import.meta.env, so read it carefully.
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.['VITE_API_URL'];
}

// Typed here because the Vite apps don't load Node's types.
declare const process: { env: { NEXT_PUBLIC_API_URL?: string } } | undefined;

function nextApiUrl(): string | undefined {
  // Vite has no `process` in the browser. Next.js needs the exact text
  // `process.env.NEXT_PUBLIC_API_URL` to put the value in.
  if (typeof process === 'undefined') return undefined;
  return process.env.NEXT_PUBLIC_API_URL;
}

// credentials: 'include' sends the httpOnly session cookie with every request, even though
// the API runs on another port (a different origin) than the page.
export const graphqlClient = new GraphQLClient(API_URL, { credentials: 'include' });

/** True when the API said "log in first" (no session cookie, or it expired). */
export function isUnauthenticated(error: unknown): boolean {
  return (
    error instanceof ClientError &&
    // Typed as always present, but a server error can arrive without extensions.
    (error.response.errors ?? []).some(
      (e) => (e.extensions as Record<string, unknown> | undefined)?.['code'] === 'UNAUTHENTICATED',
    )
  );
}

/**
 * A failed upload (these go over plain HTTP, not GraphQL). `code` and `params` are the API's
 * error code and its values; the message is the English fallback.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly params?: Record<string, string | number>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Reads the error body of a failed upload: `{ message, code?, params? }`. */
export function apiErrorFrom(body: unknown, fallback: string): ApiError {
  const { message, code, params } = (body ?? {}) as Record<string, unknown>;
  return new ApiError(
    typeof message === 'string' ? message : fallback,
    typeof code === 'string' ? code : undefined,
    typeof params === 'object' && params !== null
      ? (params as Record<string, string | number>)
      : undefined,
  );
}

/** What the API said went wrong, as a code the web app can translate. */
export interface ErrorCode {
  code: string;
  params: Record<string, string | number>;
}

/** The API's error code for a failed request, or null for errors that have none. */
export function getErrorCode(error: unknown): ErrorCode | null {
  if (error instanceof ApiError) {
    return error.code ? { code: error.code, params: error.params ?? {} } : null;
  }
  if (error instanceof ClientError) {
    const extensions = error.response.errors?.[0]?.extensions as
      Record<string, unknown> | undefined;
    const code = extensions?.['apiCode'];
    if (typeof code !== 'string') return null;
    return { code, params: (extensions?.['apiParams'] ?? {}) as ErrorCode['params'] };
  }
  return null;
}

/** Turns a failed request into something you can show the user. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ClientError) {
    return error.response.errors?.[0]?.message ?? `Request failed (${error.response.status})`;
  }
  if (error instanceof TypeError) {
    return `Can't reach the API at ${API_URL}. Is it running?`;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
