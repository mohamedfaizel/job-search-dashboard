import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { http, HttpResponse } from 'msw';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { TEST_DATABASE_URL } from './env';

export interface GqlResult<T> {
  data?: T;
  errors?: { message: string; extensions?: Record<string, unknown> }[];
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
    STILL_OPEN_CHECK_ENABLED: 'false',
    // No PDF renderer unless a test brings its own fake one: downloads are plain PDFs.
    PDF_RENDERER_URL: '',
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

/** Rows for the users behind the minted sessions (1 = admin, 2 = user), for tables that link to them. */
export async function seedTestUsers(prisma: PrismaService): Promise<void> {
  await prisma.user.createMany({
    data: [
      { id: 1, email: 'admin@example.com', name: 'Admin', passwordHash: 'x', role: 'ADMIN' },
      { id: 2, email: 'user@example.com', name: 'User', passwordHash: 'x' },
    ],
  });
}

/**
 * Fake Resume-Matcher settings endpoints: the AI queue puts the user's key and model in before
 * each AI run and takes the key out after. `log` records each change, in order.
 */
export function rmConfigHandlers(rmUrl: string, log: string[] = []) {
  return [
    http.post(`${rmUrl}/api/v1/config/api-keys`, async ({ request }) => {
      log.push(`keys ${JSON.stringify(await request.json())}`);
      return HttpResponse.json({ message: 'ok', updated_providers: [] });
    }),
    http.put(`${rmUrl}/api/v1/config/llm-api-key`, async ({ request }) => {
      const body = (await request.json()) as { provider: string; model: string };
      log.push(`llm ${body.provider} ${body.model}`);
      return HttpResponse.json({ provider: body.provider, model: body.model, api_key: '…' });
    }),
  ];
}

/** Saves a Claude key in Settings, which every Resume-Matcher AI run needs. */
export async function saveAiKey(gql: Gql, value = 'sk-ant-test-key'): Promise<void> {
  const res = await gql(
    `mutation ($value: String!) { saveApiKey(input: { kind: ANTHROPIC, value: $value }) { kind } }`,
    { value },
  );
  if (res.errors) throw new Error(res.errors[0]?.message);
}

/**
 * Puts every saved job on this user's Job posts list, as if they had imported the same jobs too.
 * Each user sees only their own list, so tests where two users act on one job need this.
 */
export async function listAllJobsFor(prisma: PrismaService, userId: number): Promise<void> {
  const jobs = await prisma.job.findMany({ select: { id: true } });
  await prisma.userJob.createMany({
    data: jobs.map((job) => ({ userId, jobId: job.id })),
    skipDuplicates: true,
  });
}
