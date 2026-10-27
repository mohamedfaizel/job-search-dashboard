import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { ProfileInput, ProfileModel } from './profile.model';
import { ProfileService } from './profile.service';

/** Every user reads and edits only their own profile: the id comes from the session cookie. */
@Resolver(() => ProfileModel)
export class ProfileResolver {
  constructor(private readonly profiles: ProfileService) {}

  @Query(() => ProfileModel)
  myProfile(@CurrentUser() user: SessionUser): Promise<ProfileModel> {
    return this.profiles.get(user.id);
  }

  @Mutation(() => ProfileModel)
  updateProfile(
    @CurrentUser() user: SessionUser,
    @Args('input') input: ProfileInput,
  ): Promise<ProfileModel> {
    return this.profiles.update(user.id, input);
  }
}
