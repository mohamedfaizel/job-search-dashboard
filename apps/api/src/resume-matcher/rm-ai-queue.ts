import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AI_PROVIDERS } from '../api-keys/ai-providers';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { apiError } from '../common/api-error';
import type { AiProvider } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { describeError, ResumeMatcherClient } from './resume-matcher.client';

/** Whose AI a Resume-Matcher run uses: the user's own provider, model and key. */
export interface UserAi {
  provider: AiProvider;
  model: string;
  key: string;
}

/**
 * Resume-Matcher has one AI setting for everyone and no key per request. So every run that
 * calls its AI waits its turn here: the user's key and model go in, the run happens, and the
 * key comes out again. One run at a time means nobody ever spends someone else's credits.
 */
@Injectable()
export class RmAiQueue {
  private readonly logger = new Logger(RmAiQueue.name);
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly keys: ApiKeysService,
    private readonly client: ResumeMatcherClient,
  ) {}

  /** The user's AI, or a message that sends them to Settings when they have no key. */
  async userAi(userId: number): Promise<UserAi> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { aiProvider: true },
    });
    const provider = user?.aiProvider ?? 'ANTHROPIC';
    const { kind, defaultModel } = AI_PROVIDERS[provider];
    const saved = await this.keys.aiKey(userId, kind);
    if (!saved) {
      throw apiError(
        BadRequestException,
        'AI_KEY_MISSING',
        'Add your Claude or OpenAI API key in Settings > API keys first.',
      );
    }
    return { provider, model: saved.model ?? defaultModel, key: saved.key };
  }

  /** Runs `call` with the user's key in Resume-Matcher, after the runs already waiting. */
  run<T>(ai: UserAi, call: () => Promise<T>): Promise<T> {
    const turn = this.tail.then(async () => {
      const { rmName } = AI_PROVIDERS[ai.provider];
      await this.client.setApiKeys({ [rmName]: ai.key });
      try {
        await this.client.setLlm(rmName, ai.model, ai.key);
        return await call();
      } finally {
        // Resume-Matcher keeps no key between runs.
        await this.client.setApiKeys({ anthropic: '', openai: '' }).catch((error: unknown) => {
          this.logger.warn(`Could not clear the key in Resume-Matcher: ${describeError(error)}`);
        });
      }
    });
    // The next run waits for this one, whether it worked or not.
    this.tail = turn.catch(() => undefined);
    return turn;
  }
}
