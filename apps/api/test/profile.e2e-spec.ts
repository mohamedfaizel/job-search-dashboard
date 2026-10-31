import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const FIELDS = `headline targetRoles locations skills languages yearsExperience linkedinUrl githubUrl websiteUrl resumeText resumeFileName phone address workPermit noticePeriod salaryExpectation relocation applicationNotes updatedAt`;
const MY_PROFILE = `query { myProfile { ${FIELDS} } }`;
const UPDATE = `mutation ($input: ProfileInput!) { updateProfile(input: $input) { ${FIELDS} } }`;

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name));

const INPUT = {
  headline: '  Frontend engineer  ',
  targetRoles: ['Frontend Engineer', ' frontend engineer ', '', 'React Developer'],
  locations: ['Berlin', 'Remote'],
  skills: ['React', 'TypeScript'],
  languages: [' German A2 ', 'German a2', 'English C1'],
  yearsExperience: 4,
  linkedinUrl: 'https://www.linkedin.com/in/ada',
  githubUrl: '',
  websiteUrl: null,
  resumeText: 'Ada Lovelace\nFrontend engineer',
  phone: ' +49 151 0000000 ',
  address: 'Berlin, Germany',
  workPermit: 'EU Blue Card',
  noticePeriod: '1 month',
  salaryExpectation: '',
  relocation: 'Yes, within Germany',
  applicationNotes: 'I want to build products people use every day.',
};

