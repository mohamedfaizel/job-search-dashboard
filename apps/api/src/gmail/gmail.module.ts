import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { JobsModule } from '../jobs/jobs.module';
import { GmailController } from './gmail.controller';
import { GmailResolver } from './gmail.resolver';
import { GmailService } from './gmail.service';
import { GoogleClientModule } from './google-client.module';

/** Connect Gmail accounts (read-only) and turn employer replies into tracker suggestions. */
@Module({
  imports: [JobsModule, CalendarModule, GoogleClientModule],
  controllers: [GmailController],
  providers: [GmailService, GmailResolver],
})
export class GmailModule {}
