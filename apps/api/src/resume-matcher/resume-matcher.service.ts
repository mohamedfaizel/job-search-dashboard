import { Injectable } from '@nestjs/common';
import { ResumeMatcherClient } from './resume-matcher.client';
import type { ResumeMatcherStatusModel } from './resume-matcher.model';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

@Injectable()
export class ResumeMatcherService {
  constructor(private readonly client: ResumeMatcherClient) {}

  /**
   * Is Resume-Matcher running, and (only when asked) can it reach the AI provider?
   * The AI check sends one tiny message, which costs a fraction of a cent, so pages call it
   * from a button instead of on every load.
   */
  async getStatus(checkAi: boolean): Promise<ResumeMatcherStatusModel> {
    const status: ResumeMatcherStatusModel = {
      configured: this.client.isConfigured,
      reachable: false,
      aiConfigured: null,
      aiHealthy: null,
      message: '',
    };
    if (!status.configured) {
      status.message = 'Resume-Matcher is switched off: set RESUME_MATCHER_URL in .env.';
      return status;
    }

    try {
      await this.client.health();
      status.reachable = true;
    } catch (error) {
      status.message = `${errorText(error)}. Start it with pnpm rm:up.`;
      return status;
    }
    if (!checkAi) {
      status.message = 'Resume-Matcher is running.';
      return status;
    }

    try {
      const rm = await this.client.status();
      status.aiConfigured = rm.llm_configured;
      status.aiHealthy = rm.llm_healthy;
    } catch (error) {
      status.message = errorText(error);
      return status;
    }
    status.message = !status.aiConfigured
      ? 'Resume-Matcher is running, but no AI key is set: add ANTHROPIC_API_KEY to .env and restart it.'
      : status.aiHealthy
        ? 'Resume-Matcher is running and the AI provider answered.'
        : 'Resume-Matcher is running, but the AI provider did not answer: check the key, model and credits.';
    return status;
  }
}
