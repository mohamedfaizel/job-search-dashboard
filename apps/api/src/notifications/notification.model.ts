import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ApplicationStatus } from '../jobs/models/enums';

@ObjectType('NotificationJob', { description: 'A job a notification points to' })
export class NotificationJobModel {
  @Field()
  id!: string;

  @Field()
  title!: string;

  @Field()
  company!: string;

  @Field(() => Int, { description: 'Your Fit % for it when the notification was made' })
  fit!: number;

  @Field(() => ApplicationStatus, {
    nullable: true,
    description: 'MAIL_AUTO: the status the email moved the job to',
  })
  status?: ApplicationStatus | null;
}

@ObjectType('BriefingCounts', { description: 'What a morning briefing counted' })
export class BriefingCountsModel {
  @Field(() => Int, { description: 'New jobs since the last briefing with your match Fit %' })
  newJobs!: number;

  @Field(() => Int, { description: 'Queued jobs whose Apply kit is written' })
  kits!: number;

  @Field(() => Int, { description: 'Applications to follow up on' })
  followUps!: number;

  @Field(() => Int, { description: 'Interviews later today' })
  interviews!: number;

  @Field(() => Int, { description: 'Employer emails waiting for your OK' })
  replies!: number;
}

@ObjectType('WeeklySearch', { description: 'A saved search in the weekly report' })
export class WeeklySearchModel {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

  @Field(() => Int, { description: 'New jobs its runs brought this week' })
  jobs!: number;

  @Field(() => Int, { description: 'Of those, the ones with your match Fit %' })
  good!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Its run time, so Pause can keep it. Set on the search to pause only',
  })
  runAt?: string | null;
}

@ObjectType('WeeklyReport', { description: 'What a weekly report counted' })
export class WeeklyReportModel {
  @Field(() => Int, { description: 'Jobs you marked Applied this week' })
  applied!: number;

  @Field(() => Int, { description: 'Employer replies: Interviewing, Offer or Rejected' })
  replies!: number;

  @Field(() => Int, { description: 'Of the replies, the interviews' })
  interviews!: number;

  @Field(() => Int, { description: 'New jobs on your list this week' })
  newJobs!: number;

  @Field(() => Int, { description: 'Of those, the ones with your match Fit %' })
  goodJobs!: number;

  @Field(() => WeeklySearchModel, {
    nullable: true,
    description: 'The saved search that found the most good jobs',
  })
  best!: WeeklySearchModel | null;

  @Field(() => WeeklySearchModel, {
    nullable: true,
    description: 'A scheduled search to pause: many new jobs, none good',
  })
  pause!: WeeklySearchModel | null;
}

@ObjectType('Notification', {
  description:
    'Something the app tells you in the bell list. The web app writes the words from `kind` and the numbers, in your language',
})
export class NotificationModel {
  @Field(() => Int)
  id!: number;

  @Field({
    description:
      'NEW_MATCHES: a scheduled search found new jobs that fit you. INTERVIEW_SOON: your interview for jobs[0] is within a day. Key pool: KEY_REQUEST and POOL_LOW (admins), KEY_APPROVED, KEY_DENIED, KEY_EMPTY, KEY_LIMIT, KEY_TAKEN_BACK. MESSAGE_REPLY: an admin (searchName) answered your message. AUTOPILOT: a saved search with Autopilot queued `count` jobs (best in `jobs`), hid `hidden` and left `kept`. KITS_READY: `count` apply kits written with your AI key (first in `jobs`). KITS_FAILED: none written (`reason`). BRIEFING: the morning briefing (`briefing`, best new jobs in `jobs`). MAIL_AUTO: clear employer emails moved `count` jobs (each with its new `status` in `jobs`); Undo with undoMailAuto. WEEKLY_REPORT: the Sunday summary (`weekly`, best good jobs of the week in `jobs`)',
  })
  kind!: string;

  @Field({
    description:
      'The saved search that found them; for MESSAGE_REPLY, who answered. Empty otherwise',
  })
  searchName!: string;

  @Field(() => Int, { description: 'How many jobs it is about' })
  count!: number;

  @Field(() => Int, { description: 'The Fit % a job needed to count' })
  fitMin!: number;

  @Field(() => [NotificationJobModel], { description: 'The best few jobs, best fit first' })
  jobs!: NotificationJobModel[];

  @Field(() => Date, {
    nullable: true,
    description: 'INTERVIEW_SOON: when the interview is. Null for other kinds',
  })
  at!: Date | null;

  @Field(() => Int, {
    nullable: true,
    description: 'KEY_REQUEST: the token request it is about, so admins can answer from the bell',
  })
  refId!: number | null;

  @Field(() => Int, { description: 'AUTOPILOT: how many new jobs it hid' })
  hidden!: number;

  @Field(() => Int, { description: 'AUTOPILOT: how many new jobs it left on Job posts for you' })
  kept!: number;

  @Field({ description: 'AUTOPILOT / MAIL_AUTO: you pressed Undo' })
  undone!: boolean;

  @Field(() => BriefingCountsModel, {
    nullable: true,
    description: 'BRIEFING: what the morning briefing counted. Null for other kinds',
  })
  briefing!: BriefingCountsModel | null;

  @Field(() => WeeklyReportModel, {
    nullable: true,
    description: 'WEEKLY_REPORT: what the weekly report counted. Null for other kinds',
  })
  weekly!: WeeklyReportModel | null;

  @Field(() => Int, { description: 'KITS_READY / KITS_FAILED: kits that could not be written' })
  failed!: number;

  @Field(() => Int, {
    description:
      'KITS_READY: kits whose resume stayed below `target`, because the job needs skills you do not have',
  })
  belowTarget!: number;

  @Field(() => Int, { nullable: true, description: 'KITS_READY: your target score for kits' })
  target!: number | null;

  @Field(() => Int, {
    description: 'KITS_READY: kits that used your master resume as it is (it already fit)',
  })
  usedMaster!: number;

  @Field(() => Int, {
    nullable: true,
    description: 'KITS_READY: what the run cost, in cents (or pence) of `currency`. Null = unknown',
  })
  costCents!: number | null;

  @Field(() => Int, {
    description: "KITS_READY: what Claude's prompt cache saved, in % of the run",
  })
  savedPercent!: number;

  @Field(() => String, { nullable: true, description: 'KITS_READY: EUR, GBP or USD' })
  currency!: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      'KITS_FAILED, or a kits run that stopped early: NO_KEY, KEY_REFUSED, NO_RESUME or NONE_WRITTEN',
  })
  reason!: string | null;

  @Field(() => Date, { nullable: true, description: 'When you read it. Null = unread' })
  readAt!: Date | null;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType('Notifications', { description: 'Your latest notifications and how many are unread' })
export class NotificationsModel {
  @Field(() => [NotificationModel])
  items!: NotificationModel[];

  @Field(() => Int)
  unread!: number;
}
