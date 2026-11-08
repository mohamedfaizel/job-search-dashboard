import type { BuilderDoc, JobInsights, JobResumeBuild, ResumeBuild } from '@jobsearch/data';
import { jobCoverLetterPdfUrl, jobResumeBuildPdfUrl, resumeBuildPdfUrl } from '@jobsearch/data';
import { http, HttpResponse } from 'msw';
import { api, apiKeys, requests } from '../../profile/test/server';

export const DOC: BuilderDoc = {
  name: 'Ada Lovelace',
  headline: 'Frontend Engineer',
  contact: ['Berlin', 'ada@example.com'],
  sections: [
    {
      id: 'sum',
      title: 'Summary',
      hidden: false,
      blocks: [{ id: 'p1', kind: 'paragraph', text: 'Engineer who ships.' }],
    },
    {
      id: 'exp',
      title: 'Experience',
      hidden: false,
      blocks: [
        {
          id: 'e1',
          kind: 'entry',
          title: 'Frontend Engineer',
          org: 'Acme GmbH',
          meta: 'Berlin | 01/2021 - today',
          bullets: ['Cut load time by 40%', 'Built the design system'],
          lines: [],
        },
      ],
    },
    {
      id: 'lang',
      title: 'Languages',
      hidden: false,
      blocks: [{ id: 'l1', kind: 'bullets', items: ['English C1', 'German A2'] }],
    },
  ],
};

const START: ResumeBuild = {
  language: 'en',
  doc: JSON.stringify(DOC),
  outOfDate: false,
  languages: ['en', 'de'],
  profileLanguages: ['English C1', 'German A2'],
  maxPages: 2,
  savedAt: null,
};

/** The builder's resume as the fake server has it. */
export const build = {
  current: { ...START },
  /** Pages the next PDF has. */
  pages: 1,
  reset() {
    this.current = { ...START };
    this.pages = 1;
  },
};

/** The last doc saved, read back from the request. */
export function lastSaved(): BuilderDoc | null {
  const saves = requests.filter((r) => r.operation === 'SaveResumeBuild');
  const last = saves[saves.length - 1];
  return last ? (JSON.parse(last.variables['doc'] as string) as BuilderDoc) : null;
}

/** The Experience section as Markdown, which "Improve with AI" shows as the "before". */
const EXPERIENCE_BEFORE =
  '## Experience\n\n### Frontend Engineer | Acme GmbH\nBerlin | 01/2021 - today\n- Cut load time by 40%\n- Built the design system';

export const builderHandlers = [
  api.query('ImproveSectionPrompt', ({ variables }) => {
    requests.push({ operation: 'ImproveSectionPrompt', variables });
    return HttpResponse.json({ data: { improveSectionPrompt: 'Please improve my section.' } });
  }),
  api.mutation('ImproveSection', ({ variables }) => {
    requests.push({ operation: 'ImproveSection', variables });
    const input = variables['input'] as { sectionId: string; reply: string | null };
    if (input.reply === null && apiKeys.length === 0) {
      return HttpResponse.json({
        errors: [{ message: 'no key', extensions: { apiCode: 'AI_KEY_MISSING', apiParams: {} } }],
      });
    }
    const reply = input.reply ?? '- Cut load time by 40%\n- Led the design system';
    const items = reply.split('\n').map((line) => line.replace(/^-\s*/, ''));
    const section = {
      id: input.sectionId,
      title: 'Experience',
      hidden: false,
      blocks: [{ id: 'n1', kind: 'bullets', items }],
    };
    return HttpResponse.json({
      data: {
        improveSection: {
          sectionId: input.sectionId,
          before: EXPERIENCE_BEFORE,
          after: `## Experience\n\n${reply}`,
          section: JSON.stringify(section),
          findings: reply.includes('90%')
            ? [{ kind: 'NUMBER', text: '90%', where: 'RESUME', context: 'Raised sales by 90%' }]
            : [],
        },
      },
    });
  }),
  api.query('ResumeBuild', ({ variables }) => {
    requests.push({ operation: 'ResumeBuild', variables });
    const language = (variables['language'] as string | null) ?? 'en';
    return HttpResponse.json({ data: { resumeBuild: { ...build.current, language } } });
  }),
  api.mutation('SaveResumeBuild', ({ variables }) => {
    requests.push({ operation: 'SaveResumeBuild', variables });
    build.current = {
      ...build.current,
      doc: variables['doc'] as string,
      outOfDate: false,
      savedAt: new Date().toISOString(),
    };
    return HttpResponse.json({ data: { saveResumeBuild: build.current } });
  }),
  api.mutation('RestartResumeBuild', ({ variables }) => {
    requests.push({ operation: 'RestartResumeBuild', variables });
    const doc: BuilderDoc = { ...DOC, name: 'Ada from the upload' };
    build.current = { ...build.current, doc: JSON.stringify(doc), outOfDate: false };
    return HttpResponse.json({ data: { restartResumeBuild: build.current } });
  }),
  api.query('ResumeBuildPrompt', () =>
    HttpResponse.json({ data: { resumeBuildPrompt: 'Please put my resume into the layout' } }),
  ),
  http.get(resumeBuildPdfUrl('en'), () => {
    requests.push({ operation: 'ResumePdf', variables: {} });
    return new HttpResponse('%PDF-1.7', {
      headers: {
        'Content-Type': 'application/pdf',
        'X-Pdf-Pages': String(build.pages),
        'X-Pdf-Styled': '1',
      },
    });
  }),
];

