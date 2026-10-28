import { Field, GraphQLISODateTime, InputType, Int } from '@nestjs/graphql';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { ApplicationStatus, Workplace } from '../models/enums';

/** A job added by hand from the job form. */
@InputType()
export class CreateJobInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  companyName!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string;

  @Field(() => GraphQLISODateTime, { nullable: true, description: 'Defaults to now' })
  @IsOptional()
  @IsDate()
  postedAt?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  seniority?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobFunction?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  skills?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @Field({ nullable: true, description: 'Two-letter ISO code, e.g. "US"' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @Field({ nullable: true, description: 'Two-letter ISO 639-1 code, e.g. "en"' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  language?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMinUsd?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMaxUsd?: number;

  @Field(() => Workplace, { nullable: true })
  @IsOptional()
  @IsEnum(Workplace)
  workplace?: Workplace;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  industry?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  description?: string;

  @Field(() => ApplicationStatus, { nullable: true })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  applicationStatus?: ApplicationStatus;
}
