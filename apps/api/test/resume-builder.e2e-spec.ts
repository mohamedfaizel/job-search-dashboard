import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, listAllJobsFor, resetDatabase, seedTestUsers } from './helpers';

const FIELDS = 'language doc outOfDate languages profileLanguages maxPages savedAt';
const GET = `query ($language: String) { resumeBuild(language: $language) { ${FIELDS} } }`;
const SAVE = `mutation ($language: String!, $doc: String!) { saveResumeBuild(language: $language, doc: $doc) { ${FIELDS} } }`;
const RESTART = `mutation ($language: String!, $reply: String) { restartResumeBuild(language: $language, reply: $reply) { ${FIELDS} } }`;
const PROMPT = `query ($language: String!) { resumeBuildPrompt(language: $language) }`;
const CREATE_JOB = `mutation ($input: CreateJobInput!) { createJob(input: $input) { id } }`;
const JOB_FIELDS = 'jobId title company language hasCopy doc masterDoc maxPages savedAt';
const GET_JOB = `query ($jobId: String!) { jobResumeBuild(jobId: $jobId) { ${JOB_FIELDS} } }`;
const START_JOB = `mutation ($jobId: String!) { startJobResumeBuild(jobId: $jobId) { ${JOB_FIELDS} } }`;
const SAVE_JOB = `mutation ($jobId: String!, $doc: String!) { saveJobResumeBuild(jobId: $jobId, doc: $doc) { ${JOB_FIELDS} } }`;
const RESET_JOB = `mutation ($jobId: String!) { resetJobResumeBuild(jobId: $jobId) { ${JOB_FIELDS} } }`;
const COPY_SECTION = `mutation ($jobId: String!, $sectionId: String!) { copySectionToMaster(jobId: $jobId, sectionId: $sectionId) { ${JOB_FIELDS} } }`;

const SECTION_FIELDS = 'sectionId before after section findings { kind text where context }';
const IMPROVE = `mutation ($input: ImproveSectionInput!) { improveSection(input: $input) { ${SECTION_FIELDS} } }`;
const IMPROVE_PROMPT = `query ($input: ImproveSectionInput!) { improveSectionPrompt(input: $input) }`;
const HAVE_TERM = `mutation ($jobId: ID!, $term: String!) { setHaveTerm(jobId: $jobId, term: $term, have: true) { jobId } }`;
const SAVE_KEY = `mutation ($value: String!) { saveApiKey(input: { kind: ANTHROPIC, value: $value }) { kind } }`;

const LETTER = `query ($jobId: String!) { jobCoverLetter(jobId: $jobId) { jobId title company language text hasCopy savedAt } }`;
const SAVE_LETTER = `mutation ($jobId: String!, $text: String!) { saveJobCoverLetter(jobId: $jobId, text: $text) { jobId text hasCopy savedAt } }`;
const TEMPLATE = `query ($language: String!) { coverLetterTemplate(language: $language) { language text savedAt } }`;
const SAVE_TEMPLATE = `mutation ($language: String!, $text: String!) { saveCoverLetterTemplate(language: $language, text: $text) { language text savedAt } }`;
const LETTER_PROMPT = `query ($input: ImproveLetterInput!) { improveLetterPrompt(input: $input) }`;
const IMPROVE_LETTER = `mutation ($input: ImproveLetterInput!) { improveLetter(input: $input) { before after findings { kind text where context } } }`;

interface Suggestion {
  sectionId: string;
  before: string;
  after: string;
  section: string;
  findings: { kind: string; text: string; where: string; context: string }[];
}

interface Build {
  language: string;
  doc: string;
  outOfDate: boolean;
  languages: string[];
  profileLanguages: string[];
  maxPages: number;
  savedAt: string | null;
}
interface JobBuild {
  jobId: string;
  title: string;
  company: string;
  language: string;
  hasCopy: boolean;
  doc: string;
  masterDoc: string;
  maxPages: number;
  savedAt: string | null;
}
interface Doc {
  name: string;
  headline?: string;
  sections: { id: string; title: string; hidden: boolean; blocks: Record<string, unknown>[] }[];
}

