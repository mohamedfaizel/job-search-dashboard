import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('NotificationJob', { description: 'A job a notification points to' })
export class NotificationJobModel {
  @Field()
  id!: string;

  @Field()
  title!: string;

  @Field()
  company!: string;

  @Field(() => Int, { description: 'Your Fit % for it when the notification was made' })
  fit!: number;
}

@ObjectType('Notification', {
  description:
    'Something the app tells you in the bell list. The web app writes the words from `kind` and the numbers, in your language',
})
export class NotificationModel {
  @Field(() => Int)
  id!: number;

  @Field({ description: 'NEW_MATCHES: a scheduled search found new jobs that fit you' })
  kind!: string;

  @Field({ description: 'The saved search that found them. Empty when not about a search' })
  searchName!: string;

  @Field(() => Int, { description: 'How many jobs it is about' })
  count!: number;

  @Field(() => Int, { description: 'The Fit % a job needed to count' })
  fitMin!: number;

  @Field(() => [NotificationJobModel], { description: 'The best few jobs, best fit first' })
  jobs!: NotificationJobModel[];

  @Field(() => Date, { nullable: true, description: 'When you read it. Null = unread' })
  readAt!: Date | null;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType('Notifications', { description: 'Your latest notifications and how many are unread' })
export class NotificationsModel {
  @Field(() => [NotificationModel])
  items!: NotificationModel[];

  @Field(() => Int)
  unread!: number;
}
