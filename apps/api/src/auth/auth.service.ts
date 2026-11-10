import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { apiError } from '../common/api-error';
import type { SignupMode, User } from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { LogInInput, SignUpInput, UserModel } from './auth.model';
import { LOCALES, SignupState } from './auth.model';
import { SESSION_DAYS } from './session';

/** A real hash to compare against when the email is unknown, so both cases take as long. */
const DUMMY_HASH = hash('not-a-real-password');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Can someone make an account now, with this invite code (or none)? Admin › Sign-up & access
   * sets the mode. The very first account is always allowed: it becomes the admin.
   */
  async signupState(invite?: string | null): Promise<SignupState> {
    if ((await this.prisma.user.count()) === 0) return SignupState.OPEN;
    const { signupMode } = await this.settings.get();
    if (signupMode === 'OPEN') return SignupState.OPEN;
    if (signupMode === 'CLOSED') return SignupState.CLOSED;
    if (!invite) return SignupState.NEEDS_INVITE;
    return (await this.settings.usableInvite(invite))
      ? SignupState.INVITED
      : SignupState.INVITE_INVALID;
  }

  async signUp(input: SignUpInput): Promise<User> {
    const { signupMode } = await this.settings.get();
    const passwordHash = await hash(input.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // The very first account runs the place, whatever the sign-up mode says.
        const first = (await tx.user.count()) === 0;
        if (!first) await this.letIn(tx, signupMode, input.invite);
        return tx.user.create({
          data: {
            email: input.email,
            name: input.name,
            passwordHash,
            role: first ? 'ADMIN' : 'USER',
            ...(input.locale ? { locale: input.locale } : {}),
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw apiError(
          BadRequestException,
          'EMAIL_TAKEN',
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  /** Throws unless the mode (and, when invite only, the invite) lets a new account in. */
  private async letIn(
    tx: Prisma.TransactionClient,
    mode: SignupMode,
    invite: string | null | undefined,
  ): Promise<void> {
    if (mode === 'CLOSED') {
      throw apiError(ForbiddenException, 'SIGNUP_CLOSED', 'Sign-up is closed on this server');
    }
    // While sign-up is open, an invite link still counts its use, but it isn't needed.
    const took = invite ? await this.settings.takeInvite(tx, invite) : false;
    if (mode === 'OPEN' || took) return;
    if (!invite) {
      throw apiError(ForbiddenException, 'INVITE_NEEDED', 'Sign-up needs an invite link');
    }
    throw apiError(
      ForbiddenException,
      'INVITE_INVALID',
      'This invite link has expired, was used up or was canceled',
    );
  }

  async logIn(input: LogInInput): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Same message and similar timing whether the email or the password is wrong, so the
    // login form can't be used to find out who has an account.
    const ok = await verify(user?.passwordHash ?? (await DUMMY_HASH), input.password);
    if (!user || !ok)
      throw apiError(UnauthorizedException, 'WRONG_LOGIN', 'Wrong email or password');
    // Only after the password was right, so this doesn't tell strangers who has an account.
    if (user.disabledAt) {
      throw apiError(ForbiddenException, 'ACCOUNT_DISABLED', 'This account is switched off');
    }
    return user;
  }

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Saves the language you picked, so the app shows it on every device. */
  /** Marks the first-login steps done (finished or skipped), so they don't show again. */
  finishOnboarding(id: number): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { onboardedAt: new Date() } });
  }

  setLocale(id: number, locale: string): Promise<User> {
    if (!(LOCALES as readonly string[]).includes(locale)) {
      throw apiError(BadRequestException, 'LOCALE_UNKNOWN', `Pick one of: ${LOCALES.join(', ')}`);
    }
    return this.prisma.user.update({ where: { id }, data: { locale } });
  }

  /** The signed token that goes in the session cookie. */
  sessionToken(user: Pick<User, 'id' | 'role'>): Promise<string> {
    return this.jwt.signAsync({ sub: user.id, role: user.role }, { expiresIn: `${SESSION_DAYS}d` });
  }
}

export function toUserModel(user: User): UserModel {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    locale: user.locale,
    aiProvider: user.aiProvider,
    onboarded: user.onboardedAt !== null,
  };
}
