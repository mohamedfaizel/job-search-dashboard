import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { LivenessResolver } from './liveness.resolver';
import { LivenessService } from './liveness.service';
import { PageFetcher } from './page-fetcher';

/** The "Is it still open?" check: on demand from the popup, and every night. */
@Module({
  imports: [JobsModule],
  providers: [PageFetcher, LivenessService, LivenessResolver],
  exports: [LivenessService],
})
export class LivenessModule {}
