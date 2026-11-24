import { Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { GoogleCalendarStatusModel } from './calendar.model';
import { CalendarService } from './calendar.service';

@Resolver()
export class CalendarResolver {
  constructor(private readonly calendar: CalendarService) {}

  @Query(() => GoogleCalendarStatusModel, {
    description: 'Is your Google Calendar connected (interviews become events there)?',
  })
  googleCalendar(@CurrentUser() user: SessionUser): Promise<GoogleCalendarStatusModel> {
    return this.calendar.status(user.id);
  }

  @Mutation(() => Boolean, {
    description: 'Forgets your Google Calendar. The events already made stay there.',
  })
  disconnectGoogleCalendar(@CurrentUser() user: SessionUser): Promise<boolean> {
    return this.calendar.disconnect(user.id);
  }
}
