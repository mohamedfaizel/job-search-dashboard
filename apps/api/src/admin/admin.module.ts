import { Module } from '@nestjs/common';
import { PdfRendererClient } from '../documents/pdf-renderer.client';
import { GmailClient } from '../gmail/gmail.client';
import { ResumeMatcherClient } from '../resume-matcher/resume-matcher.client';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';
import { OverviewService } from './overview.service';

/** Admin pages: overview and server health, and managing accounts. */
@Module({
  // The clients only read .env, so the overview checks the same addresses the app uses.
  providers: [
    AdminService,
    AdminResolver,
    OverviewService,
    PdfRendererClient,
    ResumeMatcherClient,
    GmailClient,
  ],
})
export class AdminModule {}
