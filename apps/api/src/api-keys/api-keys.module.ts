import { Module } from '@nestjs/common';
import { JobHunterModule } from '../jobhunter/jobhunter.module';
import { ApiKeysResolver } from './api-keys.resolver';
import { ApiKeysService } from './api-keys.service';

/** Each user's own keys for paid services (Settings > API keys). */
@Module({
  imports: [JobHunterModule],
  providers: [ApiKeysService, ApiKeysResolver],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
