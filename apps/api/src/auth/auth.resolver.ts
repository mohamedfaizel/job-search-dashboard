import { UnauthorizedException } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import { apiError } from '../common/api-error';
import { KeyPoolService } from '../key-pool/key-pool.service';
import { AuthLimits } from './attempt-limiter';
import type { SessionUser } from './auth.decorators';
import { CurrentUser, Public } from './auth.decorators';
import { LogInInput, SignUpInput, SignupState, UserModel } from './auth.model';
import { AuthService, toUserModel } from './auth.service';
import { SESSION_COOKIE, sessionCookieOptions } from './session';

interface GqlContext {
  req?: Request;
  res: Response;
}

const limits = new AuthLimits(process.env['NODE_ENV'] !== 'test');

/** The caller's address. Behind a proxy (Caddy, nginx), set Express "trust proxy" so this is real. */
const addressOf = (ctx: GqlContext) => ctx.req?.ip ?? 'unknown';

@Public()
@Resolver(() => UserModel)
export class AuthResolver {
  constructor(
    private readonly auth: AuthService,
    private readonly keyPool: KeyPoolService,
  ) {}

  @Query(() => UserModel, { nullable: true, description: 'Who is logged in, or null' })
  async me(@CurrentUser() session: SessionUser | undefined): Promise<UserModel | null> {
    if (!session) return null;
    const user = await this.auth.findById(session.id);
    return user ? toUserModel(user) : null;
  }

  @Query(() => SignupState, {
    description: 'Whether the sign-up page can make an account, with this invite code or none',
  })
  signupState(
    @Args('invite', { type: () => String, nullable: true }) invite?: string | null,
  ): Promise<SignupState> {
    return this.auth.signupState(invite);
  }

  @Mutation(() => UserModel, { description: 'Create an account and log in' })
  async signUp(@Args('input') input: SignUpInput, @Context() ctx: GqlContext): Promise<UserModel> {
    limits.signUp(addressOf(ctx));
    const user = await this.auth.signUp(input);
    // A new account gets a JobHunter key from the Key pool at once, when one is free.
    await this.keyPool.assignOnSignup(user.id);
    ctx.res.cookie(SESSION_COOKIE, await this.auth.sessionToken(user), sessionCookieOptions());
    return toUserModel(user);
  }

  @Mutation(() => UserModel)
  async logIn(@Args('input') input: LogInInput, @Context() ctx: GqlContext): Promise<UserModel> {
    const key = limits.logIn(addressOf(ctx), input.email);
    const user = await this.auth.logIn(input);
    limits.loggedIn(key);
    ctx.res.cookie(SESSION_COOKIE, await this.auth.sessionToken(user), sessionCookieOptions());
    return toUserModel(user);
  }

  @Mutation(() => UserModel, { description: 'The first-login steps are done (or skipped)' })
  async finishOnboarding(@CurrentUser() session: SessionUser | undefined): Promise<UserModel> {
    if (!session) throw apiError(UnauthorizedException, 'LOGIN_REQUIRED', 'Please log in');
    return toUserModel(await this.auth.finishOnboarding(session.id));
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