/** A job's resume copy as the fake server has it; `hasCopy` false until a test starts one. */
const JOB_START: JobResumeBuild = {
  jobId: 'j1',
  title: 'Frontend Engineer',
  company: 'Acme GmbH',
  language: 'en',
  hasCopy: false,
  doc: JSON.stringify(DOC),
  masterDoc: JSON.stringify(DOC),
  profileLanguages: ['English C1', 'German A2'],
  maxPages: 2,
  savedAt: null,
};
export const jobBuild = {
  current: { ...JOB_START },
  /** The terms the user ticked "I have this" for. */
  have: [] as string[],
  /** The cover letter saved for the job. */
  letter: '',
  /** What the fact check found in the saved copy. */
  facts: [] as { kind: string; text: string; where: string; context: string }[],
  reset() {
    this.current = { ...JOB_START };
    this.have = [];
    this.facts = [];
    this.letter = '';
  },
};

const insights = (): JobInsights =>
  ({
    jobId: 'j1',
    score: 52,
    jobResume: jobBuild.current.hasCopy ? { score: 61, factCheck: jobBuild.facts } : null,
    skills: [
      { term: 'react', inResume: false, youHave: false, relatedTo: null },
      {
        term: 'graphql',
        inResume: false,
        youHave: jobBuild.have.includes('graphql'),
        relatedTo: null,
      },
      { term: 'figma', inResume: false, youHave: jobBuild.have.includes('figma'), relatedTo: null },
    ],
    keywords: [{ term: 'storybook', inResume: false, youHave: false, relatedTo: null }],
  }) as unknown as JobInsights;

const letterOf = () => ({
  jobId: 'j1',
  title: 'Frontend Engineer',
  company: 'Acme GmbH',
  language: 'en',
  text: jobBuild.letter,
  hasCopy: jobBuild.current.hasCopy,
  savedAt: null,
});

