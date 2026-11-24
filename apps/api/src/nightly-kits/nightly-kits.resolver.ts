import { Args, Field, InputType, Int, Mutation, Resolver } from '@nestjs/graphql';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';
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
}

@Resolver()
export class NightlyKitsResolver {
  constructor(private readonly service: NightlyKitsService) {}

  @Mutation(() => Boolean, { description: 'Turn nightly apply kits on or off' })
  async setNightlyKits(
    @CurrentUser() user: SessionUser,
    @Args('input') input: NightlyKitsInput,
  ): Promise<boolean> {
    await this.service.setSettings(user.id, input.on, input.perNight);
    return true;
  }

  @Mutation(() => Int, {
    description:
      'Write the queued jobs’ kits now instead of tonight. Returns how many it will write; the bell says when they are done',
  })
  writeKitsNow(@CurrentUser() user: SessionUser): Promise<number> {
    return this.service.startNow(user.id);
  }
}
