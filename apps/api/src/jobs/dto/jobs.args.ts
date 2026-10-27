import { ArgsType, Field, GraphQLISODateTime, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ApplicationStatus,
  JobSortField,
  JobSource,
  SortDirection,
  Workplace,
} from '../models/enums';

/** Column filters. Every field is optional; list filters match any of the given values. */
@InputType()
export class JobFilterInput {
  @Field({ nullable: true, description: 'Free text matched against job title and company name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  companies?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seniorities?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  jobFunctions?: string[];

  @Field(() => [String], { nullable: true, description: 'Jobs requiring any of these skills' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cities?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countryCodes?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  providers?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industries?: string[];

  @Field(() => [Workplace], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(Workplace, { each: true })
  workplaces?: Workplace[];

  @Field(() => [JobSource], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(JobSource, { each: true })
  sources?: JobSource[];

  @Field(() => [ApplicationStatus], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(ApplicationStatus, { each: true })
  applicationStatuses?: ApplicationStatus[];

  @Field(() => Int, { nullable: true, description: 'Jobs whose top salary reaches at least this' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minSalaryUsd?: number;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @IsOptional()
  @IsDate()
  postedAfter?: Date;

  @Field({
    nullable: true,
    description: 'True lists only the jobs you hid. Otherwise hidden jobs are left out.',
  })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}

@InputType()
export class JobSortInput {
  @Field(() => JobSortField)
  @IsEnum(JobSortField)
  field!: JobSortField;

  @Field(() => SortDirection, { defaultValue: SortDirection.DESC })
  @IsEnum(SortDirection)
  direction: SortDirection = SortDirection.DESC;
}

@ArgsType()
export class JobsArgs {
  @Field(() => JobFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => JobFilterInput)
  filter?: JobFilterInput;

  @Field(() => JobSortInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => JobSortInput)
  sort?: JobSortInput;

  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  page = 1;

  @Field(() => Int, { defaultValue: 25 })
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}
