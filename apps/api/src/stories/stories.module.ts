import { Module } from '@nestjs/common';
import { StoriesResolver } from './stories.resolver';
import { StoriesService } from './stories.service';

/** Your story bank: STAR stories for interviews. */
@Module({
  providers: [StoriesService, StoriesResolver],
  exports: [StoriesService],
})
export class StoriesModule {}
