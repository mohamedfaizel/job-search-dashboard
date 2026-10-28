import { Module } from '@nestjs/common';
import { InsightsResolver } from './insights.resolver';
import { InsightsService } from './insights.service';

/** Job insights without AI: skill tags, TF-IDF keywords and language detection. */
@Module({
  providers: [InsightsService, InsightsResolver],
})
export class InsightsModule {}
