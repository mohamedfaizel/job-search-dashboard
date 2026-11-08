import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const FIELDS = 'language doc outOfDate languages profileLanguages maxPages savedAt';
const GET = `query ($language: String) { resumeBuild(language: $language) { ${FIELDS} } }`;
const SAVE = `mutation ($language: String!, $doc: String!) { saveResumeBuild(language: $language, doc: $doc) { ${FIELDS} } }`;
const RESTART = `mutation ($language: String!, $reply: String) { restartResumeBuild(language: $language, reply: $reply) { ${FIELDS} } }`;
const PROMPT = `query ($language: String!) { resumeBuildPrompt(language: $language) }`;

interface Build {
  language: string;
  doc: string;
  outOfDate: boolean;
  languages: string[];
  profileLanguages: string[];
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
});
