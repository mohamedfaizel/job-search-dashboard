import type { BuilderDoc, ResumeBuild } from '@jobsearch/data';
import { resumeBuildPdfUrl } from '@jobsearch/data';
import { http, HttpResponse } from 'msw';
import { api, requests } from '../../profile/test/server';

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

export const builderHandlers = [
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
