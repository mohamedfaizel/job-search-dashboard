import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { SavedAnswerModel } from './saved-answer.model';
import { SavedAnswersService } from './saved-answers.service';

@Resolver()
export class SavedAnswersResolver {
  constructor(private readonly service: SavedAnswersService) {}

  @Query(() => [SavedAnswerModel], { description: 'Your saved answers, newest first' })
  savedAnswers(@CurrentUser() user: SessionUser): Promise<SavedAnswerModel[]> {
    return this.service.list(user.id);
  }

  @Mutation(() => SavedAnswerModel, {
    description: 'Keeps an answer for the next jobs. The same question again replaces its answer',
  })
  saveAnswer(
    @CurrentUser() user: SessionUser,
    @Args('question') question: string,
    @Args('answer') answer: string,
  ): Promise<SavedAnswerModel> {
    return this.service.save(user.id, question, answer);
  }

  @Mutation(() => Int, { description: 'Deletes a saved answer. Returns its id' })
  deleteSavedAnswer(
    @CurrentUser() user: SessionUser,
    @Args('id', { type: () => Int }) id: number,
  ): Promise<number> {
    return this.service.remove(user.id, id);
  }
}
