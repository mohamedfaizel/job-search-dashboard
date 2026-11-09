import { Field, GraphQLISODateTime, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum JobTrustLevel {
  OK = 'OK',
  CAUTION = 'CAUTION',
  WARNING = 'WARNING',
}
registerEnumType(JobTrustLevel, {
  name: 'JobTrustLevel',
  description: 'OK: no signs found. CAUTION: worth a look. WARNING: looks like a scam',
});

export enum JobTrustFlag {
  ASKS_PAYMENT = 'ASKS_PAYMENT',
  ASKS_PERSONAL_DATA = 'ASKS_PERSONAL_DATA',
  CHAT_APP_ONLY = 'CHAT_APP_ONLY',
  REPOSTED = 'REPOSTED',
  OLD_AD = 'OLD_AD',
  PRIVATE_EMAIL = 'PRIVATE_EMAIL',
  TOO_GOOD = 'TOO_GOOD',
  SHORT_AD = 'SHORT_AD',
}
registerEnumType(JobTrustFlag, { name: 'JobTrustFlag' });

@ObjectType('JobTrust', {
  description: 'Is this job real? Plain checks for ghost and scam ads, no AI',
})
export class JobTrustModel {
  @Field(() => JobTrustLevel)
  level!: JobTrustLevel;

  @Field(() => [JobTrustFlag], { description: 'What the check found, worst first' })
  flags!: JobTrustFlag[];

  @Field(() => Int, {
    description: 'Earlier ads with the same title at the same company (last year)',
  })
  reposts!: number;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'When the first of those earlier ads was posted',
  })
  firstPostedAt!: Date | null;

  @Field(() => Int, { description: 'Days since this ad was posted' })
  ageDays!: number;
}
