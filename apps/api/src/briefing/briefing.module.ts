import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BriefingResolver } from './briefing.resolver';
import { BriefingService } from './briefing.service';
import { PushService } from './push.service';
import { WeeklyService } from './weekly.service';

/** The morning briefing, the weekly report, and push messages to the phone app. */
@Module({
  imports: [InsightsModule, NotificationsModule],
  providers: [BriefingService, WeeklyService, PushService, BriefingResolver],
})
export class BriefingModule {}
