import { API_URL } from '@jobsearch/data';
import { HttpResponse } from 'msw';
import { graphql } from 'msw/graphql';
import { setupServer } from 'msw/node';
import { FILTER_OPTIONS, JOBS } from './fixtures';

/** Handlers for our GraphQL endpoint (MSW 3 scopes GraphQL handlers to a URL). */
export const api = graphql.link(API_URL);

/** Every request the dashboard made in the current test, so tests can check the variables. */
export const requests: { operation: string; variables: Record<string, unknown> }[] = [];

/** Ids of the jobs the test user has hidden, so hiding works like the real API. */
export const hiddenIds = new Set<string>();

export const handlers = [
  api.query('JobsPage', ({ variables }) => {
    requests.push({ operation: 'JobsPage', variables });
    const showHidden = (variables['filter'] as { hidden?: boolean } | undefined)?.hidden ?? false;
    const items = JOBS.filter((job) => hiddenIds.has(job.id) === showHidden);
    return HttpResponse.json({
      data: { jobsPage: { items, total: items.length, page: 1, pageSize: 25 } },
    });
  }),
  api.query('HiddenJobCount', () =>
    HttpResponse.json({ data: { hiddenJobCount: hiddenIds.size } }),
  ),
  api.mutation('HideJob', ({ variables }) => {
    requests.push({ operation: 'HideJob', variables });
    hiddenIds.add(variables['id'] as string);
    return HttpResponse.json({ data: { hideJob: true } });
  }),
  api.mutation('UnhideJob', ({ variables }) => {
    requests.push({ operation: 'UnhideJob', variables });
    hiddenIds.delete(variables['id'] as string);
    return HttpResponse.json({ data: { unhideJob: true } });
  }),
  api.query('JobFilterOptions', () =>
    HttpResponse.json({ data: { jobFilterOptions: FILTER_OPTIONS } }),
  ),
  api.mutation('UpdateJobStatus', ({ variables }) => {
    requests.push({ operation: 'UpdateJobStatus', variables });
    return HttpResponse.json({
      data: { updateJobStatus: { id: variables['id'], applicationStatus: variables['status'] } },
    });
  }),
];

// MSW intercepts fetch() in tests, so the real GraphQL client runs against fake responses.
export const server = setupServer(...handlers);
