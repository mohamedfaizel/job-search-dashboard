import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { StoriesService } from './stories.service';
import { StoryInput, StoryModel } from './story.model';

@Resolver()
export class StoriesResolver {
  constructor(private readonly service: StoriesService) {}

  @Query(() => [StoryModel], { description: 'Your story bank, the story changed last first' })
  stories(@CurrentUser() user: SessionUser): Promise<StoryModel[]> {
    return this.service.list(user.id);
  }

  @Mutation(() => StoryModel, { description: 'Adds a story (no id) or changes one (with its id)' })
  saveStory(
    @CurrentUser() user: SessionUser,
    @Args('input') input: StoryInput,
  ): Promise<StoryModel> {
    return this.service.save(user.id, input);
  }

  @Mutation(() => Int, { description: 'Deletes a story. Returns its id' })
  deleteStory(
    @CurrentUser() user: SessionUser,
    @Args('id', { type: () => Int }) id: number,
  ): Promise<number> {
    return this.service.remove(user.id, id);
  }
}
