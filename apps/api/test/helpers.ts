import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { TEST_DATABASE_URL } from './env';

export interface GqlResult<T> {
  data?: T;
  errors?: { message: string }[];
}

type Gql = <T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
) => Promise<GqlResult<T>>;

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  server: Server;
  /** Calls GraphQL as the admin, so feature tests don't have to log in first. */
  gql: Gql;
  /** Calls GraphQL with no session cookie. */
  anonymous: Gql;
  /** Calls GraphQL as a regular (non-admin) user. */
  asUser: Gql;
  /** A `Cookie` header value for the admin (user 1) or the regular user (user 2), for REST calls. */
  cookieFor: (role: 'ADMIN' | 'USER') => string;
}

/** Boots the whole API (same modules as production) against the test database. */
export async function createTestApp(env: Record<string, string> = {}): Promise<TestApp> {
  // Set before the app boots; ConfigModule never overrides variables that already exist.
  Object.assign(process.env, {
    DATABASE_URL: TEST_DATABASE_URL,
    // Tests call the scheduler directly instead of waiting for its cron.
    SCHEDULER_ENABLED: 'false',
    ...env,
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const server = app.getHttpServer() as Server;
  // Sessions are signed tokens, so tests can mint one without a user row in the database.
  const jwt = app.get(JwtService);
  const cookieFor = (role: 'ADMIN' | 'USER') =>
    `session=${jwt.sign({ sub: role === 'ADMIN' ? 1 : 2, role })}`;

  const caller =
    (cookie?: string): Gql =>
    async <T>(query: string, variables?: Record<string, unknown>) => {
      const req = request(server).post('/graphql');
      if (cookie) void req.set('Cookie', cookie);
      const res = await req.send({ query, variables });
      return res.body as GqlResult<T>;
    };

  return {
    app,
    prisma,
    server,
    gql: caller(cookieFor('ADMIN')),
    anonymous: caller(),
    asUser: caller(cookieFor('USER')),
    cookieFor,
  };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Job", "Company", "SyncRun", "SavedSearch", "User" RESTART IDENTITY CASCADE',
  );
}
