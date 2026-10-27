import type { Application, ApplicationStatus, JobMatch } from '@jobsearch/data';
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

/** The test user's tracker. Tests fill it; status changes update it like the real API. */
export const applications: Application[] = [];

/** A finished match, for tests that show the score. */
export const READY_MATCH: JobMatch = {
  jobId: 'job-1',
  status: 'READY',
  error: null,
  score: 72.4,
  keywordMatchBefore: 55,
  keywordMatch: 70,
  skillsCoverage: 80,
  titleMatch: 50,
  sectionCompleteness: 100,
  dateConsistency: null,
  missingKeywords: ['Kubernetes'],
  injectableKeywords: ['GraphQL'],
  recommendations: ['Add "Senior Frontend Engineer" to your headline.'],
  resumeFileName: 'ada.pdf',
  startedAt: '2026-10-27T12:00:00.000Z',
  finishedAt: '2026-10-27T12:01:30.000Z',
  outdated: false,
};

export const handlers = [
  // By default no job has been matched yet.
  api.query('JobMatch', () => HttpResponse.json({ data: { jobMatch: null } })),
  api.mutation('MatchJob', ({ variables }) => {
    requests.push({ operation: 'MatchJob', variables });
    const pending: JobMatch = {
      ...READY_MATCH,
      jobId: variables['jobId'] as string,
      status: 'PENDING',
      score: null,
      finishedAt: null,
    };
    return HttpResponse.json({ data: { matchJob: pending } });
  }),
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
  api.query('MyApplications', () => HttpResponse.json({ data: { myApplications: applications } })),
  api.mutation('UpdateJobStatus', ({ variables }) => {
    requests.push({ operation: 'UpdateJobStatus', variables });
    const id = variables['id'] as string;
    const status = variables['status'] as ApplicationStatus;
    const index = applications.findIndex((app) => app.job.id === id);
    const job = JOBS.find((j) => j.id === id);
    if (index >= 0) applications.splice(index, 1);
    if (status !== 'NONE' && job) {
      const updatedAt = '2026-10-27T12:00:00.000Z';
      applications.unshift({ status, updatedAt, job: { ...job, applicationStatus: status } });
    }
    return HttpResponse.json({
      data: { updateJobStatus: { id: variables['id'], applicationStatus: variables['status'] } },
    });
  }),
];

// MSW intercepts fetch() in tests, so the real GraphQL client runs against fake responses.
export const server = setupServer(...handlers);
