import { ClientError, GraphQLClient } from 'graphql-request';

const DEFAULT_API_URL = 'http://localhost:3000/graphql';

/** Set VITE_API_URL to point the frontends at a deployed API. */
export const API_URL: string =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? DEFAULT_API_URL;

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
