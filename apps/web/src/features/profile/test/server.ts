import type {
  ApiKey,
  MyDesign,
  GmailAccount,
  LanguageResume,
  MatcherResume,
  Profile,
  ResumeMatcherStatus,
  SavedAnswer,
  Story,
  WordTemplate,
} from '@jobsearch/data';
import { API_URL, RESUME_UPLOAD_URL } from '@jobsearch/data';
import { http, HttpResponse } from 'msw';
import { graphql } from 'msw/graphql';
import { setupServer } from 'msw/node';

export const api = graphql.link(API_URL);

/** The test user's saved answers to Claude's questions. Tests start with none. */
export const savedAnswers: SavedAnswer[] = [];

/** The test user's story bank. Tests start with none. */
export const stories: Story[] = [];

/** Requests made in the current test, so tests can check what was sent. */
export const requests: { operation: string; variables: Record<string, unknown> }[] = [];

const STYLE = {
  resumeTemplate: 'classic',
  coverLetterLayout: 'auto',
  accentColor: '1F4E79',
  font: 'auto',
  showPhoto: false,
  hasPhoto: false,
  myDesign: null as MyDesign | null,
  fontSize: null as number | null,
  margin: null as number | null,
  lineSpacing: 1,
  skillsStyle: 'index',
  skillsBold: true,
  headingStyle: 'auto',
  datesSide: 'auto',
  bulletStyle: 'dot',
  compact: false,
};

/** My design as the server has it; null until a test saves one. */
export const myDesign: { current: MyDesign | null } = { current: null };

export const SAVED_DESIGN: MyDesign = {
  font: 'serif',
  accent: '1E3A5F',
  nameSize: 'huge',
  nameStyle: 'caps',
  nameColour: 'accent',
  align: 'centre',
  headingStyle: 'bar',
  headingCase: 'upper',
  headingColour: 'black',
  dates: 'right',
  companyFirst: true,
  density: 'normal',
  skillsFirst: false,
  photo: false,
  twoColumns: true,
};

export const PROFILE: Profile = {
  firstName: '',
  lastName: '',
  gender: '',
  dateOfBirth: '',
  nationality: '',
  employmentType: '',
  workplacePreference: '',
  drivingLicence: '',
  customFields: [],
  headline: 'Frontend engineer',
  targetRoles: ['Frontend Engineer', 'React Developer'],
  locations: ['Berlin', 'Remote'],
  skills: ['React', 'TypeScript'],
  keywords: ['accessibility'],
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
  achievements: '',
  resumeMaxPages: 2,
  keepMySections: false,
  notifyNewMatches: true,
  fillSavedAnswers: true,
  showStretches: true,
  matchFitMin: 60,
  resumeSuggestions: [],
  resumeReviewPrompt: '',
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
    {
      statusCode: 400,
      message: 'Upload a PDF or Word (.docx) file',
      code: 'RESUME_FILE_TYPE',
      params: {},
    },
    { status: 400 },
  );
});

/** Resume-Matcher is running; the AI check (checkAi: true) reports a working key. */
export const RM_RUNNING: ResumeMatcherStatus = {
  configured: true,
  reachable: true,
  aiConfigured: null,
  aiHealthy: null,
  aiProvider: 'Claude',
  aiModel: 'claude-sonnet-5-5',
  message: 'Resume-Matcher is running.',
};

export const MATCHER_RESUME: MatcherResume = {
  state: 'NOT_SENT',
  fileName: null,
  syncedAt: null,
  message: "ada.pdf hasn't been sent to Resume-Matcher yet.",
};

/** The Gmail accounts connected in the current test, and whether the server has Google set up. */
export const gmail: { configured: boolean; accounts: GmailAccount[]; found: number } = {
  configured: true,
  accounts: [],
  found: 0,
};

/** Keys saved in Settings during the current test. */
export const apiKeys: ApiKey[] = [];

/** The AI the fake user picked in Settings. */
export const me: { aiProvider: 'ANTHROPIC' | 'OPENAI' } = { aiProvider: 'ANTHROPIC' };

/** Sends to Resume-Matcher made in the current test. */
export const syncs: number[] = [];

export const ME = {
  id: 'u1',
  email: 'ada@example.com',
  name: 'Ada King Lovelace',
  role: 'USER',
  locale: 'en',
};

