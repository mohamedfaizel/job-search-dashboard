import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Roles } from '../auth/auth.decorators';
import { CreateJobInput } from './dto/create-job.input';
import { JobsArgs } from './dto/jobs.args';
import { JobsService } from './jobs.service';
import { ApplicationStatus } from './models/enums';
import { Job, JobFilterOptions, JobPage } from './models/job.model';

/** GraphQL entry points for jobs. Resolvers stay thin; the logic lives in JobsService. */
@Resolver(() => Job)
export class JobsResolver {
  constructor(private readonly jobs: JobsService) {}

  @Query(() => JobPage, { description: 'Jobs for the dashboard table: filter, sort and paginate' })
  jobsPage(@Args() args: JobsArgs): Promise<JobPage> {
    return this.jobs.findPage(args);
  }

  @Query(() => Job)
  job(@Args('id', { type: () => ID }) id: string) {
    return this.jobs.findOne(id);
  }

  @Query(() => JobFilterOptions, { description: 'Values to offer in each column filter' })
  jobFilterOptions(): Promise<JobFilterOptions> {
    return this.jobs.filterOptions();
  }

  // Jobs are shared by every user, so only the admin adds them for now.
  @Roles('ADMIN')
  @Mutation(() => Job, { description: 'Add a job by hand' })
  createJob(@Args('input') input: CreateJobInput) {
    return this.jobs.create(input);
  }

  @Mutation(() => Job, { description: 'Track your progress: Saved, Applied, Interviewing…' })
  updateJobStatus(
    @Args('id', { type: () => ID }) id: string,
    @Args('status', { type: () => ApplicationStatus }) status: ApplicationStatus,
  ) {
    return this.jobs.updateApplicationStatus(id, status);
  }
}
