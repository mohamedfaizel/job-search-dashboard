import { Field, InputType, Int, ObjectType, OmitType } from '@nestjs/graphql';
import { IsBoolean, IsEnum, IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';
import { ImportSource } from '../sync/import-source';
import { SyncJobsInput } from '../sync/sync.input';
import { ScheduleFrequency } from './schedule';

/** A search to save: a name plus the same fields as an import (without "continue"). */
@InputType()
export class SavedSearchInput extends OmitType(SyncJobsInput, ['resume'] as const, InputType) {
  @Field({ description: 'A name you will recognise, e.g. "Frontend in Berlin"' })
  @IsString()
  @Length(1, 80)
  name!: string;
}

/** One finished import, for the history table. */
@ObjectType()
export class SyncRunModel {
  @Field(() => Int)
  id!: number;

  @Field({ description: 'When the import started (for a continued import: the run it continued)' })
  startedAt!: Date;

  @Field()
  finishedAt!: Date;

  @Field({ description: 'False when pages were left unfetched' })
  complete!: boolean;

  @Field(() => Int)
  fetched!: number;

  @Field(() => Int)
  created!: number;

  @Field(() => Int)
  updated!: number;

  @Field(() => Int, { nullable: true })
  creditsCharged!: number | null;

  @Field(() => Int, { nullable: true })
  jobsAlreadyPaid!: number | null;

  @Field(() => Int, { nullable: true })
  savedSearchId!: number | null;

  @Field(() => String, { nullable: true, description: 'Name of the saved search that ran it' })
  savedSearchName!: string | null;

  @Field({ description: 'True when the scheduler started it' })
  scheduled!: boolean;

  @Field({ description: 'Short description of what was searched, e.g. "frontend · DE · Berlin"' })
  summary!: string;

  @Field(() => ImportSource, { description: 'Where the import looked for jobs' })
  source!: ImportSource;

  @Field(() => [String], {
    description: 'The company career pages it read, e.g. "greenhouse:n26" (COMPANY_BOARDS only)',
  })
  boards!: string[];

  @Field({
    description:
      'True when this import stopped with pages left and is the newest import of its search, so "Continue" can fetch the rest',
  })
  canContinue!: boolean;
}

@ObjectType()
export class SavedSearch {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

  @Field(() => ImportSource, { description: 'Where this search looks for jobs' })
  source!: ImportSource;

  @Field(() => [String], { description: 'Company career pages, for the COMPANY_BOARDS source' })
  boards!: string[];

  @Field(() => [String])
  titles!: string[];

  @Field(() => [String])
  skills!: string[];

  @Field(() => [String])
  countryCodes!: string[];

  @Field(() => [String])
  locations!: string[];

  @Field(() => [String])
  languages!: string[];

  @Field()
  skipFluentGerman!: boolean;

  @Field()
  remoteOnly!: boolean;

  @Field(() => [String])
  excludeTitles!: string[];

  @Field(() => [String])
  employmentTypes!: string[];

  @Field(() => Int, { nullable: true, description: 'Euros a year' })
  minSalaryEur!: number | null;

  @Field(() => Int)
  maxAgeDays!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  maxPages!: number;

  @Field()
  onlyNew!: boolean;

  @Field(() => ScheduleFrequency)
  schedule!: ScheduleFrequency;

  @Field({ description: 'Time of day for scheduled runs, "HH:mm" in the server\'s local time' })
  runAt!: string;

  @Field(() => Date, { nullable: true, description: 'When the scheduler runs it next' })
  nextRunAt!: Date | null;

  @Field(() => String, {
    nullable: true,
    description: 'What happened at the last scheduled time (ran, skipped for credits, failed)',
  })
  scheduleNote!: string | null;

  @Field({ description: 'Autopilot: after each run, queue good fits and hide poor ones' })
  autopilot!: boolean;

  @Field(() => Int, { description: 'Autopilot queues a new job with at least this Fit %' })
  autoQueueFitMin!: number;

  @Field({ description: "Autopilot doesn't queue a job whose ad says no visa sponsorship" })
  autoQueueNeedsVisa!: boolean;

  @Field(() => Int, { description: 'Autopilot hides a new job under this Fit %. 0 = never' })
  autoHideFitBelow!: number;

  @Field(() => Int, { description: 'The most jobs Autopilot queues in one day' })
  autoQueueMaxPerDay!: number;

  @Field({ description: 'Autopilot writes the apply kit of each job it queues, with your AI key' })
  autoKits!: boolean;

  @Field(() => Int, { description: 'Target score for those kits’ resumes (70-95)' })
  kitScoreTarget!: number;

  @Field()
  createdAt!: Date;

  @Field(() => SyncRunModel, {
    nullable: true,
    description: 'The most recent import of this search',
  })
  lastRun!: SyncRunModel | null;
}

@InputType()
export class ScheduleInput {
  @Field(() => ScheduleFrequency)
  @IsEnum(ScheduleFrequency)
  schedule!: ScheduleFrequency;

  @Field(() => String, {
    defaultValue: '07:00',
    description: '"HH:mm", 24-hour, server local time',
  })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'runAt must be a time like 07:30' })
  runAt: string = '07:00';
}

/** A saved search's Autopilot rules. */
@InputType()
export class AutopilotInput {
  @Field()
  @IsBoolean()
  autopilot!: boolean;

  @Field(() => Int, { description: 'Queue a new job with at least this Fit %' })
  @IsInt()
  @Min(1)
  @Max(100)
  autoQueueFitMin!: number;

  @Field({ description: "Don't queue a job whose ad says no visa sponsorship" })
  @IsBoolean()
  autoQueueNeedsVisa!: boolean;

  @Field(() => Int, { description: 'Hide a new job under this Fit %. 0 = never hide for its Fit' })
  @IsInt()
  @Min(0)
  @Max(100)
  autoHideFitBelow!: number;

  @Field(() => Int, { description: 'The most jobs it queues in one day, all searches together' })
  @IsInt()
  @Min(1)
  @Max(50)
  autoQueueMaxPerDay!: number;

  @Field({
    defaultValue: false,
    description: 'Write the apply kit of each job it queues, right after the run, with your AI key',
  })
  @IsBoolean()
  autoKits: boolean = false;

  @Field(() => Int, { defaultValue: 90, description: 'Target score for those kits (70-95)' })
  @IsInt()
  @Min(70, { message: 'Pick a target of 70 to 95%' })
  @Max(95, { message: 'Pick a target of 70 to 95%' })
  kitScoreTarget: number = 90;
}

@ObjectType()
export class ImportBudget {
  @Field(() => Int, { description: 'Credits used by every import since midnight (server time)' })
  used!: number;

  @Field(() => Int, {
    description: 'Admin › Limits, per user: scheduled runs stop before going over it',
  })
  cap!: number;
}
