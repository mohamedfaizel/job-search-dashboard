import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { SyncJobsInput, SyncJobsResult } from './sync.input';
import { SyncService } from './sync.service';

@Resolver()
export class SyncResolver {
  constructor(private readonly syncService: SyncService) {}

  @Mutation(() => SyncJobsResult, { description: 'Fetch jobs from JobsPipe and save them' })
  syncJobs(@Args('input') input: SyncJobsInput): Promise<SyncJobsResult> {
    return this.syncService.sync(input);
  }
}
