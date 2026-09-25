/**
 * Recovers the provision tree from document order, so the browser can
 * rebuild the contains boxes and the search index from the flat #doc
 * without the page shipping a parent id on every item.
 *
 * The rule (shared by the server and the browser; nothing else may be used
 * on either side):
 *
 *   level(reg)             = 0
 *   level(part | appendix) = 1
 *   level(item)            = level of the nearest preceding reg/part/appendix
 *                            + its depth-N class
 *   parent(row)            = nearest preceding row with a smaller level
 *
 * It is exact for 35,859 of the corpus's 36,517 rows (checked 2026-09-25
 * across all 57 regulations). The 658 it gets wrong are rows the corpus
 * stores out of pre-order (a Part after an Appendix, appendix sub-sections
 * whose ids make kindOf() call them appendices, one misplaced ECMC-style
 * sub-item), and for exactly those rows reader-render.ts writes the true
 * parent into a data-parent attribute, which the browser takes over the
 * derived one. So the browser's tree equals parent_id for every row, and
 * the attribute costs bytes on 1.8% of rows instead of all of them.
 *
 * Dependency-free: this is in the client bundle.
 */
export type ReaderKind = "reg" | "part" | "appendix" | "item";

export type TreeRow = {
  id: string;
  kind: ReaderKind;
  /** depthOf() for items (the depth-N class); ignored for the other kinds. */
  depth: number;
};

/** Derived parent id for each row, in the same order; null for the root. */
export function deriveParents(rows: readonly TreeRow[]): (string | null)[] {
  const levels = new Array<number>(rows.length);
  const parents = new Array<string | null>(rows.length);
  let blockLevel = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    let level: number;
    if (r.kind === "reg") level = blockLevel = 0;
    else if (r.kind === "part" || r.kind === "appendix") level = blockLevel = 1;
    else level = blockLevel + r.depth;
    levels[i] = level;
    let parent: string | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (levels[j] < level) {
        parent = rows[j].id;
        break;
      }
    }
    parents[i] = parent;
  }
  return parents;
}

/**
 * A provision's "top group" is the ancestor that is a direct child of the
 * regulation root (the Part/Appendix/series node whose sidebar entry is a
 * <details> group), or itself when it is one. Same definition
 * buildSearchIndex used on the server. `parentOf` is the final tree
 * (derived + data-parent overrides).
 */
export function topGroupResolver(parentOf: Map<string, string | null>): (id: string) => string {
  const cache = new Map<string, string>();
  const topGroupOf = (id: string): string => {
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    const parent = parentOf.get(id) ?? null;
    const parentsParent = parent ? (parentOf.get(parent) ?? null) : null;
    const group = !parent || !parentsParent ? id : topGroupOf(parent);
    cache.set(id, group);
    return group;
  };
  return topGroupOf;
}
