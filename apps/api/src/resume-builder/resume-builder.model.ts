import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { FactFindingModel } from '../insights/insights.model';

@ObjectType('ResumeBuild', {
  description: 'Your master resume in one language, as the Resume builder edits it',
})
export class ResumeBuildModel {
  @Field({ description: 'ISO 639-1 code, e.g. "en"' })
  language!: string;

  @Field({
    description:
      'The resume as JSON text: { name, headline, contact[], sections[{ id, title, hidden, blocks[] }] }',
  })
  doc!: string;

  @Field({
    description:
      'The resume text on My profile changed since the builder last read it (a new upload)',
  })
  outOfDate!: boolean;

  @Field(() => [String], {
    description: 'Languages you have a master resume in; the first is your main one',
  })
  languages!: string[];

  @Field(() => [String], {
    description: 'Your languages from My profile: the Languages section always shows these',
  })
  profileLanguages!: string[];

  @Field(() => Int, { description: 'Your page limit from My profile' })
  maxPages!: number;

  @Field(() => Date, { nullable: true, description: 'Null until you first save a change' })
  savedAt!: Date | null;
}

@ObjectType('JobResumeCopy', {
  description: 'A job you have a resume copy for, for the Resume page switcher',
})
export class JobResumeCopyModel {
  @Field()
  jobId!: string;

  @Field({ description: 'The job title as posted' })
  title!: string;

  @Field()
  company!: string;

  @Field(() => Date)
  savedAt!: Date;
}

@ObjectType('JobResumeBuild', {
  description: 'The copy of your resume for one job, as the Resume builder edits it',
})
export class JobResumeBuildModel {
  @Field()
  jobId!: string;

  @Field({ description: 'The job title as posted' })
  title!: string;

  @Field()
  company!: string;

  @Field({ description: 'The language of the master resume this copy starts from' })
  language!: string;

  @Field({
    description: 'You have a copy for this job. When false, doc is the master resume to start from',
  })
  hasCopy!: boolean;

  @Field({ description: 'This job’s resume as JSON text (the master’s when there is no copy yet)' })
  doc!: string;

  @Field({ description: 'Your master resume as JSON text, to see what this copy changed' })
  masterDoc!: string;

  @Field(() => [String], {
    description: 'Your languages from My profile: the Languages section always shows these',
  })
  profileLanguages!: string[];

  @Field(() => Int, { description: 'Your page limit from My profile' })
  maxPages!: number;

  @Field(() => Date, { nullable: true, description: 'Null until you first save this copy' })
  savedAt!: Date | null;
}

@InputType('ImproveSectionInput')
export class ImproveSectionInput {
  @Field({ description: 'The section to improve (its id in the resume)' })
  sectionId!: string;

  @Field(() => String, {
    nullable: true,
    description: 'The job whose copy is improved; null improves your master resume',
  })
  jobId?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Master resume language; ignored with a job',
  })
  language?: string | null;

  @Field(() => String, { nullable: true, description: 'What you want from this pass' })
  instruction?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'An AI chat’s reply pasted back. Left out, your own saved AI key answers instead',
  })
  reply?: string | null;
}

@ObjectType('SectionSuggestion', {
  description: 'An improved version of one section, to keep or discard, with its fact check',
})
export class SectionSuggestionModel {
  @Field()
  sectionId!: string;

  @Field({ description: 'The section as it is now, as Markdown' })
  before!: string;

  @Field({ description: 'The improved section as Markdown' })
  after!: string;

  @Field({ description: 'The improved section as JSON text, ready to put into the resume' })
  section!: string;

  @Field(() => [FactFindingModel], {
    description:
      'Numbers, skills and levels in the improved text that are not in anything you told us',
  })
  findings!: FactFindingModel[];
}

@ObjectType('JobCoverLetter', { description: 'The cover letter saved for one job' })
export class JobCoverLetterModel {
  @Field()
  jobId!: string;

  @Field()
  title!: string;

  @Field()
  company!: string;

  @Field({ description: 'ISO 639-1 code of the language the letter is written in' })
  language!: string;

  @Field({ description: 'Paragraphs separated by a blank line; empty until you write one' })
  text!: string;

  @Field({
    description: 'False until you start a resume copy for this job: a letter belongs to it',
  })
  hasCopy!: boolean;

  @Field(() => Date, { nullable: true })
  savedAt!: Date | null;
}

@InputType('ImproveLetterInput')
export class ImproveLetterInput {
  @Field()
  jobId!: string;

  @Field(() => String, { nullable: true, description: 'What you want from this pass' })
  instruction?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'An AI chat’s reply pasted back. Left out, your own saved AI key answers instead',
  })
  reply?: string | null;
}

@ObjectType('LetterSuggestion', {
  description: 'A written or improved cover letter to keep or discard, with its fact check',
})
export class LetterSuggestionModel {
  @Field({ description: 'The letter as it is now' })
  before!: string;

  @Field({ description: 'The new letter, paragraphs separated by a blank line' })
  after!: string;

  @Field(() => [FactFindingModel], {
    description: 'Numbers, skills and levels in the new letter that are in nothing you told us',
  })
  findings!: FactFindingModel[];
}
