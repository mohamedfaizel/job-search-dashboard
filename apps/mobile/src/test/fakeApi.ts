import type { AppNotification, Job } from '@jobsearch/data';

/** What a fake operation answers: GraphQL's { data } or { errors }. */
type Answer = { data: unknown } | { errors: { message: string; extensions?: object }[] };
type Handler = (variables: Record<string, unknown>) => Answer;

export interface Call {
  operation: string;
  variables: Record<string, unknown>;
}

/**
 * Answers the app's GraphQL requests by operation name (Me, LogIn, JobsPage…), like the web
 * tests' MSW server. Returns the list of requests made, to check what the app sent.
 */
export function fakeApi(handlers: Record<string, Handler>): Call[] {
  const calls: Call[] = [];
  jest.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
    const body = JSON.parse(init?.body as string) as {
      query: string;
      variables?: Record<string, unknown>;
    };
    const operation = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? '';
    const variables = body.variables ?? {};
    calls.push({ operation, variables });
    const handler = handlers[operation];
    const answer = handler
      ? handler(variables)
      : { errors: [{ message: `No fake for ${operation}` }] };
    return Promise.resolve(
      new Response(JSON.stringify(answer), { headers: { 'Content-Type': 'application/json' } }),
    );
  });
  return calls;
}

export const user = {
  id: 1,
  email: 'ada@example.com',
  name: 'Ada',
  role: 'USER',
  locale: 'en',
  aiProvider: 'CLAUDE',
  onboarded: true,
};

/** A job with only what the list shows; the rest is filled with empty values. */
export function job(over: Partial<Job> & Pick<Job, 'id' | 'title'>): Job {
  return {
    source: 'MANUAL',
    company: { id: 1, name: 'Acme', logoUrl: null },
    url: null,
    postedAt: '2026-11-01T10:00:00.000Z',
    seniority: null,
    jobFunction: null,
    skills: [],
    city: null,
    countryCode: null,
    language: null,
    salaryMinUsd: null,
    salaryMaxUsd: null,
    salaryEstimated: false,
    provider: null,
    workplace: null,
    visa: null,
    industry: null,
    description: null,
    postingStatus: 'active',
    checkedAt: null,
    lastCheck: null,
    checkReason: null,
    applicationStatus: 'NONE',
    matchStatus: null,
    matchScore: null,
    fitScore: null,
    fitEstimate: false,
    applyScore: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    ...over,
  };
}

/** A 🔔 notification: by default, unread new jobs from the search "Data jobs". */
export function notification(over: Partial<AppNotification> & Pick<AppNotification, 'id'>) {
  return {
    kind: 'NEW_MATCHES',
    searchName: 'Data jobs',
    count: 1,
    fitMin: 60,
    jobs: [{ id: '5', title: 'Data Engineer', company: 'HelloFresh', fit: 82 }],
    at: null,
    refId: null,
    hidden: 0,
    kept: 0,
    undone: false,
    failed: 0,
    belowTarget: 0,
    target: null,
    reason: null,
    briefing: null,
    weekly: null,
    readAt: null,
    createdAt: '2026-11-09T08:00:00.000Z',
    ...over,
  } satisfies AppNotification;
}
