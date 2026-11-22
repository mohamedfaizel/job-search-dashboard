import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import {
  AdminConversationModel,
  MessageModel,
  MyMessagesModel,
  ReplyMessageInput,
  SendMessageInput,
} from './message.model';
import { MessagesService } from './messages.service';

/** Your side of Message Mohamed Faizel. */
@Resolver()
export class MessagesResolver {
  constructor(private readonly service: MessagesService) {}

  @Query(() => MyMessagesModel, { description: 'Your messages and the answers, oldest first' })
  myMessages(@CurrentUser() user: SessionUser): Promise<MyMessagesModel> {
    return this.service.mine(user.id);
  }

  @Mutation(() => MessageModel, {
    description: 'Sends a question, suggestion or bug to the admins',
  })
  sendMessage(
    @CurrentUser() user: SessionUser,
    @Args('input') input: SendMessageInput,
  ): Promise<MessageModel> {
    return this.service.send(user.id, input.topic, input.body);
  }

  @Mutation(() => Int, { description: 'Marks the answers you saw read. Returns how many' })
  markMyMessagesRead(@CurrentUser() user: SessionUser): Promise<number> {
    return this.service.markMineRead(user.id);
  }
}

/** Admin › Messages. Every admin sees and can answer every conversation. */
@Roles('ADMIN')
@Resolver()
export class AdminMessagesResolver {
  constructor(private readonly service: MessagesService) {}

  @Query(() => [AdminConversationModel], {
    description: 'Every conversation, unanswered first (admins only)',
  })
  adminConversations(): Promise<AdminConversationModel[]> {
    return this.service.conversations();
  }

  @Query(() => [MessageModel], {
    description: 'One user’s conversation, oldest first. Marks it read (admins only)',
  })
  adminConversation(@Args('userId', { type: () => Int }) userId: number): Promise<MessageModel[]> {
    return this.service.conversation(userId);
  }

  @Mutation(() => MessageModel, { description: 'Answers a user. Rings their bell (admins only)' })
  replyMessage(
    @CurrentUser() admin: SessionUser,
    @Args('input') input: ReplyMessageInput,
  ): Promise<MessageModel> {
    return this.service.reply(admin.id, input.userId, input.body);
  }
}
