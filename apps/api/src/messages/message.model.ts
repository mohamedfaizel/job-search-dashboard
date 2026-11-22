import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsEnum, IsInt, IsString, Length } from 'class-validator';

/** Longest message we keep. */
export const MAX_BODY = 2000;

export enum MessageTopic {
  QUESTION = 'QUESTION',
  SUGGESTION = 'SUGGESTION',
  BROKEN = 'BROKEN',
}
registerEnumType(MessageTopic, {
  name: 'MessageTopic',
  description: 'What a message is about: a question, a suggestion, or something that is broken',
});

@ObjectType('Message', {
  description: 'One line in your conversation with the app’s makers: yours or an admin’s answer',
})
export class MessageModel {
  @Field(() => Int)
  id!: number;

  @Field({ description: 'True for an admin’s answer' })
  fromAdmin!: boolean;

  @Field({ description: 'Who wrote an answer. Empty on your own messages' })
  authorName!: string;

  @Field(() => MessageTopic, { nullable: true, description: 'Only on your own messages' })
  topic!: MessageTopic | null;

  @Field()
  body!: string;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType('MyMessages', { description: 'Your conversation, oldest first, and unread answers' })
export class MyMessagesModel {
  @Field(() => [MessageModel])
  items!: MessageModel[];

  @Field(() => Int, { description: 'Answers you have not seen yet' })
  unread!: number;
}

@ObjectType('AdminConversation', {
  description: 'One user’s conversation on Admin › Messages: who and the latest line',
})
export class AdminConversationModel {
  @Field(() => Int)
  userId!: number;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field({ description: 'The latest message or answer' })
  lastBody!: string;

  @Field({ description: 'True when the latest line is an admin’s answer' })
  lastFromAdmin!: boolean;

  @Field(() => Date)
  lastAt!: Date;

  @Field(() => Int, { description: 'Messages from the user no admin has opened yet' })
  unread!: number;
}

@InputType()
export class SendMessageInput {
  @Field(() => MessageTopic)
  @IsEnum(MessageTopic)
  topic!: MessageTopic;

  @Field()
  @IsString()
  @Length(1, MAX_BODY)
  body!: string;
}

@InputType()
export class ReplyMessageInput {
  @Field(() => Int)
  @IsInt()
  userId!: number;

  @Field()
  @IsString()
  @Length(1, MAX_BODY)
  body!: string;
}
