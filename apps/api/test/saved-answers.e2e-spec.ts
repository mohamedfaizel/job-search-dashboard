import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const LIST = `query { savedAnswers { id question answer } }`;
const SAVE = `mutation ($question: String!, $answer: String!) { saveAnswer(question: $question, answer: $answer) { id question answer } }`;
const DELETE = `mutation ($id: Int!) { deleteSavedAnswer(id: $id) }`;
const CREATE_JOB = `mutation ($input: CreateJobInput!) { createJob(input: $input) { id } }`;
const SAVE_TEXT = `mutation ($jobId: ID!, $text: String!) { saveJobResumeText(jobId: $jobId, text: $text) { jobResume { claudeAnswers claudeCheck } } }`;
const SAVE_ANSWERS = `mutation ($jobId: ID!, $answers: String!) { saveClaudeAnswers(jobId: $jobId, answers: $answers) { jobResume { claudeAnswers } } }`;

interface Saved {
  savedAnswers: { id: number; question: string; answer: string }[];
}

describe('saved answers', () => {
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

  it('keeps an answer once per question, for you only, and deletes it', async () => {
    const first = await t.asUser<{ saveAnswer: { id: number } }>(SAVE, {
      question: 'Is 65.000 € gross per year right?',
      answer: '65.000 € gross',
    });
    expect(first.errors).toBeUndefined();
    // The same question again (other case and punctuation) replaces the answer.
    await t.asUser(SAVE, {
      question: 'is 65.000 € gross per year right',
      answer: '70.000 € gross',
    });
    const mine = await t.asUser<Saved>(LIST);
    expect(mine.data!.savedAnswers).toEqual([
      {
        id: first.data!.saveAnswer.id,
        question: 'Is 65.000 € gross per year right?',
        answer: '70.000 € gross',
      },
    ]);
    // Another user has their own bank.
    expect((await t.gql<Saved>(LIST)).data!.savedAnswers).toEqual([]);
    const theirs = await t.gql(DELETE, { id: first.data!.saveAnswer.id });
    expect(theirs.errors?.[0]?.extensions).toMatchObject({ apiCode: 'ANSWER_NOT_FOUND' });

    expect((await t.asUser(DELETE, { id: first.data!.saveAnswer.id })).data).toEqual({
      deleteSavedAnswer: first.data!.saveAnswer.id,
    });
    expect((await t.asUser<Saved>(LIST)).data!.savedAnswers).toEqual([]);
  });

  it('gives the saved answers that fit the job to Claude in the Apply kit prompt', async () => {
    await t.asUser(SAVE, {
      question: 'Is the salary 65,000 EUR gross per year?',
      answer: 'Yes, 65,000 EUR gross',
    });
    await t.asUser(SAVE, { question: 'Did you fly drones?', answer: 'No, never' });
    const job = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, {
      input: {
        title: 'Frontend Engineer',
        companyName: 'Acme',
        description: 'Please tell us your salary expectation.',
      },
    });
    const insights = await t.asUser<{ jobInsights: { prompt: string } }>(
      `query ($jobId: ID!) { jobInsights(jobId: $jobId) { prompt } }`,
      { jobId: job.data!.createJob.id },
    );
    expect(insights.errors).toBeUndefined();
    expect(insights.data!.jobInsights.prompt).toContain(
      'Questions I answered before:\n- Is the salary 65,000 EUR gross per year?\n  Yes, 65,000 EUR gross',
    );
    expect(insights.data!.jobInsights.prompt).not.toContain('drones');
  });

  it('refuses an empty or too long question or answer', async () => {
    const empty = await t.asUser(SAVE, { question: '  ', answer: 'x' });
    const noAnswer = await t.asUser(SAVE, { question: 'Why?', answer: ' ' });
    const long = await t.asUser(SAVE, { question: 'Why?', answer: 'x'.repeat(2001) });
    for (const res of [empty, noAnswer, long]) {
      expect(res.errors?.[0]?.extensions).toMatchObject({ apiCode: 'ANSWER_LENGTH' });
    }
  });

  it('keeps your decisions on Claude’s questions for a job until a new reply arrives', async () => {
    const job = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, {
      input: { title: 'Frontend Engineer', companyName: 'Acme' },
    });
    const jobId = job.data!.createJob.id;
    const none = await t.asUser(SAVE_ANSWERS, { jobId, answers: '{}' });
    expect(none.errors?.[0]?.extensions).toMatchObject({ apiCode: 'JOB_RESUME_MISSING' });

    await t.asUser(SAVE_TEXT, {
      jobId,
      text: '=== RESUME ===\n# Ada\n\n## Skills\n- React\n=== CHECK ===\n- Ask me: Which year did you finish school?',
    });
    const answers = JSON.stringify({ 'Which year did you finish school?': { answer: '2012' } });
    const saved = await t.asUser<{ saveClaudeAnswers: { jobResume: { claudeAnswers: string } } }>(
      SAVE_ANSWERS,
      { jobId, answers },
    );
    expect(saved.data!.saveClaudeAnswers.jobResume.claudeAnswers).toBe(answers);

    for (const bad of ['not json', '[1]', '"text"', `{"a":"${'x'.repeat(20_001)}"}`]) {
      const res = await t.asUser(SAVE_ANSWERS, { jobId, answers: bad });
      expect(res.errors?.[0]?.extensions).toMatchObject({ apiCode: 'ANSWERS_INVALID' });
    }
    const missingJob = await t.asUser(SAVE_ANSWERS, { jobId: '999999', answers: '{}' });
    expect(missingJob.errors?.[0]?.extensions).toMatchObject({ apiCode: 'JOB_NOT_FOUND' });

    // A new reply with its own CHECK part starts the decisions again.
    const again = await t.asUser<{ saveJobResumeText: { jobResume: { claudeAnswers: string } } }>(
      SAVE_TEXT,
      {
        jobId,
        text: '=== RESUME ===\n# Ada\n\n## Skills\n- React\n=== CHECK ===\n- Ask me: Which city?',
      },
    );
    expect(again.data!.saveJobResumeText.jobResume.claudeAnswers).toBe('{}');
  });
});
