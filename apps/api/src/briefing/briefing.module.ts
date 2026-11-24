import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BriefingResolver } from './briefing.resolver';
import { BriefingService } from './briefing.service';
import { PushService } from './push.service';

/** The morning briefing, and push messages to the phone app. */
@Module({
  imports: [InsightsModule, NotificationsModule],
  providers: [BriefingService, PushService, BriefingResolver],
})
export class BriefingModule {}
