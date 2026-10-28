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
      removed {
        term
        everywhere
      }
      skillsCoverage
      keywordsCoverage
      score
      prompt
    }
  }
`;

const REMOVE = /* GraphQL */ `
  mutation Remove($jobId: ID!, $term: String!, $everywhere: Boolean) {
    removeInsightTerm(jobId: $jobId, term: $term, everywhere: $everywhere) {
      skills {
        term
      }
      keywords {
        term
      }
      removed {
        term
        everywhere
      }
      score
      prompt
    }
  }
`;

const RESTORE = /* GraphQL */ `
  mutation Restore($jobId: ID!, $term: String!) {
    restoreInsightTerm(jobId: $jobId, term: $term) {
      skills {
        term
      }
      removed {
        term
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
  removed: { term: string; everywhere: boolean }[];
  skillsCoverage: number | null;
  keywordsCoverage: number | null;
  score: number | null;
  prompt: string;
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

  it('scores the resume and builds a prompt with what is missing', async () => {
    const job = await addJob({
      title: 'Backend Engineer',
      skills: ['node.js', 'kafka'],
      description: 'Event streaming with Kafka and Node.js in microservices.',
    });
    await t.prisma.profile.create({ data: { userId: 2, resumeText: 'NodeJS microservices.' } });

    const result = await insights(job.id);
    expect(result.skillsCoverage).toBe(50);
    expect(result.score).toBe(
      Math.round(result.skillsCoverage! * 0.6 + result.keywordsCoverage! * 0.4),
    );
    expect(result.prompt).toContain('Job: Backend Engineer at Acme');
    expect(result.prompt).toContain('- kafka');
    expect(result.prompt).not.toContain('- node.js');
  });

  it('removes a term from one job or from every job, and puts it back', async () => {
    const first = await addJob({ title: 'A', skills: ['kafka', 'react'], description: 'Hamburg.' });
    const second = await addJob({ title: 'B', skills: ['kafka'], description: 'Hamburg office.' });
    await t.prisma.profile.create({ data: { userId: 2, resumeText: 'React.' } });

    const removed = await t.asUser<{ removeInsightTerm: Insights }>(REMOVE, {
      jobId: first.id,
      term: 'Kafka',
    });
    expect(removed.errors).toBeUndefined();
    expect(removed.data!.removeInsightTerm.skills.map((s) => s.term)).toEqual(['react']);
    expect(removed.data!.removeInsightTerm.removed).toEqual([{ term: 'kafka', everywhere: false }]);
    // Only React is left, and it's in the resume.
    expect(removed.data!.removeInsightTerm.prompt).not.toContain('- kafka');
    // The other job still lists it.
    expect((await insights(second.id)).skills.map((s) => s.term)).toEqual(['kafka']);

    // A keyword removed everywhere leaves every job.
    await t.asUser(REMOVE, { jobId: first.id, term: 'hamburg', everywhere: true });
    expect((await insights(second.id)).keywords.map((k) => k.term)).not.toContain('hamburg');
    expect((await insights(second.id)).removed).toEqual([{ term: 'hamburg', everywhere: true }]);

    const restored = await t.asUser<{ restoreInsightTerm: Insights }>(RESTORE, {
      jobId: first.id,
      term: 'kafka',
    });
    expect(restored.data!.restoreInsightTerm.skills.map((s) => s.term)).toEqual(['kafka', 'react']);
    // Other users are not affected.
    const admin = await t.gql<{ jobInsights: Insights }>(INSIGHTS, { jobId: second.id });
    expect(admin.data!.jobInsights.removed).toEqual([]);
  });

  it('says when a job does not exist', async () => {
    const res = await t.asUser(INSIGHTS, { jobId: 'nope' });
    expect(res.errors?.[0]?.message).toBe('Job nope not found');
  });
});
