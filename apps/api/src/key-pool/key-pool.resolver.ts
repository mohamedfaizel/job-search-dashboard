import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import {
  AddPoolKeysInput,
  AddPoolKeysResultModel,
  DenyKeyRequestInput,
  KeyPoolModel,
  MyPoolKeyModel,
} from './key-pool.model';
import { KeyPoolService } from './key-pool.service';

/** Settings › API keys: asking for a token from the Key pool. */
@Resolver()
export class MyPoolKeyResolver {
  constructor(private readonly pool: KeyPoolService) {}

  @Query(() => MyPoolKeyModel, {
    description: 'Where your token request stands. Never any part of a key',
  })
  myPoolKey(@CurrentUser() user: SessionUser): Promise<MyPoolKeyModel> {
    return this.pool.mine(user.id);
  }

  @Mutation(() => MyPoolKeyModel, { description: 'Asks the admins for a token from the Key pool' })
  requestPoolKey(@CurrentUser() user: SessionUser): Promise<MyPoolKeyModel> {
    return this.pool.request(user.id);
  }

  @Mutation(() => MyPoolKeyModel, { description: 'Cancels your waiting request' })
  cancelPoolKeyRequest(@CurrentUser() user: SessionUser): Promise<MyPoolKeyModel> {
    return this.pool.cancel(user.id);
  }

  @Mutation(() => MyPoolKeyModel, { description: 'Gives your lent key back to the pool' })
  givePoolKeyBack(@CurrentUser() user: SessionUser): Promise<MyPoolKeyModel> {
    return this.pool.giveBack(user.id);
  }
}

/** Admin › Key pool. Keys are shown by number only, never any part of them. */
@Roles('ADMIN')
@Resolver()
export class KeyPoolAdminResolver {
  constructor(private readonly pool: KeyPoolService) {}

  @Query(() => KeyPoolModel, { description: 'Counts, keys by number and waiting requests' })
  keyPool(): Promise<KeyPoolModel> {
    return this.pool.pool();
  }

  @Mutation(() => AddPoolKeysResultModel, { description: 'Adds one or many pasted tokens' })
  addPoolKeys(@Args('input') input: AddPoolKeysInput): Promise<AddPoolKeysResultModel> {
    return this.pool.add(input.keys, input.note ?? '');
  }

  @Mutation(() => KeyPoolModel, { description: 'Lends the next free key to this request' })
  approveKeyRequest(@Args('id', { type: () => Int }) id: number): Promise<KeyPoolModel> {
    return this.pool.approve(id);
  }

  @Mutation(() => KeyPoolModel, { description: 'Says no to a request, with an optional note' })
  denyKeyRequest(@Args('input') input: DenyKeyRequestInput): Promise<KeyPoolModel> {
    return this.pool.deny(input.id, input.note ?? null);
  }

  @Mutation(() => KeyPoolModel, {
    description: 'Takes a lent key back; with passOn it goes to the oldest waiting request',
  })
  takeBackPoolKey(
    @Args('id', { type: () => Int }) id: number,
    @Args('passOn', { type: () => Boolean, defaultValue: false }) passOn: boolean,
  ): Promise<KeyPoolModel> {
    return this.pool.takeBack(id, passOn);
  }

  @Mutation(() => KeyPoolModel, { description: 'Deletes a key from the pool' })
  removePoolKey(@Args('id', { type: () => Int }) id: number): Promise<KeyPoolModel> {
    return this.pool.remove(id);
  }
}
