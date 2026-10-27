import type { Profile } from '@jobsearch/data';
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
  yearsExperience: 4,
  linkedinUrl: 'https://www.linkedin.com/in/ada',
  githubUrl: null,
  websiteUrl: null,
  resumeText: 'Ada Lovelace\nFrontend engineer',
  resumeFileName: 'ada.pdf',
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

export const server = setupServer(
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
