import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('TermCheck')
export class TermCheckModel {
  @Field({ description: 'A skill tag or keyword, e.g. "kafka"' })
  term!: string;

  @Field({ description: 'Your resume text mentions it' })
  inResume!: boolean;
}

@ObjectType('RemovedTerm')
export class RemovedTermModel {
  @Field()
  term!: string;

  @Field({ description: 'True when it is removed from every job, not just this one' })
  everywhere!: boolean;
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
    description:
      'Our own match score: skills coverage × 60% + keywords coverage × 40%. Null without a resume',
  })
  score!: number | null;

  @Field({
    description:
      'A prompt to paste into Claude desktop or web that tailors your resume to this job',
  })
  prompt!: string;
}
