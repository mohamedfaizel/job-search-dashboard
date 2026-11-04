import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { ApplyQueueItemModel, ApplyQueuePromptModel, QueueDirection } from './apply-queue';
import { FitService } from './fit.service';
import { JobInsightsModel, PdfCheckModel } from './insights.model';
import { InsightsService } from './insights.service';
import { ReplyMatchService } from './reply-match.service';

@Resolver()
export class InsightsResolver {
  constructor(
    private readonly insights: InsightsService,
    private readonly fit: FitService,
    private readonly replyMatch: ReplyMatchService,
  ) {}

  @Mutation(() => Int, {
    description:
      'Works out Fit % for every job again, now. Normally it happens by itself. Returns how many jobs got a score',
  })
  recalculateFit(@CurrentUser() user: SessionUser): Promise<number> {
    return this.fit.forceRecalculate(user.id);
  }

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

  @Query(() => PdfCheckModel, {
    description:
      'Makes the resume PDF saved for a job and checks it the way an ATS reads it: pages, text, e-mail, dates, characters and skills',
  })
  resumePdfCheck(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
    @Args('template', { type: () => String, nullable: true }) template?: string | null,
  ): Promise<PdfCheckModel> {
    return this.insights.pdfCheck(user.id, jobId, template ?? undefined);
  }

  @Mutation(() => JobInsightsModel, {
    description:
      'Scores the resume saved for this job with Resume-Matcher (AI match). Returns at once with aiStatus PENDING; poll jobInsights until READY or FAILED (a minute or two). Uses AI credits',
  })
  async matchJobResume(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
  ): Promise<JobInsightsModel> {
    await this.replyMatch.start(user.id, jobId);
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

  @Mutation(() => JobInsightsModel, {
    description:
      '"I have this": adds a missing skill or keyword to the Skills list of My profile (have: true), or takes it off (have: false). It then counts as covered for every job',
  })
  async setHaveTerm(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
    @Args('term') term: string,
    @Args('have', { defaultValue: true }) have: boolean,
  ): Promise<JobInsightsModel> {
    const insights = await this.insights.setHaveTerm(user.id, jobId, term, have);
    // Every job's Fit % changes with your skills: start working it out now.
    this.fit.warm(user.id);
    return insights;
  }

  @Mutation(() => JobInsightsModel, { description: 'Puts a removed skill or keyword back' })
  restoreInsightTerm(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
    @Args('term') term: string,
  ): Promise<JobInsightsModel> {
    return this.insights.restoreTerm(user.id, jobId, term);
  }

  @Mutation(() => JobInsightsModel, {
    description:
      'Saves pasted text as the resume you wrote for this job (replacing the one before), and scores it',
  })
  saveJobResumeText(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
    @Args('text') text: string,
  ): Promise<JobInsightsModel> {
    return this.insights.saveJobResume(user.id, jobId, text);
  }

  @Mutation(() => JobInsightsModel, {
    description:
      'Takes the skills the fact check flagged out of the Skills section of the resume you wrote for this job, then scores it again',
  })
  removeUnsupportedSkills(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
  ) {
    return this.insights.removeUnsupportedSkills(user.id, jobId);
  }

  @Mutation(() => JobInsightsModel, { description: 'Deletes the resume you wrote for this job' })
  deleteJobResume(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
  ): Promise<JobInsightsModel> {
    return this.insights.deleteJobResume(user.id, jobId);
  }

  @Mutation(() => JobInsightsModel, {
    description:
      "Saves Claude's answer to the interview prep prompt for this job (replacing the one before)",
  })
  saveInterviewPrep(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
    @Args('text') text: string,
  ): Promise<JobInsightsModel> {
    return this.insights.saveInterviewPrep(user.id, jobId, text);
  }

  @Mutation(() => JobInsightsModel, { description: 'Deletes the interview prep for this job' })
  deleteInterviewPrep(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
  ): Promise<JobInsightsModel> {
    return this.insights.deleteInterviewPrep(user.id, jobId);
  }

  @Query(() => [ApplyQueueItemModel], {
    description: 'Jobs you lined up to apply for, oldest first',
  })
  myApplyQueue(@CurrentUser() user: SessionUser): Promise<ApplyQueueItemModel[]> {
    return this.insights.applyQueue(user.id);
  }

  @Mutation(() => [ApplyQueueItemModel], {
    description: 'Adds jobs to your Apply queue. Jobs already in it keep their place.',
  })
  addToApplyQueue(
    @CurrentUser() user: SessionUser,
    @Args('jobIds', { type: () => [ID] }) jobIds: string[],
  ): Promise<ApplyQueueItemModel[]> {
    return this.insights.addToApplyQueue(user.id, jobIds);
  }

  @Mutation(() => [ApplyQueueItemModel], {
    description: 'Moves a job one place up or down in your Apply queue',
  })
  moveInApplyQueue(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
    @Args('direction', { type: () => QueueDirection }) direction: QueueDirection,
  ): Promise<ApplyQueueItemModel[]> {
    return this.insights.moveInApplyQueue(user.id, jobId, direction);
  }

  @Mutation(() => [ApplyQueueItemModel], { description: 'Takes jobs out of your Apply queue' })
  removeFromApplyQueue(
    @CurrentUser() user: SessionUser,
    @Args('jobIds', { type: () => [ID] }) jobIds: string[],
  ): Promise<ApplyQueueItemModel[]> {
    return this.insights.removeFromApplyQueue(user.id, jobIds);
  }

  @Query(() => ApplyQueuePromptModel, {
    description: 'One Claude prompt for the queued jobs that have no reply yet (up to 5)',
  })
  applyQueuePrompt(@CurrentUser() user: SessionUser): Promise<ApplyQueuePromptModel> {
    return this.insights.applyQueuePrompt(user.id);
  }

  @Mutation(() => [ApplyQueueItemModel], {
    description: "Saves Claude's reply to the queue prompt, each part to its own job",
  })
  saveApplyQueueReply(
    @CurrentUser() user: SessionUser,
    @Args('text') text: string,
  ): Promise<ApplyQueueItemModel[]> {
    return this.insights.saveApplyQueueReply(user.id, text);
  }
}
