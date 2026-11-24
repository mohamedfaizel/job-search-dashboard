import { join } from 'node:path';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloDriver } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AuthModule } from './auth/auth.module';
import { BriefingModule } from './briefing/briefing.module';
import { CalendarModule } from './calendar/calendar.module';
import { withApiError } from './common/api-error';
import { GmailModule } from './gmail/gmail.module';
import { HealthModule } from './health/health.module';
import { InsightsModule } from './insights/insights.module';
import { JobsModule } from './jobs/jobs.module';
import { KeyPoolModule } from './key-pool/key-pool.module';
import { LivenessModule } from './liveness/liveness.module';
import { MessagesModule } from './messages/messages.module';
import { NightlyKitsModule } from './nightly-kits/nightly-kits.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { ResumeBuilderModule } from './resume-builder/resume-builder.module';
import { ResumeMatcherModule } from './resume-matcher/resume-matcher.module';
import { SalaryModule } from './salary/salary.module';
import { SavedAnswersModule } from './saved-answers/saved-answers.module';
import { SavedSearchesModule } from './saved-searches/saved-searches.module';
import { SettingsModule } from './settings/settings.module';
import { StoriesModule } from './stories/stories.module';
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
      // Puts an error's code and values (see common/api-error.ts) where the web app reads them.
      formatError: withApiError,
    }),
    // Runs @Cron jobs, like the saved-search scheduler.
    ScheduleModule.forRoot(),
    PrismaModule,
    SettingsModule,
    ApiKeysModule,
    AuthModule,
    HealthModule,
    JobsModule,
    SyncModule,
    SavedSearchesModule,
    BriefingModule,
    NightlyKitsModule,
    ProfileModule,
    ResumeMatcherModule,
    ResumeBuilderModule,
    InsightsModule,
    LivenessModule,
    NotificationsModule,
    SavedAnswersModule,
    StoriesModule,
    AdminModule,
    KeyPoolModule,
    SalaryModule,
    GmailModule,
    CalendarModule,
    MessagesModule,
  ],
})
export class AppModule {}
