import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Response } from 'express';
import type { SessionUser } from './auth.decorators';
import { CurrentUser, Public } from './auth.decorators';
import { LogInInput, SignUpInput, UserModel } from './auth.model';
import { AuthService, toUserModel } from './auth.service';
import { SESSION_COOKIE, sessionCookieOptions } from './session';

interface GqlContext {
  res: Response;
}

@Public()
@Resolver(() => UserModel)
export class AuthResolver {
  constructor(private readonly auth: AuthService) {}

  @Query(() => UserModel, { nullable: true, description: 'Who is logged in, or null' })
  async me(@CurrentUser() session: SessionUser | undefined): Promise<UserModel | null> {
    if (!session) return null;
    const user = await this.auth.findById(session.id);
    return user ? toUserModel(user) : null;
  }

  @Mutation(() => UserModel, { description: 'Create an account and log in' })
  async signUp(@Args('input') input: SignUpInput, @Context() ctx: GqlContext): Promise<UserModel> {
    const user = await this.auth.signUp(input);
    ctx.res.cookie(SESSION_COOKIE, await this.auth.sessionToken(user), sessionCookieOptions());
    return toUserModel(user);
  }

  @Mutation(() => UserModel)
  async logIn(@Args('input') input: LogInInput, @Context() ctx: GqlContext): Promise<UserModel> {
    const user = await this.auth.logIn(input);
    ctx.res.cookie(SESSION_COOKIE, await this.auth.sessionToken(user), sessionCookieOptions());
    return toUserModel(user);
  }

  @Mutation(() => Boolean)
  logOut(@Context() ctx: GqlContext): boolean {
    // Same options as when it was set (minus its lifetime), or the browser keeps it.
    const { httpOnly, sameSite, secure, path } = sessionCookieOptions();
    ctx.res.clearCookie(SESSION_COOKIE, { httpOnly, sameSite, secure, path });
    return true;
  }
}
