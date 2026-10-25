import { Module } from '@nestjs/common';
import { JobsPipeClient } from './jobspipe.client';

@Module({
  providers: [JobsPipeClient],
  exports: [JobsPipeClient],
})
export class JobsPipeModule {}
