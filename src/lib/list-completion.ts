/**
 * List completion (9 Oct 2026), for an Ask search limited to one named
 * document (ask-scope.ts).
 *
 * The outside reviewer's acceptance for "What test methods apply to a Method
 * 21 inspection under Subpart OOOO?" is that 40 CFR 60.5416(b)(1) to (b)(6)
 * come first. Retrieval ranked (b)(1), (b)(2), (b), an unrelated 60.5413
 * paragraph and (b)(3) in its top ten but not (b)(4) or (b)(6): the six are
 * the items of one printed list, and a list read with half of it missing is
 * a misleading answer. So when the search is limited and the hits hold at
 * least two direct children of one provision P, ALL of P's direct children
 * are read (parent_id = P, in printed order, through the same RLS-bound
 * client) and the family is placed, P first and then its children, at the
 * position of its highest-ranked member. The children retrieval did not
 * find are marked `retrieved: false`, like a question map's canonical rows:
 * they are list rows, not hits, and carry no score. The window is then the
 * original hit count again. Never runs unlimited: a broad question keeps
 * retrieval's own order and cut.
 *
 * `familiesToComplete` and `completeList` are pure (unit-tested with a
 * fixture shaped like the failing case); `completeListRows` is the one
 * function the Ask page, /api/search/semantic, scripts/ask-eval.ts and the
 * admin eval page all call.
 */

/**
 * A parent with more direct children than this is a section heading or a
 * part, not a printed list (a document's sections, a Part's sections):
 * completing it would pull in the whole document, so it is left alone.
 */
export const MAX_LIST_ITEMS = 20;

/**
 * The parents (provision ids) whose children should be read: two or more of
 * their direct children are among the hits. A document root is never one.
 */
export function familiesToComplete(hits: { id: string }[], parentOf: Map<string, string | null>): string[] {
  const count = new Map<string, number>();
  for (const h of hits) {
    const p = parentOf.get(h.id);
    if (p && !p.includes("-top-REG-")) count.set(p, (count.get(p) ?? 0) + 1);
  }
  return [...count].filter(([, n]) => n >= 2).map(([p]) => p);
}

/**
 * The completed list. `rowById` holds every row the caller read (the
 * family parents and all their children); a hit keeps its own object.
 * `childIds` lists each family's children in printed order. A family sits at
 * the position of its highest-ranked member (the parent or any child among
 * the hits), parent first; rows already placed are not repeated. The result
 * is cut to `window` rows.
 */
export function completeList<T extends { id: string }>(
  hits: T[],
  parentOf: Map<string, string | null>,
  rowById: Map<string, T>,
  childIds: Map<string, string[]>,
  window: number = hits.length
): T[] {
  const families = new Set(familiesToComplete(hits, parentOf));
  const placed = new Set<string>();
  const out: T[] = [];
  const place = (id: string, hitById: Map<string, T>) => {
    if (placed.has(id)) return;
    const row = hitById.get(id) ?? rowById.get(id);
    if (!row) return;
    placed.add(id);
    out.push(row);
  };
  const hitById = new Map(hits.map((h) => [h.id, h]));
  for (const h of hits) {
    const family = families.has(h.id) ? h.id : parentOf.get(h.id) && families.has(parentOf.get(h.id)!) ? parentOf.get(h.id)! : null;
    if (!family) {
      place(h.id, hitById);
      continue;
    }
    if (placed.has(family)) {
      place(h.id, hitById);
      continue;
    }
    place(family, hitById);
    for (const c of childIds.get(family) ?? []) place(c, hitById);
    place(h.id, hitById);
  }
  return out.slice(0, Math.max(window, 0));
}

/** The fields of a provision row the completion reads for the rows it adds. */
type FamilyDbRow = {
  id: string;
  citation: string;
  title: string;
  reg_key: string | null;
  jurisdiction_level: "state" | "federal" | "county";
  parent_id: string | null;
  ai_summary: string | null;
  summary_status: string | null;
  context_path: string | null;
  sort_order: number | null;
};

