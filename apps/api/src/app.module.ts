import { join } from 'node:path';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloDriver } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { PrismaModule } from './prisma/prisma.module';
import { SavedSearchesModule } from './saved-searches/saved-searches.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    // Reads the repo-root .env so every app shares one config file.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Code-first: the schema is generated from the TypeScript classes. In tests it stays in
      // memory; otherwise it is written to schema.gql so you can read the whole API in one file.
      autoSchemaFile: process.env['NODE_ENV'] === 'test' ? true : join(process.cwd(), 'schema.gql'),
      sortSchema: true,
      // Resolvers get the request (to read the session cookie) and response (to set it).
      context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
    }),
    // Runs @Cron jobs, like the saved-search scheduler.
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    HealthModule,
    JobsModule,
    SyncModule,
    SavedSearchesModule,
  ],
})
export class AppModule {}
