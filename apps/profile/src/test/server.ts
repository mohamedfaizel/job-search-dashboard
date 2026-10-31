import type {
  LanguageResume,
  MatcherResume,
  Profile,
  ResumeMatcherStatus,
  WordTemplate,
} from '@jobsearch/data';
import { API_URL, RESUME_UPLOAD_URL } from '@jobsearch/data';
import { http, HttpResponse } from 'msw';
import { graphql } from 'msw/graphql';
import { setupServer } from 'msw/node';

export const api = graphql.link(API_URL);

/** Requests made in the current test, so tests can check what was sent. */
export const requests: { operation: string; variables: Record<string, unknown> }[] = [];

export const STYLE = {
  resumeTemplate: 'classic',
  coverLetterLayout: 'auto',
  accentColor: '1F4E79',
  font: 'auto',
  showPhoto: false,
  hasPhoto: false,
};

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
  resumeLanguage: 'en',
  otherResumes: [],
  phone: '+49 151 0000000',
  address: 'Berlin, Germany',
  workPermit: 'EU Blue Card',
  noticePeriod: '1 month',
  salaryExpectation: '',
  relocation: '',
  applicationNotes: '',
  updatedAt: '2026-10-27T08:00:00.000Z',
};

/** Resumes in other languages saved in the current test. */
export const otherResumes: LanguageResume[] = [];

/** Your Word master resume as a template; null until a test sets one. */
export const wordTemplate: { current: WordTemplate | null } = { current: null };
const withOthers = (): Profile => ({ ...PROFILE, otherResumes: [...otherResumes] });

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
  api.query('DocumentStyle', () => HttpResponse.json({ data: { documentStyle: STYLE } })),
  api.query('DocumentTemplates', () =>
    HttpResponse.json({
      data: {
        documentTemplates: {
          resumeTemplates: [
            { id: 'classic', name: 'Classic', description: 'Serif.' },
            { id: 'modern', name: 'Modern', description: 'Sans.' },
            { id: 'compact', name: 'Compact', description: 'Small.' },
            ...(wordTemplate.current?.usable
              ? [{ id: 'mine', name: 'My own Word file', description: 'Your .docx.' }]
              : []),
          ],
          coverLetterLayouts: [
            { id: 'auto', name: 'Automatic', description: 'DIN for German.' },
            { id: 'din', name: 'DIN 5008', description: 'German standard.' },
            { id: 'modern', name: 'Modern', description: 'Header.' },
          ],
          wordTemplate: wordTemplate.current,
          rendererConfigured: true,
          rendererAvailable: false,
        },
      },
    }),
  ),
  api.mutation('UpdateDocumentStyle', ({ variables }) => {
    requests.push({ operation: 'UpdateDocumentStyle', variables });
    return HttpResponse.json({
      data: { updateDocumentStyle: { ...STYLE, ...(variables['input'] as object) } },
    });
  }),
  api.query('MyProfile', () => HttpResponse.json({ data: { myProfile: withOthers() } })),
  api.mutation('SaveLanguageResume', ({ variables }) => {
    requests.push({ operation: 'SaveLanguageResume', variables });
    const language = variables['language'] as string;
    const kept = otherResumes.filter((r) => r.language !== language);
    otherResumes.splice(0, otherResumes.length, ...kept, {
      language,
      text: variables['text'] as string,
      fileName: null,
      updatedAt: '2026-10-31T10:00:00.000Z',
    });
    return HttpResponse.json({ data: { saveLanguageResume: withOthers() } });
  }),
  api.mutation('DeleteLanguageResume', ({ variables }) => {
    requests.push({ operation: 'DeleteLanguageResume', variables });
    const kept = otherResumes.filter((r) => r.language !== variables['language']);
    otherResumes.splice(0, otherResumes.length, ...kept);
    return HttpResponse.json({ data: { deleteLanguageResume: withOthers() } });
  }),
  api.query('TranslationPrompt', ({ variables }) => {
    requests.push({ operation: 'TranslationPrompt', variables });
    return HttpResponse.json({
      data: {
        translationPrompt: `Please translate my resume into ${String(variables['language'])}`,
      },
    });
  }),
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
