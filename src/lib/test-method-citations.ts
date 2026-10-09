import { createAdminClient } from "@/lib/supabase/admin";
import { fetchStagedRegKeys } from "@/lib/release";
import { filterReleased } from "@/lib/regulation-pure";
import { groupCitedBy, type CitedByGroup, type CitingProvision } from "@/lib/test-method-citations-pure";

export * from "@/lib/test-method-citations-pure";

// PostgREST filters travel in the URL, so an `.in()` over hundreds of ids
// is sent in pieces (Method 21 is cited by a few hundred provisions).
const ID_CHUNK = 100;

/** Row shape read from `provisions` for the list -- deliberately excludes full_text and every summary column. */
const CITING_COLUMNS = "id, reg_key, citation, title, sort_order";

/**
 * The provisions that cite a test method, read for the public
 * /test-methods/[slug] page: the ids come from provision_method_citations
 * (migration 20261009005000, written by the importers' apply step from the
 * xref-method anchors in each provision's text), then each provision's
 * citation and title -- navigation, not content: no full_text, no summary.
 *
 * Reads with the service-role client, like fetchRegulationRoots: the page
 * is public and the citation rows are readable by everyone, but the
 * provision labels are behind the subscriber policy and the page has no
 * visitor session to act as (it is prerendered). A staged (not yet
 * released) document is dropped, as everywhere else the app reads with
 * the service role. The reader a row links to applies its own gate.
 */
export async function fetchCitingProvisions(slug: string): Promise<CitingProvision[]> {
  const admin = createAdminClient();
  const { data: cites, error } = await admin
    .from("provision_method_citations")
    .select("provision_id")
    .eq("method_slug", slug);
  if (error) throw new Error(error.message);
  const ids = Array.from(new Set((cites ?? []).map((c: { provision_id: string }) => c.provision_id)));
  if (ids.length === 0) return [];

  const pages: Promise<CitingProvision[]>[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    pages.push(
      (async () => {
        const { data, error } = await admin.from("provisions").select(CITING_COLUMNS).in("id", chunk);
        if (error) throw new Error(error.message);
        return (data ?? []) as CitingProvision[];
      })()
    );
  }
  const [rows, staged] = await Promise.all([Promise.all(pages), fetchStagedRegKeys()]);
  return filterReleased(rows.flat(), staged);
}

/** The grouped "Cited by" list for a method page. */
export async function fetchCitedBy(slug: string): Promise<CitedByGroup[]> {
  return groupCitedBy(await fetchCitingProvisions(slug));
}