const PLAIN = `User Example
Frontend Engineer
user@example.com | +49 151 1234567
EXPERIENCE
• Built the design system
LANGUAGES
English, German fluent`;

describe('Resume builder', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
    await t.prisma.profile.create({
      data: {
        userId: 2,
        resumeText: PLAIN,
        languages: ['English C1', 'German A2'],
        resumeMaxPages: 1,
      },
    });
  });

  const get = async (language?: string) => {
    const res = await t.asUser<{ resumeBuild: Build }>(GET, { language });
    expect(res.errors).toBeUndefined();
    return res.data!.resumeBuild;
  };

  it('reads your resume into sections the first time without touching My profile', async () => {
    const build = await get();
    const doc = JSON.parse(build.doc) as Doc;
    expect(build).toMatchObject({
      language: 'en',
      outOfDate: false,
      languages: ['en'],
      maxPages: 1,
      savedAt: null,
    });
    expect(doc.name).toBe('User Example');
    expect(doc.sections.map((s) => s.title)).toEqual(['EXPERIENCE', 'LANGUAGES']);
    // The Languages section shows your levels from My profile, not "German fluent".
    expect(doc.sections[1]?.blocks).toEqual([
      expect.objectContaining({ kind: 'bullets', items: ['English C1', 'German A2'] }),
    ]);
    const profile = await t.prisma.profile.findUniqueOrThrow({ where: { userId: 2 } });
    expect(profile.resumeText).toBe(PLAIN);
  });

  it('saves to My profile as text, keeps hidden sections out, and stays yours', async () => {
    const doc = JSON.parse((await get()).doc) as Doc;
    doc.sections.push({
      id: 'hob',
      title: 'Hobbies',
      hidden: true,
      blocks: [{ id: 'p', kind: 'paragraph', text: 'Chess' }],
    });
    const saved = await t.asUser<{ saveResumeBuild: Build }>(SAVE, {
      language: 'en',
      doc: JSON.stringify(doc),
    });
    expect(saved.errors).toBeUndefined();
    expect(saved.data!.saveResumeBuild.savedAt).not.toBeNull();
    const profile = await t.prisma.profile.findUniqueOrThrow({ where: { userId: 2 } });
    expect(profile.resumeText).toContain('# User Example');
    expect(profile.resumeText).toContain('## EXPERIENCE\n\n- Built the design system');
    expect(profile.resumeText).toContain('- German A2');
    expect(profile.resumeText).not.toContain('Chess');

    // The admin has their own (empty) resume.
    const admin = await t.gql<{ resumeBuild: Build }>(GET);
    expect(JSON.parse(admin.data!.resumeBuild.doc)).toMatchObject({ name: 'Admin' });
  });

  it('notices a new upload and reads it again on request', async () => {
    await get();
    await t.prisma.profile.update({
      where: { userId: 2 },
      data: { resumeText: 'New Name\nSKILLS\n- Go' },
    });
    expect((await get()).outOfDate).toBe(true);
    const again = await t.asUser<{ restartResumeBuild: Build }>(RESTART, { language: 'en' });
    expect(again.data!.restartResumeBuild.outOfDate).toBe(false);
    expect(JSON.parse(again.data!.restartResumeBuild.doc)).toMatchObject({ name: 'New Name' });
  });

  it('reads an AI chat reply into entries and saves it', async () => {
    const prompt = await t.asUser<{ resumeBuildPrompt: string }>(PROMPT, { language: 'en' });
    expect(prompt.data!.resumeBuildPrompt).toContain('Built the design system');
    const reply = `# User Example
Frontend Engineer

## Experience
### Frontend Engineer | Acme
Berlin | 01/2020 – today
- Built the design system`;
    const res = await t.asUser<{ restartResumeBuild: Build }>(RESTART, { language: 'en', reply });
    expect(res.errors).toBeUndefined();
    const doc = JSON.parse(res.data!.restartResumeBuild.doc) as Doc;
    expect(doc.sections[0]?.blocks[0]).toMatchObject({
      kind: 'entry',
      org: 'Acme',
      meta: 'Berlin | 01/2020 - today',
    });
    const empty = await t.asUser(RESTART, { language: 'en', reply: '  ' });
    expect(empty.errors?.[0]?.extensions?.['apiCode']).toBe('RESUME_REPLY_EMPTY');
  });

  it('opens a resume in another language you have', async () => {
    await t.prisma.languageResume.create({
      data: { userId: 2, language: 'de', text: '# User Example\n\n## Berufserfahrung\n- Gebaut' },
    });
    const de = await get('de');
    expect(de.language).toBe('de');
    expect(de.languages).toEqual(['en', 'de']);
    const doc = JSON.parse(de.doc) as Doc;
    const saved = await t.asUser(SAVE, { language: 'de', doc: JSON.stringify(doc) });
    expect(saved.errors).toBeUndefined();
    const row = await t.prisma.languageResume.findUniqueOrThrow({
      where: { userId_language: { userId: 2, language: 'de' } },
    });
    expect(row.text).toContain('## Berufserfahrung');
    // A language without a resume opens the main one.
    expect((await get('fr')).language).toBe('en');
  });

  it('refuses a doc that is not a resume', async () => {
    const res = await t.asUser(SAVE, { language: 'en', doc: '{"x":1}' });
    expect(res.errors?.[0]?.extensions?.['apiCode']).toBe('RESUME_BUILD_INVALID');
  });

  it('sends the PDF with its page count', async () => {
    await get();
    const res = await request(t.server)
      .get('/resume-builder/en/resume.pdf?download=1')
      .set('Cookie', t.cookieFor('USER'));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['x-pdf-pages']).toBe('1');
    // No PDF box in tests: the plain PDF.
    expect(res.headers['x-pdf-styled']).toBe('0');
    expect(res.headers['content-disposition']).toContain('attachment');
    const anonymous = await request(t.server).get('/resume-builder/en/resume.pdf');
    expect(anonymous.status).toBe(401);
  });

  describe('for one job', () => {
    let jobId: string;
    beforeEach(async () => {
      const job = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, {
        input: { title: 'Frontend Engineer', companyName: 'Acme GmbH', city: 'Berlin' },
      });
      jobId = job.data!.createJob.id;
      await listAllJobsFor(t.prisma, 2);
    });

    const getJob = async () => {
      const res = await t.asUser<{ jobResumeBuild: JobBuild }>(GET_JOB, { jobId });
      expect(res.errors).toBeUndefined();
      return res.data!.jobResumeBuild;
    };
    const exp = (doc: Doc) => doc.sections.find((s) => s.title === 'EXPERIENCE')!;

    it('starts without a copy, then copies your master and keeps edits apart from it', async () => {
      const before = await getJob();
      expect(before).toMatchObject({
        title: 'Frontend Engineer',
        company: 'Acme GmbH',
        hasCopy: false,
        savedAt: null,
      });
      expect(before.doc).toBe(before.masterDoc);

      const started = await t.asUser<{ startJobResumeBuild: JobBuild }>(START_JOB, { jobId });
      expect(started.data!.startJobResumeBuild.hasCopy).toBe(true);
      const row = await t.prisma.jobResume.findUniqueOrThrow({
        where: { userId_jobId: { userId: 2, jobId } },
      });
      expect(row.text).toContain('- Built the design system');

      const doc = JSON.parse(started.data!.startJobResumeBuild.doc) as Doc;
      exp(doc).blocks.push({ id: 'x', kind: 'bullets', items: ['Tuned GraphQL queries'] });
      const saved = await t.asUser<{ saveJobResumeBuild: JobBuild }>(SAVE_JOB, {
        jobId,
        doc: JSON.stringify(doc),
      });
      expect(saved.errors).toBeUndefined();
      expect(saved.data!.saveJobResumeBuild.savedAt).not.toBeNull();
      const after = await t.prisma.jobResume.findUniqueOrThrow({
        where: { userId_jobId: { userId: 2, jobId } },
      });
      expect(after.text).toContain('Tuned GraphQL queries');
      // My profile still has the master.
      const profile = await t.prisma.profile.findUniqueOrThrow({ where: { userId: 2 } });
      expect(profile.resumeText).toBe(PLAIN);
      expect(exp(JSON.parse((await getJob()).masterDoc) as Doc).blocks).toHaveLength(1);

      // Starting again keeps the copy you have.
      const again = await t.asUser<{ startJobResumeBuild: JobBuild }>(START_JOB, { jobId });
      expect(again.data!.startJobResumeBuild.doc).toContain('Tuned GraphQL queries');
    });

    it('reads a resume from the Apply kit into sections the first time', async () => {
      await t.prisma.jobResume.create({
        data: { userId: 2, jobId, text: '# Kit Name\n\n## Skills\n- React' },
      });
      const build = await getJob();
      expect(build.hasCopy).toBe(true);
      expect(JSON.parse(build.doc)).toMatchObject({ name: 'Kit Name' });
      const row = await t.prisma.jobResume.findUniqueOrThrow({
        where: { userId_jobId: { userId: 2, jobId } },
      });
      expect(row.doc).not.toBeNull();
    });

    it('resets to the master, and copies one section back to it', async () => {
      await t.asUser(START_JOB, { jobId });
      const doc = JSON.parse((await getJob()).doc) as Doc;
      exp(doc).blocks.push({ id: 'x', kind: 'bullets', items: ['Tuned GraphQL queries'] });
      doc.sections.push({
        id: 'proj',
        title: 'Projects',
        hidden: false,
        blocks: [{ id: 'pp', kind: 'paragraph', text: 'Open source' }],
      });
      await t.asUser(SAVE_JOB, { jobId, doc: JSON.stringify(doc) });

      // One changed section goes to the master; a section the master lacks is added.
      const expId = exp(doc).id;
      for (const sectionId of [expId, 'proj']) {
        const res = await t.asUser(COPY_SECTION, { jobId, sectionId });
        expect(res.errors).toBeUndefined();
      }
      const profile = await t.prisma.profile.findUniqueOrThrow({ where: { userId: 2 } });
      expect(profile.resumeText).toContain('Tuned GraphQL queries');
      expect(profile.resumeText).toContain('## Projects');
      const missing = await t.asUser(COPY_SECTION, { jobId, sectionId: 'nope' });
      expect(missing.errors?.[0]?.extensions?.['apiCode']).toBe('SECTION_NOT_FOUND');

      // Reset: the copy is the master again (which now has both changes), so make a new change.
      const next = JSON.parse((await getJob()).doc) as Doc;
      next.headline = 'Only for this job';
      await t.asUser(SAVE_JOB, { jobId, doc: JSON.stringify(next) });
      const reset = await t.asUser<{ resetJobResumeBuild: JobBuild }>(RESET_JOB, { jobId });
      expect(JSON.parse(reset.data!.resetJobResumeBuild.doc)).not.toMatchObject({
        headline: 'Only for this job',
      });
      expect(reset.data!.resetJobResumeBuild.doc).toBe(reset.data!.resetJobResumeBuild.masterDoc);
    });

    describe('Improve with AI', () => {
      const experienceId = async () => exp(JSON.parse((await getJob()).doc) as Doc).id;

      it('writes a prompt with the job ad, and only the terms you ticked as yours', async () => {
        const job = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, {
          input: {
            title: 'Platform Engineer',
            companyName: 'Beta AG',
            description: 'You run Kubernetes and GraphQL in production.',
            skills: ['Kubernetes', 'GraphQL'],
          },
        });
        const id = job.data!.createJob.id;
        await listAllJobsFor(t.prisma, 2);
        await t.asUser(START_JOB, { jobId: id });
        await t.asUser(HAVE_TERM, { jobId: id, term: 'GraphQL' });
        const built = await t.asUser<{ jobResumeBuild: JobBuild }>(GET_JOB, { jobId: id });
        const sectionId = exp(JSON.parse(built.data!.jobResumeBuild.doc) as Doc).id;

        const res = await t.asUser<{ improveSectionPrompt: string }>(IMPROVE_PROMPT, {
          input: { jobId: id, sectionId, instruction: 'Keep it short' },
        });
        expect(res.errors).toBeUndefined();
        const prompt = res.data!.improveSectionPrompt;
        expect(prompt).toContain('Platform Engineer');
        expect(prompt).toContain('Kubernetes and GraphQL in production');
        expect(prompt).toContain('in my own words: graphql');
        expect(prompt).not.toMatch(/in my own words:.*kubernetes/i);
        expect(prompt).toContain('Also: Keep it short');
        expect(prompt).toContain('Built the design system');
      });

      it('shows a pasted reply next to the section, flags new facts and changes nothing', async () => {
        await t.asUser(START_JOB, { jobId });
        const before = await getJob();
        const sectionId = await experienceId();
        const res = await t.asUser<{ improveSection: Suggestion }>(IMPROVE, {
          input: {
            jobId,
            sectionId,
            reply:
              '```markdown\n## Experience\n- Built the design system and cut load time by 40%\n```',
          },
        });
        expect(res.errors).toBeUndefined();
        const out = res.data!.improveSection;
        expect(out.sectionId).toBe(sectionId);
        expect(out.before).toContain('Built the design system');
        expect(out.after).toContain('cut load time by 40%');
        expect(out.findings).toEqual([expect.objectContaining({ kind: 'NUMBER', text: '40%' })]);
        expect(JSON.parse(out.section)).toMatchObject({ id: sectionId, title: 'EXPERIENCE' });
        // Keep or discard happens on screen: the saved copy is as it was.
        expect((await getJob()).doc).toBe(before.doc);
      });

      it('works on your master resume too, and refuses unreadable replies and unknown sections', async () => {
        const master = JSON.parse((await get()).doc) as Doc;
        const sectionId = exp(master).id;
        const ok = await t.asUser<{ improveSection: Suggestion }>(IMPROVE, {
          input: { sectionId, reply: '- Built the design system with the team' },
        });
        expect(ok.errors).toBeUndefined();
        expect(ok.data!.improveSection.findings).toEqual([]);
        const empty = await t.asUser(IMPROVE, { input: { sectionId, reply: '```\n```\n' } });
        expect(empty.errors?.[0]?.extensions?.['apiCode']).toBe('SUGGESTION_UNREADABLE');
        const none = await t.asUser(IMPROVE, { input: { sectionId: 'nope', reply: 'text' } });
        expect(none.errors?.[0]?.extensions?.['apiCode']).toBe('SECTION_NOT_FOUND');
      });

      it('asks your own AI key when there is no reply, and says when it is missing', async () => {
        const sectionId = (JSON.parse((await get()).doc) as Doc).sections[1]!.id;
        const missing = await t.asUser(IMPROVE, { input: { sectionId } });
        expect(missing.errors?.[0]?.extensions?.['apiCode']).toBe('AI_KEY_MISSING');

        const real = globalThis.fetch;
        const calls: string[] = [];
        const stub = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
          const url = String(input instanceof Request ? input.url : input);
          if (!url.includes('api.anthropic.com')) return real(input, init);
          calls.push(url);
          const body = url.includes('/v1/models')
            ? { data: [{ id: 'claude-sonnet-5-5' }] }
            : { content: [{ type: 'text', text: '- Led the design system rollout' }] };
          return Promise.resolve(Response.json(body));
        });
        try {
          const saved = await t.asUser(SAVE_KEY, { value: 'sk-ant-test-key-1234' });
          expect(saved.errors).toBeUndefined();
          const res = await t.asUser<{ improveSection: Suggestion }>(IMPROVE, {
            input: { sectionId },
          });
          expect(res.errors).toBeUndefined();
          expect(res.data!.improveSection.after).toContain('Led the design system rollout');
          expect(calls.some((url) => url.endsWith('/v1/messages'))).toBe(true);
        } finally {
          stub.mockRestore();
        }
      });
    });

    describe('cover letter', () => {
      const letter = async () => {
        const res = await t.asUser<{
          jobCoverLetter: { text: string; hasCopy: boolean; title: string; savedAt: string | null };
        }>(LETTER, { jobId });
        expect(res.errors).toBeUndefined();
        return res.data!.jobCoverLetter;
      };

      it('belongs to the resume copy: none before, saved as clean paragraphs after', async () => {
        expect(await letter()).toMatchObject({
          hasCopy: false,
          text: '',
          title: 'Frontend Engineer',
        });
        const early = await t.asUser(SAVE_LETTER, { jobId, text: 'Dear team' });
        expect(early.errors?.[0]?.extensions?.['apiCode']).toBe('JOB_RESUME_MISSING');

        await t.asUser(START_JOB, { jobId });
        const saved = await t.asUser<{ saveJobCoverLetter: { text: string } }>(SAVE_LETTER, {
          jobId,
          text: '```\nDear team,\n\n\n\nI like this role.\n\n---\n\nBest,\nAda\n```',
        });
        expect(saved.errors).toBeUndefined();
        expect(saved.data!.saveJobCoverLetter.text).toBe(
          'Dear team,\n\nI like this role.\n\nBest,\nAda',
        );
        expect(await letter()).toMatchObject({
          hasCopy: true,
          text: expect.stringContaining('Dear team'),
        });
        // The resume copy itself is untouched.
        expect(JSON.parse((await getJob()).doc)).toEqual(JSON.parse((await getJob()).masterDoc));

        const tooLong = await t.asUser(SAVE_LETTER, { jobId, text: 'x'.repeat(20_001) });
        expect(tooLong.errors?.[0]?.extensions?.['apiCode']).toBe('REPLY_PART_TOO_LONG');
      });

      it('keeps a cover letter template per language, with its own PDF', async () => {
        const empty = await t.asUser<{
          coverLetterTemplate: { text: string; savedAt: string | null };
        }>(TEMPLATE, { language: 'en' });
        expect(empty.data!.coverLetterTemplate).toEqual({
          language: 'en',
          text: '',
          savedAt: null,
        });
        const none = await request(t.server)
          .get('/resume-builder/en/cover-letter.pdf')
          .set('Cookie', t.cookieFor('USER'));
        expect(none.status).toBe(404);

        const saved = await t.asUser<{
          saveCoverLetterTemplate: { text: string; savedAt: string };
        }>(SAVE_TEMPLATE, {
          language: 'en',
          text: 'Dear {company} team,\n\n\n\nI want the {job} role.\n\nAda',
        });
        expect(saved.errors).toBeUndefined();
        expect(saved.data!.saveCoverLetterTemplate.text).toBe(
          'Dear {company} team,\n\nI want the {job} role.\n\nAda',
        );
        expect(saved.data!.saveCoverLetterTemplate.savedAt).toBeTruthy();
        const again = await t.asUser(SAVE_TEMPLATE, { language: 'en', text: 'Hello,\n\nAda' });
        expect(again.errors).toBeUndefined();

        const res = await request(t.server)
          .get('/resume-builder/en/cover-letter.pdf')
          .set('Cookie', t.cookieFor('USER'));
        expect(res.status).toBe(200);
        expect(res.headers['x-pdf-pages']).toBe('1');
        expect(res.headers['content-disposition']).toContain('inline');

        const tooLong = await t.asUser(SAVE_TEMPLATE, { language: 'en', text: 'x'.repeat(20_001) });
        expect(tooLong.errors?.[0]?.extensions?.['apiCode']).toBe('REPLY_PART_TOO_LONG');
        const loggedOut = await request(t.server)
          .post('/graphql')
          .send({ query: TEMPLATE, variables: { language: 'en' } });
        expect((loggedOut.body as { errors?: unknown[] }).errors).toBeDefined();
      });

      it('sends the letter as a PDF, once there is one', async () => {
        await t.asUser(START_JOB, { jobId });
        const none = await request(t.server)
          .get(`/resume-builder/job/${jobId}/cover-letter.pdf`)
          .set('Cookie', t.cookieFor('USER'));
        expect(none.status).toBe(404);
        await t.asUser(SAVE_LETTER, { jobId, text: 'Dear team,\n\nI like this role.\n\nAda' });
        const res = await request(t.server)
          .get(`/resume-builder/job/${jobId}/cover-letter.pdf?download=1`)
          .set('Cookie', t.cookieFor('USER'));
        expect(res.status).toBe(200);
        expect(res.headers['x-pdf-pages']).toBe('1');
        expect(res.headers['content-disposition']).toContain('attachment');
      });

      it('writes a prompt from the resume and the ad, and checks a pasted letter for new facts', async () => {
        await t.asUser(START_JOB, { jobId });
        await t.asUser(SAVE_LETTER, { jobId, text: 'Dear team,\n\nI like this role.\n\nAda' });
        const res = await t.asUser<{ improveLetterPrompt: string }>(LETTER_PROMPT, {
          input: { jobId, instruction: 'Warmer' },
        });
        expect(res.errors).toBeUndefined();
        expect(res.data!.improveLetterPrompt).toContain('Please improve my English cover letter');
        expect(res.data!.improveLetterPrompt).toContain('Built the design system');
        expect(res.data!.improveLetterPrompt).toContain('I like this role.');
        expect(res.data!.improveLetterPrompt).toContain('Also: Warmer');

        const out = await t.asUser<{
          improveLetter: { before: string; after: string; findings: Suggestion['findings'] };
        }>(IMPROVE_LETTER, {
          input: {
            jobId,
            reply: 'Dear team,\n\nI built the design system and cut load time by 55%.\n\nAda',
          },
        });
        expect(out.errors).toBeUndefined();
        expect(out.data!.improveLetter.before).toContain('I like this role.');
        expect(out.data!.improveLetter.after).toContain('cut load time by 55%');
        expect(out.data!.improveLetter.findings).toEqual([
          expect.objectContaining({ kind: 'NUMBER', text: '55%', where: 'COVER_LETTER' }),
        ]);
        // Nothing is saved until you keep it.
        expect((await letter()).text).toContain('I like this role.');

        const empty = await t.asUser(IMPROVE_LETTER, { input: { jobId, reply: '```\n```' } });
        expect(empty.errors?.[0]?.extensions?.['apiCode']).toBe('SUGGESTION_UNREADABLE');
      });
    });

    it('keeps another user out, and sends the copy as a PDF', async () => {
      const none = await request(t.server)
        .get(`/resume-builder/job/${jobId}/resume.pdf`)
        .set('Cookie', t.cookieFor('USER'));
      expect(none.status).toBe(404);
      await t.asUser(START_JOB, { jobId });
      const res = await request(t.server)
        .get(`/resume-builder/job/${jobId}/resume.pdf?download=1`)
        .set('Cookie', t.cookieFor('USER'));
      expect(res.status).toBe(200);
      expect(res.headers['x-pdf-pages']).toBe('1');
      expect(res.headers['content-disposition']).toContain('attachment');
      // The admin has no copy for this job.
      const admin = await t.gql<{ jobResumeBuild: JobBuild }>(GET_JOB, { jobId });
      expect(admin.data!.jobResumeBuild.hasCopy).toBe(false);
      // The switcher lists your copies only.
      const COPIES = '{ jobResumeCopies { jobId title company savedAt } }';
      const mine = await t.asUser<{ jobResumeCopies: { jobId: string; title: string }[] }>(COPIES);
      expect(mine.data!.jobResumeCopies).toEqual([
        expect.objectContaining({ jobId, title: 'Frontend Engineer', company: 'Acme GmbH' }),
      ]);
      const adminCopies = await t.gql<{ jobResumeCopies: unknown[] }>(COPIES);
      expect(adminCopies.data!.jobResumeCopies).toEqual([]);
      const missing = await t.asUser(GET_JOB, { jobId: 'nope' });
      expect(missing.errors?.[0]?.extensions?.['apiCode']).toBe('JOB_NOT_FOUND');
    });
  });
});
