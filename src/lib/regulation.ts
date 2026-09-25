import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Provision } from "@/lib/types";
import { sanitizeHtml } from "@/lib/regulation-pure";
import { renderReaderBody, type RenderedReader } from "@/lib/reader-render";

// Everything that does NOT talk to the database lives in regulation-pure.ts
// (so scripts/ and tests can import it without a Supabase client, `next/headers`
// or `server-only`); it is re-exported here so callers keep one import path.
export * from "@/lib/regulation-pure";

const PAGE_SIZE = 1000;

const PROVISION_COLUMNS =
  "id, citation, title, jurisdiction_level, issuing_body, parent_id, full_text, ai_summary, summary_status, source_url, last_verified_date, is_public, sort_order";

/**
 * Fetches every provision belonging to a regulation (stored `reg_key`, the
 * "<reg>" of "sec-<reg>-..."), paginating past PostgREST's default 1000-row
 * cap. A regulation like Colorado Reg 3 has 2,000+ rows, so a single
 * .select() would silently truncate without this.
 *
 * Page 0 is fetched alone and asks for the exact count; every remaining
 * page is then requested at once (Promise.all) instead of one awaited
 * round-trip per 1,000 rows -- ECMC is seven pages.
 *
 * Reads through the request's cookie-scoped client by default, so RLS
 * decides what comes back. `supabase` is for fetchRenderedReader, which
 * runs inside the cross-request cache with the service-role client and
 * must never be reachable except through the gate in reader-page.ts.
 */
export async function fetchRegulationProvisions(
  regNumber: string,
  supabase?: SupabaseClient
): Promise<Provision[]> {
  const client = supabase ?? (await createClient());
  const page = (from: number, withCount: boolean) =>
    client
      .from("provisions")
      .select(PROVISION_COLUMNS, withCount ? { count: "exact" } : undefined)
      // `reg_key` + `sort_order` is a composite index; `id like 'sec-<reg>-%'`
      // was a seq scan + disk sort of the whole regulation on every page.
      .eq("reg_key", regNumber)
      .order("sort_order", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

  const first = await page(0, true);
  if (first.error) throw new Error(first.error.message);
  const total = first.count ?? first.data?.length ?? 0;
  const rest: ReturnType<typeof page>[] = [];
  for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) rest.push(page(from, false));

  const all: Provision[] = [];
  for (const result of [first, ...(await Promise.all(rest))]) {
    if (result.error) throw new Error(result.error.message);
    for (const p of (result.data ?? []) as Provision[]) {
      all.push({ ...p, full_text: sanitizeHtml(p.full_text) });
    }
  }
  return all;
}

/**
 * The data version of one regulation: "<row count>:<max updated_at>". Both
 * change on any import, edit or delete (provisions.updated_at defaults to
 * now() on insert and the provisions_set_updated_at trigger bumps it on
 * update), so it is the cache key for the rendered body -- see
 * fetchRenderedReader. One cheap request: PostgREST's exact count header
 * plus the single newest row (aggregates are not enabled on this project,
 * so max() has to be an ORDER BY ... LIMIT 1).
 *
 * Cookie-scoped, like every other read on the subscriber's behalf.
 */
export async function fetchReaderVersion(regNumber: string): Promise<string> {
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("provisions")
    .select("updated_at", { count: "exact" })
    .eq("reg_key", regNumber)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const newest = (data?.[0] as { updated_at: string | null } | undefined)?.updated_at ?? "";
  return `${count ?? 0}:${newest}`;
}

// The cached body is stored in pieces this long (JS string length), so no
// single entry approaches the per-item size limit of the data cache
// behind unstable_cache (Vercel's is small; ECMC's body is ~4 MB).
const CACHE_CHUNK_CHARS = 800_000;

/**
 * The rendered reader body for a regulation, cached across requests and
 * deployments with Next's data cache, keyed by reg plus the data version
 * from fetchReaderVersion. Fetches with the service-role client, because a
 * cache scope cannot read cookies() and the body is the same for every
 * entitled subscriber anyway.
 *
 * THE GATE IS NOT HERE. Call this only through loadReaderPage
 * (reader-page.ts), after getAccessStatus() has said yes on this request;
 * see the invariant there and scripts/reader-gate.test.ts.
 *
 * Stored as one small "meta" entry (title, blurb, sidebar tree, chunk
 * count) plus N chunk entries of docHtml, all under the same key parts. On
 * a miss the regulation is fetched and rendered ONCE per request (`load`
 * is memoised) however many entries need filling; a partial hit (an
 * evicted chunk) recomputes once and refills only what is missing.
 */
export async function fetchRenderedReader(
  regNumber: string,
  version: string
): Promise<RenderedReader | null> {
  let loading: Promise<RenderedReader | null> | null = null;
  const load = () =>
    (loading ??= fetchRegulationProvisions(regNumber, createAdminClient()).then(renderReaderBody));

  const meta = await unstable_cache(
    async () => {
      const r = await load();
      if (!r) return null;
      return {
        title: r.title,
        blurb: r.blurb,
        navHtml: r.navHtml,
        chunks: Math.ceil(r.docHtml.length / CACHE_CHUNK_CHARS),
      };
    },
    ["reader-meta", regNumber, version],
    { tags: ["reader-body"] }
  )();
  if (!meta) return null;

  const chunks = await Promise.all(
    Array.from({ length: meta.chunks }, (_, i) =>
      unstable_cache(
        async () => {
          const r = await load();
          return r ? r.docHtml.slice(i * CACHE_CHUNK_CHARS, (i + 1) * CACHE_CHUNK_CHARS) : "";
        },
        ["reader-chunk", regNumber, version, String(i)],
        { tags: ["reader-body"] }
      )()
    )
  );
  return { title: meta.title, blurb: meta.blurb, navHtml: meta.navHtml, docHtml: chunks.join("") };
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
