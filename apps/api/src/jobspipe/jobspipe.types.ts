// The parts of the JobsPipe API we use. Docs: https://docs.jobspipe.dev/api-reference

export interface JobsPipeSearchRequest {
  job_title_or?: string[];
  skills_or?: string[];
  job_country_code_or?: string[];
  /** City or region names, e.g. ["Seattle", "WA"]. */
  job_location_or?: string[];
  posted_at_max_age_days?: number;
  /** Only postings JobsPipe first found at or after this UTC time, "YYYY-MM-DD HH:mm:ss". */
  discovered_at_gte?: string;
  limit?: number;
  cursor?: string;
  include_total_results?: boolean;
  /** JobsPipe only supports newest first; sending it makes the order explicit. */
  order_by?: { field: 'posted_at'; desc: true }[];
}

export interface JobsPipeSource {
  provider: string;
  url: string | null;
}

export interface JobsPipeCompany {
  name: string | null;
  domain: string | null;
  logo: string | null;
}

/** One posting. JobsPipe returns ~75 fields; only the ones we map are typed here. */
export interface JobsPipeJob {
  id: string;
  job_title: string;
  company: string;
  url: string | null;
  date_posted: string;
  short_location: string | null;
  long_location: string | null;
  normalized_city: string | null;
  cities: string[] | null;
  country_code: string | null;
  /** ISO 639-1 code of the posting's language, e.g. "de". */
  language: string | null;
  remote: boolean | null;
  hybrid: boolean | null;
  work_arrangement: string | null;
  min_annual_salary_usd: number | null;
  max_annual_salary_usd: number | null;
  estimated_min_annual_salary_usd: number | null;
  estimated_max_annual_salary_usd: number | null;
  seniority: string | null;
  job_function: string | null;
  status: string | null;
  company_domain: string | null;
  company_object: JobsPipeCompany | null;
  technology_slugs: string[] | null;
  isic_division_label: string | null;
  description: string | null;
  sources: JobsPipeSource[] | null;
}

export interface JobsPipeSearchResponse {
  metadata: {
    total_results: number | null;
    next_cursor: string | null;
    credits_charged: number;
    /** Postings in this page that were free because we already paid for them this month. */
    jobs_already_paid: number;
    credits_remaining: number;
  };
  data: JobsPipeJob[];
}
