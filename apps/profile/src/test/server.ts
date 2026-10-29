import type { MatcherResume, Profile, ResumeMatcherStatus } from '@jobsearch/data';
import { API_URL, RESUME_UPLOAD_URL } from '@jobsearch/data';
import { http, HttpResponse } from 'msw';
import { graphql } from 'msw/graphql';
import { setupServer } from 'msw/node';

export const api = graphql.link(API_URL);

/** Requests made in the current test, so tests can check what was sent. */
export const requests: { operation: string; variables: Record<string, unknown> }[] = [];

export const PROFILE: Profile = {
  headline: 'Frontend engineer',
  targetRoles: ['Frontend Engineer', 'React Developer'],
  locations: ['Berlin', 'Remote'],
  skills: ['React', 'TypeScript'],
  languages: ['German A2', 'English C1'],
  yearsExperience: 4,
  linkedinUrl: 'https://www.linkedin.com/in/ada',
  githubUrl: null,
  websiteUrl: null,
  resumeText: 'Ada Lovelace\nFrontend engineer',
  resumeFileName: 'ada.pdf',
  phone: '+49 151 0000000',
  address: 'Berlin, Germany',
  workPermit: 'EU Blue Card',
  noticePeriod: '1 month',
  salaryExpectation: '',
  relocation: '',
  applicationNotes: '',
  updatedAt: '2026-10-27T08:00:00.000Z',
};

/** What the API answers for a file it can't read. */
export const rejectUpload = http.post(RESUME_UPLOAD_URL, () => {
  requests.push({ operation: 'UploadResume', variables: { sent: true } });
  return HttpResponse.json(
    { statusCode: 400, message: 'Upload a PDF or Word (.docx) file' },
    { status: 400 },
  );
});

/** Resume-Matcher is running; the AI check (checkAi: true) reports a working key. */
export const RM_RUNNING: ResumeMatcherStatus = {
  configured: true,
  reachable: true,
  aiConfigured: null,
  aiHealthy: null,
  aiProvider: 'anthropic',
  aiModel: 'claude-sonnet-5-5',
  message: 'Resume-Matcher is running.',
};

export const MATCHER_RESUME: MatcherResume = {
  state: 'NOT_SENT',
  fileName: null,
  syncedAt: null,
  message: "ada.pdf hasn't been sent to Resume-Matcher yet.",
};

/** Sends to Resume-Matcher made in the current test. */
export const syncs: number[] = [];

export const server = setupServer(
  api.query('MyMatcherResume', () =>
    HttpResponse.json({ data: { myMatcherResume: MATCHER_RESUME } }),
  ),
  api.mutation('SyncResumeToMatcher', () => {
    syncs.push(Date.now());
    return HttpResponse.json({
      data: {
        syncResumeToMatcher: {
          state: 'READY',
          fileName: 'ada.pdf',
          syncedAt: '2026-10-27T20:00:00.000Z',
          message: 'Resume-Matcher has read ada.pdf. Jobs will be matched against it.',
        },
      },
    });
  }),
  api.query('ResumeMatcherStatus', ({ variables }) => {
    const status = variables['checkAi']
      ? {
          ...RM_RUNNING,
          aiConfigured: true,
          aiHealthy: true,
          message: 'Resume-Matcher is running and the AI provider answered.',
        }
      : RM_RUNNING;
    return HttpResponse.json({ data: { resumeMatcherStatus: status } });
  }),
  api.query('MyProfile', () => HttpResponse.json({ data: { myProfile: PROFILE } })),
  api.mutation('UpdateProfile', ({ variables }) => {
    requests.push({ operation: 'UpdateProfile', variables });
    const input = variables['input'] as Partial<Profile>;
    return HttpResponse.json({ data: { updateProfile: { ...PROFILE, ...input } } });
  }),
  http.post(RESUME_UPLOAD_URL, ({ request }) => {
    // jsdom's File and FormData don't survive Node's fetch intact (the name is lost, and on
    // Node 24 reading the body aborts), so check the request is multipart without parsing it.
    const sent = request.headers.get('content-type')?.startsWith('multipart/form-data') ?? false;
    requests.push({ operation: 'UploadResume', variables: { sent } });
    return HttpResponse.json(
      { ...PROFILE, resumeFileName: 'new cv.pdf', resumeText: 'Text from the PDF' },
      { status: 201 },
    );
  }),
);
