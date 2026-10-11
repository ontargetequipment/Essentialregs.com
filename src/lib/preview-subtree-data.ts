import "server-only";
import { createClient } from "@/lib/supabase/server";
import { subtreeLikePattern, type SubtreeRow } from "@/lib/preview-subtree";
import { withReviewerKind } from "@/lib/regulation-pure";

/**
 * The columns the focused preview reads of a public row. These are the
 * reader's own (regulation.ts PROVISION_COLUMNS) less what the preview does
 * not use; reviewed_by is reduced to a boolean the moment it is read.
 */
const SUBTREE_COLUMNS =
  "id, citation, title, jurisdiction_level, parent_id, full_text, ai_summary, summary_status, reviewed_at, reviewed_by, source_url, is_public, sort_order";

/** A subtree this large is not a preview; the limit keeps a mistaken prefix from reading a whole document. */
const SUBTREE_ROW_LIMIT = 500;

/**
 * The focused provision and everything below it that the VISITOR may read.
 *
 * Read through the request's cookie-scoped client, never the service role:
 * the database's own policy (provisions.is_public) is what decides which of
 * these rows exist for this request, so an unentitled visitor gets the public
 * ones and a locked row simply is not in the answer. (The page redirects an
 * entitled visitor to the reader before it gets here.) What comes back is
 * still not trusted: publicSubtree (preview-subtree.ts) is the fence the page
 * applies before anything is rendered.
 *
 * Two reads, the row and its descendants (`id like '<id>-%'`), because an id
 * holds parentheses and commas that a PostgREST `or` filter cannot take
 * unquoted. Both are scoped by reg_key, the composite-indexed column.
 * `id` is validated against PROVISION_ID by the caller (focusedId in the page).
 */
export async function fetchSubtreeRows(reg: string, id: string): Promise<SubtreeRow[]> {
  const supabase = await createClient();
  const scoped = () => supabase.from("provisions").select(SUBTREE_COLUMNS).eq("reg_key", reg);
  const [self, below] = await Promise.all([
    scoped().eq("id", id).maybeSingle(),
    scoped()
      .like("id", subtreeLikePattern(id))
      .order("sort_order", { ascending: true })
      .limit(SUBTREE_ROW_LIMIT),
  ]);
  if (self.error) throw new Error(self.error.message);
  if (below.error) throw new Error(below.error.message);
  const raw = [self.data, ...(below.data ?? [])].filter((r) => r !== null && r !== undefined) as unknown as (SubtreeRow & {
    reviewed_by?: string | null;
  })[];
  return raw.map((r) => withReviewerKind(r)) as SubtreeRow[];
}
