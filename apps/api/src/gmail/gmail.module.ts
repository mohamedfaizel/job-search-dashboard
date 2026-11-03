import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { GmailClient } from './gmail.client';
import { GmailController } from './gmail.controller';
import { GmailResolver } from './gmail.resolver';
import { GmailService } from './gmail.service';

/** Connect Gmail accounts (read-only) and turn employer replies into tracker suggestions. */
@Module({
  imports: [JobsModule],
  controllers: [GmailController],
  providers: [GmailClient, GmailService, GmailResolver],
})
export class GmailModule {}
