import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { DocumentsModule } from '../documents/documents.module';
import { InsightsModule } from '../insights/insights.module';
import { ResumeBuilderController } from './resume-builder.controller';
import { ResumeBuilderResolver } from './resume-builder.resolver';
import { ResumeBuilderService } from './resume-builder.service';

/** The Resume builder: your master resume section by section, with a live PDF preview. */
@Module({
  imports: [ApiKeysModule, DocumentsModule, InsightsModule],
  controllers: [ResumeBuilderController],
  providers: [ResumeBuilderService, ResumeBuilderResolver],
})
export class ResumeBuilderModule {}
