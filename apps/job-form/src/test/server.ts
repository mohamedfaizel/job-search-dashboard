import { API_URL } from '@jobsearch/data';
import { HttpResponse } from 'msw';
import { graphql } from 'msw/graphql';
import { setupServer } from 'msw/node';

export const api = graphql.link(API_URL);

/** Requests made in the current test, so tests can check what was sent. */
export const requests: { operation: string; variables: Record<string, unknown> }[] = [];

export const server = setupServer(
  api.mutation('CreateJob', ({ variables }) => {
    requests.push({ operation: 'CreateJob', variables });
    const input = variables['input'] as { title: string; companyName: string };
    return HttpResponse.json({
      data: {
        createJob: {
          id: 'new-job',
          title: input.title,
          company: { id: 9, name: input.companyName },
        },
      },
    });
  }),
  api.mutation('SyncJobs', ({ variables }) => {
    requests.push({ operation: 'SyncJobs', variables });
    return HttpResponse.json({
      data: {
        syncJobs: {
          pages: 1,
          fetched: 25,
          created: 20,
          updated: 5,
          totalAvailable: 80,
          hasMore: true,
          creditsRemaining: 741,
        },
      },
    });
  }),
);
