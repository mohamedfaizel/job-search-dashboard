import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';
import { ApplicationStatus, JobSource, Workplace } from './enums';

@ObjectType()
export class Company {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  domain!: string | null;

  @Field(() => String, { nullable: true })
  logoUrl!: string | null;
}

@ObjectType()
export class Job {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true, description: 'JobsPipe posting id; null for manual jobs' })
  externalId!: string | null;

  @Field(() => JobSource)
  source!: JobSource;

  @Field()
  title!: string;

  @Field(() => Company)
  company!: Company;

  @Field(() => String, { nullable: true })
  url!: string | null;

  @Field(() => GraphQLISODateTime)
  postedAt!: Date;

  @Field(() => String, { nullable: true })
  seniority!: string | null;

  @Field(() => String, { nullable: true })
  jobFunction!: string | null;

  @Field(() => [String])
  skills!: string[];

  @Field(() => String, { nullable: true })
  city!: string | null;

  @Field(() => String, { nullable: true })
  location!: string | null;

  @Field(() => String, { nullable: true })
  countryCode!: string | null;

  @Field(() => Int, { nullable: true })
  salaryMinUsd!: number | null;

  @Field(() => Int, { nullable: true })
  salaryMaxUsd!: number | null;

  @Field({ description: 'True when the salary is an estimate, not stated in the ad' })
  salaryEstimated!: boolean;

  @Field(() => String, { nullable: true, description: 'Job board, e.g. "indeed"' })
  provider!: string | null;

  @Field(() => Workplace, { nullable: true })
  workplace!: Workplace | null;

  @Field(() => String, { nullable: true })
  industry!: string | null;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field({ description: 'Whether the ad is still open ("active" or "closed")' })
  postingStatus!: string;

  @Field(() => ApplicationStatus, {
    description: 'Where you are with this job. Each user has their own; NONE until you act.',
  })
  applicationStatus!: ApplicationStatus;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType({ description: 'A job on your tracker board' })
export class Application {
  @Field(() => ApplicationStatus)
  status!: ApplicationStatus;

  @Field(() => GraphQLISODateTime, { description: 'When the status last changed' })
  updatedAt!: Date;

  @Field(() => Job)
  job!: Job;
}

@ObjectType()
export class JobPage {
  @Field(() => [Job])
  items!: Job[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;
}

/** Distinct values per column, used to build the dashboard's filter dropdowns. */
@ObjectType()
export class JobFilterOptions {
  @Field(() => [String])
  companies!: string[];

  @Field(() => [String])
  seniorities!: string[];

  @Field(() => [String])
  jobFunctions!: string[];

  @Field(() => [String])
  skills!: string[];

  @Field(() => [String])
  cities!: string[];

  @Field(() => [String])
  countryCodes!: string[];

  @Field(() => [String])
  providers!: string[];

  @Field(() => [String])
  industries!: string[];
}
