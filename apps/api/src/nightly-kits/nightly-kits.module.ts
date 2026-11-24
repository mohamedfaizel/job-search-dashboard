import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { InsightsModule } from '../insights/insights.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NightlyKitsResolver } from './nightly-kits.resolver';
import { NightlyKitsService } from './nightly-kits.service';

/** Nightly apply kits: queued jobs' kits written at night with the user's own AI key. */
@Module({
  imports: [ApiKeysModule, InsightsModule, NotificationsModule],
  providers: [NightlyKitsService, NightlyKitsResolver],
})
export class NightlyKitsModule {}
