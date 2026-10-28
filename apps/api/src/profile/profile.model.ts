import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

@ObjectType('Profile')
export class ProfileModel {
  @Field()
  headline!: string;

  @Field(() => [String])
  targetRoles!: string[];

  @Field(() => [String])
  locations!: string[];

  @Field(() => [String])
  skills!: string[];

  @Field(() => [String], { description: 'Languages with your real level, e.g. "German A2"' })
  languages!: string[];

  @Field(() => Int, { nullable: true })
  yearsExperience!: number | null;

  @Field(() => String, { nullable: true })
  linkedinUrl!: string | null;

  @Field(() => String, { nullable: true })
  githubUrl!: string | null;

  @Field(() => String, { nullable: true })
  websiteUrl!: string | null;

  @Field({ description: 'Plain text of your master resume' })
  resumeText!: string;

  @Field(() => String, { nullable: true, description: 'Name of the last uploaded resume file' })
  resumeFileName!: string | null;

  @Field(() => Date, { nullable: true, description: 'Null until the profile is first saved' })
  updatedAt!: Date | null;
}

/** Trims each entry, drops empty ones and duplicates (ignoring case). */
const cleanList = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) return value;
  const seen = new Set<string>();
  return (value as unknown[])
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter((item) => {
      if (typeof item !== 'string' || item === '') return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** An empty box means "no link", not an invalid URL. */
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

const LIST_RULES = { each: true, message: 'Keep each entry under 80 characters' };

@InputType()
export class ProfileInput {
  @Field({ defaultValue: '' })
  @Transform(trim)
  @IsString()
  @MaxLength(160, { message: 'Keep the headline under 160 characters' })
  headline: string = '';

  @Field(() => [String], { defaultValue: [] })
  @Transform(cleanList)
  @IsArray()
  @ArrayMaxSize(20)
  @MaxLength(80, LIST_RULES)
  targetRoles: string[] = [];

  @Field(() => [String], { defaultValue: [] })
  @Transform(cleanList)
  @IsArray()
  @ArrayMaxSize(20)
  @MaxLength(80, LIST_RULES)
  locations: string[] = [];

  @Field(() => [String], { defaultValue: [] })
  @Transform(cleanList)
  @IsArray()
  @ArrayMaxSize(60)
  @MaxLength(80, LIST_RULES)
  skills: string[] = [];

  @Field(() => [String], { defaultValue: [] })
  @Transform(cleanList)
  @IsArray()
  @ArrayMaxSize(10)
  @MaxLength(80, LIST_RULES)
  languages: string[] = [];

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60, { message: 'Years of experience must be between 0 and 60' })
  yearsExperience?: number | null;

  @Field(() => String, { nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'LinkedIn must be a full link (https://…)' })
  linkedinUrl?: string | null;

  @Field(() => String, { nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'GitHub must be a full link (https://…)' })
  githubUrl?: string | null;

  @Field(() => String, { nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'Website must be a full link (https://…)' })
  websiteUrl?: string | null;

  @Field({ defaultValue: '' })
  @IsString()
  @MaxLength(50_000, { message: 'Keep the resume under 50,000 characters' })
  resumeText: string = '';
}
