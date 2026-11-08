import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { getErrorMessage } from '../common/errors';
import { JobHunterClient } from '../jobhunter/jobhunter.client';
import { ApiKeyKind, ApiKeyModel, ApiKeyTestModel, SaveApiKeyInput } from './api-keys.model';
import { ApiKeysService } from './api-keys.service';

/** Settings > API keys. Everything is about the logged-in user's own keys. */
@Resolver()
export class ApiKeysResolver {
  constructor(
    private readonly keys: ApiKeysService,
    private readonly jobHunter: JobHunterClient,
  ) {}

  @Query(() => [ApiKeyModel], { description: 'Your saved keys (only their last 4 characters).' })
  myApiKeys(@CurrentUser() user: SessionUser): Promise<ApiKeyModel[]> {
    return this.keys.list(user.id);
  }

  @Mutation(() => ApiKeyModel, { description: 'Saves or replaces one of your keys.' })
  saveApiKey(
    @CurrentUser() user: SessionUser,
    @Args('input') input: SaveApiKeyInput,
  ): Promise<ApiKeyModel> {
    return this.keys.save(user.id, input.kind, input.value, input.model ?? null);
  }

  @Mutation(() => Boolean, { description: 'Deletes one of your keys.' })
  deleteApiKey(
    @CurrentUser() user: SessionUser,
    @Args('kind', { type: () => ApiKeyKind }) kind: ApiKeyKind,
  ): Promise<boolean> {
    return this.keys.remove(user.id, kind);
  }

  @Mutation(() => ApiKeyTestModel, {
    description: 'Tries your saved JobHunter token with a search for one job (at most 1 credit).',
  })
  async testApiKey(
    @CurrentUser() user: SessionUser,
    @Args('kind', { type: () => ApiKeyKind }) kind: ApiKeyKind,
  ): Promise<ApiKeyTestModel> {
    const secret = await this.keys.secret(user.id, kind);
    if (!secret) return { ok: false, credits: null, error: 'No key saved.' };
    if (kind !== ApiKeyKind.JOBHUNTER) {
      return { ok: false, credits: null, error: 'This key cannot be tested yet.' };
    }
    try {
      const page = await this.jobHunter.searchJobs({ limit: 1, posted_at_max_age_days: 1 }, secret);
      const credits = page.metadata.credits_remaining;
      await this.keys.noteCredits(user.id, kind, credits);
      return { ok: true, credits, error: null };
    } catch (error) {
      return { ok: false, credits: null, error: getErrorMessage(error) };
    }
  }
}
