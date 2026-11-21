import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, listAllJobsFor, resetDatabase, seedTestUsers } from './helpers';

const FIELDS = 'id title situation task action result reflection tags';
const LIST = `query { stories { ${FIELDS} } }`;
const SAVE = `mutation ($input: StoryInput!) { saveStory(input: $input) { ${FIELDS} } }`;
const DELETE = `mutation ($id: Int!) { deleteStory(id: $id) }`;
const CREATE_JOB = `mutation ($input: CreateJobInput!) { createJob(input: $input) { id } }`;

interface Story {
  id: number;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
  tags: string[];
}

const PIPELINE = {
  title: 'Faster nightly load',
  situation: 'The nightly load took 4 hours.',
  task: 'Make it fit the night window.',
  action: 'Moved it to Airflow and dbt.',
  result: 'It runs in 40 minutes.',
  tags: ['Airflow', 'dbt'],
};

describe('story bank', () => {
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

  it('adds, changes and deletes your stories, for you only', async () => {
    const added = await t.asUser<{ saveStory: Story }>(SAVE, { input: PIPELINE });
    expect(added.errors).toBeUndefined();
    const story = added.data!.saveStory;
    expect(story).toMatchObject({ ...PIPELINE, reflection: '' });

    const changed = await t.asUser<{ saveStory: Story }>(SAVE, {
      input: { ...PIPELINE, id: story.id, reflection: 'Measure first.' },
    });
    expect(changed.data!.saveStory).toMatchObject({ id: story.id, reflection: 'Measure first.' });
    expect((await t.asUser<{ stories: Story[] }>(LIST)).data!.stories).toHaveLength(1);

    // Another user sees none of them and can't change or delete them.
    expect((await t.gql<{ stories: Story[] }>(LIST)).data!.stories).toEqual([]);
    const theirs = await t.gql(SAVE, { input: { ...PIPELINE, id: story.id } });
    expect(theirs.errors?.[0]?.extensions).toMatchObject({ apiCode: 'STORY_NOT_FOUND' });
    const theirDelete = await t.gql(DELETE, { id: story.id });
    expect(theirDelete.errors?.[0]?.extensions).toMatchObject({ apiCode: 'STORY_NOT_FOUND' });

    expect((await t.asUser(DELETE, { id: story.id })).data).toEqual({ deleteStory: story.id });
    expect((await t.asUser<{ stories: Story[] }>(LIST)).data!.stories).toEqual([]);
  });

  it('refuses a story without a title', async () => {
    const res = await t.asUser(SAVE, { input: { ...PIPELINE, title: ' ' } });
    expect(res.errors?.[0]?.extensions).toMatchObject({ apiCode: 'STORY_INVALID' });
  });

  it('refuses more than 100 stories', async () => {
    const userId = (await t.prisma.user.findFirstOrThrow({ where: { role: 'USER' } })).id;
    await t.prisma.story.createMany({
      data: Array.from({ length: 100 }, (_, i) => ({ userId, title: `Story ${String(i)}` })),
    });
    const res = await t.asUser(SAVE, { input: PIPELINE });
    expect(res.errors?.[0]?.extensions).toMatchObject({ apiCode: 'STORIES_FULL' });
  });

  it('gives the stories that fit the job to the interview prep prompt', async () => {
    await t.asUser(SAVE, { input: PIPELINE });
    await t.asUser(SAVE, { input: { title: 'Led a team of 3', tags: ['leadership'] } });
    const job = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, {
      input: {
        title: 'Data Engineer',
        companyName: 'Acme',
        description: 'You build pipelines with Airflow and dbt.',
      },
    });
    await listAllJobsFor(t.prisma, 2);
    const res = await t.asUser<{ jobInsights: { interviewPrompt: string } }>(
      `query ($jobId: ID!) { jobInsights(jobId: $jobId) { interviewPrompt } }`,
      { jobId: job.data!.createJob.id },
    );
    expect(res.errors).toBeUndefined();
    const prompt = res.data!.jobInsights.interviewPrompt;
    expect(prompt).toContain('My story bank');
    // The story that shows the job's skills comes first.
    expect(prompt.indexOf('- Faster nightly load [Airflow, dbt]')).toBeLessThan(
      prompt.indexOf('- Led a team of 3'),
    );
    expect(prompt).toContain('  Result: It runs in 40 minutes.');
  });
});
