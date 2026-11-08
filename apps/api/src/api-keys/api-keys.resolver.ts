import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { UserModel } from '../auth/auth.model';
import { toUserModel } from '../auth/auth.service';
import { getErrorMessage } from '../common/errors';
import { AiProvider } from '../generated/prisma/enums';
import { JobHunterClient } from '../jobhunter/jobhunter.client';
import { PrismaService } from '../prisma/prisma.service';
import { AI_PROVIDERS, checkAiKey, providerOfKind } from './ai-providers';
import { ApiKeyKind, ApiKeyModel, ApiKeyTestModel, SaveApiKeyInput } from './api-keys.model';
import { ApiKeysService } from './api-keys.service';

/** Settings > API keys. Everything is about the logged-in user's own keys. */
@Resolver()
export class ApiKeysResolver {
  constructor(
    private readonly keys: ApiKeysService,
    private readonly jobHunter: JobHunterClient,
    private readonly prisma: PrismaService,
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

  @Mutation(() => ApiKeyModel, {
    description: 'Changes the AI model used with a saved key. Empty means the default model.',
  })
  setApiKeyModel(
    @CurrentUser() user: SessionUser,
    @Args('kind', { type: () => ApiKeyKind }) kind: ApiKeyKind,
    @Args('model', { type: () => String, nullable: true }) model: string | null,
  ): Promise<ApiKeyModel> {
    return this.keys.setModel(user.id, kind, model);
  }

  @Mutation(() => UserModel, {
    description: 'Picks your AI: Claude or OpenAI, for the AI score and the copy-and-open buttons.',
  })
  async setAiProvider(
    @CurrentUser() user: SessionUser,
    @Args('provider', { type: () => AiProvider }) provider: AiProvider,
  ): Promise<UserModel> {
    return toUserModel(
      await this.prisma.user.update({ where: { id: user.id }, data: { aiProvider: provider } }),
    );
  }

  @Mutation(() => Boolean, { description: 'Deletes one of your keys.' })
  deleteApiKey(
    @CurrentUser() user: SessionUser,
    @Args('kind', { type: () => ApiKeyKind }) kind: ApiKeyKind,
  ): Promise<boolean> {
    return this.keys.remove(user.id, kind);
  }

  @Mutation(() => ApiKeyTestModel, {
    description:
      'Tries a saved key: JobHunter with a one-job search (at most 1 credit), Claude and OpenAI by listing their models (free).',
  })
  async testApiKey(
    @CurrentUser() user: SessionUser,
    @Args('kind', { type: () => ApiKeyKind }) kind: ApiKeyKind,
  ): Promise<ApiKeyTestModel> {
    const secret = await this.keys.secret(user.id, kind);
    if (!secret) return { ok: false, credits: null, error: 'No key saved.' };
    const provider = providerOfKind(kind);
    if (provider) {
      const saved = (await this.keys.list(user.id)).find((key) => key.kind === kind);
      const model = saved?.model ?? AI_PROVIDERS[provider].defaultModel;
      const error = await checkAiKey(provider, secret, model);
      return { ok: error === null, credits: null, error };
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
