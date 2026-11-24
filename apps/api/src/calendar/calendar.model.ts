import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('GoogleCalendarStatus')
export class GoogleCalendarStatusModel {
  @Field({ description: 'False until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.' })
  configured!: boolean;

  @Field(() => String, { nullable: true, description: 'The connected Google account, or null.' })
  email!: string | null;

  @Field(() => String, { nullable: true, description: 'Why the last calendar change failed.' })
  lastError!: string | null;
}
