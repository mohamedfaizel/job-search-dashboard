import {
  Args,
  Field,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { IsBoolean, IsInt, Matches, Max, Min } from 'class-validator';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { NightlyKitsService } from './nightly-kits.service';

/** Settings › Nightly apply kits. */
@InputType()
export class NightlyKitsInput {
  @Field({ description: 'Write queued jobs’ kits at night with your own AI key' })
  @IsBoolean()
  on!: boolean;

  @Field(() => Int, { description: 'The most kits in one night (1-20)' })
  @IsInt()
  @Min(1, { message: 'Pick 1 to 20 kits a night' })
  @Max(20, { message: 'Pick 1 to 20 kits a night' })
  perNight!: number;

  @Field({ description: 'Time of night, "HH:mm", 24-hour, server local time' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'at must be a time like 03:00' })
  at!: string;
}

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

  @Mutation(() => Boolean, { description: 'Turn nightly apply kits on or off' })
  async setNightlyKits(
    @CurrentUser() user: SessionUser,
    @Args('input') input: NightlyKitsInput,
  ): Promise<boolean> {
    await this.service.setSettings(user.id, input.on, input.perNight, input.at);
    return true;
  }

  @Mutation(() => Int, {
    description:
      'Write the queued jobs’ kits now instead of at the kits time. Returns how many it will write; the bell says when they are done',
  })
  writeKitsNow(@CurrentUser() user: SessionUser): Promise<number> {
    return this.service.startNow(user.id);
  }

  @Query(() => KitRunModel, {
    nullable: true,
    description: 'Your latest apply-kits run, so Settings can show its progress and result',
  })
  kitRun(@CurrentUser() user: SessionUser): KitRunModel | null {
    return this.service.status(user.id);
  }
}
