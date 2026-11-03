import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GMAIL_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';
/** Read-only: the app can never send, change or delete mail. */
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly'];

export interface MailMessage {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: Date;
}

/** Google said the refresh token no longer works (access revoked, or the account is gone). */
export class AccessRevokedError extends Error {}

interface TokenReply {
  access_token?: string;
  refresh_token?: string;
  error?: string;
}

interface ListReply {
  messages?: { id: string }[];
}

interface MessageReply {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: { name: string; value: string }[] };
}

/** The few Google calls we need, with plain `fetch` (no Google library to learn or update). */
@Injectable()
export class GmailClient {
  constructor(private readonly config: ConfigService) {}

  get clientId(): string {
    return this.config.get<string>('GOOGLE_CLIENT_ID') ?? '';
  }

  /** Off until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in .env. */
  get configured(): boolean {
    return this.clientId !== '' && (this.config.get<string>('GOOGLE_CLIENT_SECRET') ?? '') !== '';
  }

  get redirectUri(): string {
    return this.config.get<string>('GMAIL_REDIRECT_URI') || 'http://localhost:3000/gmail/callback';
  }

  authUrl(state: string): string {
    const query = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      // offline + consent: Google must hand out a refresh token so we can check mail later.
      access_type: 'offline',
      prompt: 'consent select_account',
      state,
    });
    return `${AUTH_URL}?${query.toString()}`;
  }

  /** Trades the one-time code from the sign-in for tokens, and reads which address signed in. */
  async exchangeCode(code: string): Promise<{ email: string; refreshToken: string | null }> {
    const tokens = await this.token({ grant_type: 'authorization_code', code });
    if (!tokens.access_token) throw new Error('Google sent no access token');
    const reply = await fetch(USERINFO_URL, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    const info = (await reply.json()) as { email?: string };
    if (!reply.ok || !info.email) throw new Error('Google did not say which account signed in');
    return { email: info.email, refreshToken: tokens.refresh_token ?? null };
  }

  async accessToken(refreshToken: string): Promise<string> {
    const tokens = await this.token({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    if (!tokens.access_token) throw new Error('Google sent no access token');
    return tokens.access_token;
  }

  /** Mail that came in over the last `days` days, not sent by you, newest first. */
  async recentMail(accessToken: string, days: number, max: number): Promise<MailMessage[]> {
    const query = `newer_than:${days}d -in:sent -in:drafts -in:spam -category:promotions -category:social`;
    const list = await this.get<ListReply>(
      accessToken,
      `/messages?${new URLSearchParams({ q: query, maxResults: String(max) }).toString()}`,
    );
    const ids = (list.messages ?? []).map((message) => message.id);
    const found: MailMessage[] = [];
    // A few at a time: polite to Google, and fast enough for a few dozen mails.
    for (let i = 0; i < ids.length; i += 5) {
      const batch = await Promise.all(
        ids.slice(i, i + 5).map((id) => this.message(accessToken, id)),
      );
      found.push(...batch);
    }
    return found;
  }

  /** Tells Google to forget the access. Best effort: the account is removed here either way. */
  async revoke(refreshToken: string): Promise<void> {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
      signal: AbortSignal.timeout(10_000),
    });
  }

  private async message(accessToken: string, id: string): Promise<MailMessage> {
    const path = `/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`;
    const reply = await this.get<MessageReply>(accessToken, path);
    const header = (name: string) =>
      reply.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? '';
    return {
      id: reply.id,
      from: header('from'),
      subject: header('subject'),
      snippet: reply.snippet ?? '',
      receivedAt: new Date(Number(reply.internalDate ?? Date.now())),
    };
  }

  private async get<T>(accessToken: string, path: string): Promise<T> {
    const reply = await fetch(`${GMAIL_URL}${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!reply.ok) throw new Error(`Gmail answered ${reply.status}`);
    return (await reply.json()) as T;
  }

  private async token(fields: Record<string, string>): Promise<TokenReply> {
    const reply = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.config.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
        redirect_uri: this.redirectUri,
        ...fields,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await reply.json()) as TokenReply;
    if (body.error === 'invalid_grant') throw new AccessRevokedError('Access was revoked');
    if (!reply.ok) throw new Error(`Google answered ${reply.status}`);
    return body;
  }
}
