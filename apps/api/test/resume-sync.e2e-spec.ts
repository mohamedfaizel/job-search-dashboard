import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const RM_URL = 'http://resume-matcher.test';
const FIELDS = 'state fileName syncedAt message';
const MINE = `query { myMatcherResume { ${FIELDS} } }`;
const SYNC = `mutation { syncResumeToMatcher { ${FIELDS} } }`;

interface MatcherResume {
  state: string;
  fileName: string | null;
  syncedAt: string | null;
  message: string;
}

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name));

// Fake Resume-Matcher: remembers what it was sent and deleted, and hands out numbered ids.
let rm: { uploads: { name: string; size: number }[]; deleted: string[]; nextId: number };
const uploadOk = http.post(`${RM_URL}/api/v1/resumes/upload`, async ({ request: req }) => {
  // Fine for a small test upload; the deprecation is about parsing large bodies in servers.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const file = (await req.formData()).get('file') as File;
  rm.uploads.push({ name: file.name, size: file.size });
  rm.nextId += 1;
  return HttpResponse.json({
    resume_id: `rm-${String(rm.nextId)}`,
    processing_status: 'ready',
    is_master: true,
  });
});
const server = setupServer(
  uploadOk,
  http.delete(`${RM_URL}/api/v1/resumes/:id`, ({ params }) => {
    rm.deleted.push(params['id'] as string);
    return HttpResponse.json({ message: 'Resume deleted successfully' });
  }),
);

describe('sending the master resume to Resume-Matcher', () => {
  let t: TestApp;

  beforeAll(async () => {
    // Let local requests (supertest -> our API) through; only Resume-Matcher is faked.
    server.listen({ onUnhandledFrame: 'bypass' });
    t = await createTestApp({ RESUME_MATCHER_URL: RM_URL });
  });
  afterAll(async () => {
    server.close();
    await t.app.close();
  });
  beforeEach(async () => {
    server.resetHandlers();
    rm = { uploads: [], deleted: [], nextId: 0 };
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
  });

  const upload = (name = 'resume.pdf') =>
    request(t.server)
      .post('/profile/resume')
      .set('Cookie', t.cookieFor('USER'))
      .attach('file', fixture(name), name)
      .expect(201);
  const mine = async () =>
    (await t.asUser<{ myMatcherResume: MatcherResume }>(MINE)).data?.myMatcherResume;
  const sync = async () => {
    const res = await t.asUser<{ syncResumeToMatcher: MatcherResume }>(SYNC);
    return res.data?.syncResumeToMatcher ?? res.errors?.[0]?.message;
  };

  it('needs an uploaded file first', async () => {
    expect(await mine()).toMatchObject({ state: 'NO_FILE', fileName: null });
    expect(await sync()).toMatch(/Upload your resume as a PDF or Word file/);
    expect(rm.uploads).toEqual([]);
  });

  it('sends the uploaded file and remembers the copy', async () => {
    await upload();
    expect(await mine()).toMatchObject({ state: 'NOT_SENT' });

    const result = await sync();

    expect(result).toMatchObject({
      state: 'READY',
      fileName: 'resume.pdf',
      message: 'Resume-Matcher has read resume.pdf. Jobs will be matched against it.',
    });
    expect(rm.uploads).toEqual([{ name: 'resume.pdf', size: fixture('resume.pdf').length }]);
    const row = await t.prisma.matcherResume.findUnique({ where: { userId: 2 } });
    expect(row).toMatchObject({ rmResumeId: 'rm-1', status: 'READY', error: null });
  });

  it('replaces the old copy after a new upload', async () => {
    await upload();
    await sync();
    await upload('resume.docx');
    expect(await mine()).toMatchObject({ state: 'OUTDATED', fileName: 'resume.pdf' });

    expect(await sync()).toMatchObject({ state: 'READY', fileName: 'resume.docx' });
    // The old copy is deleted first: Resume-Matcher holds at most 5 master resumes.
    expect(rm.deleted).toEqual(['rm-1']);
    expect(rm.uploads.map((u) => u.name)).toEqual(['resume.pdf', 'resume.docx']);
  });

  it('keeps each user’s copy separate', async () => {
    await upload();
    await sync();
    const admin = await t.gql<{ myMatcherResume: MatcherResume }>(MINE);
    expect(admin.data?.myMatcherResume.state).toBe('NO_FILE');
  });

  it('explains when the AI could not read the resume', async () => {
    server.use(
      http.post(`${RM_URL}/api/v1/resumes/upload`, () =>
        HttpResponse.json({ resume_id: 'rm-9', processing_status: 'failed', is_master: true }),
      ),
    );
    await upload();

    const result = await sync();

    expect(result).toMatchObject({ state: 'FAILED' });
    expect((result as MatcherResume).message).toMatch(/Test AI connection/);
    // Its id is kept, so the next send deletes this copy instead of piling up masters.
    const row = await t.prisma.matcherResume.findUnique({ where: { userId: 2 } });
    expect(row?.rmResumeId).toBe('rm-9');
  });

  it('explains the 5-resume limit', async () => {
    server.use(
      http.post(`${RM_URL}/api/v1/resumes/upload`, () =>
        HttpResponse.json(
          { detail: 'You can keep up to 5 master resumes. Delete one before adding another.' },
          { status: 409 },
        ),
      ),
    );
    await upload();

    expect(await sync()).toMatchObject({
      state: 'FAILED',
      message: expect.stringContaining('5 master resumes') as unknown,
    });
  });

  it('says how to start Resume-Matcher when it is down', async () => {
    server.use(http.post(`${RM_URL}/api/v1/resumes/upload`, () => HttpResponse.error()));
    await upload();

    expect(await sync()).toMatchObject({
      state: 'FAILED',
      message: `Resume-Matcher at ${RM_URL} is not reachable. Start it with pnpm rm:up.`,
    });
  });

  it('carries on when the old copy was already deleted in Resume-Matcher', async () => {
    await upload();
    await sync();
    server.use(
      http.delete(`${RM_URL}/api/v1/resumes/:id`, () =>
        HttpResponse.json({ detail: 'Resume not found' }, { status: 404 }),
      ),
    );

    expect(await sync()).toMatchObject({ state: 'READY' });
    expect(rm.uploads).toHaveLength(2);
  });
});
