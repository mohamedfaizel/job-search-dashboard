import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PUSH_TIMEOUT_MS = 15_000;

export interface PushMessage {
  title: string;
  body: string;
  /** Where tapping the message goes in the phone app, e.g. "/alerts". */
  url: string;
}

interface ExpoTicket {
  status?: 'ok' | 'error';
  details?: { error?: string };
}

/** Only real Expo push tokens are kept: anything else would be sent to Expo for nothing. */
export const isPushToken = (token: string): boolean =>
  /^(ExponentPushToken|ExpoPushToken)\[[^\]]{1,200}\]$/.test(token);

/**
 * Push messages to the phone app through Expo's free push service, so they reach the lock screen
 * even when the app is closed. Phones register their token after login.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Links this phone to the user (a phone used by someone else before moves over). */
  async register(userId: number, token: string): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token },
      update: { userId },
    });
  }

  /** Logging out on the phone: it gets no more pushes for this user. */
  async unregister(userId: number, token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
  }

  /** Sends one message to each of the user's phones. Returns how many took it. Never throws. */
  async send(userId: number, message: PushMessage): Promise<number> {
    const rows = await this.prisma.pushToken.findMany({ where: { userId } });
    if (rows.length === 0) return 0;
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(
          rows.map((row) => ({
            to: row.token,
            title: message.title,
            body: message.body,
            data: { url: message.url },
            sound: 'default',
            channelId: 'alerts',
          })),
        ),
        signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push answered ${String(res.status)}`);
        return 0;
      }
      const body = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
      const tickets = body?.data ?? [];
      // A phone that uninstalled the app: forget its token.
      const gone = rows.filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered');
      if (gone.length) {
        await this.prisma.pushToken.deleteMany({ where: { id: { in: gone.map((r) => r.id) } } });
      }
      return tickets.filter((ticket) => ticket.status === 'ok').length;
    } catch (error) {
      this.logger.warn(`Could not send a push: ${getErrorMessage(error)}`);
      return 0;
    }
  }
}
