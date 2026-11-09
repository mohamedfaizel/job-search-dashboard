import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum SalaryBasis {
  TITLE = 'TITLE',
  FUNCTION = 'FUNCTION',
  NONE = 'NONE',
}
registerEnumType(SalaryBasis, {
  name: 'SalaryBasis',
  description: 'What the range compares with: similar titles, the same job function, or nothing',
});

@ObjectType('SalaryExample', { description: 'A similar job with a salary, for the range' })
export class SalaryExampleModel {
  @Field(() => ID)
  jobId!: string;

  @Field()
  title!: string;

  @Field()
  company!: string;

  @Field(() => Int, { nullable: true })
  min!: number | null;

  @Field(() => Int, { nullable: true })
  max!: number | null;
}

@ObjectType('SalaryResearch', {
  description:
    'Salary research for one job from the jobs we have (no AI): yearly amounts in the country currency, rounded to 1,000',
})
export class SalaryResearchModel {
  @Field({ description: '"EUR" or "USD"' })
  currency!: string;

  @Field(() => SalaryBasis)
  basis!: SalaryBasis;

  @Field(() => Int)
  sampleSize!: number;

  @Field(() => Int, { description: 'How many of them are estimates, not stated in the ad' })
  estimatedCount!: number;

  @Field(() => Int, { nullable: true, description: '25th percentile' })
  low!: number | null;

  @Field(() => Int, { nullable: true })
  median!: number | null;

  @Field(() => Int, { nullable: true, description: '75th percentile' })
  high!: number | null;

  @Field(() => Int, { nullable: true })
  jobMin!: number | null;

  @Field(() => Int, { nullable: true })
  jobMax!: number | null;

  @Field(() => Int, {
    nullable: true,
    description: 'A number to ask for: the higher of the high end and the ad',
  })
  ask!: number | null;

  @Field(() => [SalaryExampleModel], {
    description: 'Up to five of the similar jobs, newest first',
  })
  examples!: SalaryExampleModel[];

  @Field({ description: 'Your salary expectation from My profile, as you wrote it' })
  expectation!: string;

  @Field({ description: 'Paste into Claude: target, scripts, counter-offer email, extras' })
  prompt!: string;
}
