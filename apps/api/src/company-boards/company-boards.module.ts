import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { CompanyBoardsSyncService } from './company-boards-sync.service';
import { CompanyBoardsClient } from './company-boards.client';

/** Companies' own career pages (Greenhouse, Lever, Ashby) as a third place to import jobs from. */
@Module({
  imports: [JobsModule],
  providers: [CompanyBoardsClient, CompanyBoardsSyncService],
  exports: [CompanyBoardsSyncService],
})
export class CompanyBoardsModule {}
