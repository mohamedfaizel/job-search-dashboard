import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { SignupMode } from '../generated/prisma/client';

registerEnumType(SignupMode, { name: 'SignupMode' });

export enum InviteStateModel {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  USED_UP = 'USED_UP',
}
registerEnumType(InviteStateModel, { name: 'InviteState' });

/** Admin › Sign-up & access and Limits. */
@ObjectType('AppSettings')
export class AppSettingsModel {
  @Field(() => SignupMode)
  signupMode!: SignupMode;

  @Field(() => Int, { description: 'Per user and day: scheduled runs stop before going over it' })
  dailyCreditCap!: number;

  @Field(() => Int, { description: 'The most saved searches one user can keep' })
  maxSavedSearches!: number;

  @Field({ description: 'Saved searches run on their schedule' })
  schedulerOn!: boolean;

  @Field({ description: 'The nightly "still open?" check runs' })
  stillOpenOn!: boolean;

  @Field({ description: "Key pool: a user's first token request gets a free key at once" })
  poolAutoApprove!: boolean;

  @Field(() => Int, { description: 'Key pool: credits each user may spend with a lent key' })
  poolKeyLimit!: number;

  @Field({ description: 'SCHEDULER_ENABLED=false in .env keeps the scheduler off anyway' })
  schedulerOffInEnv!: boolean;

  @Field({ description: 'STILL_OPEN_CHECK_ENABLED=false in .env keeps the check off anyway' })
  stillOpenOffInEnv!: boolean;
}

/** Only the fields you send change. */
@InputType()
export class UpdateAppSettingsInput {
  @Field(() => SignupMode, { nullable: true })
  @IsOptional()
  @IsIn(Object.values(SignupMode))
  signupMode?: SignupMode;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  dailyCreditCap?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxSavedSearches?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  schedulerOn?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  stillOpenOn?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  poolAutoApprove?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  poolKeyLimit?: number;
}

@ObjectType('Invite')
export class InviteModel {
  @Field(() => Int)
  id!: number;

  @Field({ description: 'Goes in the link: /signup?invite=<token>' })
  token!: string;

  @Field()
  createdAt!: Date;

  @Field(() => Date, { nullable: true, description: 'Null = never expires' })
  expiresAt!: Date | null;

  @Field(() => Int, { nullable: true, description: 'Null = any number of times' })
  maxUses!: number | null;

  @Field(() => Int)
  uses!: number;

  @Field(() => InviteStateModel)
  state!: InviteStateModel;
}

@InputType()
export class CreateInviteInput {
  @Field(() => Int, { nullable: true, description: 'Null = never expires' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number | null;

  @Field(() => Int, { nullable: true, description: 'Null = any number of times' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxUses?: number | null;
}
