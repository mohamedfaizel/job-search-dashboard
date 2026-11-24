import { Module } from '@nestjs/common';
import { GoogleClientModule } from '../gmail/google-client.module';
import { CalendarClient } from './calendar.client';
import { CalendarResolver } from './calendar.resolver';
import { CalendarService } from './calendar.service';

/** Interviews into Google Calendar. Signing in goes through the Gmail sign-in pages. */
@Module({
  imports: [GoogleClientModule],
  providers: [CalendarClient, CalendarService, CalendarResolver],
  exports: [CalendarService],
})
export class CalendarModule {}
