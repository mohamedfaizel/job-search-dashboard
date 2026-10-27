import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase } from './helpers';

const FIELDS = `headline targetRoles locations skills yearsExperience linkedinUrl githubUrl websiteUrl resumeText resumeFileName updatedAt`;
const MY_PROFILE = `query { myProfile { ${FIELDS} } }`;
const UPDATE = `mutation ($input: ProfileInput!) { updateProfile(input: $input) { ${FIELDS} } }`;

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name));

const INPUT = {
  headline: '  Frontend engineer  ',
  targetRoles: ['Frontend Engineer', ' frontend engineer ', '', 'React Developer'],
  locations: ['Berlin', 'Remote'],
  skills: ['React', 'TypeScript'],
  yearsExperience: 4,
  linkedinUrl: 'https://www.linkedin.com/in/ada',
  githubUrl: '',
  websiteUrl: null,
  resumeText: 'Ada Lovelace\nFrontend engineer',
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
    await t.prisma.user.createMany({
      data: [
        { id: 1, email: 'admin@example.com', name: 'Admin', passwordHash: 'x', role: 'ADMIN' },
        { id: 2, email: 'user@example.com', name: 'User', passwordHash: 'x' },
      ],
    });
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
        yearsExperience: null,
        linkedinUrl: null,
        githubUrl: null,
        websiteUrl: null,
        resumeText: '',
        resumeFileName: null,
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
      yearsExperience: 4,
      linkedinUrl: 'https://www.linkedin.com/in/ada',
      githubUrl: null,
      websiteUrl: null,
      resumeText: 'Ada Lovelace\nFrontend engineer',
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
});
