import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobMatchService } from '../src/resume-matcher/job-match.service';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const RM_URL = 'http://resume-matcher.test';
const CREATE_JOB = `mutation ($input: CreateJobInput!) { createJob(input: $input) { id } }`;
const FIELDS = `jobId status error score keywordMatchBefore keywordMatch skillsCoverage titleMatch
  sectionCompleteness dateConsistency missingKeywords injectableKeywords recommendations
  resumeFileName outdated`;
const MATCH = `mutation ($jobId: ID!) { matchJob(jobId: $jobId) { ${FIELDS} } }`;
const GET = `query ($jobId: ID!) { jobMatch(jobId: $jobId) { ${FIELDS} } }`;
const PAGE = `query { jobsPage { items { id matchStatus matchScore } } }`;

interface JobMatch {
  status: string;
  error: string | null;
  score: number | null;
  outdated: boolean;
  [field: string]: unknown;
}

const ATS = {
  overall_score: 72.5,
  sub_scores: {
    keyword_match: 70,
    skills_coverage: 80,
    title_match: 50,
    section_completeness: 100,
    date_consistency: null,
  },
  missing_keywords: ['Kubernetes'],
  injectable_keywords: ['GraphQL'],
  recommendations: ['Add "Frontend Engineer" to your headline.'],
};

// Fake Resume-Matcher: remembers the job descriptions and previews it was asked for.
let rm: {
  jobs: { text: string; resumeId: string }[];
  previews: { resume_id: string; job_id: string; prompt_id: string }[];
};
const server = setupServer(
  http.post(`${RM_URL}/api/v1/jobs/upload`, async ({ request }) => {
    const body = (await request.json()) as { job_descriptions: string[]; resume_id: string };
    rm.jobs.push({ text: body.job_descriptions[0]!, resumeId: body.resume_id });
    return HttpResponse.json({ message: 'ok', job_id: [`rm-job-${String(rm.jobs.length)}`] });
  }),
  http.post(`${RM_URL}/api/v1/resumes/improve/preview`, async ({ request }) => {
    rm.previews.push((await request.json()) as (typeof rm.previews)[number]);
    return HttpResponse.json({
      request_id: 'r',
      data: {
        refinement_stats: { initial_match_percentage: 55, final_match_percentage: 70 },
        ats_score: ATS,
        warnings: [],
      },
    });
  }),
);

