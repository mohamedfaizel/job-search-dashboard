import { Module } from '@nestjs/common';
import { JobMatchService } from './job-match.service';
import { ResumeMatcherClient } from './resume-matcher.client';
import { ResumeMatcherResolver } from './resume-matcher.resolver';
import { ResumeMatcherService } from './resume-matcher.service';
import { ResumeSyncService } from './resume-sync.service';

@Module({
  providers: [
    ResumeMatcherClient,
    ResumeMatcherService,
    ResumeSyncService,
    JobMatchService,
    ResumeMatcherResolver,
  ],
  // Later PRs (resume sync, job matching) use the client from their own modules.
  exports: [ResumeMatcherClient],
})
export class ResumeMatcherModule {}
