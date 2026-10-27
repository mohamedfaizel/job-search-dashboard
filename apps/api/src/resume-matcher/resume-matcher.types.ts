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

/** POST /api/v1/jobs/upload: stores job descriptions and returns one id per description. */
export interface RmJobUploadResponse {
  job_id: string[];
}

/** The ATS score Resume-Matcher computes without the AI, from the keywords the AI extracted. */
export interface RmAtsScore {
  overall_score: number;
  sub_scores: {
    keyword_match: number;
    skills_coverage: number;
    /** Null when the posting has no clear job title. */
    title_match: number | null;
    section_completeness: number;
    /** Null when the resume has fewer than two dates. */
    date_consistency: number | null;
  };
  missing_keywords: string[];
  injectable_keywords: string[];
  recommendations: string[];
}

/**
 * POST /api/v1/resumes/improve/preview: tailors the resume to the job without saving it, and
 * scores the result.
 */
export interface RmImprovePreviewResponse {
  data: {
    refinement_stats: { initial_match_percentage: number; final_match_percentage: number } | null;
    /** Null when Resume-Matcher couldn't compute it. */
    ats_score: RmAtsScore | null;
    warnings: string[];
  };
}

/** GET /api/v1/config/llm-api-key: the provider and model it really uses (key masked). */
export interface RmLlmConfigResponse {
  provider: string;
  model: string;
}
