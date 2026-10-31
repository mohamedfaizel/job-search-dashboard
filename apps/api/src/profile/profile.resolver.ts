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

  @Mutation(() => ProfileModel, {
    description:
      'Saves your master resume in another language (e.g. "de"), replacing the one before',
  })
  saveLanguageResume(
    @CurrentUser() user: SessionUser,
    @Args('language') language: string,
    @Args('text') text: string,
  ): Promise<ProfileModel> {
    return this.profiles.saveLanguageResume(user.id, language, text);
  }

  @Mutation(() => ProfileModel, { description: 'Deletes your master resume in a language' })
  deleteLanguageResume(
    @CurrentUser() user: SessionUser,
    @Args('language') language: string,
  ): Promise<ProfileModel> {
    return this.profiles.deleteLanguageResume(user.id, language);
  }

  @Query(() => String, {
    description:
      'A prompt for Claude that translates your master resume into a language, keeping every fact',
  })
  translationPrompt(
    @CurrentUser() user: SessionUser,
    @Args('language') language: string,
  ): Promise<string> {
    return this.profiles.translationPrompt(user.id, language);
  }

  @Mutation(() => ProfileModel)
  updateProfile(
    @CurrentUser() user: SessionUser,
    @Args('input') input: ProfileInput,
  ): Promise<ProfileModel> {
    return this.profiles.update(user.id, input);
  }
}
