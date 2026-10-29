import { Module } from '@nestjs/common';
import { ApplyKitController } from './apply-kit.controller';
import { InsightsResolver } from './insights.resolver';
import { InsightsService } from './insights.service';
import { JobResumeController } from './job-resume.controller';

/** Job insights without AI: skill tags, TF-IDF keywords and language detection. */
@Module({
  controllers: [JobResumeController, ApplyKitController],
  providers: [InsightsService, InsightsResolver],
})
export class InsightsModule {}
