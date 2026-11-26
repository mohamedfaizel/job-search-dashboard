import { Field, Int, ObjectType, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { NightlyKitsService } from './nightly-kits.service';

@ObjectType('KitRun', { description: 'Your latest apply-kits run, while it writes and after' })
export class KitRunModel {
  @Field({ description: 'Still writing' })
  running!: boolean;

  @Field(() => Int, { description: 'Kits this run tries to write' })
  total!: number;

  @Field(() => Int, { description: 'Jobs finished so far (written or failed)' })
  done!: number;

  @Field(() => Int)
  written!: number;

  @Field(() => Int)
  failed!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Why it stopped early or wrote none: NO_KEY, KEY_REFUSED, NO_RESUME, NONE_WRITTEN',
  })
  reason!: string | null;

  @Field()
  startedAt!: Date;
}

@Resolver()
export class NightlyKitsResolver {
  constructor(private readonly service: NightlyKitsService) {}

  @Query(() => KitRunModel, {
    nullable: true,
    description:
      'Your latest apply-kits run, so your saved searches can show its progress and result',
  })
  kitRun(@CurrentUser() user: SessionUser): KitRunModel | null {
    return this.service.status(user.id);
  }
}
