import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '../generated/prisma/client';
import type { SessionUser } from './auth.decorators';
import { IS_PUBLIC, requestOf, ROLES } from './auth.decorators';
import { SESSION_COOKIE } from './session';

/**
 * Runs before every resolver and controller (registered as APP_GUARD). Reads the session
 * cookie, then lets the call through when it is public, or when the caller is logged in and
 * has one of the required roles.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = requestOf(context);
    req.user = await this.readSession(req.cookies[SESSION_COOKIE] as string | undefined);

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    if (!req.user) throw new UnauthorizedException('Please log in');

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(req.user.role)) {
      throw new ForbiddenException('Only the admin can do this');
    }
    return true;
  }

  /** A missing, expired or tampered cookie just means "not logged in". */
  private async readSession(token: string | undefined): Promise<SessionUser | undefined> {
    if (!token) return undefined;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: number; role: Role }>(token);
      return { id: payload.sub, role: payload.role };
    } catch {
      return undefined;
    }
  }
}
