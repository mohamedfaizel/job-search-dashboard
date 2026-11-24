import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getErrorMessage } from '../common/errors';
import { AccessRevokedError, GmailClient } from '../gmail/gmail.client';
import { decryptToken, encryptToken, tokenKey } from '../gmail/token-crypto';
import { PrismaService } from '../prisma/prisma.service';
import { interviewEvent } from './calendar-event';
import { CalendarClient, EventGoneError } from './calendar.client';
import type { GoogleCalendarStatusModel } from './calendar.model';

/**
 * Interviews into Google Calendar: when your calendar is connected, every interview date you set
 * becomes an event there (with the job link and your prep notes), moves when you change the date
 * and goes away when you clear it. It only touches the events it made.
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GmailClient,
    private readonly client: CalendarClient,
    private readonly config: ConfigService,
  ) {}

  async status(userId: number): Promise<GoogleCalendarStatusModel> {
    const row = await this.prisma.googleCalendar.findUnique({
      where: { userId },
      select: { email: true, lastError: true },
    });
    return {
      configured: this.google.configured,
      email: row?.email ?? null,
      lastError: row?.lastError ?? null,
    };
  }

  /** Saves the calendar after sign-in, then adds the interviews you already have coming up. */
  async connect(userId: number, email: string, refreshToken: string | null): Promise<void> {
    const existing = await this.prisma.googleCalendar.findUnique({ where: { userId } });
    if (!refreshToken && !existing) throw new Error('Google sent no refresh token');
    const encrypted = refreshToken ? encryptToken(refreshToken, tokenKey(this.config)) : undefined;
    // A different Google account: the events we made live in the old one, so start over.
    if (existing && existing.email !== email) {
      await this.prisma.application.updateMany({
        where: { userId, calendarEventId: { not: null } },
        data: { calendarEventId: null },
      });
    }
    await this.prisma.googleCalendar.upsert({
      where: { userId },
      create: { userId, email, refreshToken: encrypted ?? '' },
      update: { email, ...(encrypted ? { refreshToken: encrypted } : {}), lastError: null },
    });
    const coming = await this.prisma.application.findMany({
      where: { userId, interviewAt: { gte: new Date() }, calendarEventId: null },
      select: { jobId: true },
    });
    for (const { jobId } of coming) await this.syncInterview(userId, jobId);
  }

  /** Forgets the calendar. The events already there stay; you can delete them in Google. */
  async disconnect(userId: number): Promise<boolean> {
    const row = await this.prisma.googleCalendar.findUnique({ where: { userId } });
    if (!row) return false;
    await this.prisma.$transaction([
      this.prisma.googleCalendar.delete({ where: { userId } }),
      this.prisma.application.updateMany({
        where: { userId, calendarEventId: { not: null } },
        data: { calendarEventId: null },
      }),
    ]);
    await this.google.revoke(this.plain(row.refreshToken)).catch(() => undefined);
    return true;
  }

  /**
   * Makes the calendar match the interview date of one job: adds, moves or removes its event.
   * Never throws: a calendar problem must not stop you saving the date. It is shown in Settings.
   */
  async syncInterview(userId: number, jobId: string): Promise<void> {
    const calendar = await this.prisma.googleCalendar.findUnique({ where: { userId } });
    if (!calendar || !this.google.configured) return;
    try {
      const token = await this.google.accessToken(this.plain(calendar.refreshToken));
      const eventId = await this.apply(userId, jobId, token);
      await this.prisma.application.updateMany({
        where: { userId, jobId },
        data: { calendarEventId: eventId },
      });
      if (calendar.lastError) {
        await this.prisma.googleCalendar.update({ where: { userId }, data: { lastError: null } });
      }
    } catch (error) {
      const reason =
        error instanceof AccessRevokedError
          ? 'Google access was removed. Connect the calendar again.'
          : getErrorMessage(error);
      this.logger.warn(`Calendar for ${String(userId)}:${jobId} failed: ${reason}`);
      await this.prisma.googleCalendar.update({ where: { userId }, data: { lastError: reason } });
    }
  }

  /** Does the calendar change and returns the event id to keep (null: no event). */
  private async apply(userId: number, jobId: string, token: string): Promise<string | null> {
    const application = await this.prisma.application.findUnique({
      where: { userId_jobId: { userId, jobId } },
      select: {
        interviewAt: true,
        calendarEventId: true,
        job: { select: { title: true, url: true, company: { select: { name: true } } } },
      },
    });
    if (!application) return null;
    const { interviewAt, calendarEventId } = application;
    if (!interviewAt) {
      if (calendarEventId) await this.client.remove(token, calendarEventId);
      return null;
    }
    const prep = await this.prisma.interviewPrep.findUnique({
      where: { userId_jobId: { userId, jobId } },
      select: { text: true },
    });
    const web = this.config.get<string>('WEB_URL') || 'http://localhost:3001';
    const event = interviewEvent({
      title: application.job.title,
      company: application.job.company.name,
      at: interviewAt,
      jobLink: `${web}/jobs?job=${encodeURIComponent(jobId)}`,
      adUrl: application.job.url,
      prep: prep?.text ?? null,
    });
    if (calendarEventId) {
      try {
        await this.client.update(token, calendarEventId, event);
        return calendarEventId;
      } catch (error) {
        // You deleted it in Google: make a new one, since the interview is still on.
        if (!(error instanceof EventGoneError)) throw error;
      }
    }
    return this.client.insert(token, event);
  }

  private plain(stored: string): string {
    return decryptToken(stored, tokenKey(this.config));
  }
}
