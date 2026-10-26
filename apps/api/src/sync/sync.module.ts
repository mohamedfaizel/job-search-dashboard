import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { JobsPipeModule } from '../jobspipe/jobspipe.module';
import { SyncResolver } from './sync.resolver';
import { SyncService } from './sync.service';

@Module({
  imports: [JobsModule, JobsPipeModule],
  providers: [SyncService, SyncResolver],
  exports: [SyncService],
})
export class SyncModule {}
