import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminMessagesResolver, MessagesResolver } from './messages.resolver';
import { MessagesService } from './messages.service';

/** Message Mohamed Faizel: users write to the admins, and admins answer. */
@Module({
  imports: [NotificationsModule],
  providers: [MessagesService, MessagesResolver, AdminMessagesResolver],
})
export class MessagesModule {}
