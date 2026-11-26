import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { InsightsModule } from '../insights/insights.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NightlyKitsResolver } from './nightly-kits.resolver';
import { NightlyKitsService } from './nightly-kits.service';

/** Apply kits: the kits of the jobs Autopilot queued, written with the user's own AI key. */
@Module({
  imports: [ApiKeysModule, InsightsModule, NotificationsModule],
  providers: [NightlyKitsService, NightlyKitsResolver],
  exports: [NightlyKitsService],
})
export class NightlyKitsModule {}
