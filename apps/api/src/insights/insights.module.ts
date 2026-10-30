import { Module } from '@nestjs/common';
import { ApplyKitController, ApplyQueueController } from './apply-kit.controller';
import { CorpusService } from './corpus.service';
import { FitService } from './fit.service';
import { InsightsResolver } from './insights.resolver';
import { InsightsService } from './insights.service';
import { JobResumeController } from './job-resume.controller';

/** Job insights without AI: skill tags, TF-IDF keywords, language detection and Fit %. */
@Module({
  controllers: [JobResumeController, ApplyKitController, ApplyQueueController],
  providers: [InsightsService, InsightsResolver, CorpusService, FitService],
  exports: [FitService],
})
export class InsightsModule {}
