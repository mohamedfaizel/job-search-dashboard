import { Module } from '@nestjs/common';
import { ArbeitsagenturModule } from '../arbeitsagentur/arbeitsagentur.module';
import { CompanyBoardsModule } from '../company-boards/company-boards.module';
import { JobsModule } from '../jobs/jobs.module';
import { JobsPipeModule } from '../jobspipe/jobspipe.module';
import { SyncResolver } from './sync.resolver';
import { SyncService } from './sync.service';

@Module({
  imports: [JobsModule, JobsPipeModule, ArbeitsagenturModule, CompanyBoardsModule],
  providers: [SyncService, SyncResolver],
  exports: [SyncService],
})
export class SyncModule {}
