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
  coverLetter
  formAnswers
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
  coverLetter: string;
  formAnswers: string;
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

    it('splits an Apply kit reply and builds the Apply kit page from it', async () => {
      const job = await backendJob();
      await t.prisma.profile.update({
        where: { userId: 2 },
        data: {
          phone: '+49 151 0000000',
          languages: ['German A2', 'English C1'],
          workPermit: 'EU Blue Card',
          noticePeriod: '1 month',
        },
      });
      const reply = `=== RESUME ===
Backend Engineer. Node.js, Kafka and microservices.
=== COVER LETTER ===
Dear Acme team, I build event streaming systems.
=== FORM ANSWERS ===
Why Acme: I like your product.
=== CHECK ===
- Related: none`;

      const res = await t.asUser<{ saveJobResumeText: Insights }>(SAVE_TEXT, {
        jobId: job.id,
        text: reply,
      });
      expect(res.errors).toBeUndefined();
      expect(res.data!.saveJobResumeText.jobResume).toMatchObject({
        coverLetter: 'Dear Acme team, I build event streaming systems.',
        formAnswers: 'Why Acme: I like your product.',
        skillsCoverage: 100,
      });
      // Only the resume part is kept as the resume.
      expect(((await download(job.id).expect(200)).body as Buffer).toString()).toBe(
        'Backend Engineer. Node.js, Kafka and microservices.',
      );

      // Both come as PDFs named after you and the company, ready to attach.
      for (const [path, name] of [
        ['resume.pdf', 'Resume-Acme.pdf'],
        ['cover-letter.pdf', 'Cover-letter-Acme.pdf'],
      ] as const) {
        const pdf = await request(t.server)
          .get(`/job-resume/${job.id}/${path}`)
          .set('Cookie', t.cookieFor('USER'))
          .buffer(true)
          .parse((r, done) => {
            const chunks: Buffer[] = [];
            r.on('data', (c: Buffer) => chunks.push(c));
            r.on('end', () => {
              done(null, Buffer.concat(chunks));
            });
          })
          .expect(200);
        expect(pdf.headers['content-type']).toBe('application/pdf');
        expect(pdf.headers['content-disposition']).toContain(name);
        expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
      }
      await request(t.server)
        .get(`/job-resume/${job.id}/resume.pdf`)
        .set('Cookie', t.cookieFor('ADMIN'))
        .expect(404);

      const kit = await request(t.server)
        .get(`/apply-kit/${job.id}`)
        .set('Cookie', t.cookieFor('USER'))
        .expect(200);
      expect(kit.headers['content-type']).toContain('text/plain');
      expect(kit.headers['cache-control']).toBe('no-store');
      expect(kit.text).toContain('APPLY KIT: Backend Engineer at Acme');
      expect(kit.text).toContain('Never click Submit');
      expect(kit.text).toContain('Phone: +49 151 0000000');
      expect(kit.text).toContain('copy exactly): German A2, English C1');
      expect(kit.text).toContain('Work permit: EU Blue Card');
      expect(kit.text).toContain('Salary expectation: (not given: leave this field empty');
      expect(kit.text).toContain('Why Acme: I like your product.');
      expect(kit.text).toContain('Dear Acme team');
      expect(kit.text).toContain(`/job-resume/${job.id}`);
      expect(kit.text).not.toContain('Related: none');

      await request(t.server).get(`/apply-kit/${job.id}`).expect(401);
      await request(t.server).get('/apply-kit/nope').set('Cookie', t.cookieFor('USER')).expect(404);
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

  describe('Apply queue', () => {
    const QUEUE_FIELDS = 'jobId title company url ready';
    const QUEUE = `query { myApplyQueue { ${QUEUE_FIELDS} } }`;
    const ADD = `mutation ($ids: [ID!]!) { addToApplyQueue(jobIds: $ids) { ${QUEUE_FIELDS} } }`;
    const REMOVE = `mutation ($ids: [ID!]!) { removeFromApplyQueue(jobIds: $ids) { ${QUEUE_FIELDS} } }`;
    const STATUS = `mutation ($id: ID!, $status: ApplicationStatus!) { updateJobStatus(id: $id, status: $status) { id } }`;
    interface Item {
      jobId: string;
      title: string;
      company: string;
      url: string | null;
      ready: boolean;
    }

    it('lines up jobs, marks the ones with a Claude reply ready, and lists them for Claude in Chrome', async () => {
      const first = await addJob({ title: 'Backend Engineer', url: 'https://example.com/1' });
      const second = await addJob({ title: 'Frontend Engineer', url: 'https://example.com/2' });
      await t.prisma.profile.create({ data: { userId: 2, resumeText: 'NodeJS' } });
      await t.asUser(SAVE_TEXT, {
        jobId: second.id,
        text: '=== RESUME ===\nReact\n=== COVER LETTER ===\nDear team',
      });

      const added = await t.asUser<{ addToApplyQueue: Item[] }>(ADD, {
        ids: [first.id, second.id, 'nope'],
      });
      expect(added.errors).toBeUndefined();
      // Adding again keeps the order; unknown jobs are ignored.
      await t.asUser(ADD, { ids: [first.id] });
      const queue = (await t.asUser<{ myApplyQueue: Item[] }>(QUEUE)).data!.myApplyQueue;
      expect(queue.map((i) => [i.title, i.ready])).toEqual([
        ['Backend Engineer', false],
        ['Frontend Engineer', true],
      ]);
      // Only yours: the admin's queue is empty.
      expect((await t.gql<{ myApplyQueue: Item[] }>(QUEUE)).data!.myApplyQueue).toEqual([]);

      const page = await request(t.server)
        .get('/apply-queue')
        .set('Cookie', t.cookieFor('USER'))
        .expect(200);
      expect(page.headers['cache-control']).toBe('no-store');
      expect(page.text).toContain('APPLY QUEUE: 2 jobs');
      expect(page.text).toContain('Never click Submit');
      expect(page.text).toContain('1. Backend Engineer at Acme\n   Posting: https://example.com/1');
      expect(page.text).toContain(`/apply-kit/${second.id}`);
      expect(page.text).toContain('no cover letter or form answers saved yet');
      await request(t.server).get('/apply-queue').expect(401);
    });

    it('drops a job when you remove it or mark it Applied', async () => {
      const first = await addJob({ title: 'Backend Engineer' });
      const second = await addJob({ title: 'Frontend Engineer' });
      await t.asUser(ADD, { ids: [first.id, second.id] });

      // Saving it keeps it in the queue; applying takes it out.
      await t.asUser(STATUS, { id: first.id, status: 'SAVED' });
      await t.asUser(STATUS, { id: second.id, status: 'APPLIED' });
      let queue = (await t.asUser<{ myApplyQueue: Item[] }>(QUEUE)).data!.myApplyQueue;
      expect(queue.map((i) => i.title)).toEqual(['Backend Engineer']);

      const removed = await t.asUser<{ removeFromApplyQueue: Item[] }>(REMOVE, { ids: [first.id] });
      queue = removed.data!.removeFromApplyQueue;
      expect(queue).toEqual([]);
    });

    it('writes the replies for the waiting jobs with one prompt, and saves each part to its job', async () => {
      const PROMPT = 'query { applyQueuePrompt { prompt jobIds waiting } }';
      const SAVE = `mutation ($text: String!) { saveApplyQueueReply(text: $text) { ${QUEUE_FIELDS} } }`;
      const first = await addJob({ title: 'Backend Engineer', description: 'Kafka and Node.js.' });
      const second = await addJob({ title: 'Frontend Engineer', description: 'React.' });
      await t.prisma.profile.create({
        data: { userId: 2, resumeText: 'NodeJS microservices.', languages: ['German A2'] },
      });
      await t.asUser(ADD, { ids: [first.id, second.id] });

      const res = await t.asUser<{
        applyQueuePrompt: { prompt: string; jobIds: string[]; waiting: number };
      }>(PROMPT);
      expect(res.errors).toBeUndefined();
      const { prompt, jobIds, waiting } = res.data!.applyQueuePrompt;
      expect(jobIds).toEqual([first.id, second.id]);
      expect(waiting).toBe(2);
      expect(prompt).toContain('for each of the 2 jobs below');
      expect(prompt).toContain(`--- JOB 2 of 2: Frontend Engineer at Acme (id ${second.id}) ---`);
      expect(prompt).toContain('- German A2');
      // Your resume goes in once, not once per job.
      expect(prompt.split('NodeJS microservices.')).toHaveLength(2);

      const reply = `Here you go.
=== JOB 1: ${first.id} ===
=== RESUME ===
Backend Engineer. Node.js and Kafka.
=== COVER LETTER ===
Dear Acme team.
=== FORM ANSWERS ===
Why Acme: streaming.
=== CHECK ===
- Related: none
**=== JOB 2: garbled ===**
=== RESUME ===
Frontend Engineer. React.
=== COVER LETTER ===
Hello Acme.`;
      const saved = await t.asUser<{ saveApplyQueueReply: Item[] }>(SAVE, { text: reply });
      expect(saved.errors).toBeUndefined();
      expect(saved.data!.saveApplyQueueReply.map((i) => i.ready)).toEqual([true, true]);
      const stored = await t.prisma.jobResume.findMany({ orderBy: { text: 'asc' } });
      expect(stored.map((r) => [r.jobId, r.text, r.coverLetter])).toEqual([
        [first.id, 'Backend Engineer. Node.js and Kafka.', 'Dear Acme team.'],
        [second.id, 'Frontend Engineer. React.', 'Hello Acme.'],
      ]);

      // Nothing left to write.
      const after = await t.asUser<{
        applyQueuePrompt: { prompt: string; jobIds: string[]; waiting: number };
      }>(PROMPT);
      expect(after.data!.applyQueuePrompt).toEqual({ prompt: '', jobIds: [], waiting: 0 });

      const wrong = await t.asUser(SAVE, { text: 'just a resume' });
      expect(wrong.errors?.[0]?.message).toMatch(/No "=== JOB 1/);
    });
  });
});
