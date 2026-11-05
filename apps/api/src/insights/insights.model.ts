import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { JobMatchStatus } from '../jobs/models/enums';

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

@ObjectType('FactFinding', {
  description:
    'Something in the resume or cover letter Claude wrote that is not in your resume or profile',
})
export class FactFindingModel {
  @Field(() => String, { description: 'NUMBER, SKILL or LEVEL (a language level such as B2)' })
  kind!: string;

  @Field({ description: 'The number, skill or level as written' })
  text!: string;

  @Field(() => String, { description: 'RESUME or COVER_LETTER' })
  where!: string;

  @Field({ description: 'The line it is in, shortened' })
  context!: string;
}

@ObjectType('JobResume', {
  description:
    'The resume you wrote for this job, uploaded or pasted, scored the same way as your profile resume',
})
export class JobResumeModel {
  @Field({
    description:
      'The resume as saved: Markdown from the Apply kit reply (or text read out of the file), with your edits',
  })
  text!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Name of the uploaded file. Null when the text was pasted',
  })
  fileName!: string | null;

  @Field({ description: 'The cover letter from the Apply kit reply. Empty when there was none' })
  coverLetter!: string;

  @Field({ description: 'The form answers from the Apply kit reply. Empty when there were none' })
  formAnswers!: string;

  @Field({
    description:
      "Claude's CHECK part of the reply: terms placed or skipped, stretches and questions for you. Empty when there was none",
  })
  claudeCheck!: string;

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

  @Field(() => JobMatchStatus, {
    nullable: true,
    description:
      "Resume-Matcher's check of this resume. Null until asked, and again after the resume is saved anew",
  })
  aiStatus!: JobMatchStatus | null;

  @Field(() => Float, { nullable: true, description: "Resume-Matcher's ATS score (0-100)" })
  aiScore!: number | null;

  @Field(() => String, { nullable: true, description: 'What went wrong. Null unless FAILED' })
  aiError!: string | null;

  @Field(() => [String], {
    description: 'Job keywords Resume-Matcher still misses in this resume. Empty until READY',
  })
  aiMissing!: string[];

  @Field(() => [String], {
    description: "Resume-Matcher's tips for this resume. Empty until READY",
  })
  aiTips!: string[];

  @Field(() => [String], {
    description: 'Skills and keywords this resume has and your profile resume doesn’t',
  })
  nowCovered!: string[];

  @Field(() => [String], { description: 'Skills and keywords still missing from this resume' })
  stillMissing!: string[];

  @Field(() => [FactFindingModel], {
    nullable: true,
    description:
      'Numbers, skills and language levels that are not in your resume or profile. Null when there is no resume of yours to compare with',
  })
  factCheck!: FactFindingModel[] | null;
}

@ObjectType('InterviewPrep', {
  description: 'What Claude wrote to prepare you for an interview for this job, pasted back',
})
export class InterviewPrepModel {
  @Field()
  text!: string;

  @Field()
  updatedAt!: Date;
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
      'True when germanLevel is read from words like "fließend" (fluent) instead of a named level',
  })
  germanLevelEstimated!: boolean;

  @Field({
    description:
      'The language the prompt asks Claude to write the resume in: "de" when German is required, else "en"',
  })
  resumeLanguage!: string;

  @Field({
    description:
      "The language of the master resume this job was checked against: your resume in the ad's language when you have one, else your main one",
  })
  checkedAgainst!: string;

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

  @Field(() => String, {
    nullable: true,
    description:
      'The review prompt for Claude: checks the saved draft as a hiring manager would, against your own resume and the rules, and returns the fixed resume, cover letter and form answers. Null until a reply is saved',
  })
  reviewPrompt!: string | null;

  @Field({
    description:
      'The interview prep prompt for Claude: likely questions with answers from your resume, your gaps, and questions to ask',
  })
  interviewPrompt!: string;

  @Field(() => InterviewPrepModel, {
    nullable: true,
    description: 'Claude’s interview prep for this job, if you pasted it back',
  })
  interviewPrep!: InterviewPrepModel | null;
}

@ObjectType('PdfCheckItem', {
  description: 'One check of the finished resume PDF, read the way an ATS reads it',
})
export class PdfCheckItemModel {
  @Field(() => String, {
    description: 'PAGES, TEXT, NAME, EMAIL, DATES, CHARACTERS, PLACEHOLDERS or SKILLS',
  })
  code!: string;

  @Field()
  ok!: boolean;

  @Field({
    description:
      'What was found: "pages/limit" for PAGES, the word count for TEXT, the name for NAME, the e-mail(s) for EMAIL, else what is wrong (comma separated)',
  })
  detail!: string;
}

@ObjectType('PdfCheck', {
  description: 'The finished resume PDF in your template, checked from its text layer',
})
export class PdfCheckModel {
  @Field()
  jobId!: string;

  @Field({ description: 'The template the PDF was made with' })
  template!: string;

  @Field(() => [PdfCheckItemModel])
  items!: PdfCheckItemModel[];
}
