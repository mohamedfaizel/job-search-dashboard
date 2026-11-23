import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { KeyPoolAdminResolver, MyPoolKeyResolver } from './key-pool.resolver';
import { KeyPoolService } from './key-pool.service';

/** The admins' Key pool of JobHunter tokens, lent to users who ask. */
@Module({
  imports: [ApiKeysModule, NotificationsModule],
  providers: [KeyPoolService, MyPoolKeyResolver, KeyPoolAdminResolver],
  exports: [KeyPoolService],
})
export class KeyPoolModule {}
