import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Provision } from "@/lib/types";
import { sanitizeHtml } from "@/lib/regulation-pure";

// Everything that does NOT talk to the database lives in regulation-pure.ts
// (so scripts/ and tests can import it without a Supabase client, `next/headers`
// or `server-only`); it is re-exported here so callers keep one import path.
export * from "@/lib/regulation-pure";

const PAGE_SIZE = 1000;

/**
 * Fetches every provision belonging to a regulation (stored `reg_key`, the
 * "<reg>" of "sec-<reg>-..."), paginating past PostgREST's default 1000-row
 * cap. A regulation like
 * Colorado Reg 3 has 2,000+ rows, so a single .select() would silently
 * truncate without this.
 */
export async function fetchRegulationProvisions(
  regNumber: string
): Promise<Provision[]> {
  const supabase = await createClient();
  const all: Provision[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("provisions")
      .select(
        "id, citation, title, jurisdiction_level, issuing_body, parent_id, full_text, ai_summary, summary_status, source_url, last_verified_date, is_public, sort_order"
      )
      // `reg_key` + `sort_order` is a composite index; `id like 'sec-<reg>-%'`
      // was a seq scan + disk sort of the whole regulation on every page.
      .eq("reg_key", regNumber)
      .order("sort_order", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(
      ...(data as Provision[]).map((p) => ({
        ...p,
        full_text: sanitizeHtml(p.full_text),
      }))
    );
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

/** Every top-level regulation currently in the corpus (for the /regulations index). */
export async function fetchRegulationList(): Promise<Provision[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provisions")
    .select("id, citation, title, jurisdiction_level, issuing_body")
    .like("id", "sec-%-top-REG-%")
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Provision[];
}

/** Columns the public teaser is ever allowed to read. Never add full_text here. */
const TEASER_COLUMNS = "id, citation, title, ai_summary, summary_status, source_url";

/** Row shape returned by fetchRegulationTeaser — deliberately excludes full_text. */
export type TeaserProvision = Pick<
  Provision,
  "id" | "citation" | "title" | "ai_summary" | "summary_status" | "source_url"
>;

export type RegulationTeaser = {
  root: TeaserProvision | null;
  /** Top-level Part/Appendix headings only (see kindOf) -- no section bodies. */
  headings: TeaserProvision[];
  /** Up to TEASER_SUMMARY_LIMIT reviewed, non-empty summaries for the teaser. */
  summaries: TeaserProvision[];
};

/** Max plain-English summaries shown on a public /preview teaser page. */
export const TEASER_SUMMARY_LIMIT = 5;

/**
 * Public, anonymous-safe read path for the SEO teaser page
 * (/regulations/[reg]/preview). The real corpus is not `is_public` (see
 * supabase/schema.sql), so an anonymous visitor's RLS-bound client
 * (fetchRegulationProvisions above) returns nothing for it. This function
 * deliberately bypasses RLS with the service-role client to expose a small,
 * fixed slice of marketing-safe data:
 *
 *   - the regulation's own citation/title,
 *   - its top-level Part/Appendix headings (citation/title only), and
 *   - up to TEASER_SUMMARY_LIMIT already human-reviewed ai_summary rows.
 *
 * It NEVER selects `full_text` and is capped to a handful of rows. Do not
 * widen this into a general-purpose fetch or add columns beyond
 * TEASER_COLUMNS -- write a new, separately-scoped function instead.
 */
export async function fetchRegulationTeaser(
  regNumber: string
): Promise<RegulationTeaser> {
  const supabase = createAdminClient();
  const scopedToReg = () =>
    supabase.from("provisions").select(TEASER_COLUMNS).eq("reg_key", regNumber);

  const [rootResult, headingsResult, summariesResult] = await Promise.all([
    // The regulation's own top-level row (id contains "-top-REG-").
    scopedToReg().like("id", "%-top-REG-%").limit(1),
    // Top-level Part/Appendix headings only -- every such row's parent_id is
    // the regulation root itself (verified against the live corpus), so no
    // section body ever matches this filter.
    scopedToReg()
      .or("id.like.%-PART-%,id.like.%-APPENDIX-%")
      .order("sort_order", { ascending: true }),
    // A capped teaser of already-reviewed, non-empty plain-English summaries.
    scopedToReg()
      .in("summary_status", ["approved", "edited"])
      .not("ai_summary", "is", null)
      .neq("ai_summary", "")
      .order("sort_order", { ascending: true })
      .limit(TEASER_SUMMARY_LIMIT),
  ]);

  if (rootResult.error) throw new Error(rootResult.error.message);
  if (headingsResult.error) throw new Error(headingsResult.error.message);
  if (summariesResult.error) throw new Error(summariesResult.error.message);

  return {
    root: (rootResult.data?.[0] as TeaserProvision) ?? null,
    headings: (headingsResult.data ?? []) as TeaserProvision[],
    summaries: (summariesResult.data ?? []) as TeaserProvision[],
  };
}

/**
 * Reg-number list for enumerating /regulations/[reg]/preview URLs in
 * src/app/sitemap.ts. NOTE: this deliberately does NOT reuse the ordinary
 * (RLS-bound) fetchRegulationList() above -- that function is subject to the
 * same anon-role RLS policy described on fetchRegulationTeaser (only
 * `is_public` rows are visible), and none of the real regulations are
 * `is_public`. Sitemap generation runs with no user session, so calling the
 * RLS-bound version here would silently enumerate zero regulations and the
 * teaser pages would never get linked/indexed. Bypasses RLS the same way,
 * with the same full_text-free column list.
 */
export async function fetchRegulationRootsForSitemap(): Promise<TeaserProvision[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("provisions")
    .select(TEASER_COLUMNS)
    .like("id", "sec-%-top-REG-%")
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TeaserProvision[];
}
