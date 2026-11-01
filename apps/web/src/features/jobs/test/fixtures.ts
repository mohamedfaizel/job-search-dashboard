import type { Job, JobFilterOptions } from '@jobsearch/data';

export function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    source: 'JOBSPIPE',
    title: 'Senior Frontend Engineer',
    company: { id: 1, name: 'Acme', logoUrl: null },
    url: 'https://example.com/jobs/1',
    postedAt: '2026-10-24T12:00:00.000Z',
    seniority: 'senior',
    jobFunction: 'Engineering',
    skills: ['react', 'typescript', 'graphql'],
    city: 'Berlin',
    countryCode: 'DE',
    language: 'de',
    salaryMinUsd: 90_000,
    salaryMaxUsd: 120_000,
    salaryEstimated: false,
    provider: 'indeed',
    workplace: 'REMOTE',
    visa: 'OFFERS',
    industry: 'Computer programming',
    description: 'Build the dashboard of the future.\n\nYou will work with React.',
    postingStatus: 'active',
    applicationStatus: 'NONE',
    matchStatus: null,
    matchScore: null,
    fitScore: null,
    createdAt: '2026-10-24T12:00:00.000Z',
    ...overrides,
  };
}

export const JOBS: Job[] = [
  makeJob(),
  makeJob({
    id: 'job-2',
    title: 'Backend Developer',
    company: { id: 2, name: 'Beta GmbH', logoUrl: null },
    seniority: null,
    skills: ['node.js'],
    city: 'Aachen',
    language: 'en',
    salaryMinUsd: null,
    salaryMaxUsd: null,
    workplace: 'HYBRID',
    visa: 'NO',
    provider: 'linkedin',
    applicationStatus: 'APPLIED',
    createdAt: '2026-10-30T08:00:00.000Z',
  }),
];

export const FILTER_OPTIONS: JobFilterOptions = {
  companies: ['Acme', 'Beta GmbH'],
  seniorities: ['senior'],
  jobFunctions: ['Engineering'],
  skills: ['graphql', 'node.js', 'react', 'typescript'],
  cities: ['Aachen', 'Berlin'],
  countryCodes: ['DE'],
  languages: ['de', 'en'],
  providers: ['indeed', 'linkedin'],
  industries: ['Computer programming'],
};
