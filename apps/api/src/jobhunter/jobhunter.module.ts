import { Module } from '@nestjs/common';
import { JobHunterClient } from './jobhunter.client';

@Module({
  providers: [JobHunterClient],
  exports: [JobHunterClient],
})
export class JobHunterModule {}
