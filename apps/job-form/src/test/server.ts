import type { SavedSearch, SyncRun } from '@jobsearch/data';
import { API_URL } from '@jobsearch/data';
import { HttpResponse } from 'msw';
import { graphql } from 'msw/graphql';
import { setupServer } from 'msw/node';

export const api = graphql.link(API_URL);

/** Requests made in the current test, so tests can check what was sent. */
export const requests: { operation: string; variables: Record<string, unknown> }[] = [];

export const LAST_RUN: SyncRun = {
  id: 7,
  startedAt: '2026-10-26T08:00:00.000Z',
  finishedAt: '2026-10-26T08:00:05.000Z',
  complete: true,
  fetched: 25,
  created: 20,
  updated: 5,
  creditsCharged: 20,
  jobsAlreadyPaid: 5,
  savedSearchId: 1,
  savedSearchName: 'Frontend in Berlin',
  summary: 'frontend · react · DE · Berlin',
};

export const SAVED: SavedSearch = {
  id: 1,
  name: 'Frontend in Berlin',
  titles: ['frontend'],
  skills: ['react'],
  countryCodes: ['DE'],
  locations: ['Berlin'],
  maxAgeDays: 7,
  pageSize: 25,
  maxPages: 2,
  onlyNew: true,
  createdAt: '2026-10-25T08:00:00.000Z',
  lastRun: LAST_RUN,
};

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
    const input = variables['input'] as { onlyNew?: boolean; resume?: boolean };
    const resumed = input.resume ?? false;
    return HttpResponse.json({
      data: {
        syncJobs: {
          pages: 1,
          fetched: 25,
          created: 20,
          updated: 5,
          totalAvailable: 80,
          // A first import stops with pages left; continuing it fetches the rest.
          hasMore: !resumed,
          creditsRemaining: 741,
          creditsCharged: 20,
          jobsAlreadyPaid: 5,
          // The API only sets this when it ran an "only new jobs" import.
          newSince: input.onlyNew ? '2026-10-25T09:30:00.000Z' : null,
          resumed,
        },
      },
    });
  }),
  api.query('SavedSearches', () => HttpResponse.json({ data: { savedSearches: [SAVED] } })),
  api.query('SyncRuns', () =>
    HttpResponse.json({
      data: {
        syncRuns: [
          LAST_RUN,
          {
            ...LAST_RUN,
            id: 6,
            savedSearchId: null,
            savedSearchName: null,
            summary: 'backend',
            complete: false,
          },
        ],
      },
    }),
  ),
  api.mutation('CreateSavedSearch', ({ variables }) => {
    requests.push({ operation: 'CreateSavedSearch', variables });
    const input = variables['input'] as { name: string };
    return HttpResponse.json({
      data: { createSavedSearch: { ...SAVED, id: 2, name: input.name, lastRun: null } },
    });
  }),
  api.mutation('UpdateSavedSearch', ({ variables }) => {
    requests.push({ operation: 'UpdateSavedSearch', variables });
    return HttpResponse.json({ data: { updateSavedSearch: SAVED } });
  }),
  api.mutation('DeleteSavedSearch', ({ variables }) => {
    requests.push({ operation: 'DeleteSavedSearch', variables });
    return HttpResponse.json({ data: { deleteSavedSearch: true } });
  }),
  api.mutation('RunSavedSearch', ({ variables }) => {
    requests.push({ operation: 'RunSavedSearch', variables });
    return HttpResponse.json({
      data: {
        runSavedSearch: {
          pages: 2,
          fetched: 50,
          created: 30,
          updated: 20,
          totalAvailable: 120,
          hasMore: !variables['resume'],
          creditsRemaining: 700,
          creditsCharged: 30,
          jobsAlreadyPaid: 20,
          newSince: '2026-10-26T07:00:00.000Z',
          resumed: Boolean(variables['resume']),
        },
      },
    });
  }),
);
