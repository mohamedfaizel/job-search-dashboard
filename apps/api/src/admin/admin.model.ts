import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsIn, IsInt, IsString, Length } from 'class-validator';
import { Role } from '../generated/prisma/client';

/** One account on Admin › Users: who it is and counts, never its jobs, resumes or keys. */
@ObjectType()
export class AdminUserModel {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field(() => Role)
  role!: Role;

  @Field()
  joinedAt!: Date;

  @Field(() => Date, {
    nullable: true,
    description: 'Null = never used the app since this was added',
  })
  lastSeenAt!: Date | null;

  @Field({ description: 'True when an admin switched the account off' })
  disabled!: boolean;

  @Field({ description: 'Has saved a JobHunter token in Settings (the token itself never leaves)' })
  hasJobKey!: boolean;

  @Field(() => Int, { description: 'Imports run this calendar month, by hand or scheduled' })
  importsThisMonth!: number;
}

@InputType()
export class SetUserRoleInput {
  @Field(() => Int)
  @IsInt()
  userId!: number;

  @Field(() => Role)
  @IsIn(Object.values(Role))
  role!: Role;
}

@InputType()
export class SetUserDisabledInput {
  @Field(() => Int)
  @IsInt()
  userId!: number;

  @Field()
  disabled!: boolean;
}

@InputType()
export class DeleteUserInput {
  @Field(() => Int)
  @IsInt()
  userId!: number;

  /** The account's email typed again, so a slip of the mouse can't delete anyone. */
  @Field()
  @IsString()
  @Length(1, 320, { message: 'Type the email of the account you delete' })
  confirmEmail!: string;
}
