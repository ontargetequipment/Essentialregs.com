export type JurisdictionLevel = "federal" | "state" | "county";

export type CrossReference = {
  id: string;
  raw_text: string;
  target_type: "internal" | "external";
  target_provision_id: string | null;
  target_url: string | null;
};

export type Provision = {
  id: string;
  citation: string;
  title: string;
  jurisdiction_level: JurisdictionLevel;
  issuing_body: string;
  parent_id: string | null;
  full_text: string;
  ai_summary: string | null;
  source_url: string | null;
  last_verified_date: string | null;
  is_public: boolean;
  sort_order: number;
  /** Moderation state of ai_summary — see supabase/migrations/004_review.sql. Absent/undefined wherever a caller hasn't selected it. */
  summary_status?: string | null;
  cross_references?: CrossReference[];
};

/**
 * Every character that appears in a provision id. 19,164 of 36,517 ids
 * (52.5%) contain parentheses -- "sec-7-B-II-C-2-b-(ii)-(D)" -- so a
 * validator that omits them rejects more than half the corpus.
 *
 * This is the ONE definition. It was previously duplicated in
 * app/regs/[id]/page.tsx and lib/related.ts, the copies drifted, and the
 * /regs/[id] copy 404'd every paren id in production.
 *
 * Validating before the id reaches a query is defense-in-depth against the
 * URL segment being used for PostgREST filter-syntax injection.
 */
export const PROVISION_ID = /^[A-Za-z0-9_.:()-]+$/;
