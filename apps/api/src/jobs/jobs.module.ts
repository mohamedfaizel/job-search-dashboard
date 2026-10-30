import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module';
import { JobsResolver } from './jobs.resolver';
import { JobsService } from './jobs.service';

@Module({
  imports: [InsightsModule],
  providers: [JobsService, JobsResolver],
  exports: [JobsService],
})
export class JobsModule {}