export const jobBuilderHandlers = [
  ...builderHandlers,
  api.query('JobResumeBuild', ({ variables }) => {
    requests.push({ operation: 'JobResumeBuild', variables });
    return HttpResponse.json({ data: { jobResumeBuild: jobBuild.current } });
  }),
  api.mutation('StartJobResumeBuild', ({ variables }) => {
    requests.push({ operation: 'StartJobResumeBuild', variables });
    jobBuild.current = { ...jobBuild.current, hasCopy: true, savedAt: '2026-11-08T10:00:00Z' };
    return HttpResponse.json({ data: { startJobResumeBuild: jobBuild.current } });
  }),
  api.mutation('SaveJobResumeBuild', ({ variables }) => {
    requests.push({ operation: 'SaveJobResumeBuild', variables });
    jobBuild.current = {
      ...jobBuild.current,
      doc: variables['doc'] as string,
      savedAt: new Date().toISOString(),
    };
    return HttpResponse.json({ data: { saveJobResumeBuild: jobBuild.current } });
  }),
  api.mutation('ResetJobResumeBuild', ({ variables }) => {
    requests.push({ operation: 'ResetJobResumeBuild', variables });
    jobBuild.current = { ...jobBuild.current, doc: jobBuild.current.masterDoc };
    return HttpResponse.json({ data: { resetJobResumeBuild: jobBuild.current } });
  }),
  api.mutation('CopySectionToMaster', ({ variables }) => {
    requests.push({ operation: 'CopySectionToMaster', variables });
    // The master takes that section from the copy.
    const copy = JSON.parse(jobBuild.current.doc) as BuilderDoc;
    const master = JSON.parse(jobBuild.current.masterDoc) as BuilderDoc;
    const section = copy.sections.find((x) => x.id === variables['sectionId']);
    if (section) {
      master.sections = master.sections.map((x) => (x.id === section.id ? section : x));
    }
    jobBuild.current = { ...jobBuild.current, masterDoc: JSON.stringify(master) };
    return HttpResponse.json({ data: { copySectionToMaster: jobBuild.current } });
  }),
  api.query('JobInsights', () => HttpResponse.json({ data: { jobInsights: insights() } })),
  api.mutation('SetHaveTerm', ({ variables }) => {
    requests.push({ operation: 'SetHaveTerm', variables });
    jobBuild.have.push(variables['term'] as string);
    return HttpResponse.json({ data: { setHaveTerm: insights() } });
  }),
  api.query('JobCoverLetter', ({ variables }) => {
    requests.push({ operation: 'JobCoverLetter', variables });
    return HttpResponse.json({ data: { jobCoverLetter: letterOf() } });
  }),
  api.mutation('SaveJobCoverLetter', ({ variables }) => {
    requests.push({ operation: 'SaveJobCoverLetter', variables });
    jobBuild.letter = variables['text'] as string;
    return HttpResponse.json({ data: { saveJobCoverLetter: letterOf() } });
  }),
  api.query('ImproveLetterPrompt', ({ variables }) => {
    requests.push({ operation: 'ImproveLetterPrompt', variables });
    return HttpResponse.json({ data: { improveLetterPrompt: 'Please write my letter.' } });
  }),
  api.mutation('ImproveLetter', ({ variables }) => {
    requests.push({ operation: 'ImproveLetter', variables });
    const reply = (variables['input'] as { reply: string | null }).reply ?? 'Dear team,\n\nHi.';
    return HttpResponse.json({
      data: {
        improveLetter: {
          before: jobBuild.letter,
          after: reply,
          findings: reply.includes('90%')
            ? [
                {
                  kind: 'NUMBER',
                  text: '90%',
                  where: 'COVER_LETTER',
                  context: 'raised sales by 90%',
                },
              ]
            : [],
        },
      },
    });
  }),
  http.get(jobCoverLetterPdfUrl('j1'), () => {
    requests.push({ operation: 'JobLetterPdf', variables: {} });
    return new HttpResponse('%PDF-1.7', {
      headers: { 'Content-Type': 'application/pdf', 'X-Pdf-Pages': '1', 'X-Pdf-Styled': '1' },
    });
  }),
  api.query('ResumePdfCheck', ({ variables }) => {
    requests.push({ operation: 'ResumePdfCheck', variables });
    return HttpResponse.json({
      data: {
        resumePdfCheck: {
          jobId: variables['jobId'],
          template: 'classic',
          items: [
            { code: 'PAGES', ok: false, detail: '3/2' },
            { code: 'TEXT', ok: true, detail: '412' },
          ],
        },
      },
    });
  }),
  http.get(jobResumeBuildPdfUrl('j1'), () => {
    requests.push({ operation: 'JobResumePdf', variables: {} });
    return new HttpResponse('%PDF-1.7', {
      headers: {
        'Content-Type': 'application/pdf',
        'X-Pdf-Pages': '1',
        'X-Pdf-Styled': '1',
      },
    });
  }),
];
