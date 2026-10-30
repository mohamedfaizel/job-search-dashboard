import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module';
import { ProfileController } from './profile.controller';
import { ProfileResolver } from './profile.resolver';
import { ProfileService } from './profile.service';

@Module({
  imports: [InsightsModule],
  controllers: [ProfileController],
  providers: [ProfileService, ProfileResolver],
})
export class ProfileModule {}
