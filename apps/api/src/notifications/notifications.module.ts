import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module';
import { NotificationsResolver } from './notifications.resolver';
import { NotificationsService } from './notifications.service';

/** The bell list: notifications for one user, such as new jobs that fit them. */
@Module({
  imports: [InsightsModule],
  providers: [NotificationsService, NotificationsResolver],
  exports: [NotificationsService],
})
export class NotificationsModule {}