describe('matching your resume against a job', () => {
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
    rm = { jobs: [], previews: [] };
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
    const res = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, {
      input: { title: 'Frontend Engineer', companyName: 'Acme', description: 'React and GraphQL.' },
    });
    jobId = res.data!.createJob.id;
  });

  const sendResume = (syncedAt = new Date()) =>
    t.prisma.matcherResume.create({
      data: { userId: 2, rmResumeId: 'rm-1', status: 'READY', fileName: 'cv.pdf', syncedAt },
    });
  const match = async () => {
    const res = await t.asUser<{ matchJob: JobMatch }>(MATCH, { jobId });
    return res.data?.matchJob ?? res.errors?.[0]?.message;
  };
  /** The match runs in the background, so wait until it leaves PENDING, like the page does. */
  const finished = () =>
    vi.waitFor(
      async () => {
        const res = await t.asUser<{ jobMatch: JobMatch | null }>(GET, { jobId });
        const found = res.data?.jobMatch;
        if (!found || found.status === 'PENDING') throw new Error('still matching');
        return found;
      },
      { timeout: 3000, interval: 20 },
    );

  it('needs your resume in Resume-Matcher first', async () => {
    expect(await match()).toMatch(/Send your resume to Resume-Matcher on My profile first/);
    expect(rm.jobs).toEqual([]);
  });

  it('needs a job description', async () => {
    await sendResume();
    const res = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, {
      input: { title: 'No text', companyName: 'Acme' },
    });
    jobId = res.data!.createJob.id;

    expect(await match()).toMatch(/no description/);
  });

  it('returns PENDING at once, then saves the ATS score', async () => {
    await sendResume();

    expect(await match()).toMatchObject({
      status: 'PENDING',
      score: null,
      resumeFileName: 'cv.pdf',
    });

    expect(await finished()).toEqual({
      jobId,
      status: 'READY',
      error: null,
      score: 72.5,
      keywordMatchBefore: 55,
      keywordMatch: 70,
      skillsCoverage: 80,
      titleMatch: 50,
      sectionCompleteness: 100,
      dateConsistency: null,
      missingKeywords: ['Kubernetes'],
      injectableKeywords: ['GraphQL'],
      recommendations: ['Add "Frontend Engineer" to your headline.'],
      resumeFileName: 'cv.pdf',
      outdated: false,
    });
    // The title and company lead the text, so Resume-Matcher can score the title.
    expect(rm.jobs).toEqual([
      { text: 'Frontend Engineer at Acme\n\nReact and GraphQL.', resumeId: 'rm-1' },
    ]);
    expect(rm.previews).toEqual([{ resume_id: 'rm-1', job_id: 'rm-job-1', prompt_id: 'nudge' }]);
  });

  it('shows the score in your table only', async () => {
    await sendResume();
    await match();
    await finished();

    const mine = await t.asUser<{ jobsPage: { items: unknown[] } }>(PAGE);
    expect(mine.data?.jobsPage.items).toEqual([
      { id: jobId, matchStatus: 'READY', matchScore: 72.5 },
    ]);
    const admin = await t.gql<{ jobsPage: { items: unknown[] } }>(PAGE);
    expect(admin.data?.jobsPage.items).toEqual([
      { id: jobId, matchStatus: null, matchScore: null },
    ]);
  });

  it("reuses Resume-Matcher's copy of the job when matching again", async () => {
    await sendResume();
    await match();
    await finished();
    await match();
    await finished();

    expect(rm.jobs).toHaveLength(1);
    expect(rm.previews.map((p) => p.job_id)).toEqual(['rm-job-1', 'rm-job-1']);
  });

  it('sends the job again when Resume-Matcher lost its copy', async () => {
    await sendResume();
    await t.prisma.jobMatch.create({
      data: { userId: 2, jobId, status: 'READY', rmJobId: 'gone', startedAt: new Date() },
    });
    server.use(
      http.post(
        `${RM_URL}/api/v1/resumes/improve/preview`,
        () => HttpResponse.json({ detail: 'Job description not found' }, { status: 404 }),
        { once: true },
      ),
    );

    await match();

    expect(await finished()).toMatchObject({ status: 'READY', score: 72.5 });
    expect(rm.previews.map((p) => p.job_id)).toEqual(['rm-job-1']);
  });

  it('saves why a match failed', async () => {
    await sendResume();
    server.use(
      http.post(`${RM_URL}/api/v1/resumes/improve/preview`, () =>
        HttpResponse.json({ detail: 'Resume tailoring timed out after 240s.' }, { status: 504 }),
      ),
    );

    await match();

    expect(await finished()).toMatchObject({
      status: 'FAILED',
      score: null,
      error: 'Resume tailoring timed out after 240s.',
    });
  });

  it('marks the score outdated after you send a newer resume', async () => {
    await sendResume(new Date('2026-01-01'));
    await match();
    await finished();

    await t.prisma.matcherResume.update({ where: { userId: 2 }, data: { syncedAt: new Date() } });

    expect(await finished()).toMatchObject({ status: 'READY', outdated: true });
  });

  it('fails matches left running when the API restarts', async () => {
    await t.prisma.jobMatch.create({
      data: { userId: 2, jobId, status: 'PENDING', startedAt: new Date() },
    });

    await t.app.get(JobMatchService).onApplicationBootstrap();

    expect(await finished()).toMatchObject({
      status: 'FAILED',
      error: expect.stringMatching(/restarted/),
    });
  });
});
