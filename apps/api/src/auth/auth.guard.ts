import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { apiError } from '../common/api-error';
import type { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SessionUser } from './auth.decorators';
import { IS_PUBLIC, requestOf, ROLES } from './auth.decorators';
import { SESSION_COOKIE } from './session';

/** How often "last seen" is written for one user: once per few minutes is enough. */
const LAST_SEEN_EVERY_MS = 5 * 60 * 1000;

/**
 * Runs before every resolver and controller (registered as APP_GUARD). Reads the session
 * cookie, then lets the call through when it is public, or when the caller is logged in and
 * has one of the required roles.
 *
 * The cookie only says who you are. Your role and whether you may log in come from the
 * database on every call, so an admin's change (make admin, disable, delete) works at once,
 * not when the 7-day cookie runs out.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = requestOf(context);
    req.user = await this.readSession(req.cookies[SESSION_COOKIE] as string | undefined);

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    if (!req.user) throw apiError(UnauthorizedException, 'LOGIN_REQUIRED', 'Please log in');

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(req.user.role)) {
      throw apiError(ForbiddenException, 'ADMIN_ONLY', 'Only the admin can do this');
    }
    return true;
  }

  /**
   * A missing, expired or tampered cookie just means "not logged in", and so does the cookie of
   * an account that was deleted or disabled.
   */
  private async readSession(token: string | undefined): Promise<SessionUser | undefined> {
    if (!token) return undefined;
    let id: number;
    try {
      id = (await this.jwt.verifyAsync<{ sub: number }>(token)).sub;
    } catch {
      return undefined;
    }
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, disabledAt: true, lastSeenAt: true },
    });
    if (!user || user.disabledAt) return undefined;
    await this.markSeen(id, user.lastSeenAt);
    return { id, role: user.role };
  }

  /** Writes "last seen", at most every few minutes; a failed write never fails the call. */
  private async markSeen(id: number, lastSeenAt: Date | null): Promise<void> {
    const now = Date.now();
    if (lastSeenAt && now - lastSeenAt.getTime() < LAST_SEEN_EVERY_MS) return;
    await this.prisma.user
      .update({ where: { id }, data: { lastSeenAt: new Date(now) } })
      .catch(() => undefined);
  }
}
