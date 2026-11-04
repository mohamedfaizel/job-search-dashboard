import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { ResumeMatcherModule } from '../resume-matcher/resume-matcher.module';
import { ApplyKitController, ApplyQueueController } from './apply-kit.controller';
import { CorpusService } from './corpus.service';
import { FitService } from './fit.service';
import { InsightsResolver } from './insights.resolver';
import { InsightsService } from './insights.service';
import { JobResumeController } from './job-resume.controller';
import { ReplyMatchService } from './reply-match.service';

/** Job insights without AI: skill tags, TF-IDF keywords, language detection and Fit %. */
@Module({
  imports: [DocumentsModule, ResumeMatcherModule],
  controllers: [JobResumeController, ApplyKitController, ApplyQueueController],
  providers: [InsightsService, InsightsResolver, CorpusService, FitService, ReplyMatchService],
  exports: [FitService],
})
export class InsightsModule {}