export const server = setupServer(
  api.query('MyApiKeys', () => HttpResponse.json({ data: { myApiKeys: [...apiKeys] } })),
  api.mutation('SaveApiKey', ({ variables }) => {
    requests.push({ operation: 'SaveApiKey', variables });
    const input = variables['input'] as { kind: ApiKey['kind']; value: string; model?: string };
    const saved: ApiKey = {
      kind: input.kind,
      last4: input.value.trim().slice(-4),
      model: input.model ?? null,
      credits: null,
      updatedAt: '2026-11-08T12:00:00.000Z',
    };
    apiKeys.splice(0, apiKeys.length, ...apiKeys.filter((k) => k.kind !== input.kind), saved);
    return HttpResponse.json({ data: { saveApiKey: saved } });
  }),
  api.mutation('DeleteApiKey', ({ variables }) => {
    requests.push({ operation: 'DeleteApiKey', variables });
    apiKeys.splice(0, apiKeys.length, ...apiKeys.filter((k) => k.kind !== variables['kind']));
    return HttpResponse.json({ data: { deleteApiKey: true } });
  }),
  api.mutation('TestApiKey', ({ variables }) => {
    requests.push({ operation: 'TestApiKey', variables });
    if (variables['kind'] !== 'JOBHUNTER') {
      return HttpResponse.json({ data: { testApiKey: { ok: true, credits: null, error: null } } });
    }
    for (const key of apiKeys) key.credits = 412;
    return HttpResponse.json({ data: { testApiKey: { ok: true, credits: 412, error: null } } });
  }),
  api.mutation('SetApiKeyModel', ({ variables }) => {
    requests.push({ operation: 'SetApiKeyModel', variables });
    const key = apiKeys.find((k) => k.kind === variables['kind']);
    if (key) key.model = (variables['model'] as string | null) ?? null;
    return HttpResponse.json({ data: { setApiKeyModel: key } });
  }),
  api.mutation('SetAiProvider', ({ variables }) => {
    requests.push({ operation: 'SetAiProvider', variables });
    me.aiProvider = variables['provider'] as typeof me.aiProvider;
    return HttpResponse.json({ data: { setAiProvider: { ...ME, aiProvider: me.aiProvider } } });
  }),
  api.mutation('UpdateNotificationSettings', ({ variables }) => {
    requests.push({ operation: 'UpdateNotificationSettings', variables });
    const input = variables['input'] as Partial<Profile>;
    return HttpResponse.json({ data: { updateNotificationSettings: { ...PROFILE, ...input } } });
  }),
  api.query('GmailStatus', () =>
    HttpResponse.json({
      data: { gmailStatus: { configured: gmail.configured, accounts: gmail.accounts } },
    }),
  ),
  api.mutation('SyncGmail', () => {
    for (const account of gmail.accounts) account.lastSyncAt = '2026-11-03T12:00:00.000Z';
    return HttpResponse.json({
      data: {
        syncGmail: { accounts: gmail.accounts.length, suggestions: gmail.found, warnings: [] },
      },
    });
  }),
  api.mutation('DisconnectGmail', ({ variables }) => {
    requests.push({ operation: 'DisconnectGmail', variables });
    gmail.accounts = gmail.accounts.filter((account) => account.id !== variables['id']);
    return HttpResponse.json({ data: { disconnectGmail: true } });
  }),
  api.mutation('FinishOnboarding', () => {
    requests.push({ operation: 'FinishOnboarding', variables: {} });
    return HttpResponse.json({
      data: { finishOnboarding: { ...ME, aiProvider: me.aiProvider, onboarded: true } },
    });
  }),
  api.query('Me', () =>
    HttpResponse.json({
      data: {
        me: { ...ME, aiProvider: me.aiProvider },
      },
    }),
  ),
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
          message: 'Resume-Matcher is running and Claude answered.',
        }
      : RM_RUNNING;
    return HttpResponse.json({ data: { resumeMatcherStatus: status } });
  }),
  api.query('DocumentStyle', () =>
    HttpResponse.json({
      data: {
        documentStyle: myDesign.current
          ? { ...STYLE, resumeTemplate: 'design', myDesign: myDesign.current }
          : STYLE,
      },
    }),
  ),
  api.mutation('SaveMyDesign', ({ variables }) => {
    requests.push({ operation: 'SaveMyDesign', variables });
    myDesign.current = SAVED_DESIGN;
    return HttpResponse.json({
      data: { saveMyDesign: { ...STYLE, resumeTemplate: 'design', myDesign: SAVED_DESIGN } },
    });
  }),
  api.mutation('DeleteMyDesign', () => {
    requests.push({ operation: 'DeleteMyDesign', variables: {} });
    myDesign.current = null;
    return HttpResponse.json({ data: { deleteMyDesign: STYLE } });
  }),
  api.query('DocumentTemplates', () =>
    HttpResponse.json({
      data: {
        documentTemplates: {
          resumeTemplates: [
            ...(myDesign.current
              ? [
                  {
                    id: 'design',
                    name: 'My design',
                    description: 'Your look.',
                    fontSize: 10,
                    margin: 15,
                  },
                ]
              : []),
            { id: 'classic', name: 'Classic', description: 'Serif.', fontSize: 11, margin: 20 },
            { id: 'modern', name: 'Modern', description: 'Sans.', fontSize: 11, margin: 19 },
            { id: 'compact', name: 'Compact', description: 'Small.', fontSize: 10, margin: 15 },
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
          designPrompt: 'I attached my resume. Describe its design as JSON.',
          rendererConfigured: true,
          rendererAvailable: false,
        },
      },
    }),
  ),
  api.mutation('UpdateDocumentStyle', ({ variables }) => {
    requests.push({ operation: 'UpdateDocumentStyle', variables });
    const { designAccent, ...input } = variables['input'] as { designAccent?: string | null };
    // Like the API: a colour for My design is saved into My design.
    if (designAccent && myDesign.current)
      myDesign.current = { ...myDesign.current, accent: designAccent };
    return HttpResponse.json({
      data: { updateDocumentStyle: { ...STYLE, ...input, myDesign: myDesign.current } },
    });
  }),
  api.query('SavedAnswers', () => HttpResponse.json({ data: { savedAnswers: [...savedAnswers] } })),
  api.mutation('SaveAnswer', ({ variables }) => {
    requests.push({ operation: 'SaveAnswer', variables });
    const question = variables['question'] as string;
    const row: SavedAnswer = {
      id: savedAnswers.find((a) => a.question === question)?.id ?? savedAnswers.length + 1,
      question,
      answer: variables['answer'] as string,
      updatedAt: '2026-11-05T12:00:00.000Z',
    };
    savedAnswers.splice(
      0,
      savedAnswers.length,
      ...savedAnswers.filter((a) => a.question !== question),
      row,
    );
    return HttpResponse.json({ data: { saveAnswer: row } });
  }),
  api.mutation('DeleteSavedAnswer', ({ variables }) => {
    requests.push({ operation: 'DeleteSavedAnswer', variables });
    const rest = savedAnswers.filter((a) => a.id !== variables['id']);
    savedAnswers.splice(0, savedAnswers.length, ...rest);
    return HttpResponse.json({ data: { deleteSavedAnswer: variables['id'] } });
  }),
  api.query('Stories', () => HttpResponse.json({ data: { stories: [...stories] } })),
  api.mutation('SaveStory', ({ variables }) => {
    requests.push({ operation: 'SaveStory', variables });
    const input = variables['input'] as Omit<Story, 'updatedAt' | 'id'> & { id?: number };
    if (!input.title.trim()) {
      return HttpResponse.json({
        errors: [
          {
            message: 'no title',
            extensions: {
              apiCode: 'STORY_INVALID',
              apiParams: { title: 120, part: 2000, tags: 10 },
            },
          },
        ],
      });
    }
    const row: Story = {
      ...input,
      id: input.id ?? stories.length + 1,
      updatedAt: '2026-11-09T12:00:00.000Z',
    };
    stories.splice(0, stories.length, row, ...stories.filter((x) => x.id !== row.id));
    return HttpResponse.json({ data: { saveStory: row } });
  }),
  api.mutation('DeleteStory', ({ variables }) => {
    requests.push({ operation: 'DeleteStory', variables });
    stories.splice(0, stories.length, ...stories.filter((x) => x.id !== variables['id']));
    return HttpResponse.json({ data: { deleteStory: variables['id'] } });
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
  // A resume file in another language, e.g. /profile/resume/de. Saved straight away.
  http.post(`${RESUME_UPLOAD_URL}/:language`, ({ params }) => {
    const language = params['language'] as string;
    requests.push({ operation: 'UploadLanguageResume', variables: { language } });
    const kept = otherResumes.filter((r) => r.language !== language);
    otherResumes.splice(0, otherResumes.length, ...kept, {
      language,
      text: 'Ada Lovelace\nEntwicklerin',
      fileName: 'lebenslauf.pdf',
      updatedAt: '2026-11-01T10:00:00.000Z',
    });
    return HttpResponse.json(withOthers(), { status: 201 });
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
