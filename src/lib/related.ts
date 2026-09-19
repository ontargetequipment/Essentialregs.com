import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, summaryParagraphs } from "@/lib/regulation";
import { regBadge, regLabel } from "@/lib/semantic";

/**
 * "Related provisions" — Phase 4 of the semantic-search plan.
 *
 * Reads `provision_neighbors` (precomputed by pipeline/embed.py: the five
 * closest provisions corpus-wide, excluding the row's own parent, children
 * and siblings). Two read paths:
 *
 *   fetchRelated()        — as the visitor. RLS on provision_neighbors and on
 *                           provisions decides what comes back (subscribers:
 *                           everything; anonymous: public↔public only).
 *   fetchRelatedTeaser()  — service role, for /sample: citation + title + an
 *                           already-reviewed summary, never full_text, linking
 *                           to the public /preview pages. Same idea as
 *                           fetchRegulationTeaser() in lib/regulation.ts.
 */

export type RelatedItem = {
  id: string;
  citation: string;
  title: string;
  reg_key: string | null;
  jurisdiction_level: string;
  /** First paragraph of the summary, or null when there is none / it was rejected. */
  summary: string | null;
  score: number;
  rank: number;
  badge: string;
  regLabel: string;
  /** true when this neighbour is in a different regulation than the anchor. */
  crossReg: boolean;
};

export const RELATED_ID = /^[A-Za-z0-9_.:()-]+$/;
/** A cross-reg neighbour this close to the best score is promoted to the top. */
const CROSS_REG_PROMOTE_DELTA = 0.03;

export function regKeyOf(id: string): string | null {
  const m = /^sec-([^-]+)-/.exec(id);
  return m ? m[1].toLowerCase() : null;
}

type NeighborRow = {
  rank: number;
  score: number;
  neighbor: {
    id: string;
    citation: string;
    title: string;
    ai_summary: string | null;
    summary_status: string | null;
    jurisdiction_level: string;
  } | null;
};

function toItem(anchorId: string, row: NeighborRow): RelatedItem | null {
  const n = row.neighbor;
  if (!n) return null;
  const key = regKeyOf(n.id);
  const paras = n.summary_status === "rejected" ? [] : summaryParagraphs(n.ai_summary ?? "");
  return {
    id: n.id,
    citation: n.citation,
    title: n.title,
    reg_key: key,
    jurisdiction_level: n.jurisdiction_level,
    summary: paras[0] ?? null,
    score: row.score,
    rank: row.rank,
    badge: regBadge(key, n.jurisdiction_level),
    regLabel: regLabel(key),
    crossReg: key !== regKeyOf(anchorId),
  };
}

/** Rank order, but a cross-regulation neighbour within CROSS_REG_PROMOTE_DELTA of the top score goes first. */
export function orderForDisplay(items: RelatedItem[]): RelatedItem[] {
  if (items.length < 2) return items;
  const sorted = [...items].sort((a, b) => a.rank - b.rank);
  const top = sorted[0].score;
  const promoted = sorted.filter((i) => i.crossReg && i.score >= top - CROSS_REG_PROMOTE_DELTA);
  const rest = sorted.filter((i) => !promoted.includes(i));
  return [...promoted, ...rest];
}

const SELECT =
  "rank, score, neighbor:provisions!provision_neighbors_neighbor_id_fkey(id, citation, title, ai_summary, summary_status, jurisdiction_level)";

/** Related provisions as the current visitor (RLS-bound). */
export async function fetchRelated(provisionId: string): Promise<RelatedItem[]> {
  if (!RELATED_ID.test(provisionId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provision_neighbors")
    .select(SELECT)
    .eq("provision_id", provisionId)
    .order("rank", { ascending: true });
  if (error) throw new Error(error.message);
  const items = ((data ?? []) as unknown as NeighborRow[])
    .map((r) => toItem(provisionId, r))
    .filter((i): i is RelatedItem => i !== null);
  return orderForDisplay(items);
}

/**
 * Teaser variant for the public /sample page: bypasses RLS with the service
 * role but only ever returns citation/title/reviewed-summary — no full_text —
 * so an anonymous visitor sees *that* related material exists (and can go to
 * the /preview page) without reading it. Keep the column list as is.
 */
export async function fetchRelatedTeaser(provisionId: string): Promise<RelatedItem[]> {
  if (!RELATED_ID.test(provisionId)) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("provision_neighbors")
    .select(SELECT)
    .eq("provision_id", provisionId)
    .order("rank", { ascending: true });
  if (error) throw new Error(error.message);
  const items = ((data ?? []) as unknown as NeighborRow[])
    .map((r) => {
      if (r.neighbor && !["approved", "edited"].includes(r.neighbor.summary_status ?? "")) {
        r.neighbor.ai_summary = null; // unreviewed summaries stay behind the paywall
      }
      return toItem(provisionId, r);
    })
    .filter((i): i is RelatedItem => i !== null);
  return orderForDisplay(items);
}

/** Reader link for a related item. */
export function hrefForRelated(item: Pick<RelatedItem, "id" | "reg_key">, teaser = false): string {
  if (!item.reg_key) return `/regs/${item.id}`;
  return teaser ? `/regulations/${item.reg_key}/preview` : `/regulations/${item.reg_key}#${item.id}`;
}

/**
 * Collapsed placeholder rendered inline in the regulation reader for every
 * provision. The list is fetched from /api/related the first time the
 * <details> is opened (see RelatedProvisionsLoader.tsx) — the reader page
 * already renders 2,000+ provisions server-side, so shipping five neighbours
 * for each of them up front would double the page for links most readers
 * never open.
 */
export function relatedPanelHtml(provisionId: string): string {
  if (!RELATED_ID.test(provisionId)) return "";
  return (
    `<details class="related-panel" data-related-for="${escapeHtml(provisionId)}">` +
    `<summary>Related provisions</summary>` +
    `<div class="related-body"><p class="related-note">Loading…</p></div>` +
    `</details>`
  );
}
