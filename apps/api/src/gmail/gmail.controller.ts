import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { CalendarService } from '../calendar/calendar.service';
import { CALENDAR_SCOPES, GmailClient } from './gmail.client';
import { GmailService } from './gmail.service';
import { makeState, readState } from './oauth-state';
import { tokenSecret } from './token-crypto';

/** Marks a sign-in that connects Google Calendar, so both share the one Google callback. */
const CALENDAR = 'cal.';

/**
 * The two browser steps of "Connect Gmail": /gmail/connect sends you to Google, Google sends you
 * back to /gmail/callback, and from there you land on Settings > Gmail with the result in the address.
 */
@Controller('gmail')
export class GmailController {
  private readonly logger = new Logger(GmailController.name);

  constructor(
    private readonly gmail: GmailService,
    private readonly calendar: CalendarService,
    private readonly client: GmailClient,
    private readonly config: ConfigService,
  ) {}

  private get secret(): string {
    return tokenSecret(this.config);
  }

  private back(result: string, what: 'gmail' | 'calendar' = 'gmail'): string {
    const web = this.config.get<string>('WEB_URL') || 'http://localhost:3001';
    return `${web}/settings?${what}=${result}`;
  }

  @Get('connect')
  connect(@CurrentUser() user: SessionUser, @Res() res: Response): void {
    res.redirect(
      this.client.configured
        ? this.client.authUrl(makeState(user.id, this.secret))
        : this.back('not-configured'),
    );
  }

  /** Same as Connect Gmail, but asks Google for calendar events instead of mail. */
  @Get('calendar/connect')
  connectCalendar(@CurrentUser() user: SessionUser, @Res() res: Response): void {
    res.redirect(
      this.client.configured
        ? this.client.authUrl(CALENDAR + makeState(user.id, this.secret), CALENDAR_SCOPES)
        : this.back('not-configured', 'calendar'),
    );
  }

  /** Public because Google, not your browser app, calls it; the signed state proves who you are. */
  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    res.redirect(await this.finish(code, state, error));
  }

  /** Where to send the browser afterwards: Settings > Gmail, with the result in the address. */
  private async finish(
    code: string | undefined,
    state: string | undefined,
    error: string | undefined,
  ): Promise<string> {
    const what = state?.startsWith(CALENDAR) ? 'calendar' : 'gmail';
    const signed = what === 'calendar' ? state?.slice(CALENDAR.length) : state;
    const userId = signed ? readState(signed, this.secret) : null;
    if (userId === null) return this.back('error', what);
    if (error || !code) return this.back('denied', what);
    try {
      const { email, refreshToken } = await this.client.exchangeCode(code);
      if (what === 'calendar') await this.calendar.connect(userId, email, refreshToken);
      else await this.gmail.connect(userId, email, refreshToken);
      return this.back('connected', what);
    } catch (failure) {
      this.logger.warn(`Connecting ${what} failed: ${String(failure)}`);
      return this.back('error', what);
    }
  }
}
