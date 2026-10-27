/**
 * The parts of Resume-Matcher's REST API (v1.4.0, /api/v1) that we use. Only the fields we read
 * are listed; Resume-Matcher sends more.
 */

/** GET /api/v1/health: answers without calling the AI provider. */
export interface RmHealthResponse {
  status: string;
}

/** GET /api/v1/status: also sends a tiny "Hi" to the AI provider to check the key and model. */
export interface RmStatusResponse {
  status: string;
  llm_configured: boolean;
  llm_healthy: boolean;
  has_master_resume: boolean;
}

/** POST /api/v1/resumes/upload: answers once the AI has read the resume (or failed to). */
export interface RmResumeUploadResponse {
  resume_id: string;
  /** "ready" when the AI read it into sections, "failed" when it couldn't. */
  processing_status: 'ready' | 'failed' | 'processing';
  is_master: boolean;
}
