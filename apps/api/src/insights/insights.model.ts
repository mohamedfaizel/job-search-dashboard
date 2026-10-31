import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('TermCheck')
export class TermCheckModel {
  @Field({ description: 'A skill tag or keyword, e.g. "kafka"' })
  term!: string;

  @Field({ description: 'Your resume text mentions it' })
  inResume!: boolean;

  @Field({
    description:
      'Not in your resume text, but on the Skills list of My profile ("I have this"). It counts as covered, and the prompt tells Claude it must be in the resume',
  })
  youHave!: boolean;

  @Field(() => String, {
    nullable: true,
    description:
      'For a missing term: the skill in your resume or profile that makes it a fair addition, e.g. "graphql" for "apollo"',
  })
  relatedTo!: string | null;
}

@ObjectType('RemovedTerm')
export class RemovedTermModel {
  @Field()
  term!: string;

  @Field({ description: 'True when it is removed from every job, not just this one' })
  everywhere!: boolean;
}

@ObjectType('JobResume', {
  description:
    'The resume you wrote for this job, uploaded or pasted, scored the same way as your profile resume',
})
export class JobResumeModel {
  @Field(() => String, {
    nullable: true,
    description: 'Name of the uploaded file. Null when the text was pasted',
  })
  fileName!: string | null;

  @Field({ description: 'The cover letter from the Apply kit reply. Empty when there was none' })
  coverLetter!: string;

  @Field({ description: 'The form answers from the Apply kit reply. Empty when there were none' })
  formAnswers!: string;

  @Field()
  updatedAt!: Date;

  @Field(() => Int, { nullable: true, description: 'Percent of the skills in this resume' })
  skillsCoverage!: number | null;

  @Field(() => Int, { nullable: true, description: 'Percent of the keywords in this resume' })
  keywordsCoverage!: number | null;

  @Field(() => Int, { nullable: true })
  titleMatch!: number | null;

  @Field(() => Int, {
    nullable: true,
    description: 'The "after" score: the same weights as the profile resume\'s score',
  })
  score!: number | null;

  @Field(() => [String], {
    description: 'Skills and keywords this resume has and your profile resume doesn’t',
  })
  nowCovered!: string[];

  @Field(() => [String], { description: 'Skills and keywords still missing from this resume' })
  stillMissing!: string[];
}

@ObjectType('JobInsights', {
  description:
    'What the job asks for, worked out without AI: JobsPipe tags, TF-IDF and word matching against your resume text.',
})
export class JobInsightsModel {
  @Field()
  jobId!: string;

  @Field({ description: 'The title as posted' })
  title!: string;

  @Field(() => String, {
    nullable: true,
    description: 'JobsPipe’s cleaned-up title, when it differs from the posted one',
  })
  normalizedTitle!: string | null;

  @Field(() => String, { nullable: true, description: 'ISO 639-1 code, e.g. "de"' })
  language!: string | null;

  @Field({ description: 'True when the language was guessed from the text, not given by JobsPipe' })
  languageDetected!: boolean;

  @Field({
    description: 'The ad is written in German or asks for German skills (not just as a plus)',
  })
  germanRequired!: boolean;

  @Field(() => String, { nullable: true, description: 'The German level the ad names, e.g. "B2"' })
  germanLevel!: string | null;

  @Field({
    description:
      'The language the prompt asks Claude to write the resume in: "de" when German is required, else "en"',
  })
  resumeLanguage!: string;

  @Field({ description: 'False until you upload a resume or type it on your profile' })
  hasResume!: boolean;

  @Field(() => [TermCheckModel], {
    description: 'The job’s skill tags, minus the ones you removed',
  })
  skills!: TermCheckModel[];

  @Field(() => [TermCheckModel], {
    description: 'The words that set this description apart from your other jobs (TF-IDF)',
  })
  keywords!: TermCheckModel[];

  @Field(() => [RemovedTermModel], { description: 'Skills and keywords you removed with ×' })
  removed!: RemovedTermModel[];

  @Field(() => Int, { nullable: true, description: 'Percent of the skills in your resume' })
  skillsCoverage!: number | null;

  @Field(() => Int, { nullable: true, description: 'Percent of the keywords in your resume' })
  keywordsCoverage!: number | null;

  @Field(() => Int, {
    nullable: true,
    description: 'How well your resume names the job title (100 = the whole title appears)',
  })
  titleMatch!: number | null;

  @Field(() => Int, {
    nullable: true,
    description:
      "Our own match score, weighted like Resume-Matcher's: keywords 40%, skills 20%, title 15%, sections 15% and dates 10% (both always full). Null without a resume",
  })
  score!: number | null;

  @Field(() => JobResumeModel, {
    nullable: true,
    description: 'The resume you wrote for this job, if you uploaded or pasted one',
  })
  jobResume!: JobResumeModel | null;

  @Field({
    description:
      'The Apply kit prompt for Claude desktop or web: your resume tailored to this job, a cover letter and form answers',
  })
  prompt!: string;
}
