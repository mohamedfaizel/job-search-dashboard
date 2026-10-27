import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import type { User } from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { LogInInput, SignUpInput, UserModel } from './auth.model';
import { SESSION_DAYS } from './session';

/** A real hash to compare against when the email is unknown, so both cases take as long. */
const DUMMY_HASH = hash('not-a-real-password');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signUp(input: SignUpInput): Promise<User> {
    if (this.config.get<string>('ALLOW_SIGNUP') === 'false') {
      throw new ForbiddenException('Sign-up is closed on this server');
    }
    const passwordHash = await hash(input.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // The very first account runs the place: it can import jobs and spend credits.
        const role = (await tx.user.count()) === 0 ? 'ADMIN' : 'USER';
        return tx.user.create({
          data: { email: input.email, name: input.name, passwordHash, role },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('An account with this email already exists');
      }
      throw error;
    }
  }

  async logIn(input: LogInInput): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Same message and similar timing whether the email or the password is wrong, so the
    // login form can't be used to find out who has an account.
    const ok = await verify(user?.passwordHash ?? (await DUMMY_HASH), input.password);
    if (!user || !ok) throw new UnauthorizedException('Wrong email or password');
    return user;
  }

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** The signed token that goes in the session cookie. */
  sessionToken(user: Pick<User, 'id' | 'role'>): Promise<string> {
    return this.jwt.signAsync({ sub: user.id, role: user.role }, { expiresIn: `${SESSION_DAYS}d` });
  }
}

export function toUserModel(user: User): UserModel {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
