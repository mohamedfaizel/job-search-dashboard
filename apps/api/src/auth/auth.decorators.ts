import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator, SetMetadata } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import type { Role } from '../generated/prisma/client';

/** What the session cookie says about who is calling. */
export interface SessionUser {
  id: number;
  role: Role;
}

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Anyone can call this, logged in or not (login, sign-up, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Only these roles can call this, e.g. `@Roles('ADMIN')` on everything that spends credits. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** The underlying HTTP request, for GraphQL resolvers and REST controllers alike. */
export function requestOf(context: ExecutionContext): Request & { user?: SessionUser | undefined } {
  if (context.getType<string>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<{ req: Request }>().req;
  }
  return context.switchToHttp().getRequest<Request>();
}

/** The logged-in user in a resolver: `me(@CurrentUser() user: SessionUser | undefined)`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => requestOf(context).user,
);
