import { Field, ObjectType } from '@nestjs/graphql';

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
