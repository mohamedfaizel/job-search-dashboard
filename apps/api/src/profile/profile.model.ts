import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RESUME_LANGUAGES } from './resumes';

@ObjectType('LanguageResume')
export class LanguageResumeModel {
  @Field({ description: 'ISO 639-1 code, e.g. "de"' })
  language!: string;

  @Field()
  text!: string;

  @Field(() => String, { nullable: true, description: 'The uploaded file, null when pasted' })
  fileName!: string | null;

  @Field()
  updatedAt!: Date;
}

/** Genders a form may ask for, as codes; each language shows its own words. */
export const GENDERS = ['female', 'male', 'diverse', 'not_specified'] as const;

@ObjectType('ProfileField', { description: 'A field of your own, like "Xing" or "Pronouns"' })
export class ProfileFieldModel {
  @Field()
  label!: string;

  @Field()
  value!: string;
}

@ObjectType('Profile')
export class ProfileModel {
  @Field({ description: 'Empty until saved; the form suggests it from your account name' })
  firstName!: string;

  @Field()
  lastName!: string;

  @Field({ description: 'female, male, diverse or not_specified; empty = not given' })
  gender!: string;

  @Field({ description: 'ISO date "YYYY-MM-DD"; empty = not given' })
  dateOfBirth!: string;

  @Field()
  nationality!: string;

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

  @Field({ description: 'The language your master resume is in, e.g. "en"' })
  resumeLanguage!: string;

  @Field(() => [LanguageResumeModel], {
    description: 'Your master resume in other languages, used for jobs in those languages',
  })
  otherResumes!: LanguageResumeModel[];

  @Field({ description: 'Application answers: your phone number, as forms should get it' })
  phone!: string;

  @Field({ description: 'City and country, or the full address forms ask for' })
  address!: string;

  @Field({ description: 'Work permit or visa status, e.g. "EU Blue Card holder"' })
  workPermit!: string;

  @Field({ description: 'Notice period or earliest start, e.g. "1 month"' })
  noticePeriod!: string;

  @Field({ description: 'Salary expectation, e.g. "€65,000 a year"' })
  salaryExpectation!: string;

  @Field({ description: 'Willing to relocate, and where' })
  relocation!: string;

  @Field({ description: 'e.g. "Full-time"' })
  employmentType!: string;

  @Field({ description: 'e.g. "Remote or hybrid"' })
  workplacePreference!: string;

  @Field({ description: 'e.g. "Class B"' })
  drivingLicence!: string;

  @Field({ description: 'Short answers you reuse on applications, as free text' })
  applicationNotes!: string;

  @Field(() => [ProfileFieldModel], { description: 'Your own fields, in your order' })
  customFields!: ProfileFieldModel[];

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
export class ProfileFieldInput {
  @Field()
  @Transform(trim)
  @IsString()
  @MaxLength(60, { message: 'Keep each field name under 60 characters' })
  label!: string;

  @Field()
  @Transform(trim)
  @IsString()
  @MaxLength(500, { message: 'Keep each field value under 500 characters' })
  value!: string;
}

@InputType()
export class ProfileInput {
  @Field({ defaultValue: '' })
  @Transform(trim)
  @IsString()
  @MaxLength(80, { message: 'Keep the first name under 80 characters' })
  firstName: string = '';

  @Field({ defaultValue: '' })
  @Transform(trim)
  @IsString()
  @MaxLength(80, { message: 'Keep the last name under 80 characters' })
  lastName: string = '';

  @Field({ defaultValue: '' })
  @IsIn(['', ...GENDERS], { message: 'Pick a gender from the list' })
  gender: string = '';

  @Field({ defaultValue: '' })
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/, { message: 'Date of birth must be a date like 1990-05-31' })
  dateOfBirth: string = '';

  @Field({ defaultValue: '' })
  @Transform(trim)
  @IsString()
  @MaxLength(80, { message: 'Keep nationality under 80 characters' })
  nationality: string = '';

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

  @Field(() => String, {
    nullable: true,
    description: 'The language your master resume is in. Left out = unchanged',
  })
  @IsOptional()
  @IsIn(Object.keys(RESUME_LANGUAGES), { message: 'Pick a language from the list' })
  resumeLanguage?: string | null;

  @Field({ defaultValue: '' })
  @Transform(trim)
  @IsString()
  @MaxLength(40, { message: 'Keep phone under 40 characters' })
  phone: string = '';

  @Field({ defaultValue: '' })
  @Transform(trim)
  @IsString()
  @MaxLength(200, { message: 'Keep address under 200 characters' })
  address: string = '';

  @Field({ defaultValue: '' })
  @Transform(trim)
  @IsString()
  @MaxLength(200, { message: 'Keep work permit under 200 characters' })
  workPermit: string = '';

  @Field({ defaultValue: '' })
  @Transform(trim)
  @IsString()
  @MaxLength(100, { message: 'Keep notice period under 100 characters' })
  noticePeriod: string = '';

  @Field({ defaultValue: '' })
  @Transform(trim)
  @IsString()
  @MaxLength(100, { message: 'Keep salary expectation under 100 characters' })
  salaryExpectation: string = '';

  @Field({ defaultValue: '' })
  @Transform(trim)
  @IsString()
  @MaxLength(200, { message: 'Keep relocation under 200 characters' })
  relocation: string = '';

  @Field({ defaultValue: '' })
  @Transform(trim)
  @IsString()
  @MaxLength(5_000, { message: 'Keep your saved answers under 5,000 characters' })
  applicationNotes: string = '';

  @Field({ defaultValue: '' })
  @Transform(trim)
  @IsString()
  @MaxLength(100, { message: 'Keep employment type under 100 characters' })
  employmentType: string = '';

  @Field({ defaultValue: '' })
  @Transform(trim)
  @IsString()
  @MaxLength(100, { message: 'Keep workplace preference under 100 characters' })
  workplacePreference: string = '';

  @Field({ defaultValue: '' })
  @Transform(trim)
  @IsString()
  @MaxLength(100, { message: 'Keep driving licence under 100 characters' })
  drivingLicence: string = '';

  @Field(() => [ProfileFieldInput], { defaultValue: [] })
  @IsArray()
  @ArrayMaxSize(30, { message: 'Add at most 30 fields of your own' })
  @ValidateNested({ each: true })
  @Type(() => ProfileFieldInput)
  customFields: ProfileFieldInput[] = [];
}
