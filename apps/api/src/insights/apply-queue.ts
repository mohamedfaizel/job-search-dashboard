import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('ApplyQueueItem', { description: 'A job you lined up to apply for' })
export class ApplyQueueItemModel {
  @Field(() => ID)
  jobId!: string;

  @Field()
  title!: string;

  @Field()
  company!: string;

  @Field(() => String, { nullable: true, description: 'The posting, where the form is' })
  url!: string | null;

  @Field({
    description:
      "True once Claude's reply (resume, cover letter, form answers) is saved for this job",
  })
  ready!: boolean;

  @Field()
  addedAt!: Date;
}

@ObjectType('ApplyQueuePrompt', {
  description: 'One Claude prompt that writes the replies for several queued jobs at once',
})
export class ApplyQueuePromptModel {
  @Field({ description: 'Empty when every queued job already has a reply' })
  prompt!: string;

  @Field(() => [ID], { description: 'The jobs in this prompt, oldest first' })
  jobIds!: string[];

  @Field(() => Int, { description: 'Queued jobs with no reply yet, in this prompt or not' })
  waiting!: number;
}

/** What the queue page lists for each job. */
export interface QueuePageItem {
  title: string;
  company: string;
  url: string | null;
  kitUrl: string;
  ready: boolean;
}

/**
 * The Apply queue page: plain text for Claude in Chrome, listing each job with its posting and
 * Apply kit. Claude fills in one form at a time and leaves every Submit to you.
 */
export function buildQueuePage(items: QueuePageItem[]): string {
  if (items.length === 0) return 'APPLY QUEUE\n\nThe queue is empty. Nothing to do.\n';
  const list = items
    .map((item, i) =>
      [
        `${String(i + 1)}. ${item.title} at ${item.company}`,
        `   Posting: ${item.url ?? '(no link saved: skip this job and tell me)'}`,
        `   Apply kit: ${item.kitUrl}`,
        item.ready
          ? null
          : '   Note: no cover letter or form answers saved yet. Fill in only my details.',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
  return `APPLY QUEUE: ${String(items.length)} job${items.length === 1 ? '' : 's'}

INSTRUCTIONS FOR CLAUDE IN CHROME
1. Take the jobs below one at a time, in order. For each job, open its posting in a new tab.
2. Open that job's Apply kit link, read it, and follow its instructions to fill in the application form.
3. Never click Submit, Apply, Send or anything that sends an application. Leave the filled-in form open in its tab and go on to the next job.
4. If a job needs a sign-in, an account or a CAPTCHA, or the posting is closed, skip it and note why.
5. When you have been through every job, tell me, for each one: filled in and ready for me to submit, or skipped and why.

JOBS
${list}
`;
}
