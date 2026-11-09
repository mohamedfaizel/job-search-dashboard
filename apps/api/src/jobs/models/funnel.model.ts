import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { JobSource } from './enums';

@ObjectType('FunnelSource', { description: 'How far applications from one job source got' })
export class FunnelSourceModel {
  @Field(() => JobSource)
  source!: JobSource;

  @Field(() => Int)
  applied!: number;

  @Field(() => Int)
  interviews!: number;

  @Field(() => Int)
  offers!: number;
}

@ObjectType('Funnel', {
  description:
    'Your job search funnel: how far your tracked jobs got. An offer also counts as applied and interviewed',
})
export class FunnelModel {
  @Field(() => Int, { description: 'Every job on your tracker' })
  tracked!: number;

  @Field(() => Int)
  applied!: number;

  @Field(() => Int)
  interviews!: number;

  @Field(() => Int)
  offers!: number;

  @Field(() => Int)
  rejected!: number;

  @Field(() => Int, { description: 'Applied, with no interview, offer or rejection yet' })
  waiting!: number;

  @Field(() => Float, {
    nullable: true,
    description: 'Share of applications with any answer, 0 to 1; null before you apply',
  })
  responseRate!: number | null;

  @Field(() => Float, { nullable: true, description: 'Share of applications with an interview' })
  interviewRate!: number | null;

  @Field(() => Float, { nullable: true, description: 'Share of interviews that became an offer' })
  offerRate!: number | null;

  @Field(() => Float, {
    nullable: true,
    description: 'Middle number of days from applying to the first answer',
  })
  medianDaysToReply!: number | null;

  @Field(() => Int)
  appliedLast7Days!: number;

  @Field(() => Int)
  appliedLast30Days!: number;

  @Field(() => [FunnelSourceModel])
  bySource!: FunnelSourceModel[];
}
