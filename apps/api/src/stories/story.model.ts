import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('Story', {
  description: 'One story of your story bank (STAR): situation, task, action, result',
})
export class StoryModel {
  @Field(() => Int)
  id!: number;

  @Field({ description: 'A short name, e.g. "Cut the nightly load from 4 h to 40 min"' })
  title!: string;

  @Field({ description: 'Situation: where you were and what was going on' })
  situation!: string;

  @Field({ description: 'Task: what you had to do' })
  task!: string;

  @Field({ description: 'Action: what you did, step by step' })
  action!: string;

  @Field({ description: 'Result: what came of it, with real numbers' })
  result!: string;

  @Field({ description: 'Reflection: what you learned or would do differently' })
  reflection!: string;

  @Field(() => [String], { description: 'Skills or themes it shows, e.g. "leadership"' })
  tags!: string[];

  @Field()
  updatedAt!: Date;
}

@InputType('StoryInput', { description: 'A new story (no id) or a change to one (with its id)' })
export class StoryInput {
  @Field(() => Int, { nullable: true })
  id?: number | null;

  @Field()
  title!: string;

  @Field({ defaultValue: '' })
  situation!: string;

  @Field({ defaultValue: '' })
  task!: string;

  @Field({ defaultValue: '' })
  action!: string;

  @Field({ defaultValue: '' })
  result!: string;

  @Field({ defaultValue: '' })
  reflection!: string;

  @Field(() => [String], { defaultValue: [] })
  tags!: string[];
}
