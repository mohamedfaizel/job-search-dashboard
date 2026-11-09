import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { SalaryResearchModel } from './salary.model';
import { SalaryService } from './salary.service';

@Resolver(() => SalaryResearchModel)
export class SalaryResolver {
  constructor(private readonly salary: SalaryService) {}

  @Query(() => SalaryResearchModel, {
    description: 'What similar jobs pay, a number to ask for, and a negotiation prompt for Claude',
  })
  salaryResearch(
    @CurrentUser() user: SessionUser,
    @Args('jobId', { type: () => ID }) jobId: string,
  ) {
    return this.salary.research(user.id, jobId);
  }
}
