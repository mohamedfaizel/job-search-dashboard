import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { GmailClient } from './gmail.client';
import { GmailService } from './gmail.service';
import { makeState, readState } from './oauth-state';

/**
 * The two browser steps of "Connect Gmail": /gmail/connect sends you to Google, Google sends you
 * back to /gmail/callback, and from there you land on My profile with the result in the address.
 */
@Controller('gmail')
export class GmailController {
  private readonly logger = new Logger(GmailController.name);

  constructor(
    private readonly gmail: GmailService,
    private readonly client: GmailClient,
    private readonly config: ConfigService,
  ) {}

  private get secret(): string {
    return (
      this.config.get<string>('GMAIL_TOKEN_KEY') ||
      this.config.get<string>('JWT_SECRET') ||
      'dev-only-secret-change-me'
    );
  }

  private back(result: string): string {
    const web = this.config.get<string>('WEB_URL') || 'http://localhost:3001';
    return `${web}/profile?gmail=${result}`;
  }

  @Get('connect')
  connect(@CurrentUser() user: SessionUser, @Res() res: Response): void {
    res.redirect(
      this.client.configured
        ? this.client.authUrl(makeState(user.id, this.secret))
        : this.back('not-configured'),
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

  /** Where to send the browser afterwards: the profile page, with the result in the address. */
  private async finish(
    code: string | undefined,
    state: string | undefined,
    error: string | undefined,
  ): Promise<string> {
    const userId = state ? readState(state, this.secret) : null;
    if (userId === null) return this.back('error');
    if (error || !code) return this.back('denied');
    try {
      const { email, refreshToken } = await this.client.exchangeCode(code);
      await this.gmail.connect(userId, email, refreshToken);
      return this.back('connected');
    } catch (failure) {
      this.logger.warn(`Connecting Gmail failed: ${String(failure)}`);
      return this.back('error');
    }
  }
}
