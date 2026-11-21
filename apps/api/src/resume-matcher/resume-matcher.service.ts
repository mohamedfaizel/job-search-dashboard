import { HttpException, Injectable } from '@nestjs/common';
import { RM_UNAVAILABLE, ResumeMatcherClient } from './resume-matcher.client';
import type { ResumeMatcherStatusModel } from './resume-matcher.model';
import type { UserAi } from './rm-ai-queue';
import { RmAiQueue } from './rm-ai-queue';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

const PROVIDER_NAME = { ANTHROPIC: 'Claude', OPENAI: 'OpenAI' } as const;

@Injectable()
export class ResumeMatcherService {
  constructor(
    private readonly client: ResumeMatcherClient,
    private readonly queue: RmAiQueue,
  ) {}

  /**
   * Is Resume-Matcher running, and (only when asked) can it reach your AI with your key?
   * The AI check sends one tiny message, which costs a fraction of a cent, so pages call it
   * from a button instead of on every load. Only admins read how to set it up or start it;
   * everyone else reads that it is not available right now.
   */
  async getStatus(
    userId: number,
    checkAi: boolean,
    isAdmin = false,
  ): Promise<ResumeMatcherStatusModel> {
    const status: ResumeMatcherStatusModel = {
      configured: this.client.isConfigured,
      reachable: false,
      aiConfigured: null,
      aiHealthy: null,
      aiProvider: null,
      aiModel: null,
      message: '',
      error: null,
    };
    if (!status.configured) {
      status.message = isAdmin
        ? 'Resume-Matcher is switched off: set RESUME_MATCHER_URL in .env.'
        : RM_UNAVAILABLE;
      return status;
    }

    try {
      await this.client.health();
      status.reachable = true;
    } catch (error) {
      // The raw error names hosts and ports, so only admins get it.
      if (isAdmin) status.error = errorText(error);
      status.message = isAdmin ? `${errorText(error)}. Start it with pnpm rm:up.` : RM_UNAVAILABLE;
      return status;
    }

    // Your own AI from Settings > API keys: Resume-Matcher gets it for each run.
    let ai: UserAi | null = null;
    try {
      ai = await this.queue.userAi(userId);
      status.aiProvider = PROVIDER_NAME[ai.provider];
      status.aiModel = ai.model;
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
    }
    if (!checkAi) {
      status.message = 'Resume-Matcher is running.';
      return status;
    }
    if (!ai) {
      status.aiConfigured = false;
      status.aiHealthy = false;
      status.message = 'Resume-Matcher is running, but you have no AI key yet: add one above.';
      return status;
    }

    try {
      const rm = await this.queue.run(ai, () => this.client.status());
      status.aiConfigured = rm.llm_configured;
      status.aiHealthy = rm.llm_healthy;
    } catch (error) {
      status.error = errorText(error);
      status.message = status.error;
      return status;
    }
    status.message = status.aiHealthy
      ? `Resume-Matcher is running and ${status.aiProvider} answered.`
      : `Resume-Matcher is running, but ${status.aiProvider} (${ai.model}) did not answer: check the key, model and credits.`;
    return status;
  }
}
