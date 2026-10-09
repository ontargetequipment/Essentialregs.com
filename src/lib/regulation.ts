import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Provision } from "@/lib/types";
import { filterReleased, sanitizeHtml, withReviewerKind } from "@/lib/regulation-pure";
import { fetchStagedRegKeys, isRegReleased } from "@/lib/release";
import { renderReaderBody, type RenderedReader } from "@/lib/reader-render";

// Everything that does NOT talk to the database lives in regulation-pure.ts
// (so scripts/ and tests can import it without a Supabase client, `next/headers`
// or `server-only`); it is re-exported here so callers keep one import path.
export * from "@/lib/regulation-pure";
import { teaserSummariesVisible } from "@/lib/regulation-pure";

const PAGE_SIZE = 1000;

// reviewed_at is the date on the summary badge (summaryStatusBadge).
// reviewed_by is selected only so the badge can tell a person's approval from
// the pipeline's (isHumanReviewer). It holds an email on some rows, so it is
// reduced to the boolean reviewed_by_human the moment the page comes back
// (fetchRegulationProvisions) and never stays on a Provision: this list
// feeds the reader body every subscriber receives.
const PROVISION_COLUMNS =
  "id, citation, title, jurisdiction_level, issuing_body, parent_id, full_text, ai_summary, summary_status, reviewed_at, reviewed_by, source_url, last_verified_date, is_public, sort_order";

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
    for (const raw of (result.data ?? []) as (Provision & { reviewed_by?: string | null })[]) {
      const p = withReviewerKind(raw);
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
 * The markup version of the rendered body. The cache key below is the
 * regulation, the DATA version (fetchReaderVersion: row count and newest
 * updated_at) and this. unstable_cache also keys on the source text of its
 * callback, but that callback is a one-line call to `load` whose text does
 * not change when renderReaderBody's output does, and the data cache
 * outlives a deployment -- so a markup change with no data change would
 * keep serving the old body. Bump this whenever reader-render.ts or the
 * panel builders in regulation-pure.ts change what they emit.
 *
 *   2: the review-status badge in every summary panel (1 Oct 2026).
 *   3: trust copy pass (9 Oct 2026): the badge wording, "Verify on eCFR" on
 *      federal documents, the dateLine in the meta entry.
 */
const READER_RENDER_VERSION = "3";

/**
 * The rendered reader body for a regulation, cached across requests and
 * deployments with Next's data cache, keyed by reg plus the data version
 * from fetchReaderVersion plus READER_RENDER_VERSION. Fetches with the
 * service-role client, because a
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
        dateLine: r.dateLine,
        navHtml: r.navHtml,
        chunks: Math.ceil(r.docHtml.length / CACHE_CHUNK_CHARS),
      };
    },
    ["reader-meta", regNumber, version, READER_RENDER_VERSION],
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
        ["reader-chunk", regNumber, version, READER_RENDER_VERSION, String(i)],
        { tags: ["reader-body"] }
      )()
    )
  );
  return { title: meta.title, blurb: meta.blurb, dateLine: meta.dateLine ?? null, navHtml: meta.navHtml, docHtml: chunks.join("") };
}

/** Every top-level regulation currently in the corpus (for a regulation index). */
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
  /**
   * Summaries of this regulation still waiting for the automated review
   * (summary_status pending with a summary). While above 0 the review run
   * has not finished and the teaser shows no summaries (owner decision,
   * 5 Oct 2026: a regulation's summaries are not shown on public sample or
   * preview pages until its review run has finished).
   */
  pendingSummaries: number;
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
  // A staged document has no public preview: the page 404s on a null root.
  if (!(await isRegReleased(regNumber))) {
    return { root: null, headings: [], summaries: [], pendingSummaries: 0 };
  }
  const supabase = createAdminClient();
  const scopedToReg = () =>
    supabase.from("provisions").select(TEASER_COLUMNS).eq("reg_key", regNumber);

  const [rootResult, headingsResult, summariesResult, pendingResult] = await Promise.all([
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
    // How many of this regulation's summaries are still pending the
    // automated review: a count only, no columns.
    supabase
      .from("provisions")
      .select("id", { count: "exact", head: true })
      .eq("reg_key", regNumber)
      .eq("summary_status", "pending")
      .not("ai_summary", "is", null),
  ]);

  if (rootResult.error) throw new Error(rootResult.error.message);
  if (headingsResult.error) throw new Error(headingsResult.error.message);
  if (summariesResult.error) throw new Error(summariesResult.error.message);
  if (pendingResult.error) throw new Error(pendingResult.error.message);

  const pendingSummaries = pendingResult.count ?? 0;
  return {
    root: (rootResult.data?.[0] as TeaserProvision) ?? null,
    headings: (headingsResult.data ?? []) as TeaserProvision[],
    summaries: teaserSummariesVisible(pendingSummaries)
      ? ((summariesResult.data ?? []) as TeaserProvision[])
      : [],
    pendingSummaries,
  };
}

