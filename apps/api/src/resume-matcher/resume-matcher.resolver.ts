import { Args, Query, Resolver } from '@nestjs/graphql';
import { ResumeMatcherStatusModel } from './resume-matcher.model';
import { ResumeMatcherService } from './resume-matcher.service';

/** Any logged-in user may ask; the global AuthGuard already rejects anonymous requests. */
@Resolver(() => ResumeMatcherStatusModel)
export class ResumeMatcherResolver {
  constructor(private readonly resumeMatcher: ResumeMatcherService) {}

  @Query(() => ResumeMatcherStatusModel)
  resumeMatcherStatus(
    @Args('checkAi', {
      defaultValue: false,
      description: 'Also send a test message to the AI provider (costs a fraction of a cent)',
    })
    checkAi: boolean,
  ): Promise<ResumeMatcherStatusModel> {
    return this.resumeMatcher.getStatus(checkAi);
  }
}
