import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SyncJobsResult } from '../sync/sync.input';
import { SavedSearch, SavedSearchInput, SyncRunModel } from './saved-search.model';
import { SavedSearchesService } from './saved-searches.service';

@Resolver(() => SavedSearch)
export class SavedSearchesResolver {
  constructor(private readonly service: SavedSearchesService) {}

  @Query(() => [SavedSearch], {
    description: 'Your saved searches, by name, with their last import',
  })
  savedSearches(): Promise<SavedSearch[]> {
    return this.service.list();
  }

  @Query(() => [SyncRunModel], { description: 'Past imports, newest first' })
  syncRuns(
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Args('savedSearchId', { type: () => Int, nullable: true }) savedSearchId?: number,
  ): Promise<SyncRunModel[]> {
    return this.service.history(Math.min(Math.max(limit, 1), 100), savedSearchId ?? undefined);
  }

  @Mutation(() => SavedSearch)
  createSavedSearch(@Args('input') input: SavedSearchInput): Promise<SavedSearch> {
    return this.service.create(input);
  }

  @Mutation(() => SavedSearch)
  updateSavedSearch(
    @Args('id', { type: () => Int }) id: number,
    @Args('input') input: SavedSearchInput,
  ): Promise<SavedSearch> {
    return this.service.update(id, input);
  }

  @Mutation(() => Boolean, { description: 'Delete a saved search. Its past imports stay.' })
  deleteSavedSearch(@Args('id', { type: () => Int }) id: number): Promise<boolean> {
    return this.service.remove(id);
  }

  @Mutation(() => SyncJobsResult, { description: 'Import from JobsPipe with a saved search' })
  runSavedSearch(
    @Args('id', { type: () => Int }) id: number,
    @Args('resume', { defaultValue: false, description: 'Continue its last import instead' })
    resume: boolean,
  ): Promise<SyncJobsResult> {
    return this.service.run(id, resume);
  }
}
