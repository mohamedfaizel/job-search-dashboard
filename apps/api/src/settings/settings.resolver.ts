import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Roles } from '../auth/auth.decorators';
import type { AppSetting, Invite } from '../generated/prisma/client';
import {
  AppSettingsModel,
  CreateInviteInput,
  InviteModel,
  InviteStateModel,
  UpdateAppSettingsInput,
} from './settings.model';
import { inviteState, SettingsService } from './settings.service';

const toInvite = (invite: Invite): InviteModel => ({
  ...invite,
  state: InviteStateModel[inviteState(invite)],
});

/** Admin › Sign-up & access and Limits. Admins only. */
@Roles('ADMIN')
@Resolver()
export class SettingsResolver {
  constructor(private readonly settings: SettingsService) {}

  private toModel(row: AppSetting): AppSettingsModel {
    return {
      ...row,
      schedulerOffInEnv: this.settings.schedulerOffInEnv,
      stillOpenOffInEnv: this.settings.stillOpenOffInEnv,
    };
  }

  @Query(() => AppSettingsModel, { description: 'Sign-up mode and limits (admins only)' })
  async appSettings(): Promise<AppSettingsModel> {
    return this.toModel(await this.settings.get());
  }

  @Mutation(() => AppSettingsModel, { description: 'Changes them; works at once' })
  async updateAppSettings(@Args('input') input: UpdateAppSettingsInput): Promise<AppSettingsModel> {
    // A null means "leave it", like a field you didn't send.
    const changes = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== null && value !== undefined),
    ) as UpdateAppSettingsInput;
    return this.toModel(await this.settings.update(changes));
  }

  @Query(() => [InviteModel], { description: 'Invite links not canceled, newest first' })
  async invites(): Promise<InviteModel[]> {
    return (await this.settings.invites()).map(toInvite);
  }

  @Mutation(() => InviteModel)
  async createInvite(@Args('input') input: CreateInviteInput): Promise<InviteModel> {
    return toInvite(
      await this.settings.createInvite(input.expiresInDays ?? null, input.maxUses ?? null),
    );
  }

  @Mutation(() => Int, { description: 'Cancels an invite link. Returns its id' })
  cancelInvite(@Args('id', { type: () => Int }) id: number): Promise<number> {
    return this.settings.cancelInvite(id);
  }
}
