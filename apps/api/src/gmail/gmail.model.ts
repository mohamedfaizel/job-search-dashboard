import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';
import { ApplicationStatus } from '../jobs/models/enums';

@ObjectType('GmailAccount')
export class GmailAccountModel {
  @Field(() => Int)
  id!: number;

  @Field()
  email!: string;

  @Field(() => GraphQLISODateTime)
  connectedAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastSyncAt!: Date | null;

  @Field(() => String, { nullable: true, description: 'Why the last check failed, if it did.' })
  lastError!: string | null;
}

@ObjectType('MailSuggestion')
export class MailSuggestionModel {
  @Field(() => Int)
  id!: number;

  @Field(() => ID)
  jobId!: string;

  @Field()
  jobTitle!: string;

  @Field()
  company!: string;

  @Field(() => ApplicationStatus, { description: 'Where the job is in your tracker now.' })
  currentStatus!: ApplicationStatus;

  @Field(() => ApplicationStatus, { description: 'Where the email says it should be.' })
  status!: ApplicationStatus;

  @Field()
  accountEmail!: string;

  @Field()
  fromAddress!: string;

  @Field()
  subject!: string;

  @Field()
  snippet!: string;

  @Field(() => GraphQLISODateTime)
  receivedAt!: Date;
}

@ObjectType('GmailStatus')
export class GmailStatusModel {
  @Field({ description: 'False until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.' })
  configured!: boolean;

  @Field(() => [GmailAccountModel])
  accounts!: GmailAccountModel[];
}

@ObjectType('GmailSyncResult')
export class GmailSyncResultModel {
  @Field(() => Int)
  accounts!: number;

  @Field(() => Int, { description: 'New suggestions waiting for you.' })
  suggestions!: number;

  @Field(() => [String], { description: 'Accounts that could not be read, with the reason.' })
  warnings!: string[];
}
