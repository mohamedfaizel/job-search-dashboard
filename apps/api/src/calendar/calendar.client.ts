import { Injectable } from '@nestjs/common';
import type { CalendarEvent } from './calendar-event';

const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/** The event is not in the calendar any more (you deleted it there). */
export class EventGoneError extends Error {}

/** The three Google Calendar calls we need, on your main calendar, with plain `fetch`. */
@Injectable()
export class CalendarClient {
  /** Adds the event and returns its id. */
  async insert(accessToken: string, event: CalendarEvent): Promise<string> {
    const reply = await this.call(accessToken, 'POST', '', event);
    const body = (await reply.json()) as { id?: string };
    if (!body.id) throw new Error('Google Calendar sent no event id');
    return body.id;
  }

  /** Moves or rewrites an event we made before. */
  async update(accessToken: string, eventId: string, event: CalendarEvent): Promise<void> {
    await this.call(accessToken, 'PATCH', `/${encodeURIComponent(eventId)}`, event);
  }

  /** Removes it. Already gone counts as removed. */
  async remove(accessToken: string, eventId: string): Promise<void> {
    try {
      await this.call(accessToken, 'DELETE', `/${encodeURIComponent(eventId)}`);
    } catch (error) {
      if (!(error instanceof EventGoneError)) throw error;
    }
  }

  private async call(
    accessToken: string,
    method: string,
    path: string,
    body?: CalendarEvent,
  ): Promise<Response> {
    const reply = await fetch(`${EVENTS_URL}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20_000),
    });
    if (reply.status === 404 || reply.status === 410) throw new EventGoneError('Event is gone');
    if (!reply.ok) throw new Error(`Google Calendar answered ${reply.status}`);
    return reply;
  }
}
