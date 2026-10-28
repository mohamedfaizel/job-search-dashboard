import {
  Field,
  Float,
  GraphQLISODateTime,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { JobMatchStatus } from '../jobs/models/enums';

@ObjectType('ResumeMatcherStatus')
export class ResumeMatcherStatusModel {
  @Field({ description: 'False when RESUME_MATCHER_URL is not set in .env' })
  configured!: boolean;

  @Field({ description: 'The Resume-Matcher container answered its health check' })
  reachable!: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'An AI provider key is set. Null unless checkAi was true',
  })
  aiConfigured!: boolean | null;

  @Field(() => Boolean, {
    nullable: true,
    description: 'A test message to the AI provider worked. Null unless checkAi was true',
  })
  aiHealthy!: boolean | null;

  @Field(() => String, {
    nullable: true,
    description:
      "The AI provider Resume-Matcher really uses, e.g. anthropic. One saved in its own Settings page beats .env. Null when it isn't reachable",
  })
  aiProvider!: string | null;

  @Field(() => String, { nullable: true, description: 'The AI model Resume-Matcher really uses' })
  aiModel!: string | null;

  @Field({ description: 'One sentence for the user saying what works and what to fix' })
  message!: string;
}

/** Where your master resume stands in Resume-Matcher. */
export enum MatcherResumeState {
  /** No PDF/Word file uploaded yet (typed-in text can't be sent). */
  NO_FILE = 'NO_FILE',
  /** A file is uploaded but was never sent. */
  NOT_SENT = 'NOT_SENT',
  /** You uploaded a newer file since the last send. */
  OUTDATED = 'OUTDATED',
  READY = 'READY',
  FAILED = 'FAILED',
}
registerEnumType(MatcherResumeState, { name: 'MatcherResumeState' });

@ObjectType('MatcherResume')
export class MatcherResumeModel {
  @Field(() => MatcherResumeState)
  state!: MatcherResumeState;

  @Field(() => String, { nullable: true, description: 'The file Resume-Matcher last received' })
  fileName!: string | null;

  @Field(() => Date, { nullable: true })
  syncedAt!: Date | null;

  @Field({ description: 'One sentence for the user saying where things stand' })
  message!: string;
}

@ObjectType('JobMatch', {
  description:
    'How well your master resume fits one job. Resume-Matcher lightly tailors the resume to the job, then scores it the way an ATS would',
})
export class JobMatchModel {
  @Field(() => ID)
  jobId!: string;

  @Field(() => JobMatchStatus)
  status!: JobMatchStatus;

  @Field(() => String, { nullable: true, description: 'What went wrong. Null unless FAILED' })
  error!: string | null;

  @Field(() => Float, {
    nullable: true,
    description: 'ATS score 0-100: a weighted mix of the five scores below',
  })
  score!: number | null;

  @Field(() => Float, {
    nullable: true,
    description: "Share of the job's keywords already in your resume, before tailoring",
  })
  keywordMatchBefore!: number | null;

  @Field(() => Float, { nullable: true, description: 'Keyword match after tailoring (40%)' })
  keywordMatch!: number | null;

  @Field(() => Float, {
    nullable: true,
    description: "The job's skills found in your resume (20%)",
  })
  skillsCoverage!: number | null;

  @Field(() => Float, {
    nullable: true,
    description: 'The job title in your headline or summary (15%). Null when the posting has none',
  })
  titleMatch!: number | null;

  @Field(() => Float, { nullable: true, description: 'Contact info and key sections (15%)' })
  sectionCompleteness!: number | null;

  @Field(() => Float, {
    nullable: true,
    description: 'Dates written in one format (10%). Null with fewer than two dates',
  })
  dateConsistency!: number | null;

  @Field(() => [String], { description: 'Job keywords your resume lacks' })
  missingKeywords!: string[];

  @Field(() => [String], {
    description: 'Job keywords elsewhere in your resume that tailoring could bring forward',
  })
  injectableKeywords!: string[];

  @Field(() => [String])
  recommendations!: string[];

  @Field(() => String, { nullable: true, description: 'The resume file this was scored against' })
  resumeFileName!: string | null;

  @Field(() => GraphQLISODateTime)
  startedAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  finishedAt!: Date | null;

  @Field({ description: 'You sent a newer resume since, so match again for a current score' })
  outdated!: boolean;
}

@ObjectType('TailoredResume', {
  description:
    'Your resume rewritten by Resume-Matcher for one job, with a cover letter. Download both as PDFs from /tailored/{jobId}/resume.pdf and /tailored/{jobId}/cover-letter.pdf',
})
export class TailoredResumeModel {
  @Field(() => ID)
  jobId!: string;

  @Field(() => JobMatchStatus)
  status!: JobMatchStatus;

  @Field(() => String, { nullable: true, description: 'What went wrong. Null unless FAILED' })
  error!: string | null;

  @Field(() => Float, { nullable: true, description: 'ATS score of the tailored version (0-100)' })
  score!: number | null;

  @Field(() => String, {
    nullable: true,
    description: 'The cover letter text. Null if it could not be written',
  })
  coverLetter!: string | null;

  @Field(() => String, { nullable: true, description: 'The resume file it was tailored from' })
  resumeFileName!: string | null;

  @Field(() => GraphQLISODateTime)
  startedAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  finishedAt!: Date | null;

  @Field({ description: 'You sent a newer resume since, so tailor again to use it' })
  outdated!: boolean;
}
