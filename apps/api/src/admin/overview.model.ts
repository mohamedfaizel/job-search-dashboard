import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

/** What Admin › Overview checks. */
export enum HealthService {
  DATABASE = 'DATABASE',
  PDF_MAKER = 'PDF_MAKER',
  RESUME_MATCHER = 'RESUME_MATCHER',
  GMAIL = 'GMAIL',
  SCHEDULER = 'SCHEDULER',
  STILL_OPEN = 'STILL_OPEN',
}
registerEnumType(HealthService, { name: 'HealthService' });

export enum HealthState {
  /** Running (or set up, for Gmail). */
  OK = 'OK',
  /** Set up in .env but not answering. */
  DOWN = 'DOWN',
  /** Switched off: not set up in .env, or switched off on Admin › Limits. */
  OFF = 'OFF',
}
registerEnumType(HealthState, { name: 'HealthState' });

@ObjectType()
export class HealthCheckModel {
  @Field(() => HealthService)
  service!: HealthService;

  @Field(() => HealthState)
  state!: HealthState;

  @Field({ description: 'OFF because of .env (not the Admin › Limits switch)' })
  offInEnv!: boolean;

  @Field(() => Date, {
    nullable: true,
    description: 'Scheduler: when the next saved search is due',
  })
  nextRunAt!: Date | null;
}

@ObjectType()
export class ImportDayModel {
  @Field({ description: 'Midnight (server time) that starts the day' })
  day!: Date;

  @Field(() => Int)
  imports!: number;
}

/** Admin › Overview: counts only, over every account. */
@ObjectType()
export class AdminOverviewModel {
  @Field(() => Int)
  users!: number;

  @Field(() => Int, { description: 'Accounts made in the last 7 days' })
  newThisWeek!: number;

  @Field(() => Int, { description: 'Accounts that used the app in the last 7 days' })
  activeThisWeek!: number;

  @Field(() => Int, { description: 'Accounts with a JobHunter token saved' })
  withJobKey!: number;

  @Field(() => Int)
  importsToday!: number;

  @Field(() => Int, { description: 'New jobs the imports added today' })
  jobsAddedToday!: number;

  @Field(() => [ImportDayModel], { description: 'Imports per day, oldest first, today last' })
  week!: ImportDayModel[];

  @Field(() => [HealthCheckModel])
  health!: HealthCheckModel[];
}
