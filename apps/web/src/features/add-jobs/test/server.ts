import type { Profile, SavedSearch, SyncRun, User } from '@jobsearch/data';
import { API_URL } from '@jobsearch/data';
import { HttpResponse } from 'msw';
import { graphql } from 'msw/graphql';
import { setupServer } from 'msw/node';

export const api = graphql.link(API_URL);

/** Requests made in the current test, so tests can check what was sent. */
export const requests: { operation: string; variables: Record<string, unknown> }[] = [];

const LAST_RUN: SyncRun = {
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
  scheduled: false,
  summary: 'frontend · react · DE · Berlin',
  source: 'JOBHUNTER',
  boards: [],
  canContinue: false,
};

export const SAVED: SavedSearch = {
  id: 1,
  source: 'JOBHUNTER',
  boards: [],
  name: 'Frontend in Berlin',
  titles: ['frontend'],
  skills: ['react'],
  countryCodes: ['DE'],
  locations: ['Berlin'],
  languages: [],
  skipFluentGerman: false,
  remoteOnly: false,
  excludeTitles: [],
  employmentTypes: [],
  minSalaryEur: null,
  maxAgeDays: 7,
  pageSize: 25,
  maxPages: 2,
  onlyNew: true,
  schedule: 'DAILY',
  runAt: '07:00',
  nextRunAt: '2026-10-27T07:00:00.000Z',
  scheduleNote: 'Ran at 26 Oct, 07:00: 20 new, 5 already saved.',
  autopilot: false,
  autoQueueFitMin: 75,
  autoQueueNeedsVisa: true,
  autoHideFitBelow: 40,
  autoQueueMaxPerDay: 10,
  createdAt: '2026-10-25T08:00:00.000Z',
  lastRun: LAST_RUN,
};

const PROFILE: Profile = {
  firstName: '',
  lastName: '',
  gender: '',
  dateOfBirth: '',
  nationality: '',
  employmentType: '',
  workplacePreference: '',
  drivingLicence: '',
  customFields: [],
  headline: '',
  targetRoles: ['Frontend Engineer', 'React Developer'],
  locations: ['Berlin'],
  skills: [],
  keywords: [],
  languages: [],
  yearsExperience: null,
  linkedinUrl: null,
  githubUrl: null,
  websiteUrl: null,
  resumeText: '',
  resumeFileName: null,
  resumeLanguage: 'en',
  otherResumes: [],
  phone: '',
  address: '',
  workPermit: '',
  noticePeriod: '',
  salaryExpectation: '',
  relocation: '',
  applicationNotes: '',
  achievements: '',
  resumeMaxPages: 2,
  keepMySections: false,
  notifyNewMatches: true,
  fillSavedAnswers: true,
  showStretches: true,
  matchFitMin: 60,
  nightlyKits: false,
  nightlyKitsMax: 5,
  resumeSuggestions: [],
  resumeReviewPrompt: '',
  updatedAt: null,
};

/** Who the fake API says is logged in. Add jobs is for the admin only. */
export const session: { user: User } = {
  user: {
    id: 1,
    email: 'admin@example.com',
    name: 'Admin',
    role: 'ADMIN',
    locale: 'en',
    aiProvider: 'ANTHROPIC',
    onboarded: true,
  },
};

export const server = setupServer(
  api.query('Me', () => HttpResponse.json({ data: { me: session.user } })),
  api.query('MyProfile', () => HttpResponse.json({ data: { myProfile: PROFILE } })),
  // You have a JobHunter token unless a test says otherwise.
  api.query('MyApiKeys', () =>
    HttpResponse.json({
      data: {
        myApiKeys: [
          {
            kind: 'JOBHUNTER',
            last4: 'abcd',
            model: null,
            credits: null,
            updatedAt: '2026-11-08T12:00:00.000Z',
          },
        ],
      },
    }),
  ),
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
          warnings: [],
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
            canContinue: true,
            scheduled: true,
          },
          {
            ...LAST_RUN,
            id: 5,
            savedSearchId: null,
            savedSearchName: null,
            summary: 'Senior Frontend',
            source: 'COMPANY_BOARDS',
            boards: ['greenhouse:n26', 'ashby:deepl', 'lever:spotify'],
            creditsCharged: 0,
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
  api.query('ImportBudget', () =>
    HttpResponse.json({ data: { importBudget: { used: 35, cap: 100 } } }),
  ),
  api.mutation('SetSavedSearchSchedule', ({ variables }) => {
    requests.push({ operation: 'SetSavedSearchSchedule', variables });
    const input = variables['input'] as Pick<SavedSearch, 'schedule' | 'runAt'>;
    return HttpResponse.json({ data: { setSavedSearchSchedule: { ...SAVED, ...input } } });
  }),
  api.mutation('SetSavedSearchAutopilot', ({ variables }) => {
    requests.push({ operation: 'SetSavedSearchAutopilot', variables });
    const input = variables['input'] as Partial<SavedSearch>;
    return HttpResponse.json({ data: { setSavedSearchAutopilot: { ...SAVED, ...input } } });
  }),
  api.mutation('ContinueImport', ({ variables }) => {
    requests.push({ operation: 'ContinueImport', variables });
    return HttpResponse.json({
      data: {
        continueImport: {
          pages: 1,
          fetched: 10,
          created: 8,
          updated: 2,
          totalAvailable: 30,
          hasMore: true,
          creditsRemaining: 90,
          creditsCharged: 8,
          jobsAlreadyPaid: 2,
          newSince: null,
          resumed: true,
          warnings: [],
        },
      },
    });
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
          warnings: [],
        },
      },
    });
  }),
);
