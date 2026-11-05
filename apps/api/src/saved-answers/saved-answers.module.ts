import { Module } from '@nestjs/common';
import { SavedAnswersResolver } from './saved-answers.resolver';
import { SavedAnswersService } from './saved-answers.service';

/** The bank of answers to Claude's questions, for the next jobs. */
@Module({
  providers: [SavedAnswersService, SavedAnswersResolver],
})
export class SavedAnswersModule {}
