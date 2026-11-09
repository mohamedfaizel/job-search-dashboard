import { UnauthorizedException } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import { apiError } from '../common/api-error';
import { AttemptLimiter } from './attempt-limiter';
import type { SessionUser } from './auth.decorators';
import { CurrentUser, Public } from './auth.decorators';
import { LogInInput, SignUpInput, UserModel } from './auth.model';
import { AuthService, toUserModel } from './auth.service';
import { SESSION_COOKIE, sessionCookieOptions } from './session';

interface GqlContext {
  req?: Request;
  res: Response;
}

const MINUTE = 60_000;
/** Tests sign up and log in many times from one address, so the limits are off there. */
const limitsOn = process.env['NODE_ENV'] !== 'test';
// One address may try one email 10 times, and any emails 50 times, in 15 minutes.
const loginTries = new AttemptLimiter(10, 15 * MINUTE);
const addressTries = new AttemptLimiter(50, 15 * MINUTE);
// One address may make 10 accounts an hour.
const signUpTries = new AttemptLimiter(10, 60 * MINUTE);

/** The caller's address. Behind a proxy (Caddy, nginx), set Express "trust proxy" so this is real. */
const addressOf = (ctx: GqlContext) => ctx.req?.ip ?? 'unknown';

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
    if (limitsOn) signUpTries.hit(addressOf(ctx));
    const user = await this.auth.signUp(input);
    ctx.res.cookie(SESSION_COOKIE, await this.auth.sessionToken(user), sessionCookieOptions());
    return toUserModel(user);
  }

  @Mutation(() => UserModel)
  async logIn(@Args('input') input: LogInInput, @Context() ctx: GqlContext): Promise<UserModel> {
    const key = `${addressOf(ctx)}|${input.email.trim().toLowerCase()}`;
    if (limitsOn) {
      addressTries.hit(addressOf(ctx));
      loginTries.hit(key);
    }
    const user = await this.auth.logIn(input);
    loginTries.reset(key);
    ctx.res.cookie(SESSION_COOKIE, await this.auth.sessionToken(user), sessionCookieOptions());
    return toUserModel(user);
  }

  @Mutation(() => UserModel, { description: 'Show the app in this language: "en" or "de"' })
  async setLocale(
    @CurrentUser() session: SessionUser | undefined,
    @Args('locale') locale: string,
  ): Promise<UserModel> {
    if (!session) throw apiError(UnauthorizedException, 'LOGIN_REQUIRED', 'Please log in');
    return toUserModel(await this.auth.setLocale(session.id, locale));
  }

  @Mutation(() => Boolean)
  logOut(@Context() ctx: GqlContext): boolean {
    // Same options as when it was set (minus its lifetime), or the browser keeps it.
    const { httpOnly, sameSite, secure, path } = sessionCookieOptions();
    ctx.res.clearCookie(SESSION_COOKIE, { httpOnly, sameSite, secure, path });
    return true;
  }
}