/**
 * How many summaries of each regulation are still pending the automated
 * review (summary_status pending with a summary), for the public sample
 * page's gate (gatePublicSummaries). Service-role, count-only reads; no
 * text columns.
 */
export async function fetchPendingSummaryCounts(regKeys: string[]): Promise<Map<string, number>> {
  const supabase = createAdminClient();
  const out = new Map<string, number>();
  await Promise.all(
    Array.from(new Set(regKeys)).map(async (key) => {
      const { count, error } = await supabase
        .from("provisions")
        .select("id", { count: "exact", head: true })
        .eq("reg_key", key)
        .eq("summary_status", "pending")
        .not("ai_summary", "is", null);
      if (error) throw new Error(error.message);
      out.set(key, count ?? 0);
    })
  );
  return out;
}

/** Columns the public regulation index may read. Never add full_text here. */
const ROOT_COLUMNS = "id, citation, title, jurisdiction_level, issuing_body";

/** Row shape returned by fetchRegulationRoots -- deliberately excludes full_text. */
export type RegulationRoot = Pick<
  Provision,
  "id" | "citation" | "title" | "jurisdiction_level" | "issuing_body"
>;

/**
 * Public, anonymous-safe read of the regulation ROOT rows (id contains
 * "-top-REG-"): the index of what the corpus covers, which is marketing,
 * not paywalled content. The roots are not `is_public` (see
 * supabase/schema.sql), so the RLS-bound fetchRegulationList() above
 * returns nothing for an anonymous visitor -- /sample then labelled its
 * cards with the raw reg key and /federal showed no cards at all. Like
 * fetchRegulationTeaser, this deliberately bypasses RLS with the
 * service-role client so a prospect sees exactly what a subscriber sees.
 *
 * With `ids`, only those roots (the four /sample cards); without, every
 * root (the /federal and /general-permits indexes, the sitemap).
 *
 * It may NEVER return a non-root row (the "-top-REG-" filter is applied
 * even when `ids` is given, so a section id passed in returns nothing) and
 * NEVER selects `full_text`: ROOT_COLUMNS is citation and title plus the
 * two grouping columns the index cards need. Do not widen this into a
 * general-purpose fetch or add columns beyond ROOT_COLUMNS -- write a
 * new, separately-scoped function instead.
 */
export async function fetchRegulationRoots(ids?: string[]): Promise<RegulationRoot[]> {
  if (ids && ids.length === 0) return [];
  const supabase = createAdminClient();
  let query = supabase
    .from("provisions")
    .select(ROOT_COLUMNS)
    .like("id", "sec-%-top-REG-%")
    .order("id", { ascending: true });
  if (ids) query = query.in("id", ids);
  const [{ data, error }, staged] = await Promise.all([query, fetchStagedRegKeys()]);
  if (error) throw new Error(error.message);
  // A staged (newly imported, not yet released) document is not in any
  // index, sitemap or sample card -- see src/lib/release.ts.
  return filterReleased((data ?? []) as RegulationRoot[], staged);
}
