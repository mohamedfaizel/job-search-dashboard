import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const RM_URL = 'http://resume-matcher.test';
const CREATE_JOB = `mutation ($input: CreateJobInput!) { createJob(input: $input) { id } }`;
const FIELDS = 'jobId status error score coverLetter resumeFileName outdated';
const TAILOR = `mutation ($jobId: ID!) { tailorResume(jobId: $jobId) { ${FIELDS} } }`;
const GET = `query ($jobId: ID!) { tailoredResume(jobId: $jobId) { ${FIELDS} } }`;

interface Tailored {
  status: string;
  error: string | null;
  coverLetter: string | null;
  [field: string]: unknown;
}

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

// Fake Resume-Matcher: hands out numbered ids and remembers what it was asked to do.
let rm: { jobs: number; improved: { resume_id: string; job_id: string }[]; deleted: string[] };
const server = setupServer(
  http.post(`${RM_URL}/api/v1/jobs/upload`, () => {
    rm.jobs += 1;
    return HttpResponse.json({ message: 'ok', job_id: [`rm-job-${String(rm.jobs)}`] });
  }),
  http.post(`${RM_URL}/api/v1/resumes/improve`, async ({ request: req }) => {
    rm.improved.push((await req.json()) as (typeof rm.improved)[number]);
    return HttpResponse.json({
      request_id: 'r',
      data: {
        resume_id: `tailored-${String(rm.improved.length)}`,
        ats_score: { overall_score: 84 },
        cover_letter: null,
      },
    });
  }),
  http.post(`${RM_URL}/api/v1/resumes/:id/generate-cover-letter`, ({ params }) =>
    HttpResponse.json({ content: `Dear team, (for ${String(params['id'])})`, message: 'ok' }),
  ),
  http.get(`${RM_URL}/api/v1/resumes/:id/pdf`, () =>
    HttpResponse.arrayBuffer(PDF.buffer, { headers: { 'Content-Type': 'application/pdf' } }),
  ),
  http.get(`${RM_URL}/api/v1/resumes/:id/cover-letter/pdf`, () =>
    HttpResponse.arrayBuffer(PDF.buffer, { headers: { 'Content-Type': 'application/pdf' } }),
  ),
  http.delete(`${RM_URL}/api/v1/resumes/:id`, ({ params }) => {
    rm.deleted.push(params['id'] as string);
    return HttpResponse.json({ message: 'ok' });
  }),
);

describe('tailoring your resume to a job', () => {
  let t: TestApp;
  let jobId: string;

  beforeAll(async () => {
    server.listen({ onUnhandledFrame: 'bypass' });
    t = await createTestApp({ RESUME_MATCHER_URL: RM_URL });
  });
  afterAll(async () => {
    server.close();
    await t.app.close();
  });
  beforeEach(async () => {
    server.resetHandlers();
    rm = { jobs: 0, improved: [], deleted: [] };
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
    const res = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, {
      input: { title: 'Frontend Engineer', companyName: 'Acme', description: 'React.' },
    });
    jobId = res.data!.createJob.id;
    await t.prisma.matcherResume.create({
      data: {
        userId: 2,
        rmResumeId: 'rm-1',
        status: 'READY',
        fileName: 'cv.pdf',
        syncedAt: new Date(),
      },
    });
  });

  const tailor = async () => {
    const res = await t.asUser<{ tailorResume: Tailored }>(TAILOR, { jobId });
    return res.data?.tailorResume ?? res.errors?.[0]?.message;
  };
  /** Tailoring runs in the background, so wait until it leaves PENDING, like the page does. */
  const finished = () =>
    vi.waitFor(
      async () => {
        const res = await t.asUser<{ tailoredResume: Tailored | null }>(GET, { jobId });
        const found = res.data?.tailoredResume;
        if (!found || found.status === 'PENDING') throw new Error('still tailoring');
        return found;
      },
      { timeout: 3000, interval: 20 },
    );
  const download = (path: string, cookie = t.cookieFor('USER')) =>
    request(t.server).get(`/tailored/${jobId}/${path}`).set('Cookie', cookie);

  it('saves the tailored resume and a cover letter', async () => {
    expect(await tailor()).toMatchObject({ status: 'PENDING', coverLetter: null });

    expect(await finished()).toEqual({
      jobId,
      status: 'READY',
      error: null,
      score: 84,
      coverLetter: 'Dear team, (for tailored-1)',
      resumeFileName: 'cv.pdf',
      outdated: false,
    });
    expect(rm.improved).toEqual([{ resume_id: 'rm-1', job_id: 'rm-job-1' }]);
  });

  it('reuses the job a match already sent to Resume-Matcher', async () => {
    await t.prisma.jobMatch.create({
      data: { userId: 2, jobId, status: 'READY', rmJobId: 'from-match', startedAt: new Date() },
    });

    await tailor();
    await finished();

    expect(rm.jobs).toBe(0);
    expect(rm.improved).toEqual([{ resume_id: 'rm-1', job_id: 'from-match' }]);
  });

  it('downloads both PDFs, only for the user who tailored them', async () => {
    await download('resume.pdf').expect(404);

    await tailor();
    await finished();

    const resume = await download('resume.pdf').expect(200);
    expect(resume.headers['content-type']).toBe('application/pdf');
    expect(resume.headers['content-disposition']).toContain('tailored-resume.pdf');
    expect(new Uint8Array(resume.body as Buffer)).toEqual(PDF);
    await download('cover-letter.pdf').expect(200);
    await download('resume.pdf', t.cookieFor('ADMIN')).expect(404);
    await request(t.server).get(`/tailored/${jobId}/resume.pdf`).expect(401);
  });

  it('replaces the previous tailored copy', async () => {
    await tailor();
    await finished();
    await tailor();
    await finished();

    expect(rm.deleted).toEqual(['tailored-1']);
    expect(rm.jobs).toBe(1);
  });

  it('keeps the resume when only the cover letter fails', async () => {
    server.use(
      http.post(`${RM_URL}/api/v1/resumes/:id/generate-cover-letter`, () =>
        HttpResponse.json({ detail: 'Failed to generate cover letter.' }, { status: 500 }),
      ),
    );

    await tailor();

    expect(await finished()).toMatchObject({ status: 'READY', coverLetter: null });
    await download('resume.pdf').expect(200);
    await download('cover-letter.pdf').expect(404);
  });

  it('saves why tailoring failed', async () => {
    server.use(
      http.post(`${RM_URL}/api/v1/resumes/improve`, () =>
        HttpResponse.json(
          { detail: 'Failed to improve resume. Please try again.' },
          { status: 500 },
        ),
      ),
    );

    await tailor();

    expect(await finished()).toMatchObject({
      status: 'FAILED',
      error: 'Failed to improve resume. Please try again.',
    });
  });
});
