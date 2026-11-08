import {
  Field,
  GraphQLISODateTime,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { ApiKeyKind } from '../generated/prisma/enums';

registerEnumType(ApiKeyKind, { name: 'ApiKeyKind' });
export { ApiKeyKind };

/** A saved key as the screens see it: never the key itself, only its last 4 characters. */
@ObjectType('ApiKey')
export class ApiKeyModel {
  @Field(() => ApiKeyKind)
  kind!: ApiKeyKind;

  @Field({ description: 'The last 4 characters, e.g. "a9F2".' })
  last4!: string;

  @Field(() => String, { nullable: true, description: 'The AI model to use with this key.' })
  model!: string | null;

  @Field(() => Int, { nullable: true, description: 'JobHunter credits left, as it last said.' })
  credits!: number | null;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@InputType()
export class SaveApiKeyInput {
  @Field(() => ApiKeyKind)
  @IsEnum(ApiKeyKind)
  kind!: ApiKeyKind;

  @Field({ description: 'The key or token. Stored encrypted; it is never shown again.' })
  @IsString()
  @Length(8, 500)
  value!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  model?: string | null;
}

@ObjectType('ApiKeyTest')
export class ApiKeyTestModel {
  @Field({ description: 'True when the service accepted the key.' })
  ok!: boolean;

  @Field(() => Int, { nullable: true, description: 'JobHunter credits left after the test.' })
  credits!: number | null;

  @Field(() => String, { nullable: true, description: 'What the service said, when it failed.' })
  error!: string | null;
}
