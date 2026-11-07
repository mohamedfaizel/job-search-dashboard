import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Roles } from '../auth/auth.decorators';
import { SyncJobsInput, SyncJobsResult } from './sync.input';
import { SyncService } from './sync.service';

// Imports spend the server's JobHunter credits.
@Roles('ADMIN')
@Resolver()
export class SyncResolver {
  constructor(private readonly syncService: SyncService) {}

  @Mutation(() => SyncJobsResult, { description: 'Fetch jobs from JobHunter and save them' })
  syncJobs(@Args('input') input: SyncJobsInput): Promise<SyncJobsResult> {
    return this.syncService.sync(input);
  }
}
