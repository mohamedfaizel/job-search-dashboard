import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { SyncJobsResult } from '../sync/sync.input';
import {
  ImportBudget,
  SavedSearch,
  SavedSearchInput,
  ScheduleInput,
  SyncRunModel,
} from './saved-search.model';
import { SavedSearchesService } from './saved-searches.service';
import { SchedulerService } from './scheduler.service';

// Everyone has their own saved searches; their JobHunter imports use their own token.
@Resolver(() => SavedSearch)
export class SavedSearchesResolver {
  constructor(
    private readonly service: SavedSearchesService,
    private readonly scheduler: SchedulerService,
  ) {}

  @Query(() => ImportBudget, {
    description: "Today's credits you used against the daily limit (Admin › Limits)",
  })
  importBudget(@CurrentUser() user: SessionUser): Promise<ImportBudget> {
    return this.scheduler.budget(user.id);
  }

  @Mutation(() => SavedSearch, { description: 'Turn scheduled runs of a saved search on or off' })
  setSavedSearchSchedule(
    @CurrentUser() user: SessionUser,
    @Args('id', { type: () => Int }) id: number,
    @Args('input') input: ScheduleInput,
  ): Promise<SavedSearch> {
    return this.service.setSchedule(user.id, id, input.schedule, input.runAt);
  }

  @Query(() => [SavedSearch], {
    description: 'Your saved searches, by name, with their last import',
  })
  savedSearches(@CurrentUser() user: SessionUser): Promise<SavedSearch[]> {
    return this.service.list(user.id);
  }

  @Query(() => [SyncRunModel], { description: 'Past imports, newest first' })
  syncRuns(
    @CurrentUser() user: SessionUser,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Args('savedSearchId', { type: () => Int, nullable: true }) savedSearchId?: number,
  ): Promise<SyncRunModel[]> {
    return this.service.history(
      user.id,
      Math.min(Math.max(limit, 1), 100),
      savedSearchId ?? undefined,
    );
  }

  @Mutation(() => SavedSearch)
  createSavedSearch(
    @CurrentUser() user: SessionUser,
    @Args('input') input: SavedSearchInput,
  ): Promise<SavedSearch> {
    return this.service.create(user.id, input);
  }

  @Mutation(() => SavedSearch)
  updateSavedSearch(
    @CurrentUser() user: SessionUser,
    @Args('id', { type: () => Int }) id: number,
    @Args('input') input: SavedSearchInput,
  ): Promise<SavedSearch> {
    return this.service.update(user.id, id, input);
  }

  @Mutation(() => Boolean, { description: 'Delete a saved search. Its past imports stay.' })
  deleteSavedSearch(
    @CurrentUser() user: SessionUser,
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    return this.service.remove(user.id, id);
  }

  @Mutation(() => SyncJobsResult, { description: 'Import from JobHunter with a saved search' })
  runSavedSearch(
    @CurrentUser() user: SessionUser,
    @Args('id', { type: () => Int }) id: number,
    @Args('resume', { defaultValue: false, description: 'Continue its last import instead' })
    resume: boolean,
  ): Promise<SyncJobsResult> {
    return this.service.run(user.id, id, resume);
  }
}
