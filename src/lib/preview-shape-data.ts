import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { subtreeLikePattern, type SubtreeShape } from "@/lib/preview-subtree";

/**
 * The shape of a focused preview's subtree (v3.1, 13 Oct 2026): every row
 * below the focused one, public or not, as its id and order only. What the
 * "… N more provisions in the full corpus" markers are counted from
 * (omittedAfter, preview-subtree.ts).
 *
 * Read with the service role, as the focused provision's own label is
 * (fetchProvisionTeaser), because the visitor's client cannot see the locked
 * rows this count is about. Its own file, apart from preview-subtree-data.ts,
 * which reads the rows a visitor may be shown and must never use the service
 * role (scripts/preview-subtree.test.ts pins both). The column list is the
 * whole safety: no text, no title, no citation, so the most a locked row
 * ever gives a visitor is a number. The focused row itself is not read:
 * omittedAfter places it first.
 */
const SHAPE_COLUMNS = "id, sort_order";

/** More rows than this below one provision is a document, not a preview; the markers then undercount, and say so nowhere. */
const SHAPE_ROW_LIMIT = 2000;

export async function fetchSubtreeShape(reg: string, id: string): Promise<SubtreeShape[]> {
  const { data, error } = await createAdminClient()
    .from("provisions")
    .select(SHAPE_COLUMNS)
    .eq("reg_key", reg)
    .like("id", subtreeLikePattern(id))
    .order("sort_order", { ascending: true })
    .limit(SHAPE_ROW_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []) as SubtreeShape[];
}
