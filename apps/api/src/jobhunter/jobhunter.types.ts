// The parts of the JobHunter API we use.

export interface JobHunterSearchRequest {
  job_title_or?: string[];
  skills_or?: string[];
  job_country_code_or?: string[];
  /** City or region names, e.g. ["Seattle", "WA"]. */
  job_location_or?: string[];
  posted_at_max_age_days?: number;
  /** ISO 639-1 codes of the language the posting is written in. */
  language_or?: string[];
  /** Drop postings whose description has every word of any of these phrases. */
  description_not?: string[];
  remote?: boolean;
  job_title_not?: string[];
  employment_type_or?: string[];
  /** The top of the posted range, annualized, in US dollars. Unposted salaries never match. */
  min_salary_usd?: number;
  /** Keep postings whose value is unknown for these filtered fields. */
  include_unknown?: string[];
  /** Only postings JobHunter first found at or after this UTC time, "YYYY-MM-DD HH:mm:ss". */
  discovered_at_gte?: string;
  limit?: number;
  cursor?: string;
  include_total_results?: boolean;
  /** JobHunter only supports newest first; sending it makes the order explicit. */
  order_by?: { field: 'posted_at'; desc: true }[];
}

export interface JobHunterSource {
  provider: string;
  url: string | null;
}

export interface JobHunterCompany {
  name: string | null;
  domain: string | null;
  logo: string | null;
}

/** One posting. JobHunter returns ~75 fields; only the ones we map are typed here. */
export interface JobHunterJob {
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
  company_object: JobHunterCompany | null;
  technology_slugs: string[] | null;
  isic_division_label: string | null;
  /** "offers", "no" or "citizenship_required", read by JobHunter from the text. Rarely set. */
  visa_sponsorship?: string | null;
  description: string | null;
  sources: JobHunterSource[] | null;
}

export interface JobHunterSearchResponse {
  metadata: {
    total_results: number | null;
    next_cursor: string | null;
    credits_charged: number;
    /** Postings in this page that were free because we already paid for them this month. */
    jobs_already_paid: number;
    credits_remaining: number;
  };
  data: JobHunterJob[];
}
