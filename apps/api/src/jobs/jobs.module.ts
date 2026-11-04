import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module';
import { JobsResolver } from './jobs.resolver';
import { JobsService } from './jobs.service';
import { TableSettingsResolver } from './table-settings.resolver';

@Module({
  imports: [InsightsModule],
  providers: [JobsService, JobsResolver, TableSettingsResolver],
  exports: [JobsService],
})
export class JobsModule {}
