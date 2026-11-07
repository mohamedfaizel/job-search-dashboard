import { Module } from '@nestjs/common';
import { ArbeitsagenturModule } from '../arbeitsagentur/arbeitsagentur.module';
import { CompanyBoardsModule } from '../company-boards/company-boards.module';
import { JobHunterModule } from '../jobhunter/jobhunter.module';
import { JobsModule } from '../jobs/jobs.module';
import { SyncResolver } from './sync.resolver';
import { SyncService } from './sync.service';

@Module({
  imports: [JobsModule, JobHunterModule, ArbeitsagenturModule, CompanyBoardsModule],
  providers: [SyncService, SyncResolver],
  exports: [SyncService],
})
export class SyncModule {}
