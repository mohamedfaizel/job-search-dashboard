import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { AiProvider, Role } from '../generated/prisma/client';

registerEnumType(Role, { name: 'Role' });
registerEnumType(AiProvider, { name: 'AiProvider' });

@ObjectType('User')
export class UserModel {
  @Field(() => Int)
  id!: number;

  @Field()
  email!: string;

  @Field()
  name!: string;

  @Field(() => Role)
  role!: Role;

  @Field({ description: 'The language the app is shown in: "en" or "de"' })
  locale!: string;

  @Field(() => AiProvider, {
    description: 'Your AI for the AI score and the copy-and-open buttons (Settings > API keys)',
  })
  aiProvider!: AiProvider;

  @Field({ description: 'False until you finish or skip the first-login steps' })
  onboarded!: boolean;
}

/** The languages the app is translated into. The first is the default. */
export const LOCALES = ['en', 'de'] as const;

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

@InputType()
export class LogInInput {
  @Field()
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  email!: string;

  @Field()
  @IsString()
  @Length(1, 128, { message: 'Enter your password' })
  password!: string;
}

@InputType()
export class SignUpInput {
  @Field()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 80, { message: 'Enter your name (up to 80 characters)' })
  name!: string;

  @Field()
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  email!: string;

  /** New passwords need a sensible minimum; login accepts whatever was set. */
  @Field()
  @IsString()
  @Length(8, 128, { message: 'Use a password of at least 8 characters' })
  password!: string;

  /** The language the sign-up page was in, so the app stays in it after you sign up. */
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn(LOCALES)
  locale?: string | null;

  /** The invite link's code (?invite=…), needed while sign-up is "invite only". */
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  invite?: string | null;
}

/** What the sign-up page shows: the form, or why it can't make an account. */
export enum SignupState {
  /** Anyone can sign up. */
  OPEN = 'OPEN',
  /** Invite only, and this invite link works. */
  INVITED = 'INVITED',
  /** Invite only, and there is no invite link. */
  NEEDS_INVITE = 'NEEDS_INVITE',
  /** Invite only, and the link expired, was used up or canceled. */
  INVITE_INVALID = 'INVITE_INVALID',
  /** No new accounts. */
  CLOSED = 'CLOSED',
}
registerEnumType(SignupState, { name: 'SignupState' });
