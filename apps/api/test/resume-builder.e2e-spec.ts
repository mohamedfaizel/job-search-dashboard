import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

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
      const missing = await t.asUser(GET_JOB, { jobId: 'nope' });
      expect(missing.errors?.[0]?.extensions?.['apiCode']).toBe('JOB_NOT_FOUND');
    });
  });
});
