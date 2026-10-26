import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

/** What to fetch from JobsPipe. Also the shape a scheduled search will reuse later. */
@InputType()
export class SyncJobsInput {
  @Field(() => [String], { description: 'Match any of these job titles, e.g. ["frontend"]' })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  titles!: string[];

  @Field(() => [String], {
    nullable: true,
    description: 'Match any of these skills, e.g. ["react"]',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  skills?: string[];

  @Field(() => [String], { nullable: true, description: 'ISO country codes, e.g. ["DE"]' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(2, 2, { each: true })
  countryCodes?: string[];

  @Field(() => [String], {
    nullable: true,
    description: 'Cities or regions, e.g. ["Berlin", "Bavaria"]. Combine with countryCodes.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  locations?: string[];

  @Field(() => Int, { defaultValue: 7, description: 'Only postings from the last N days' })
  @IsInt()
  @Min(1)
  @Max(90)
  maxAgeDays = 7;

  @Field(() => Int, {
    defaultValue: 25,
    description:
      'Jobs per page (each job costs a credit). JobsPipe caps it by plan: Free 25, Builder/Growth 100, Scale/Business 500.',
  })
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize = 25;

  @Field(() => Int, {
    defaultValue: 1,
    description: 'Stop after this many pages to protect credits',
  })
  @IsInt()
  @Min(1)
  @Max(50)
  maxPages = 1;

  @Field(() => Boolean, {
    defaultValue: true,
    description: 'Only ask for postings JobsPipe found since the last complete run of this search',
  })
  @IsBoolean()
  onlyNew = true;

  @Field(() => Boolean, {
    defaultValue: false,
    description: 'Continue the last import of this search from the page where it stopped',
  })
  @IsBoolean()
  resume = false;
}

@ObjectType()
export class SyncJobsResult {
  @Field(() => Int)
  pages!: number;

  @Field(() => Int)
  fetched!: number;

  @Field(() => Int)
  created!: number;

  @Field(() => Int)
  updated!: number;

  @Field(() => Int, { nullable: true, description: 'Total matches JobsPipe reported' })
  totalAvailable!: number | null;

  @Field({ description: 'True when more pages were left unfetched' })
  hasMore!: boolean;

  @Field(() => Int, { nullable: true })
  creditsRemaining!: number | null;

  @Field(() => Int, { description: 'Credits this run used' })
  creditsCharged!: number;

  @Field(() => Int, {
    description: 'Jobs that were free because they were already paid this month',
  })
  jobsAlreadyPaid!: number;

  @Field(() => Date, {
    nullable: true,
    description:
      'With onlyNew: postings found since this time were asked for. Null on a first run.',
  })
  newSince!: Date | null;

  @Field({ description: 'True when this run continued an earlier import from its saved cursor' })
  resumed!: boolean;
}
