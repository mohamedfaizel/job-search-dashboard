import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { JobsService } from '../jobs/jobs.service';
import { Job } from '../jobs/models/job.model';
import { LivenessService } from './liveness.service';

@Resolver()
export class LivenessResolver {
  constructor(
    private readonly liveness: LivenessService,
    private readonly jobs: JobsService,
  ) {}

  @Mutation(() => Job, {
    description:
      'Opens the job\'s link to see if it is still open. A closed job becomes "expired". Checked in the last 10 minutes: returns the saved answer.',
  })
  async checkJobStillOpen(
    @CurrentUser() user: SessionUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    await this.liveness.check(id);
    return this.jobs.findOne(user.id, id);
  }
}
