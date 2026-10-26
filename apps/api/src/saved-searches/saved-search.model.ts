import { Field, InputType, Int, ObjectType, OmitType } from '@nestjs/graphql';
import { IsString, Length } from 'class-validator';
import { SyncJobsInput } from '../sync/sync.input';

/** A search to save: a name plus the same fields as an import (without "continue"). */
@InputType()
export class SavedSearchInput extends OmitType(SyncJobsInput, ['resume'] as const, InputType) {
  @Field({ description: 'A name you will recognise, e.g. "Frontend in Berlin"' })
  @IsString()
  @Length(1, 80)
  name!: string;
}

/** One finished import, for the history table. */
@ObjectType()
export class SyncRunModel {
  @Field(() => Int)
  id!: number;

  @Field({ description: 'When the import started (for a continued import: the run it continued)' })
  startedAt!: Date;

  @Field()
  finishedAt!: Date;

  @Field({ description: 'False when pages were left unfetched' })
  complete!: boolean;

  @Field(() => Int)
  fetched!: number;

  @Field(() => Int)
  created!: number;

  @Field(() => Int)
  updated!: number;

  @Field(() => Int, { nullable: true })
  creditsCharged!: number | null;

  @Field(() => Int, { nullable: true })
  jobsAlreadyPaid!: number | null;

  @Field(() => Int, { nullable: true })
  savedSearchId!: number | null;

  @Field(() => String, { nullable: true, description: 'Name of the saved search that ran it' })
  savedSearchName!: string | null;

  @Field({ description: 'Short description of what was searched, e.g. "frontend · DE · Berlin"' })
  summary!: string;
}

@ObjectType()
export class SavedSearch {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

  @Field(() => [String])
  titles!: string[];

  @Field(() => [String])
  skills!: string[];

  @Field(() => [String])
  countryCodes!: string[];

  @Field(() => [String])
  locations!: string[];

  @Field(() => Int)
  maxAgeDays!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  maxPages!: number;

  @Field()
  onlyNew!: boolean;

  @Field()
  createdAt!: Date;

  @Field(() => SyncRunModel, {
    nullable: true,
    description: 'The most recent import of this search',
  })
  lastRun!: SyncRunModel | null;
}
