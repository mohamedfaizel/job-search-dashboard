import { Module } from '@nestjs/common';
import { ResumeMatcherClient } from './resume-matcher.client';
import { ResumeMatcherResolver } from './resume-matcher.resolver';
import { ResumeMatcherService } from './resume-matcher.service';

@Module({
  providers: [ResumeMatcherClient, ResumeMatcherService, ResumeMatcherResolver],
  // Later PRs (resume sync, job matching) use the client from their own modules.
  exports: [ResumeMatcherClient],
})
export class ResumeMatcherModule {}
