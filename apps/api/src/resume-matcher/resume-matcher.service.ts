import { Injectable } from '@nestjs/common';
import { ResumeMatcherClient } from './resume-matcher.client';
import type { ResumeMatcherStatusModel } from './resume-matcher.model';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Choices saved in Resume-Matcher's own Settings page beat .env, which surprises people. */
const SETTINGS_HINT =
  " A provider or model saved in Resume-Matcher's own Settings page (http://localhost:3100/settings) overrides .env.";
const using = ({ aiProvider, aiModel }: ResumeMatcherStatusModel) =>
  aiProvider ? ` (${aiProvider}${aiModel ? ` / ${aiModel}` : ''})` : '';

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
      aiProvider: null,
      aiModel: null,
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
    try {
      // Free: reads Resume-Matcher's settings without calling the AI provider.
      const llm = await this.client.llmConfig();
      status.aiProvider = llm.provider;
      status.aiModel = llm.model;
    } catch {
      // Older Resume-Matcher versions may not have this endpoint; the rest still works.
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
        : `Resume-Matcher is running, but the AI provider${using(status)} did not answer: check the key, model and credits.${SETTINGS_HINT}`;
    return status;
  }
}
