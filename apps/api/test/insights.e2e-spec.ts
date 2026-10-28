import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const CREATE_JOB = /* GraphQL */ `
  mutation CreateJob($input: CreateJobInput!) {
    createJob(input: $input) {
      id
      language
    }
  }
`;

const INSIGHTS = /* GraphQL */ `
  query JobInsights($jobId: ID!) {
    jobInsights(jobId: $jobId) {
      title
      normalizedTitle
      language
      languageDetected
      hasResume
      skills {
        term
        inResume
      }
      keywords {
        term
        inResume
      }
    }
  }
`;

interface Insights {
  title: string;
  language: string | null;
  languageDetected: boolean;
  hasResume: boolean;
  skills: { term: string; inResume: boolean }[];
  keywords: { term: string; inResume: boolean }[];
}

describe('job insights without AI', () => {
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
  });

  async function addJob(input: Record<string, unknown>) {
    const res = await t.gql<{ createJob: { id: string; language: string | null } }>(CREATE_JOB, {
      input: { companyName: 'Acme', ...input },
    });
    expect(res.errors).toBeUndefined();
    return res.data!.createJob;
  }
  async function insights(jobId: string) {
    const res = await t.asUser<{ jobInsights: Insights }>(INSIGHTS, { jobId });
    expect(res.errors).toBeUndefined();
    return res.data!.jobInsights;
  }

  it('checks the job’s skills and keywords against your resume', async () => {
    const job = await addJob({
      title: 'Backend Engineer',
      skills: ['node.js', 'kafka'],
      description:
        'We are building event streaming with Kafka and Node.js. You will design microservices, ' +
        'own microservices in production and tune Postgres queries. Terraform is a plus.',
    });
    // Other jobs make the common words common, so TF-IDF can spot what is special here.
    await addJob({
      title: 'Frontend Engineer',
      description: 'We are building a design system in React. Production experience required.',
    });
    await t.prisma.profile.create({
      data: { userId: 2, resumeText: 'Five years of NodeJS microservices. Some Terraform.' },
    });

    const result = await insights(job.id);
    expect(result).toMatchObject({ title: 'Backend Engineer', language: 'en', hasResume: true });
    expect(result.skills).toEqual([
      { term: 'node.js', inResume: true },
      { term: 'kafka', inResume: false },
    ]);
    // Skill tags aren't repeated as keywords, and words in every ad ("building") rank low.
    const keywords = result.keywords.map((k) => k.term);
    expect(keywords[0]).toBe('microservices');
    expect(keywords).not.toContain('kafka');
    expect(result.keywords).toContainEqual({ term: 'terraform', inResume: true });
    expect(result.keywords).toContainEqual({ term: 'postgres', inResume: false });
  });

  it('detects the language of a hand-added job and says it has no resume yet', async () => {
    const job = await addJob({
      title: 'Frontend Entwickler',
      description: 'Wir suchen einen Frontend Entwickler mit sehr guten Kenntnissen in React.',
    });
    expect(job.language).toBe('de');

    const result = await insights(job.id);
    expect(result).toMatchObject({ language: 'de', languageDetected: false, hasResume: false });
  });

  it('says when a job does not exist', async () => {
    const res = await t.asUser(INSIGHTS, { jobId: 'nope' });
    expect(res.errors?.[0]?.message).toBe('Job nope not found');
  });
});
