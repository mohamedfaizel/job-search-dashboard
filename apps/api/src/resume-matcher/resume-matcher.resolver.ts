import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { JobMatchService } from './job-match.service';
import {
  JobMatchModel,
  MatcherResumeModel,
  ResumeMatcherStatusModel,
} from './resume-matcher.model';
import { ResumeMatcherService } from './resume-matcher.service';
import { ResumeSyncService } from './resume-sync.service';

/** Any logged-in user may use these; the global AuthGuard already rejects anonymous requests. */
@Resolver(() => ResumeMatcherStatusModel)
export class ResumeMatcherResolver {
  constructor(
    private readonly resumeMatcher: ResumeMatcherService,
    private readonly resumeSync: ResumeSyncService,
    private readonly jobMatches: JobMatchService,
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

  @Query(() => JobMatchModel, {
    nullable: true,
    description: 'Your resume match for one job. Null if you never matched it',
  })
  jobMatch(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
  ): Promise<JobMatchModel | null> {
    return this.jobMatches.get(user.id, jobId);
  }

  @Mutation(() => JobMatchModel, {
    description:
      'Score your resume against a job with Resume-Matcher. Returns at once as PENDING; poll jobMatch until READY or FAILED (a minute or two). Uses AI credits',
  })
  matchJob(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
  ): Promise<JobMatchModel> {
    return this.jobMatches.start(user.id, jobId);
  }
}
