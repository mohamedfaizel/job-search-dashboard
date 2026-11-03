/** The hiring tools whose public career-page feeds we can read. All three are free, no key. */
export const ATS_NAMES = ['greenhouse', 'lever', 'ashby'] as const;
export type Ats = (typeof ATS_NAMES)[number];

/** One company's job board: the tool it uses and its name in that tool's address. */
export interface BoardRef {
  ats: Ats;
  slug: string;
}

export type BoardEmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship';

/** A posting from any of the three tools, in one shape. */
export interface BoardPosting {
  id: string;
  title: string;
  url: string;
  /** The company's name when the feed says it; otherwise we write it from the board name. */
  company: string | null;
  location: string | null;
  /** True when the feed says remote; null when it doesn't say. */
  remote: boolean | null;
  /** When it was published (or last updated, if that is all the feed has). */
  postedAt: Date | null;
  employmentType: BoardEmploymentType | null;
  department: string | null;
  /** Plain text, no HTML. */
  description: string | null;
  /** The feed's own record, kept for later. */
  raw: unknown;
}

// What we read from each feed. Every field is optional on purpose.
export interface GreenhouseFeed {
  jobs?: {
    id?: number | string;
    title?: string;
    absolute_url?: string;
    location?: { name?: string };
    updated_at?: string;
    first_published?: string;
    company_name?: string;
    /** HTML, itself escaped (&lt;p&gt;). */
    content?: string;
    departments?: { name?: string }[];
  }[];
}

export interface LeverPosting {
  id?: string;
  text?: string;
  hostedUrl?: string;
  /** Milliseconds since 1970. */
  createdAt?: number;
  workplaceType?: string;
  descriptionPlain?: string;
  additionalPlain?: string;
  lists?: { text?: string; content?: string }[];
  categories?: { location?: string; team?: string; commitment?: string };
}

export interface AshbyFeed {
  jobs?: {
    id?: string;
    title?: string;
    location?: string;
    department?: string;
    employmentType?: string;
    publishedAt?: string;
    jobUrl?: string;
    isRemote?: boolean;
    isListed?: boolean;
    descriptionPlain?: string;
    descriptionHtml?: string;
  }[];
}
