import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { GmailStatusModel, GmailSyncResultModel, MailSuggestionModel } from './gmail.model';
import { GmailService } from './gmail.service';

/** Everything here is about the logged-in user's own accounts: the id comes from the session. */
@Resolver()
export class GmailResolver {
  constructor(private readonly gmail: GmailService) {}

  @Query(() => GmailStatusModel, { description: 'Your connected Gmail accounts.' })
  gmailStatus(@CurrentUser() user: SessionUser): Promise<GmailStatusModel> {
    return this.gmail.status(user.id);
  }

  @Query(() => [MailSuggestionModel], {
    description: 'Tracker changes suggested by employer emails, waiting for your answer.',
  })
  mailSuggestions(@CurrentUser() user: SessionUser): Promise<MailSuggestionModel[]> {
    return this.gmail.suggestions(user.id);
  }

  @Mutation(() => GmailSyncResultModel, {
    description: 'Reads the last two weeks of mail in every connected account, now.',
  })
  syncGmail(@CurrentUser() user: SessionUser): Promise<GmailSyncResultModel> {
    return this.gmail.syncUser(user.id);
  }

  @Mutation(() => Boolean, {
    description: 'Settings > Gmail: let clear emails move jobs by themselves (true) or not',
  })
  setMailAutoStatus(@CurrentUser() user: SessionUser, @Args('on') on: boolean): Promise<boolean> {
    return this.gmail.setAutoStatus(user.id, on);
  }

  @Mutation(() => Boolean, {
    description: 'Undo in the bell: the jobs clear emails moved go back to where they were',
  })
  undoMailAuto(
    @CurrentUser() user: SessionUser,
    @Args('notificationId', { type: () => Int }) notificationId: number,
  ): Promise<boolean> {
    return this.gmail.undoAuto(user.id, notificationId);
  }

  @Mutation(() => Boolean, { description: 'Removes a Gmail account and its pending suggestions.' })
  disconnectGmail(
    @CurrentUser() user: SessionUser,
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    return this.gmail.disconnect(user.id, id);
  }

  @Mutation(() => Boolean, { description: 'Moves the job to the status the email points to.' })
  approveMailSuggestion(
    @CurrentUser() user: SessionUser,
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    return this.gmail.approve(user.id, id);
  }

  @Mutation(() => Boolean, { description: 'Ignores a suggestion. It will not come back.' })
  dismissMailSuggestion(
    @CurrentUser() user: SessionUser,
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    return this.gmail.dismiss(user.id, id);
  }
}