describe('profile', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    // Profiles belong to real users, so the minted sessions need matching rows.
    await seedTestUsers(t.prisma);
  });

  const upload = (role: 'ADMIN' | 'USER', file: Buffer, name: string) =>
    request(t.server)
      .post('/profile/resume')
      .set('Cookie', t.cookieFor(role))
      .attach('file', file, name);

  it('needs a logged-in user', async () => {
    const res = await t.anonymous(MY_PROFILE);
    expect(res.errors?.[0]?.message).toBe('Please log in');
    const file = await request(t.server)
      .post('/profile/resume')
      .attach('file', fixture('resume.pdf'), 'resume.pdf');
    expect(file.status).toBe(401);
  });

  it('starts empty', async () => {
    const res = await t.asUser(MY_PROFILE);
    expect(res.data).toEqual({
      myProfile: {
        headline: '',
        targetRoles: [],
        locations: [],
        skills: [],
        languages: [],
        yearsExperience: null,
        linkedinUrl: null,
        githubUrl: null,
        websiteUrl: null,
        resumeText: '',
        resumeFileName: null,
        phone: '',
        address: '',
        workPermit: '',
        noticePeriod: '',
        salaryExpectation: '',
        relocation: '',
        applicationNotes: '',
        updatedAt: null,
      },
    });
  });

  it('saves a cleaned-up profile and reads it back', async () => {
    const saved = await t.asUser(UPDATE, { input: INPUT });
    expect(saved.errors).toBeUndefined();

    const res = await t.asUser<{ myProfile: Record<string, unknown> }>(MY_PROFILE);
    expect(res.data!.myProfile).toMatchObject({
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
      phone: '+49 151 0000000',
      address: 'Berlin, Germany',
      workPermit: 'EU Blue Card',
      noticePeriod: '1 month',
      salaryExpectation: '',
      relocation: 'Yes, within Germany',
      applicationNotes: 'I want to build products people use every day.',
    });
    expect(res.data!.myProfile['updatedAt']).not.toBeNull();
  });

  it('refuses bad links and impossible experience', async () => {
    const res = await t.asUser(UPDATE, {
      input: { ...INPUT, linkedinUrl: 'not a link', yearsExperience: 99 },
    });
    const message = res.errors?.[0]?.message ?? '';
    expect(message).toMatch(/LinkedIn/);
    expect(message).toMatch(/60/);
  });

  it('keeps each user’s profile private', async () => {
    await t.asUser(UPDATE, { input: INPUT });

    const admin = await t.gql<{ myProfile: { headline: string } }>(MY_PROFILE);
    expect(admin.data!.myProfile.headline).toBe('');
  });

  it('reads the text out of an uploaded PDF', async () => {
    const res = await upload('USER', fixture('resume.pdf'), 'Ada CV.pdf');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ resumeFileName: 'Ada CV.pdf' });
    const profile = await t.asUser<{ myProfile: { resumeText: string } }>(MY_PROFILE);
    expect(profile.data!.myProfile.resumeText).toContain('Ada Lovelace');
    expect(profile.data!.myProfile.resumeText).toContain('React, TypeScript');
  });

  it('reads the text out of an uploaded Word file and keeps the rest of the profile', async () => {
    await t.asUser(UPDATE, { input: INPUT });

    const res = await upload('USER', fixture('resume.docx'), 'grace.docx');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      headline: 'Frontend engineer',
      resumeFileName: 'grace.docx',
      resumeText: 'Grace Hopper\n\nBackend engineer: Node.js, PostgreSQL',
    });
  });

  it('refuses other file types and missing files', async () => {
    const txt = await upload('USER', Buffer.from('hello'), 'notes.txt');
    expect(txt.status).toBe(400);
    expect(txt.body).toMatchObject({ message: 'Upload a PDF or Word (.docx) file' });

    const none = await request(t.server).post('/profile/resume').set('Cookie', t.cookieFor('USER'));
    expect(none.status).toBe(400);
    expect(none.body).toMatchObject({ message: 'Choose a file to upload' });
  });

  describe('master resume in another language', () => {
    const OTHER = `language text fileName`;
    const SAVE = `mutation ($language: String!, $text: String!) { saveLanguageResume(language: $language, text: $text) { resumeLanguage otherResumes { ${OTHER} } } }`;
    const DELETE = `mutation ($language: String!) { deleteLanguageResume(language: $language) { otherResumes { ${OTHER} } } }`;
    const TRANSLATE = `query ($language: String!) { translationPrompt(language: $language) }`;
    type Saved = {
      saveLanguageResume: {
        resumeLanguage: string;
        otherResumes: { language: string; text: string; fileName: string | null }[];
      };
    };

    it('saves, replaces and deletes your German resume', async () => {
      await t.asUser(UPDATE, { input: INPUT });
      const saved = await t.asUser<Saved>(SAVE, {
        language: 'de',
        text: '  Ada Lovelace\r\nEntwicklerin ',
      });
      expect(saved.errors).toBeUndefined();
      expect(saved.data!.saveLanguageResume).toEqual({
        resumeLanguage: 'en',
        otherResumes: [{ language: 'de', text: 'Ada Lovelace\nEntwicklerin', fileName: null }],
      });
      await t.asUser(SAVE, { language: 'de', text: 'Neu' });
      const mine = await t.asUser<{ myProfile: { otherResumes: { text: string }[] } }>(
        `query { myProfile { otherResumes { ${OTHER} } } }`,
      );
      expect(mine.data!.myProfile.otherResumes).toEqual([
        { language: 'de', text: 'Neu', fileName: null },
      ]);
      // Your own, not the admin's.
      const admin = await t.gql<{ myProfile: { otherResumes: unknown[] } }>(
        `query { myProfile { otherResumes { language } } }`,
      );
      expect(admin.data!.myProfile.otherResumes).toEqual([]);

      const deleted = await t.asUser<{ deleteLanguageResume: { otherResumes: unknown[] } }>(
        DELETE,
        { language: 'de' },
      );
      expect(deleted.data!.deleteLanguageResume.otherResumes).toEqual([]);
    });

    it('refuses the master resume’s own language, unknown languages and empty text', async () => {
      await t.asUser(UPDATE, { input: { ...INPUT, resumeLanguage: 'de' } });
      const same = await t.asUser(SAVE, { language: 'de', text: 'x' });
      expect(same.errors?.[0]?.message).toBe(
        'Your master resume is already in German. Pick another language.',
      );
      expect((await t.asUser(SAVE, { language: 'xx', text: 'x' })).errors?.[0]?.message).toBe(
        'Pick a language from the list',
      );
      expect((await t.asUser(SAVE, { language: 'en', text: '  ' })).errors?.[0]?.message).toBe(
        'The resume is empty',
      );
    });

    it('builds a translation prompt from your master resume and real levels', async () => {
      const none = await t.asUser(TRANSLATE, { language: 'de' });
      expect(none.errors?.[0]?.message).toBe('Add your master resume first');

      await t.asUser(UPDATE, { input: INPUT });
      const res = await t.asUser<{ translationPrompt: string }>(TRANSLATE, { language: 'de' });
      expect(res.data!.translationPrompt).toContain('from English into German');
      expect(res.data!.translationPrompt).toContain('Ada Lovelace\nFrontend engineer');
      expect(res.data!.translationPrompt).toContain('- German A2\n- English C1');
    });

    it('reads an uploaded German resume file', async () => {
      const res = await request(t.server)
        .post('/profile/resume/de')
        .set('Cookie', t.cookieFor('USER'))
        .attach('file', fixture('resume.docx'), 'lebenslauf.docx');
      expect(res.status).toBe(201);
      expect((res.body as { otherResumes: unknown[] }).otherResumes).toEqual([
        expect.objectContaining({ language: 'de', fileName: 'lebenslauf.docx' }),
      ]);
    });
  });
});
