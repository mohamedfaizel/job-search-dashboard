import type {
  Application,
  ApplicationStatus,
  ApplyQueueItem,
  InterviewPrep,
  JobInsights,
  JobMatch,
  JobResume,
  MailSuggestion,
  Profile,
  RemovedTerm,
  TailoredResume,
} from '@jobsearch/data';
import { API_URL, jobResumeUrl } from '@jobsearch/data';
import { http, HttpResponse } from 'msw';
import { graphql } from 'msw/graphql';
import { setupServer } from 'msw/node';
import { FILTER_OPTIONS, JOBS } from './fixtures';

/** Handlers for our GraphQL endpoint (MSW 3 scopes GraphQL handlers to a URL). */
export const api = graphql.link(API_URL);

/** Every request the dashboard made in the current test, so tests can check the variables. */
/** Files the app started downloading (see setup.ts). */
export const downloads: string[] = [];

export const requests: { operation: string; variables: Record<string, unknown> }[] = [];

/** Ids of the jobs the test user has hidden, so hiding works like the real API. */
export const hiddenIds = new Set<string>();

/** The test user's tracker. Tests fill it; status changes update it like the real API. */
export const applications: Application[] = [];

/** Employer-email suggestions waiting for an answer in the current test. */
export const mailSuggestions: MailSuggestion[] = [];

/** The test user's Apply queue. Marking a job Applied takes it out, like the real API. */
export const applyQueue: ApplyQueueItem[] = [];

function queueItem(jobId: string): ApplyQueueItem | null {
  const job = JOBS.find((j) => j.id === jobId);
  if (!job) return null;
  return {
    jobId,
    title: job.title,
    company: job.company.name,
    url: job.url,
    ready: jobId === 'job-1' && jobResume.current !== null,
    addedAt: '2026-10-29T12:00:00.000Z',
    number: 0,
  };
}

/** The queue as the API returns it: numbered 1, 2, 3 in its order. */
const numbered = () => applyQueue.map((item, i) => ({ ...item, number: i + 1 }));

/** Insights for a job when the user has a resume: some skills found, some missing. */
/** The review prompt the server gives once a reply is saved. */

export const INSIGHTS: JobInsights = {
  jobId: 'job-1',
  title: 'Senior Frontend Engineer',
  normalizedTitle: 'Frontend Engineer',
  language: 'de',
  languageDetected: false,
  germanRequired: true,
  germanLevel: 'B2',
  germanLevelEstimated: false,
  resumeLanguage: 'de',
  checkedAgainst: 'en',
  hasResume: true,
  skills: [
    { term: 'react', inResume: true, youHave: false, relatedTo: null },
    { term: 'graphql', inResume: false, youHave: false, relatedTo: null },
  ],
  keywords: [
    { term: 'microfrontends', inResume: false, youHave: false, relatedTo: null },
    { term: 'storybook', inResume: true, youHave: false, relatedTo: null },
  ],
  removed: [],
  skillsCoverage: 50,
  keywordsCoverage: 50,
  titleMatch: 100,
  score: 50,
  jobResume: null,
  prompt: 'Please tailor my resume for this job.\n- graphql',
  interviewPrompt: 'Please prepare me for an interview.\n- graphql',
  interviewPrep: null,
};

/** The resume the test user saved for job-1, once they upload or paste one. */
export const SAVED_RESUME: JobResume = {
  text: '# Ada Lovelace\nFrontend Engineer\nBerlin | ada@example.com\n\n## Experience\n### Frontend Engineer | Acme\n01/2021 - today\n- Built dashboards in React and GraphQL\n\n## Skills\n- React, TypeScript',
  fileName: null,
  coverLetter: 'Dear Acme team, I build dashboards.',
  formAnswers: 'Why Acme: I like your product.',
  claudeCheck:
    '- Placed: graphql (Replace)\n- Stretches: (1) "Led the team": you were one of three. Keep, soften or drop? (2) React 19: only in a side project.\n- Ask me: Which year did you finish school?',
  updatedAt: '2026-10-28T12:00:00.000Z',
  skillsCoverage: 100,
  keywordsCoverage: 50,
  titleMatch: 100,
  score: 85,
  aiStatus: null,
  aiScore: null,
  aiError: null,
  aiMissing: [],
  aiTips: [],
  nowCovered: ['graphql'],
  stillMissing: ['microfrontends'],
};

