import { Module } from '@nestjs/common';
import { JobsResolver } from './jobs.resolver';
import { JobsService } from './jobs.service';

@Module({
  providers: [JobsService, JobsResolver],
  exports: [JobsService],
})
export class JobsModule {}
