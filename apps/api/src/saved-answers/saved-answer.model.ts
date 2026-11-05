import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('SavedAnswer', {
  description: 'An answer you gave to one of Claude’s questions, kept for the next jobs',
})
export class SavedAnswerModel {
  @Field(() => Int)
  id!: number;

  @Field({ description: 'The question, as Claude asked it the first time' })
  question!: string;

  @Field()
  answer!: string;

  @Field()
  updatedAt!: Date;
}
