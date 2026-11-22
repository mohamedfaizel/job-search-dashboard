import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { apiError } from '../common/api-error';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminConversationModel, MessageModel, MyMessagesModel } from './message.model';
import { MAX_BODY, MessageTopic } from './message.model';

/** How many messages a user can send in an hour, so one account cannot flood the admins. */
export const PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

const SELECT = {
  id: true,
  fromAdmin: true,
  authorName: true,
  topic: true,
  body: true,
  createdAt: true,
} as const;

function toModel(row: {
  id: number;
  fromAdmin: boolean;
  authorName: string;
  topic: string | null;
  body: string;
  createdAt: Date;
}): MessageModel {
  const topic = Object.values(MessageTopic).find((t) => t === row.topic) ?? null;
  return {
    id: row.id,
    fromAdmin: row.fromAdmin,
    authorName: row.authorName,
    topic,
    body: row.body,
    createdAt: row.createdAt,
  };
}

function cleanBody(body: string): string {
  const text = body.trim();
  if (!text || text.length > MAX_BODY) {
    throw apiError(
      BadRequestException,
      'MESSAGE_LENGTH',
      `A message is 1 to ${String(MAX_BODY)} characters`,
      { max: MAX_BODY },
    );
  }
  return text;
}

/**
 * Message Mohamed Faizel: each user has one conversation with the admins. Users write with a
 * topic; any admin can read it and answer, and the answer rings the user's bell.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async mine(userId: number): Promise<MyMessagesModel> {
    const [rows, unread] = await Promise.all([
      this.prisma.message.findMany({ where: { userId }, orderBy: { id: 'asc' }, select: SELECT }),
      this.prisma.message.count({ where: { userId, fromAdmin: true, readByUserAt: null } }),
    ]);
    return { items: rows.map(toModel), unread };
  }

  async send(userId: number, topic: MessageTopic, body: string): Promise<MessageModel> {
    const text = cleanBody(body);
    const recent = await this.prisma.message.count({
      where: { userId, fromAdmin: false, createdAt: { gt: new Date(Date.now() - HOUR_MS) } },
    });
    if (recent >= PER_HOUR) {
      throw apiError(
        TooManyMessages,
        'MESSAGE_LIMIT',
        `You can send ${String(PER_HOUR)} messages an hour. Try again later.`,
        { max: PER_HOUR },
      );
    }
    const row = await this.prisma.message.create({
      data: { userId, topic, body: text },
      select: SELECT,
    });
    return toModel(row);
  }

  /** You opened the window: the answers in it are read. Returns how many were unread. */
  async markMineRead(userId: number): Promise<number> {
    const { count } = await this.prisma.message.updateMany({
      where: { userId, fromAdmin: true, readByUserAt: null },
      data: { readByUserAt: new Date() },
    });
    return count;
  }

  /** Every conversation, the ones waiting for an answer first, then newest first. */
  async conversations(): Promise<AdminConversationModel[]> {
    const [latest, unread] = await Promise.all([
      this.prisma.message.findMany({
        distinct: ['userId'],
        orderBy: [{ userId: 'asc' }, { id: 'desc' }],
        select: {
          userId: true,
          body: true,
          fromAdmin: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
      this.prisma.message.groupBy({
        by: ['userId'],
        where: { fromAdmin: false, readByAdminAt: null },
        _count: { _all: true },
      }),
    ]);
    const unreadBy = new Map(unread.map((u) => [u.userId, u._count._all]));
    return latest
      .map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        lastBody: m.body,
        lastFromAdmin: m.fromAdmin,
        lastAt: m.createdAt,
        unread: unreadBy.get(m.userId) ?? 0,
      }))
      .sort(
        (a, b) =>
          Number(b.unread > 0) - Number(a.unread > 0) || b.lastAt.getTime() - a.lastAt.getTime(),
      );
  }

  /** One user's conversation, oldest first. Opening it marks their messages read. */
  async conversation(userId: number): Promise<MessageModel[]> {
    const rows = await this.prisma.message.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
      select: SELECT,
    });
    if (rows.length === 0) throw notFound(userId);
    await this.prisma.message.updateMany({
      where: { userId, fromAdmin: false, readByAdminAt: null },
      data: { readByAdminAt: new Date() },
    });
    return rows.map(toModel);
  }

  /** An admin answers a user. The answer rings the user's bell. */
  async reply(adminId: number, userId: number, body: string): Promise<MessageModel> {
    const text = cleanBody(body);
    const [admin, wrote] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: adminId }, select: { name: true } }),
      this.prisma.message.count({ where: { userId, fromAdmin: false } }),
    ]);
    // Admins answer; they do not start conversations with users who never wrote.
    if (wrote === 0) throw notFound(userId);
    const now = new Date();
    const [row] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { userId, fromAdmin: true, authorName: admin?.name ?? '', body: text },
        select: SELECT,
      }),
      // Answering means you read everything before it.
      this.prisma.message.updateMany({
        where: { userId, fromAdmin: false, readByAdminAt: null },
        data: { readByAdminAt: now },
      }),
    ]);
    await this.notifications.messageReply(userId, row.authorName);
    return toModel(row);
  }
}

function notFound(userId: number) {
  return apiError(
    NotFoundException,
    'CONVERSATION_NOT_FOUND',
    `No messages from user ${String(userId)}`,
  );
}

class TooManyMessages extends HttpException {
  constructor(body: object) {
    super(body, HttpStatus.TOO_MANY_REQUESTS);
  }
}
