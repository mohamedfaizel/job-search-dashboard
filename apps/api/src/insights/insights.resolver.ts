import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { JobInsightsModel } from './insights.model';
import { InsightsService } from './insights.service';

@Resolver()
export class InsightsResolver {
  constructor(private readonly insights: InsightsService) {}

  @Query(() => JobInsightsModel, {
    description:
      'Title, language, skills and keywords of a job, checked against your resume. Free and instant: no AI',
  })
  jobInsights(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
  ): Promise<JobInsightsModel> {
    return this.insights.forJob(user.id, jobId);
  }

  @Mutation(() => JobInsightsModel, {
    description:
      'Removes a skill or keyword ("I don’t have it" or "not relevant") from this job, or from every job',
  })
  removeInsightTerm(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
    @Args('term') term: string,
    @Args('everywhere', { defaultValue: false }) everywhere: boolean,
  ): Promise<JobInsightsModel> {
    return this.insights.removeTerm(user.id, jobId, term, everywhere);
  }

  @Mutation(() => JobInsightsModel, { description: 'Puts a removed skill or keyword back' })
  restoreInsightTerm(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
    @Args('term') term: string,
  ): Promise<JobInsightsModel> {
    return this.insights.restoreTerm(user.id, jobId, term);
  }
}
