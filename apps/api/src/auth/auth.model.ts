import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';
import { Role } from '../generated/prisma/client';

registerEnumType(Role, { name: 'Role' });

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
}

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
}