/** Claude's interview prep the test user saved for job-1. Tests start with nothing. */
/** The Job posts settings the test user saved (JSON text). Tests start with nothing saved. */
export const tableSettings: { current: string | null } = { current: null };

export const interviewPrep: { current: InterviewPrep | null } = { current: null };

/** What the test user saved for job-1. Tests start with nothing. */
export const jobResume: { current: JobResume | null } = { current: null };

/** Terms the test user removed with ×. Tests start with none. */
export const removedTerms: RemovedTerm[] = [];
/** Terms the user said they have ("I have it"), like the Skills list on My profile. */
export const haveTerms: string[] = [];

/** INSIGHTS minus the removed terms, like the real API (score fixed at 80 once any is gone). */
function insightsNow(): JobInsights {
  const kept = (t: { term: string }) => !removedTerms.some((r) => r.term === t.term);
  const mark = <T extends { term: string; inResume: boolean }>(t: T) => ({
    ...t,
    youHave: !t.inResume && haveTerms.includes(t.term),
  });
  const skills = INSIGHTS.skills.map(mark);
  const keywords = INSIGHTS.keywords.map(mark);
  if (removedTerms.length === 0 && haveTerms.length === 0)
    return {
      ...INSIGHTS,
      jobResume: jobResume.current,
      interviewPrep: interviewPrep.current,
    };
  return {
    ...INSIGHTS,
    jobResume: jobResume.current,
    interviewPrep: interviewPrep.current,
    skills: skills.filter(kept),
    keywords: keywords.filter(kept),
    removed: [...removedTerms],
    score: 80,
    prompt: haveTerms.length
      ? `${INSIGHTS.prompt}\nMUST: ${haveTerms.join(', ')}`
      : INSIGHTS.prompt,
  };
}

/** What the API answers for a job resume file it can't read. */
export const rejectJobResumeUpload = http.post(jobResumeUrl('job-1'), () =>
  HttpResponse.json(
    { statusCode: 400, message: 'Upload a PDF, Word (.docx), text or Markdown file' },
    { status: 400 },
  ),
);

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

/** A finished tailored resume, for tests that show the downloads. */
export const READY_TAILORED: TailoredResume = {
  jobId: 'job-1',
  status: 'READY',
  error: null,
  score: 84,
  coverLetter: 'Dear Acme team,\n\nI would love to build your dashboard.',
  resumeFileName: 'ada.pdf',
  startedAt: '2026-10-27T12:00:00.000Z',
  finishedAt: '2026-10-27T12:02:00.000Z',
  outdated: false,
};

/** The test user's profile, with Application answers filled in. */
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
  targetRoles: [],
  locations: [],
  skills: [],
  languages: ['German A2'],
  yearsExperience: 4,
  linkedinUrl: null,
  githubUrl: null,
  websiteUrl: null,
  resumeText: 'Ada Lovelace',
  resumeFileName: null,
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
  matchFitMin: 60,
  resumeSuggestions: [],
  resumeReviewPrompt: '',
  updatedAt: '2026-10-27T08:00:00.000Z',
};

/** A queued job that isn't on the dashboard's page, so the popup has to fetch it. */
export const OFF_PAGE_JOB_ID = 'job-elsewhere';

