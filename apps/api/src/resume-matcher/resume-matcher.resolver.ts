import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { MatcherResumeModel, ResumeMatcherStatusModel } from './resume-matcher.model';
import { ResumeMatcherService } from './resume-matcher.service';
import { ResumeSyncService } from './resume-sync.service';

/** Any logged-in user may use these; the global AuthGuard already rejects anonymous requests. */
@Resolver(() => ResumeMatcherStatusModel)
export class ResumeMatcherResolver {
  constructor(
    private readonly resumeMatcher: ResumeMatcherService,
    private readonly resumeSync: ResumeSyncService,
  ) {}

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

  @Query(() => MatcherResumeModel, {
    description: "Your master resume's copy in Resume-Matcher, which jobs are matched against",
  })
  myMatcherResume(@CurrentUser() user: SessionUser): Promise<MatcherResumeModel> {
    return this.resumeSync.get(user.id);
  }

  @Mutation(() => MatcherResumeModel, {
    description:
      'Send your uploaded resume file to Resume-Matcher, replacing the previous copy. Its AI reads it, which can take a minute',
  })
  syncResumeToMatcher(@CurrentUser() user: SessionUser): Promise<MatcherResumeModel> {
    return this.resumeSync.sync(user.id);
  }
}
