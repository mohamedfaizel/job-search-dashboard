import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { ArbeitsagenturSyncService } from './arbeitsagentur-sync.service';
import { ArbeitsagenturClient } from './arbeitsagentur.client';

/** The Federal Employment Agency's free job board, as a second place to import jobs from. */
@Module({
  imports: [JobsModule],
  providers: [ArbeitsagenturClient, ArbeitsagenturSyncService],
  exports: [ArbeitsagenturSyncService],
})
export class ArbeitsagenturModule {}
