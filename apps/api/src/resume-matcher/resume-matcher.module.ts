import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { JobMatchService } from './job-match.service';
import { ResumeMatcherClient } from './resume-matcher.client';
import { ResumeMatcherResolver } from './resume-matcher.resolver';
import { ResumeMatcherService } from './resume-matcher.service';
import { ResumeSyncService } from './resume-sync.service';
import { RmAiQueue } from './rm-ai-queue';
import { TailorController } from './tailor.controller';
import { TailorService } from './tailor.service';

@Module({
  imports: [ApiKeysModule],
  controllers: [TailorController],
  providers: [
    ResumeMatcherClient,
    RmAiQueue,
    ResumeMatcherService,
    ResumeSyncService,
    JobMatchService,
    TailorService,
    ResumeMatcherResolver,
  ],
  // Other modules (the Apply kit's AI score) call Resume-Matcher too, through the same queue.
  exports: [ResumeMatcherClient, RmAiQueue],
})
export class ResumeMatcherModule {}
