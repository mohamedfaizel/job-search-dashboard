import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ArbeitsagenturModule } from '../arbeitsagentur/arbeitsagentur.module';
import { CompanyBoardsModule } from '../company-boards/company-boards.module';
import { JobHunterModule } from '../jobhunter/jobhunter.module';
import { JobsModule } from '../jobs/jobs.module';
import { KeyPoolModule } from '../key-pool/key-pool.module';
import { SyncResolver } from './sync.resolver';
import { SyncService } from './sync.service';

@Module({
  imports: [
    JobsModule,
    JobHunterModule,
    ApiKeysModule,
    ArbeitsagenturModule,
    CompanyBoardsModule,
    KeyPoolModule,
  ],
  providers: [SyncService, SyncResolver],
  exports: [SyncService],
})
export class SyncModule {}
