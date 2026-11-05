import { Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { NotificationsModel } from './notification.model';
import { NotificationsService } from './notifications.service';

@Resolver()
export class NotificationsResolver {
  constructor(private readonly service: NotificationsService) {}

  @Query(() => NotificationsModel, { description: 'Your bell list, newest first' })
  notifications(@CurrentUser() user: SessionUser): Promise<NotificationsModel> {
    return this.service.list(user.id);
  }

  @Mutation(() => Int, { description: 'Mark all your notifications read. Returns how many' })
  markNotificationsRead(@CurrentUser() user: SessionUser): Promise<number> {
    return this.service.markAllRead(user.id);
  }
}
