import { Global, Module } from '@nestjs/common';
import { SettingsResolver } from './settings.resolver';
import { SettingsService } from './settings.service';

/** The settings admins change in the app. Global: sign-up, the scheduler and limits read them. */
@Global()
@Module({
  providers: [SettingsService, SettingsResolver],
  exports: [SettingsService],
})
export class SettingsModule {}
