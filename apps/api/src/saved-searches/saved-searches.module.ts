import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SyncModule } from '../sync/sync.module';
import { AutopilotService } from './autopilot.service';
import { SavedSearchesResolver } from './saved-searches.resolver';
import { SavedSearchesService } from './saved-searches.service';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [SyncModule, NotificationsModule, InsightsModule],
  providers: [SavedSearchesService, SavedSearchesResolver, SchedulerService, AutopilotService],
  exports: [SavedSearchesService],
})
export class SavedSearchesModule {}
