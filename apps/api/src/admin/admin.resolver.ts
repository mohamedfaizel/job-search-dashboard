import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import {
  AdminUserModel,
  DeleteUserInput,
  SetUserDisabledInput,
  SetUserRoleInput,
} from './admin.model';
import { AdminService } from './admin.service';
import { AdminOverviewModel } from './overview.model';
import { OverviewService } from './overview.service';

/** Admin pages. Every call here is for admins only. */
@Roles('ADMIN')
@Resolver()
export class AdminResolver {
  constructor(
    private readonly service: AdminService,
    private readonly overview: OverviewService,
  ) {}

  @Query(() => AdminOverviewModel, {
    description: 'Counts, imports this week and server health (admins only)',
  })
  adminOverview(): Promise<AdminOverviewModel> {
    return this.overview.overview();
  }

  @Query(() => [AdminUserModel], { description: 'Every account, oldest first (admins only)' })
  adminUsers(): Promise<AdminUserModel[]> {
    return this.service.users();
  }

  @Mutation(() => AdminUserModel, { description: 'Makes an account admin or a normal user' })
  setUserRole(
    @CurrentUser() admin: SessionUser,
    @Args('input') input: SetUserRoleInput,
  ): Promise<AdminUserModel> {
    return this.service.setRole(admin.id, input.userId, input.role);
  }

  @Mutation(() => AdminUserModel, { description: 'Switches an account off (no login) or on again' })
  setUserDisabled(
    @CurrentUser() admin: SessionUser,
    @Args('input') input: SetUserDisabledInput,
  ): Promise<AdminUserModel> {
    return this.service.setDisabled(admin.id, input.userId, input.disabled);
  }

  @Mutation(() => Int, { description: 'Deletes an account and all its data. Returns its id' })
  deleteUser(
    @CurrentUser() admin: SessionUser,
    @Args('input') input: DeleteUserInput,
  ): Promise<number> {
    return this.service.remove(admin.id, input.userId, input.confirmEmail);
  }
}
