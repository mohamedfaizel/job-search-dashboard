import { ClientError, GraphQLClient } from 'graphql-request';

const DEFAULT_API_URL = 'http://localhost:3000/graphql';

/** Set VITE_API_URL to point the frontends at a deployed API. */
export const API_URL: string =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? DEFAULT_API_URL;

export const graphqlClient = new GraphQLClient(API_URL);

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
