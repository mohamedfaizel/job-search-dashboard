import { Field, InputType, Int, ObjectType, OmitType } from '@nestjs/graphql';
import { IsEnum, IsString, Length, Matches } from 'class-validator';
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
}

@ObjectType()
export class SavedSearch {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

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

@ObjectType()
export class ImportBudget {
  @Field(() => Int, { description: 'Credits used by every import since midnight (server time)' })
  used!: number;

  @Field(() => Int, { description: 'DAILY_CREDIT_CAP: scheduled runs stop before going over it' })
  cap!: number;
}
