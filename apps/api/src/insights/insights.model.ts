import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('TermCheck')
export class TermCheckModel {
  @Field({ description: 'A skill tag or keyword, e.g. "kafka"' })
  term!: string;

  @Field({ description: 'Your resume text mentions it' })
  inResume!: boolean;
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

  @Field(() => [TermCheckModel], { description: 'The job’s skill tags' })
  skills!: TermCheckModel[];

  @Field(() => [TermCheckModel], {
    description: 'The words that set this description apart from your other jobs (TF-IDF)',
  })
  keywords!: TermCheckModel[];
}
