import { Module } from '@nestjs/common';
import { SyncModule } from '../sync/sync.module';
import { SavedSearchesResolver } from './saved-searches.resolver';
import { SavedSearchesService } from './saved-searches.service';

@Module({
  imports: [SyncModule],
  providers: [SavedSearchesService, SavedSearchesResolver],
  exports: [SavedSearchesService],
})
export class SavedSearchesModule {}
