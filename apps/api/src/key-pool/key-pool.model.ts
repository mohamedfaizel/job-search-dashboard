import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export enum MyPoolKeyStateKind {
  /** Nothing asked, or the last answer is old enough to ask again. */
  NONE = 'NONE',
  /** Asked; waiting for an admin (or for a free key). */
  PENDING = 'PENDING',
  /** A key from the pool is lent to you. */
  APPROVED = 'APPROVED',
  /** An admin said no; you can ask again from `askAgainAt`. */
  DENIED = 'DENIED',
}
registerEnumType(MyPoolKeyStateKind, { name: 'PoolKeyState' });

export enum PoolKeyStatus {
  FREE = 'FREE',
  ASSIGNED = 'ASSIGNED',
  /** Its credits are used up (JobHunter said 0 left). */
  EMPTY = 'EMPTY',
}
registerEnumType(PoolKeyStatus, { name: 'PoolKeyStatus' });

/** Settings › API keys: where your token request stands. Never any part of a key. */
@ObjectType('MyPoolKey')
export class MyPoolKeyModel {
  @Field(() => MyPoolKeyStateKind)
  state!: MyPoolKeyStateKind;

  @Field(() => Date, { nullable: true, description: 'When you asked (PENDING, DENIED)' })
  requestedAt!: Date | null;

  @Field(() => String, { nullable: true, description: "DENIED: the admin's note" })
  note!: string | null;

  @Field(() => Date, { nullable: true, description: 'DENIED: when you can ask again' })
  askAgainAt!: Date | null;

  @Field(() => Int, { description: 'How many credits you may spend with a lent key' })
  limit!: number;

  @Field(() => Int, { description: 'APPROVED: credits you spent with it so far' })
  used!: number;

  @Field({ description: 'No key is free right now: a new request joins the waiting list' })
  poolEmpty!: boolean;

  @Field(() => Date, {
    nullable: true,
    description: 'PENDING: when the server gives you the key by itself. Null: an admin decides',
  })
  readyAt!: Date | null;
}

@ObjectType('PoolKey', { description: 'A key in the pool, by number only. The key is never sent' })
export class PoolKeyModel {
  @Field(() => Int)
  id!: number;

  @Field(() => PoolKeyStatus)
  status!: PoolKeyStatus;

  @Field(() => String, { nullable: true, description: 'Who has it (so you can take it back)' })
  holder!: string | null;

  @Field(() => Int, { description: 'Credits its holder spent since they got it' })
  used!: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Credits left on the key, as JobHunter last said',
  })
  credits!: number | null;

  @Field()
  note!: string;

  @Field()
  createdAt!: Date;
}

@ObjectType('KeyRequest', { description: 'A user waiting for a key' })
export class KeyRequestModel {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field()
  createdAt!: Date;
}

/** Admin › Key pool. */
@ObjectType('KeyPool')
export class KeyPoolModel {
  @Field(() => Int)
  free!: number;

  @Field(() => Int)
  assigned!: number;

  @Field(() => Int)
  empty!: number;

  @Field(() => Int, { description: 'Credits each user may spend with a lent key' })
  limit!: number;

  @Field({ description: "A user's first request gets a free key by itself, after the wait" })
  autoApprove!: boolean;

  @Field(() => Int, { description: 'Hours a user waits before the key is given (0 = at once)' })
  waitHours!: number;

  @Field(() => [PoolKeyModel], { description: 'Newest first' })
  keys!: PoolKeyModel[];

  @Field(() => [KeyRequestModel], { description: 'Waiting requests, oldest first' })
  requests!: KeyRequestModel[];
}

@ObjectType('AddPoolKeysResult')
export class AddPoolKeysResultModel {
  @Field(() => Int)
  added!: number;

  @Field(() => Int, { description: 'Already in the pool' })
  duplicates!: number;

  @Field(() => Int, { description: 'Did not look like a token' })
  invalid!: number;
}

@InputType()
export class AddPoolKeysInput {
  @Field({ description: 'One or many tokens, split by spaces, commas or new lines' })
  @IsString()
  @Length(1, 50_000)
  keys!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  note?: string;
}

@InputType()
export class DenyKeyRequestInput {
  @Field(() => Int)
  @IsInt()
  @Min(1)
  id!: number;

  @Field(() => String, { nullable: true, description: 'Shown to the user' })
  @IsOptional()
  @IsString()
  @Length(0, 300)
  note?: string | null;
}
