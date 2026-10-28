import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { matchScore } from '../src/insights/score';
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

const JOB_RESUME = `jobResume {
  fileName
  skillsCoverage
  keywordsCoverage
  titleMatch
  score
  nowCovered
  stillMissing
}`;

const INSIGHTS = /* GraphQL */ `
  query JobInsights($jobId: ID!) {
    jobInsights(jobId: $jobId) {
      title
      normalizedTitle
      language
      languageDetected
      germanRequired
      germanLevel
      resumeLanguage
      hasResume
      skills {
        term
        inResume
        relatedTo
      }
      keywords {
        term
        inResume
        relatedTo
      }
      removed {
        term
        everywhere
      }
      skillsCoverage
      keywordsCoverage
      titleMatch
      score
      ${JOB_RESUME}
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

const SAVE_TEXT = /* GraphQL */ `
  mutation Save($jobId: ID!, $text: String!) {
    saveJobResumeText(jobId: $jobId, text: $text) {
      score
      ${JOB_RESUME}
    }
  }
`;

const DELETE_RESUME = /* GraphQL */ `
  mutation Delete($jobId: ID!) {
    deleteJobResume(jobId: $jobId) {
      ${JOB_RESUME}
    }
  }
`;

interface JobResume {
  fileName: string | null;
  skillsCoverage: number | null;
  keywordsCoverage: number | null;
  titleMatch: number | null;
  score: number | null;
  nowCovered: string[];
  stillMissing: string[];
}

interface Insights {
  title: string;
  language: string | null;
  languageDetected: boolean;
  germanRequired: boolean;
  germanLevel: string | null;
  resumeLanguage: string;
  hasResume: boolean;
  skills: { term: string; inResume: boolean; relatedTo?: string | null }[];
  keywords: { term: string; inResume: boolean; relatedTo?: string | null }[];
  removed: { term: string; everywhere: boolean }[];
  skillsCoverage: number | null;
  keywordsCoverage: number | null;
  titleMatch: number | null;
  score: number | null;
  jobResume: JobResume | null;
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
      { term: 'node.js', inResume: true, relatedTo: null },
      { term: 'kafka', inResume: false, relatedTo: null },
    ]);
    // Skill tags aren't repeated as keywords, and words in every ad ("building") rank low.
    const keywords = result.keywords.map((k) => k.term);
    // Tools first (Postgres, Terraform), then the plain word that stands out most.
    expect(keywords.slice(0, 3)).toEqual(['postgres', 'terraform', 'microservices']);
    expect(keywords).not.toContain('kafka');
    expect(result.keywords).toContainEqual({ term: 'terraform', inResume: true, relatedTo: null });
    expect(result.keywords).toContainEqual({ term: 'postgres', inResume: false, relatedTo: null });
  });

  it('detects the language of a hand-added job and says it has no resume yet', async () => {
    const job = await addJob({
      title: 'Frontend Entwickler',
      description: 'Wir suchen einen Frontend Entwickler mit sehr guten Kenntnissen in React.',
    });
    expect(job.language).toBe('de');

    const result = await insights(job.id);
    expect(result).toMatchObject({
      language: 'de',
      languageDetected: false,
      hasResume: false,
      germanRequired: true,
      resumeLanguage: 'de',
    });
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
    // "Backend Engineer" isn't in the resume, and neither word is.
    expect(result.titleMatch).toBe(0);
    expect(result.score).toBe(
      matchScore({ keywords: result.keywordsCoverage, skills: 50, title: 0 }),
    );
    expect(result.prompt).toContain('Job: Backend Engineer at Acme');
    expect(result.prompt).toContain('- kafka');
    expect(result.prompt).not.toContain('- node.js');
  });

  it('drops generic words and cities, ranks tools first and hints at related skills', async () => {
    const job = await addJob({
      title: 'Frontend Engineer',
      skills: ['apollo'],
      description:
        'Business impact for our teams: you build microfrontends with Storybook and drive ' +
        'efficiency across platforms. Workshops in Hamburg twice a year.',
    });
    // Another job's city is still a city.
    await addJob({ title: 'Other', city: 'Hamburg', description: 'We hire in Hamburg.' });
    await t.prisma.profile.create({
      data: { userId: 2, resumeText: 'React and GraphQL.', skills: ['Jest', 'Docker'] },
    });

    const result = await insights(job.id);
    const keywords = result.keywords.map((k) => k.term);
    for (const noise of ['business', 'teams', 'efficiency', 'platforms', 'hamburg']) {
      expect(keywords).not.toContain(noise);
    }
    // Known tools come before plain words.
    expect(keywords.slice(0, 2).sort()).toEqual(['microfrontends', 'storybook']);
    expect(result.skills).toEqual([{ term: 'apollo', inResume: false, relatedTo: 'graphql' }]);
    expect(result.prompt).toContain(
      'Other skills I have (not all of them are in my resume):\n- Jest\n- Docker',
    );
  });

  it('asks for a German resume only when the job needs German, with your real level', async () => {
    const german = await addJob({
      title: 'Frontend Engineer',
      description:
        'We build web apps in React for customers across Europe. You speak fluent German (C1).',
    });
    const english = await addJob({
      title: 'Frontend Engineer',
      description:
        'We build web apps in React for customers across Europe. Office language is English.',
    });
    await t.prisma.profile.create({
      data: { userId: 2, resumeText: 'React.', languages: ['German A2', 'English C1'] },
    });

    const needsGerman = await insights(german.id);
    expect(needsGerman).toMatchObject({
      language: 'en',
      germanRequired: true,
      germanLevel: 'C1',
      resumeLanguage: 'de',
    });
    expect(needsGerman.prompt).toContain(
      'Write the whole resume in German: the job asks for German (C1).',
    );
    expect(needsGerman.prompt).toContain('never higher:\n- German A2\n- English C1');

    const englishOnly = await insights(english.id);
    expect(englishOnly).toMatchObject({ germanRequired: false, resumeLanguage: 'en' });
    expect(englishOnly.prompt).toContain(
      "Write the resume in English: the job doesn't ask for German.",
    );
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

  describe('the resume you wrote for a job', () => {
    const upload = (jobId: string, file: Buffer, name: string, cookie = t.cookieFor('USER')) =>
      request(t.server)
        .post(`/job-resume/${jobId}`)
        .set('Cookie', cookie)
        .attach('file', file, name);
    const download = (jobId: string, cookie = t.cookieFor('USER')) =>
      request(t.server)
        .get(`/job-resume/${jobId}`)
        .set('Cookie', cookie)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            done(null, Buffer.concat(chunks));
          });
        });

    async function backendJob() {
      const job = await addJob({
        title: 'Backend Engineer',
        skills: ['node.js', 'kafka'],
        description: 'Event streaming with Kafka and Node.js in microservices.',
      });
      await t.prisma.profile.create({ data: { userId: 2, resumeText: 'NodeJS microservices.' } });
      return job;
    }

    it('scores pasted text next to the profile resume', async () => {
      const job = await backendJob();
      expect((await insights(job.id)).jobResume).toBeNull();

      const res = await t.asUser<{ saveJobResumeText: Insights }>(SAVE_TEXT, {
        jobId: job.id,
        text: '  Backend Engineer. Node.js, Kafka and microservices.  ',
      });
      expect(res.errors).toBeUndefined();
      const { score, jobResume } = res.data!.saveJobResumeText;
      expect(jobResume).toMatchObject({
        fileName: null,
        skillsCoverage: 100,
        titleMatch: 100,
        nowCovered: expect.arrayContaining(['kafka']) as string[],
        stillMissing: expect.not.arrayContaining(['kafka']) as string[],
      });
      expect(jobResume!.score).toBeGreaterThan(score!);

      // Downloads as a text file, only for its owner.
      const file = await download(job.id).expect(200);
      expect(file.headers['content-type']).toContain('text/plain');
      expect(file.headers['content-disposition']).toContain('resume.txt');
      expect((file.body as Buffer).toString()).toBe(
        'Backend Engineer. Node.js, Kafka and microservices.',
      );
      await download(job.id, t.cookieFor('ADMIN')).expect(404);
      await request(t.server).get(`/job-resume/${job.id}`).expect(401);
    });

    it('reads an uploaded PDF and gives the same file back', async () => {
      const job = await backendJob();
      const pdf = readFileSync(join(__dirname, 'fixtures', 'resume.pdf'));

      const res = await upload(job.id, pdf, 'Ada for Acme.pdf').expect(201);
      expect((res.body as Insights).jobResume).toMatchObject({ fileName: 'Ada for Acme.pdf' });

      const file = await download(job.id).expect(200);
      expect(file.headers['content-type']).toBe('application/pdf');
      expect(file.headers['content-disposition']).toContain(
        "filename*=UTF-8''Ada%20for%20Acme.pdf",
      );
      expect(Buffer.compare(file.body as Buffer, pdf)).toBe(0);
    });

    it('takes Markdown from Claude, replaces the old resume and deletes it', async () => {
      const job = await backendJob();
      await t.asUser(SAVE_TEXT, { jobId: job.id, text: 'Old version' });

      const res = await upload(job.id, Buffer.from('# Ada\n\n- Kafka'), 'resume.md').expect(201);
      expect((res.body as Insights).jobResume).toMatchObject({
        fileName: 'resume.md',
        skillsCoverage: 50,
      });

      const deleted = await t.asUser<{ deleteJobResume: Insights }>(DELETE_RESUME, {
        jobId: job.id,
      });
      expect(deleted.data!.deleteJobResume.jobResume).toBeNull();
      await download(job.id).expect(404);
    });

    it('refuses empty text, other file types and unknown jobs', async () => {
      const job = await backendJob();
      const empty = await t.asUser(SAVE_TEXT, { jobId: job.id, text: ' \n ' });
      expect(empty.errors?.[0]?.message).toBe('The resume is empty');

      const image = await upload(job.id, Buffer.from('png'), 'photo.png').expect(400);
      expect(image.body).toMatchObject({
        message: 'Upload a PDF, Word (.docx), text or Markdown file',
      });

      const missing = await t.asUser(SAVE_TEXT, { jobId: 'nope', text: 'Hi' });
      expect(missing.errors?.[0]?.message).toBe('Job nope not found');
    });
  });
});
