import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

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
