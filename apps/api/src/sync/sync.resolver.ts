import { Args, Mutation, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { SyncJobsInput, SyncJobsResult } from './sync.input';
import { SyncService } from './sync.service';

// Anyone can import: JobHunter imports use your own token (Settings > API keys).
@Resolver()
export class SyncResolver {
  constructor(private readonly syncService: SyncService) {}

  @Mutation(() => SyncJobsResult, { description: 'Fetch jobs from JobHunter and save them' })
  syncJobs(
    @CurrentUser() user: SessionUser,
    @Args('input') input: SyncJobsInput,
  ): Promise<SyncJobsResult> {
    return this.syncService.sync(input, { userId: user.id });
  }
}
