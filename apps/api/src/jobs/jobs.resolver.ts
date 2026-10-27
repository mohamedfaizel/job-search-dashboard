import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { CreateJobInput } from './dto/create-job.input';
import { JobsArgs } from './dto/jobs.args';
import { JobsService } from './jobs.service';
import { ApplicationStatus } from './models/enums';
import { Application, Job, JobFilterOptions, JobPage } from './models/job.model';

/** GraphQL entry points for jobs. Resolvers stay thin; the logic lives in JobsService. */
@Resolver(() => Job)
export class JobsResolver {
  constructor(private readonly jobs: JobsService) {}

  @Query(() => JobPage, { description: 'Jobs for the dashboard table: filter, sort and paginate' })
  jobsPage(@CurrentUser() user: SessionUser, @Args() args: JobsArgs): Promise<JobPage> {
    return this.jobs.findPage(user.id, args);
  }

  @Query(() => Int, { description: 'How many jobs you have hidden' })
  hiddenJobCount(@CurrentUser() user: SessionUser): Promise<number> {
    return this.jobs.hiddenCount(user.id);
  }

  @Mutation(() => Boolean, { description: 'Hide a job from your table. Other users still see it.' })
  hideJob(
    @CurrentUser() user: SessionUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.jobs.hide(user.id, id);
  }

  @Mutation(() => Boolean, { description: 'Show a hidden job in your table again' })
  unhideJob(
    @CurrentUser() user: SessionUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.jobs.unhide(user.id, id);
  }

  @Query(() => Job)
  job(@CurrentUser() user: SessionUser, @Args('id', { type: () => ID }) id: string) {
    return this.jobs.findOne(user.id, id);
  }

  @Query(() => [Application], { description: 'Your tracker: jobs you saved, applied to, etc.' })
  myApplications(@CurrentUser() user: SessionUser) {
    return this.jobs.applications(user.id);
  }

  @Query(() => JobFilterOptions, { description: 'Values to offer in each column filter' })
  jobFilterOptions(): Promise<JobFilterOptions> {
    return this.jobs.filterOptions();
  }

  // Jobs are shared by every user, so only the admin adds them for now.
  @Roles('ADMIN')
  @Mutation(() => Job, { description: 'Add a job by hand' })
  createJob(@CurrentUser() user: SessionUser, @Args('input') input: CreateJobInput) {
    return this.jobs.create(user.id, input);
  }

  @Mutation(() => Job, {
    description: 'Track your progress: Saved, Applied, Interviewing… Only you see your status.',
  })
  updateJobStatus(
    @CurrentUser() user: SessionUser,
    @Args('id', { type: () => ID }) id: string,
    @Args('status', { type: () => ApplicationStatus }) status: ApplicationStatus,
  ) {
    return this.jobs.updateApplicationStatus(user.id, id, status);
  }
}
