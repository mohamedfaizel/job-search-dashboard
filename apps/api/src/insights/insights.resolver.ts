import { Args, ID, Query, Resolver } from '@nestjs/graphql';
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
}