const handlers = [
  api.query('Job', ({ variables }) => {
    requests.push({ operation: 'Job', variables });
    const id = variables['id'] as string;
    const job =
      id === OFF_PAGE_JOB_ID
        ? { ...JOBS[0]!, id, title: 'Platform Engineer' }
        : JOBS.find((j) => j.id === id);
    return HttpResponse.json(
      job ? { data: { job } } : { errors: [{ message: 'Job not found' }], data: null },
    );
  }),
  api.query('ApplyQueue', () => HttpResponse.json({ data: { myApplyQueue: numbered() } })),
  api.mutation('AddToApplyQueue', ({ variables }) => {
    requests.push({ operation: 'AddToApplyQueue', variables });
    for (const id of variables['jobIds'] as string[]) {
      const item = queueItem(id);
      if (item && !applyQueue.some((q) => q.jobId === id)) applyQueue.push(item);
    }
    return HttpResponse.json({ data: { addToApplyQueue: numbered() } });
  }),
  api.mutation('MoveInApplyQueue', ({ variables }) => {
    requests.push({ operation: 'MoveInApplyQueue', variables });
    const from = applyQueue.findIndex((q) => q.jobId === variables['jobId']);
    const to = variables['direction'] === 'UP' ? from - 1 : from + 1;
    if (from >= 0 && to >= 0 && to < applyQueue.length) {
      applyQueue.splice(to, 0, ...applyQueue.splice(from, 1));
    }
    return HttpResponse.json({ data: { moveInApplyQueue: numbered() } });
  }),
  api.mutation('RemoveFromApplyQueue', ({ variables }) => {
    requests.push({ operation: 'RemoveFromApplyQueue', variables });
    const ids = variables['jobIds'] as string[];
    const kept = applyQueue.filter((q) => !ids.includes(q.jobId));
    applyQueue.splice(0, applyQueue.length, ...kept);
    return HttpResponse.json({ data: { removeFromApplyQueue: numbered() } });
  }),
  api.query('ApplyQueuePrompt', () => {
    const waiting = applyQueue.filter((q) => !q.ready);
    return HttpResponse.json({
      data: {
        applyQueuePrompt: {
          prompt: waiting.length
            ? `QUEUE PROMPT for ${waiting.map((q) => q.jobId).join(', ')}`
            : '',
          jobIds: waiting.map((q) => q.jobId),
          waiting: waiting.length,
        },
      },
    });
  }),
  api.mutation('SaveApplyQueueReply', ({ variables }) => {
    requests.push({ operation: 'SaveApplyQueueReply', variables });
    const text = variables['text'] as string;
    for (const q of applyQueue) if (text.includes(`JOB`) && text.includes(q.jobId)) q.ready = true;
    return HttpResponse.json({ data: { saveApplyQueueReply: numbered() } });
  }),
  // Every job's link answers "still open" unless a test says otherwise.
  api.mutation('CheckJobStillOpen', ({ variables }) => {
    requests.push({ operation: 'CheckJobStillOpen', variables });
    const job = JOBS.find((j) => j.id === variables['id']) ?? JOBS[0]!;
    return HttpResponse.json({
      data: {
        checkJobStillOpen: {
          ...job,
          checkedAt: new Date().toISOString(),
          lastCheck: 'OPEN',
          checkReason: 'LOOKS_OPEN',
        },
      },
    });
  }),
  api.query('MyProfile', () => HttpResponse.json({ data: { myProfile: PROFILE } })),
  // By default nothing has been tailored yet.
  api.query('TailoredResume', () => HttpResponse.json({ data: { tailoredResume: null } })),
  api.mutation('TailorResume', ({ variables }) => {
    requests.push({ operation: 'TailorResume', variables });
    const pending: TailoredResume = {
      ...READY_TAILORED,
      jobId: variables['jobId'] as string,
      status: 'PENDING',
      score: null,
      coverLetter: null,
      finishedAt: null,
    };
    return HttpResponse.json({ data: { tailorResume: pending } });
  }),
  api.query('DocumentStyle', () =>
    HttpResponse.json({
      data: {
        documentStyle: {
          resumeTemplate: 'modern',
          coverLetterLayout: 'auto',
          accentColor: '1F4E79',
          font: 'auto',
          showPhoto: false,
          hasPhoto: false,
          myDesign: null,
        },
      },
    }),
  ),
  api.query('DocumentTemplates', () =>
    HttpResponse.json({
      data: {
        documentTemplates: {
          resumeTemplates: [
            { id: 'classic', name: 'Classic', description: '' },
            { id: 'modern', name: 'Modern', description: '' },
            { id: 'compact', name: 'Compact', description: '' },
            { id: 'mine', name: 'My own Word file', description: '' },
          ],
          coverLetterLayouts: [],
          wordTemplate: {
            language: 'en',
            fileName: 'My-CV.docx',
            usable: true,
            sections: ['PROFILE', 'EXPERIENCE'],
            warnings: [],
          },
          designPrompt: '',
          rendererConfigured: true,
          rendererAvailable: true,
        },
      },
    }),
  ),
  api.query('ResumePdfCheck', ({ variables }) => {
    requests.push({ operation: 'ResumePdfCheck', variables });
    return HttpResponse.json({
      data: {
        resumePdfCheck: {
          jobId: variables['jobId'],
          template: variables['template'],
          items: [
            { code: 'PAGES', ok: false, detail: '3/2' },
            { code: 'TEXT', ok: true, detail: '412' },
            { code: 'NAME', ok: true, detail: 'User Example' },
            { code: 'EMAIL', ok: true, detail: 'user@example.com' },
            { code: 'DATES', ok: false, detail: '01/2020 – today' },
            { code: 'CHARACTERS', ok: true, detail: '' },
            { code: 'PLACEHOLDERS', ok: false, detail: '(fill in)' },
            { code: 'SKILLS', ok: true, detail: '' },
          ],
        },
      },
    });
  }),
  api.query('JobInsights', ({ variables }) =>
    HttpResponse.json({ data: { jobInsights: { ...insightsNow(), jobId: variables['jobId'] } } }),
  ),
  api.mutation('RemoveInsightTerm', ({ variables }) => {
    requests.push({ operation: 'RemoveInsightTerm', variables });
    const term = variables['term'] as string;
    const others = removedTerms.filter((r) => r.term !== term);
    removedTerms.splice(0, removedTerms.length, ...others, {
      term,
      everywhere: variables['everywhere'] === true,
    });
    return HttpResponse.json({ data: { removeInsightTerm: insightsNow() } });
  }),
  api.mutation('SaveJobResumeText', ({ variables }) => {
    requests.push({ operation: 'SaveJobResumeText', variables });
    jobResume.current = SAVED_RESUME;
    return HttpResponse.json({ data: { saveJobResumeText: insightsNow() } });
  }),
  api.mutation('EditJobResume', ({ variables }) => {
    requests.push({ operation: 'EditJobResume', variables });
    jobResume.current = {
      ...(jobResume.current ?? SAVED_RESUME),
      text: (variables['resume'] as string).trim(),
      coverLetter: (variables['coverLetter'] as string).trim(),
      formAnswers: (variables['formAnswers'] as string).trim(),
      updatedAt: '2026-11-05T12:00:00.000Z',
    };
    return HttpResponse.json({ data: { editJobResume: insightsNow() } });
  }),
  api.mutation('SaveInterviewPrep', ({ variables }) => {
    requests.push({ operation: 'SaveInterviewPrep', variables });
    interviewPrep.current = {
      text: (variables['text'] as string).trim(),
      updatedAt: '2026-11-03T12:00:00.000Z',
    };
    return HttpResponse.json({ data: { saveInterviewPrep: insightsNow() } });
  }),
  api.mutation('DeleteInterviewPrep', ({ variables }) => {
    requests.push({ operation: 'DeleteInterviewPrep', variables });
    interviewPrep.current = null;
    return HttpResponse.json({ data: { deleteInterviewPrep: insightsNow() } });
  }),
  api.mutation('DeleteJobResume', ({ variables }) => {
    requests.push({ operation: 'DeleteJobResume', variables });
    jobResume.current = null;
    return HttpResponse.json({ data: { deleteJobResume: insightsNow() } });
  }),
  http.post(jobResumeUrl('job-1'), ({ request }) => {
    // jsdom's File and FormData don't survive Node's fetch intact (the name is lost), so check
    // the request is multipart without parsing it.
    const sent = request.headers.get('content-type')?.startsWith('multipart/form-data') ?? false;
    requests.push({ operation: 'UploadJobResume', variables: { sent } });
    jobResume.current = { ...SAVED_RESUME, fileName: 'resume-acme.pdf' };
    return HttpResponse.json(insightsNow(), { status: 201 });
  }),
  api.mutation('SetHaveTerm', ({ variables }) => {
    requests.push({ operation: 'SetHaveTerm', variables });
    const term = variables['term'] as string;
    const others = haveTerms.filter((t) => t !== term);
    haveTerms.splice(0, haveTerms.length, ...others, ...(variables['have'] ? [term] : []));
    return HttpResponse.json({ data: { setHaveTerm: insightsNow() } });
  }),
  api.mutation('MatchJobResume', ({ variables }) => {
    requests.push({ operation: 'MatchJobResume', variables });
    // The real server answers at once with PENDING, then finishes in the background.
    if (jobResume.current) jobResume.current = { ...jobResume.current, aiStatus: 'PENDING' };
    return HttpResponse.json({ data: { matchJobResume: insightsNow() } });
  }),
  api.mutation('RestoreInsightTerm', ({ variables }) => {
    requests.push({ operation: 'RestoreInsightTerm', variables });
    const others = removedTerms.filter((r) => r.term !== variables['term']);
    removedTerms.splice(0, removedTerms.length, ...others);
    return HttpResponse.json({ data: { restoreInsightTerm: insightsNow() } });
  }),
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
    const filter = variables['filter'] as
      | { hidden?: boolean; applicationStatuses?: ApplicationStatus[]; createdAfter?: string }
      | undefined;
    const createdAfter = filter?.createdAfter;
    const showHidden = filter?.hidden ?? false;
    const statuses = filter?.applicationStatuses ?? [];
    const items = JOBS.filter(
      (job) =>
        hiddenIds.has(job.id) === showHidden &&
        (statuses.length === 0 || statuses.includes(job.applicationStatus)) &&
        (!createdAfter || job.createdAt > createdAfter),
    );
    return HttpResponse.json({
      data: { jobsPage: { items, total: items.length, page: 1, pageSize: 25 } },
    });
  }),
  api.query('MyTableSettings', () =>
    HttpResponse.json({ data: { myTableSettings: tableSettings.current } }),
  ),
  api.mutation('SaveTableSettings', ({ variables }) => {
    requests.push({ operation: 'SaveTableSettings', variables });
    tableSettings.current = variables['settings'] as string;
    return HttpResponse.json({ data: { saveTableSettings: true } });
  }),
  // By default this is your first visit, so nothing is New.
  api.mutation('StartJobsVisit', () => HttpResponse.json({ data: { startJobsVisit: null } })),
  api.mutation('RecalculateFit', () => {
    requests.push({ operation: 'RecalculateFit', variables: {} });
    return HttpResponse.json({ data: { recalculateFit: JOBS.length } });
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
  api.query('MailSuggestions', () =>
    HttpResponse.json({ data: { mailSuggestions: [...mailSuggestions] } }),
  ),
  api.mutation('ApproveMailSuggestion', ({ variables }) => {
    requests.push({ operation: 'ApproveMailSuggestion', variables });
    const index = mailSuggestions.findIndex((item) => item.id === variables['id']);
    const [item] = index < 0 ? [] : mailSuggestions.splice(index, 1);
    if (item) {
      for (const app of applications) {
        if (app.job.id === item.jobId) app.status = item.status;
      }
    }
    return HttpResponse.json({ data: { approveMailSuggestion: true } });
  }),
  api.mutation('DismissMailSuggestion', ({ variables }) => {
    requests.push({ operation: 'DismissMailSuggestion', variables });
    const index = mailSuggestions.findIndex((item) => item.id === variables['id']);
    if (index >= 0) mailSuggestions.splice(index, 1);
    return HttpResponse.json({ data: { dismissMailSuggestion: true } });
  }),
  api.query('MyApplications', () => HttpResponse.json({ data: { myApplications: applications } })),
  api.mutation('MarkFollowedUp', ({ variables }) => {
    requests.push({ operation: 'MarkFollowedUp', variables });
    for (const app of applications) {
      if (app.job.id === variables['jobId']) {
        app.followUpDue = false;
        app.followedUpAt = '2026-11-03T12:00:00.000Z';
      }
    }
    return HttpResponse.json({ data: { markFollowedUp: applications } });
  }),
  api.mutation('UpdateJobStatus', ({ variables }) => {
    requests.push({ operation: 'UpdateJobStatus', variables });
    const id = variables['id'] as string;
    const status = variables['status'] as ApplicationStatus;
    const index = applications.findIndex((app) => app.job.id === id);
    const job = JOBS.find((j) => j.id === id);
    if (index >= 0) applications.splice(index, 1);
    if (!['NONE', 'SAVED'].includes(status)) {
      const kept = applyQueue.filter((q) => q.jobId !== id);
      applyQueue.splice(0, applyQueue.length, ...kept);
    }
    if (status !== 'NONE' && job) {
      const updatedAt = '2026-10-27T12:00:00.000Z';
      applications.unshift({
        status,
        updatedAt,
        followedUpAt: null,
        followUpDue: false,
        job: { ...job, applicationStatus: status },
      });
    }
    return HttpResponse.json({
      data: { updateJobStatus: { id: variables['id'], applicationStatus: variables['status'] } },
    });
  }),
];

// MSW intercepts fetch() in tests, so the real GraphQL client runs against fake responses.
export const server = setupServer(...handlers);
