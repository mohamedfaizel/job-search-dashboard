import { BadRequestException } from '@nestjs/common';
import { Args, Field, InputType, Mutation, Resolver } from '@nestjs/graphql';
import { IsBoolean, Matches } from 'class-validator';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { apiError } from '../common/api-error';
import { BriefingService } from './briefing.service';
import { isPushToken, PushService } from './push.service';

@InputType()
export class BriefingInput {
  @Field({ description: 'Send the morning briefing' })
  @IsBoolean()
  on!: boolean;

  @Field({ description: '"HH:mm", 24-hour, server local time' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'at must be a time like 07:30' })
  at!: string;
}

@Resolver()
export class BriefingResolver {
  constructor(
    private readonly briefing: BriefingService,
    private readonly push: PushService,
  ) {}

  @Mutation(() => Boolean, { description: 'Turn the morning briefing on or off, and set its time' })
  async setBriefing(
    @CurrentUser() user: SessionUser,
    @Args('input') input: BriefingInput,
  ): Promise<boolean> {
    await this.briefing.setSettings(user.id, input.on, input.at);
    return true;
  }

  @Mutation(() => Boolean, { description: 'The phone app: send push messages to this phone' })
  async registerPushToken(
    @CurrentUser() user: SessionUser,
    @Args('token') token: string,
  ): Promise<boolean> {
    if (!isPushToken(token)) {
      throw apiError(BadRequestException, 'PUSH_TOKEN_INVALID', 'Not an Expo push token');
    }
    await this.push.register(user.id, token);
    return true;
  }

  @Mutation(() => Boolean, { description: 'The phone app on log out: no more pushes here' })
  async unregisterPushToken(
    @CurrentUser() user: SessionUser,
    @Args('token') token: string,
  ): Promise<boolean> {
    await this.push.unregister(user.id, token);
    return true;
  }
}
