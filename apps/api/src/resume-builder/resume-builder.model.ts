import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('ResumeBuild', {
  description: 'Your master resume in one language, as the Resume builder edits it',
})
export class ResumeBuildModel {
  @Field({ description: 'ISO 639-1 code, e.g. "en"' })
  language!: string;

  @Field({
    description:
      'The resume as JSON text: { name, headline, contact[], sections[{ id, title, hidden, blocks[] }] }',
  })
  doc!: string;

  @Field({
    description:
      'The resume text on My profile changed since the builder last read it (a new upload)',
  })
  outOfDate!: boolean;

  @Field(() => [String], {
    description: 'Languages you have a master resume in; the first is your main one',
  })
  languages!: string[];

  @Field(() => [String], {
    description: 'Your languages from My profile: the Languages section always shows these',
  })
  profileLanguages!: string[];

  @Field(() => Int, { description: 'Your page limit from My profile' })
  maxPages!: number;

  @Field(() => Date, { nullable: true, description: 'Null until you first save a change' })
  savedAt!: Date | null;
}
