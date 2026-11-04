import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { InsightsService } from '../src/insights/insights.service';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const RM_URL = 'http://resume-matcher.test';
const CREATE_JOB = `mutation ($input: CreateJobInput!) { createJob(input: $input) { id } }`;
const FIELDS = `jobResume { score aiStatus aiScore aiError }`;
const SAVE = `mutation ($jobId: ID!, $text: String!) {
  saveJobResumeText(jobId: $jobId, text: $text) { ${FIELDS} } }`;
const MATCH = `mutation ($jobId: ID!) { matchJobResume(jobId: $jobId) { ${FIELDS} } }`;
const GET = `query ($jobId: ID!) { jobInsights(jobId: $jobId) { ${FIELDS} } }`;
const PAGE = `query { jobsPage { items { id applyScore } } }`;

interface JobResume {
  score: number | null;
  aiStatus: string | null;
  aiScore: number | null;
  aiError: string | null;
}

const RESUME =
  '# Jane Doe\n\n## Skills\n\n- React\n- GraphQL\n\n## Experience\n\nBuilt dashboards.';

// Fake Resume-Matcher: remembers what it was sent and which temporary resumes it still holds.
let rm: { uploaded: string[]; deleted: string[]; jobs: string[] };
let readable = true;
const server = setupServer(
  http.post(`${RM_URL}/api/v1/resumes/upload`, () => {
    rm.uploaded.push('rm-temp');
    return HttpResponse.json({
      resume_id: 'rm-temp',
      processing_status: readable ? 'ready' : 'failed',
      is_master: true,
    });
  }),
  http.delete(`${RM_URL}/api/v1/resumes/:id`, ({ params }) => {
    rm.deleted.push(String(params['id']));
    return HttpResponse.json({ message: 'ok' });
  }),
  http.post(`${RM_URL}/api/v1/jobs/upload`, async ({ request }) => {
    const body = (await request.json()) as { job_descriptions: string[] };
    rm.jobs.push(body.job_descriptions[0]!);
    return HttpResponse.json({ message: 'ok', job_id: ['rm-job-1'] });
  }),
  http.post(`${RM_URL}/api/v1/resumes/improve/preview`, () =>
    HttpResponse.json({
      request_id: 'r',
      data: {
        refinement_stats: null,
        ats_score: {
          overall_score: 81.2,
          sub_scores: {
            keyword_match: 80,
            skills_coverage: 90,
            title_match: 50,
            section_completeness: 100,
            date_consistency: null,
          },
          missing_keywords: [],
          injectable_keywords: [],
          recommendations: [],
        },
        warnings: [],
      },
    }),
  ),
);

describe('AI match of the resume Claude wrote', () => {
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
    rm = { uploaded: [], deleted: [], jobs: [] };
    readable = true;
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
    const res = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, {
      input: {
        title: 'Frontend Engineer',
        companyName: 'Acme',
        description: 'React and GraphQL.',
      },
    });
    jobId = res.data!.createJob.id;
  });

  const save = () =>
    t.asUser<{ saveJobResumeText: { jobResume: JobResume } }>(SAVE, { jobId, text: RESUME });
  const finished = () =>
    vi.waitFor(
      async () => {
        const res = await t.asUser<{ jobInsights: { jobResume: JobResume } }>(GET, { jobId });
        const found = res.data!.jobInsights.jobResume;
        if (found.aiStatus === 'PENDING') throw new Error('still checking');
        return found;
      },
      { timeout: 5000, interval: 25 },
    );

  it('needs a saved reply first', async () => {
    const res = await t.asUser(MATCH, { jobId });
    expect(res.errors?.[0]?.message).toMatch(/Save the Apply kit reply/);
    expect(rm.uploaded).toEqual([]);
  });

  it('needs a job description', async () => {
    const created = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, {
      input: { title: 'No text', companyName: 'Acme' },
    });
    jobId = created.data!.createJob.id;
    await save();
    const res = await t.asUser(MATCH, { jobId });
    expect(res.errors?.[0]?.message).toMatch(/no description/);
  });

  it('keeps the Apply kit score on the job and shows it in the table', async () => {
    const saved = (await save()).data!.saveJobResumeText.jobResume;
    expect(saved).toMatchObject({ aiStatus: null, aiScore: null });
    expect(saved.score).toBeGreaterThan(0);

    const mine = await t.asUser<{ jobsPage: { items: unknown[] } }>(PAGE);
    expect(mine.data?.jobsPage.items).toEqual([{ id: jobId, applyScore: saved.score }]);
    const admin = await t.gql<{ jobsPage: { items: unknown[] } }>(PAGE);
    expect(admin.data?.jobsPage.items).toEqual([{ id: jobId, applyScore: null }]);
  });

  it('gives replies saved before the score was kept their Apply kit score', async () => {
    await t.prisma.jobResume.create({ data: { userId: 2, jobId, text: RESUME } });

    const filled = await t.app.get(InsightsService).backfillScores();

    expect(filled).toBe(1);
    const mine = await t.asUser<{ jobsPage: { items: { applyScore: number | null }[] } }>(PAGE);
    expect(mine.data?.jobsPage.items[0]?.applyScore).toBeGreaterThan(0);
  });

  it('scores the resume with Resume-Matcher, then removes its temporary copy', async () => {
    await save();
    const started = await t.asUser<{ matchJobResume: { jobResume: JobResume } }>(MATCH, { jobId });
    // The real run takes a minute; the fake one can finish before this answer is read.
    expect(['PENDING', 'READY']).toContain(started.data?.matchJobResume.jobResume.aiStatus);

    expect(await finished()).toMatchObject({ aiStatus: 'READY', aiScore: 81.2, aiError: null });
    expect(rm.jobs).toEqual(['Frontend Engineer at Acme\n\nReact and GraphQL.']);
    // Resume-Matcher keeps at most 5 master resumes, so the copy must not stay.
    expect(rm.deleted).toEqual(['rm-temp']);
  });

  it('clears the AI match when the resume is saved again', async () => {
    await save();
    await t.asUser(MATCH, { jobId });
    await finished();

    const again = (await save()).data!.saveJobResumeText.jobResume;
    expect(again).toMatchObject({ aiStatus: null, aiScore: null, aiError: null });
  });

  it("says so when Resume-Matcher's AI can't read the PDF", async () => {
    readable = false;
    await save();
    await t.asUser(MATCH, { jobId });

    const done = await finished();
    expect(done.aiStatus).toBe('FAILED');
    expect(done.aiError).toMatch(/couldn't read it/);
    expect(rm.deleted).toEqual(['rm-temp']);
  });

  it('saves why the check failed', async () => {
    server.use(
      http.post(`${RM_URL}/api/v1/resumes/improve/preview`, () =>
        HttpResponse.json({ detail: 'AI key missing' }, { status: 500 }),
      ),
    );
    await save();
    await t.asUser(MATCH, { jobId });

    expect(await finished()).toMatchObject({ aiStatus: 'FAILED', aiScore: null });
  });
});