/** A row added by completion: shaped like a SemanticHit with no score, `retrieved: false`. */
export type ListRow = {
  id: string;
  citation: string;
  title: string;
  reg_key: string | null;
  jurisdiction_level: "state" | "federal" | "county";
  summary: string | null;
  score: null;
  path: string | null;
  retrieved: false;
};

/** The slice of a supabase client the completion uses. */
type QueryBuilder = {
  select: (cols: string) => {
    in: (col: string, values: string[]) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> & {
      order?: (col: string, o: { ascending: boolean }) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
    };
  };
};
export type CompletionClient = { from: (table: string) => unknown };

const COLS = "id, citation, title, reg_key, jurisdiction_level, parent_id, ai_summary, summary_status, context_path, sort_order";

/**
 * The completed hits for a limited search (`within` set), else the hits
 * unchanged. A failed read leaves the hits as retrieval ranked them.
 */
export async function completeListRows<T extends { id: string }>(
  client: CompletionClient,
  hits: T[],
  within: string | null,
  log: (message: string) => void = (m) => console.error(m)
): Promise<(T | ListRow)[]> {
  if (!within || hits.length < 2) return hits;
  const table = () => client.from("provisions") as QueryBuilder;
  const parents = await table().select("id, parent_id").in("id", hits.map((h) => h.id));
  if (parents.error) {
    log(`ask: list completion lookup failed: ${parents.error.message}`);
    return hits;
  }
  const parentOf = new Map<string, string | null>(((parents.data ?? []) as { id: string; parent_id: string | null }[]).map((r) => [r.id, r.parent_id]));
  const families = familiesToComplete(hits, parentOf);
  if (families.length === 0) return hits;

  const have = new Set(hits.map((h) => h.id));
  const kidsQ = table().select(COLS).in("parent_id", families);
  const kids = await (kidsQ.order ? kidsQ.order("sort_order", { ascending: true }) : kidsQ);
  const missingParents = families.filter((p) => !have.has(p));
  const parentRows = missingParents.length > 0 ? await table().select(COLS).in("id", missingParents) : { data: [], error: null };
  if (kids.error || parentRows.error) {
    log(`ask: list completion read failed: ${kids.error?.message ?? parentRows.error?.message}`);
    return hits;
  }
  // A parent with a long run of children is a heading, not a list: not completed.
  const perParent = new Map<string, number>();
  for (const r of (kids.data ?? []) as FamilyDbRow[]) if (r.parent_id) perParent.set(r.parent_id, (perParent.get(r.parent_id) ?? 0) + 1);
  const lists = families.filter((p) => (perParent.get(p) ?? 0) <= MAX_LIST_ITEMS);
  if (lists.length === 0) return hits;
  const rowById = new Map<string, T | ListRow>();
  const childIds = new Map<string, string[]>();
  const toRow = (r: FamilyDbRow): ListRow => ({
    id: r.id,
    citation: r.citation,
    title: r.title,
    reg_key: r.reg_key,
    jurisdiction_level: r.jurisdiction_level,
    summary: r.summary_status === "rejected" ? null : r.ai_summary,
    score: null,
    path: r.context_path,
    retrieved: false,
  });
  for (const r of [...((kids.data ?? []) as FamilyDbRow[]), ...((parentRows.data ?? []) as FamilyDbRow[])]) {
    rowById.set(r.id, toRow(r));
    if (r.parent_id && lists.includes(r.parent_id)) {
      const list = childIds.get(r.parent_id) ?? [];
      list.push(r.id);
      childIds.set(r.parent_id, list);
    }
  }
  // Children come back in sort_order (the printed order); parents of the hits are known from the hits' own rows.
  return completeList<T | ListRow>(hits, new Map([...parentOf].filter(([, p]) => p === null || lists.includes(p) || !families.includes(p))), rowById, childIds, hits.length);
}
