import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { TEST_DATABASE_URL } from './env';

export interface GqlResult<T> {
  data?: T;
  errors?: { message: string }[];
}

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  gql: <T = Record<string, unknown>>(
    query: string,
    variables?: Record<string, unknown>,
  ) => Promise<GqlResult<T>>;
}

/** Boots the whole API (same modules as production) against the test database. */
export async function createTestApp(env: Record<string, string> = {}): Promise<TestApp> {
  // Set before the app boots; ConfigModule never overrides variables that already exist.
  Object.assign(process.env, { DATABASE_URL: TEST_DATABASE_URL, ...env });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.useGlobalPipes(createValidationPipe());
  await app.init();

  const prisma = app.get(PrismaService);
  const server = app.getHttpServer() as Server;

  async function gql<T>(query: string, variables?: Record<string, unknown>) {
    const res = await request(server).post('/graphql').send({ query, variables });
    return res.body as GqlResult<T>;
  }

  return { app, prisma, gql };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE "Job", "Company", "SyncRun" RESTART IDENTITY CASCADE');
}
