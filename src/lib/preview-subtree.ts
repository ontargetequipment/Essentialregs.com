/**
 * The visitor preview of a public subtree (Sprint 7, 11 Oct 2026): the pure
 * half. /regulations/<reg>/preview?p=<id> used to say only "this provision is
 * in the full corpus". Since the Regulation 7 I.C.1 subtree (13 rows) became
 * public, a visitor who follows GP05 VI.C's Regulation 7 citation lands on
 * that row and reads it: its official text and the approved summaries, in the
 * reader's own markup, with the rest of Regulation 7 still locked.
 *
 * Nothing here talks to the database or to Next (the read is
 * preview-subtree-data.ts), so scripts/preview-subtree.test.ts can pin the
 * guard without either.
 *
 * THE GUARD, in three layers (a leak needs all three to fail):
 *   1. The database. The rows are read with the visitor's own cookie-scoped
 *      client, so RLS (provisions.is_public) decides what comes back. No
 *      service-role client reads text on this path.
 *   2. publicSubtree below, the second fence: of whatever came back it keeps
 *      only rows with is_public === true whose id is the focused id or starts
 *      with `${focused}-`, and nothing at all unless the focused row itself is
 *      among them. A locked parent (sec-7-B-I-C) therefore never shows its
 *      public child (sec-7-B-I-C-1), a sibling (sec-7-B-I-C-2) or a lookalike
 *      (sec-7-B-I-C-10) never rides along, and a row the database should not
 *      have returned is dropped.
 *   3. renderSubtreeHtml re-applies layer 2 itself, so a caller cannot render
 *      rows it has not fenced, and links in the text are rewritten so a click
 *      never reaches a reader that would 404 for a visitor.
 */
import sanitizeHtmlLib from "sanitize-html";
import {
  applicabilityContextFor,
  applicabilityContextHtml,
  applicabilityContextKey,
} from "@/lib/applicability-context";
import { isPublicReaderReg, provisionDestination } from "@/lib/destination";
import { foreignOriginOf, originTrailLabel, validProvisionId } from "@/lib/reader-nav";
import {
  escapeHtml,
  gatePublicSummaries,
  isFederalKey,
  promoteHeadingParagraph,
  regKeyOf,
  sanitizeHtml,
  snippetAfterCitation,
  summaryBadgeClass,
  summaryPanelHtml,
  summarySourceLinkHtml,
  summaryStatusBadge,
  withItemIdBadge,
} from "@/lib/regulation-pure";
import { withTourParam, tourRequested, TOUR_PARAM } from "@/lib/tour";
import type { Provision } from "@/lib/types";

/** What the preview reads of one row (the columns in preview-subtree-data.ts). reviewed_by is already reduced to reviewed_by_human. */
export type SubtreeRow = Pick<
  Provision,
  | "id"
  | "citation"
  | "title"
  | "jurisdiction_level"
  | "parent_id"
  | "full_text"
  | "ai_summary"
  | "source_url"
  | "is_public"
  | "sort_order"
  | "summary_status"
  | "reviewed_at"
  | "reviewed_by_human"
>;

type SearchParams = Record<string, string | string[] | undefined>;

const firstValue = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

// ---------------------------------------------------------------------------
// The fence
// ---------------------------------------------------------------------------

/** Whether `id` is the focused provision or one of its descendants (an id starts with its parent's id and a hyphen). */
export function inSubtree(id: string, focusedId: string): boolean {
  return id === focusedId || id.startsWith(`${focusedId}-`);
}

/**
 * The rows a visitor may be shown for a focused provision: the second fence
 * (see the file comment). Keeps rows with is_public === true (strictly: a
 * missing or null flag is a refusal) inside the focused subtree, and returns
 * [] unless the focused row itself is one of them. In sort_order (then id),
 * one row per id.
 */
export function publicSubtree<T extends { id: string; is_public?: boolean | null; sort_order?: number | null }>(
  rows: readonly T[],
  focusedId: string
): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const r of rows) {
    if (r.is_public !== true || !inSubtree(r.id, focusedId) || seen.has(r.id)) continue;
    seen.add(r.id);
    kept.push(r);
  }
  if (!seen.has(focusedId)) return [];
  return kept.sort(
    (a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id)
  );
}

/**
 * The LIKE pattern that selects a row's descendants by id ("sec-7-B-I-C-1-%"):
 * the hyphen keeps "sec-7-B-I-C-10" out, and the characters LIKE treats as
 * wildcards (% and _) or as the escape (\) are escaped. A first filter only:
 * publicSubtree is the fence.
 */
export function subtreeLikePattern(focusedId: string): string {
  return `${focusedId.replace(/[\\%_]/g, "\\$&")}-%`;
}

// ---------------------------------------------------------------------------
// Depth
// ---------------------------------------------------------------------------

/** The number of id segments after "sec-<reg>-": "sec-7-B-I-C-1" is 4. */
function segmentCount(id: string): number {
  const key = regKeyOf(id);
  return key ? id.slice(`sec-${key}-`.length).split("-").filter(Boolean).length : 1;
}

/**
 * The reader's depth-N of the focused row, from its id. The reader derives
 * depth from the chain of parents (depthOf: a row under the regulation root
 * is depth 1, every row below adds one), and the ancestors of a locked
 * subtree are not readable by a visitor. In a Part-structured regulation the
 * chain has one row per id segment ("sec-7-P-B", "sec-7-B-I", "sec-7-B-I-C",
 * "sec-7-B-I-C-1"), so the number of segments is the reader's depth; that
 * holds for all 2,095 Part B rows of Regulation 7 (checked against the
 * importer's parse, scripts/preview-subtree.test.ts keeps the I.C.1 case).
 * It only decides how far a row is indented, so a regulation whose ids do not
 * follow the rule is indented a step too far or too little, never wrong in
 * any other way.
 */
export function readerDepthBase(focusedId: string): number {
  return Math.max(1, segmentCount(focusedId));
}

/** depth-N for every row: the focused row's base, plus one per parent row between it and the focused row. */
function subtreeDepths(rows: readonly SubtreeRow[], focusedId: string): Map<string, number> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const base = readerDepthBase(focusedId);
  const depths = new Map<string, number>();
  for (const row of rows) {
    let hops = 0;
    let cur: SubtreeRow | undefined = row;
    while (cur && cur.id !== focusedId && hops < 32) {
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
      hops++;
    }
    // A row whose chain does not reach the focused row (its parent was not
    // readable) is placed by how many id segments it has below it.
    depths.set(row.id, cur?.id === focusedId ? base + hops : base + Math.max(1, segmentCount(row.id) - segmentCount(focusedId)));
  }
  return depths;
}

// ---------------------------------------------------------------------------
// Links in the text
// ---------------------------------------------------------------------------

export type LinkContext = {
  /** Ids of the rows on the page. */
  ids: ReadonlySet<string>;
};

const REG_LINK = /^\/regulations\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/;

function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Where a click on provision `target` goes from the preview: this page for a row on it, else the destination a visitor can open. */
function targetHref(target: string, ctx: LinkContext): string {
  if (ctx.ids.has(target)) return `#${target}`;
  return provisionDestination({ id: target, reg_key: regKeyOf(target) }, { hasAccess: false });
}

/**
 * One href of the official text, for a visitor (hasAccess false):
 *
 *   /regulations/<reg>#<id>, <id> on this page      -> #<id>
 *   /regulations/<reg>#<id>, any other provision    -> provisionDestination: GP05's
 *                                                      reader, otherwise the focused
 *                                                      preview (the reader 404s)
 *   /regulations/<reg> (a document, no provision,   -> its /preview, or GP05's reader
 *     or its root row)                                  (the query stays there)
 *   anything else (an external link, a test method,   unchanged
 *     a #hash, /regulations/<reg>/preview...)
 *
 * The importer writes these as <a class="xref-external-reg">, with the cited
 * provision in the hash since Sprint 2 and, for a renumbered definition, a
 * "?cited=" query (import_ccr.py). The result never starts with
 * "/regulations/<reg>#" for a regulation whose reader is closed.
 */
export function previewHref(href: string, ctx: LinkContext): string {
  const m = REG_LINK.exec(href);
  if (!m) return href;
  const [, reg, below, query = "", hash = ""] = m;
  // /regulations/<reg>/preview?p=... and anything else below a reader: not ours to rewrite.
  if (below) return href;
  const target = hash ? validProvisionId(safeDecode(hash.slice(1))) : null;
  if (target && !target.includes("-top-REG-")) return targetHref(target, ctx);
  const key = (target && regKeyOf(target)) || reg;
  if (!/^[A-Za-z0-9]+$/.test(key)) return href;
  return isPublicReaderReg(key) ? `/regulations/${key}${query}` : `/regulations/${key}/preview`;
}

const XREF_CLASS = /(^|\s)xref(\s|$)/;

/**
 * Rewrites the links of one row's (already sanitised) text with previewHref,
 * and turns the same-document cross-references into links: the importer
 * writes "Section I.D." as <span class="xref" data-target="sec-7-B-I-D">,
 * which the reader makes clickable with a script the preview does not run, so
 * left alone it would look like a link and do nothing. As an <a class="xref"
 * href> it keeps the reader's styling and goes where previewHref sends a
 * cited provision. The result is sanitised again, so nothing the rewrite adds
 * can be anything the first pass would have removed.
 */
export function rewriteSubtreeLinks(html: string, ctx: LinkContext): string {
  const rewritten = sanitizeHtmlLib(html, {
    // The input has been through sanitizeHtml, which left no script, style or
    // event handler in it; this pass only renames and re-points, and its
    // output goes through sanitizeHtml again below. `allowedTags: false` is the
    // library's "keep every tag" and is why it needs allowVulnerableTags
    // (it warns about script and style, which cannot be here).
    allowedTags: false,
    allowedAttributes: false,
    allowVulnerableTags: true,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href;
        if (href === undefined) return { tagName, attribs };
        const next = previewHref(href, ctx);
        if (next === href) return { tagName, attribs };
        const out: sanitizeHtmlLib.Attributes = { ...attribs, href: next };
        if (next.startsWith("#")) {
          // On this page: not "external", and not a new tab.
          delete out.target;
          if (out.class) out.class = out.class.replace(/(^|\s)xref-external-reg(?=\s|$)/g, "$1xref").trim();
        }
        return { tagName, attribs: out };
      },
      span: (tagName, attribs) => {
        const target = XREF_CLASS.test(attribs.class ?? "") ? validProvisionId(attribs["data-target"]) : null;
        if (!target) return { tagName, attribs };
        const out: sanitizeHtmlLib.Attributes = { ...attribs, href: targetHref(target, ctx) };
        delete out["data-target"];
        return { tagName: "a", attribs: out };
      },
    },
  });
  return sanitizeHtml(rewritten);
}

// ---------------------------------------------------------------------------
// The rows
// ---------------------------------------------------------------------------

/**
 * Fills a summary panel the way the browser fills the reader's: the server
 * writes the panel with an empty source row, a badge without its tooltip and
 * an empty applicability marker (summaryPanelHtml), and reader-client.ts
 * (fillSummaryLinks, fillSummaryBadges, fillApplicabilityContexts) completes
 * them from the same functions used here. The preview runs no such script, so
 * the page ships them finished. scripts/preview-subtree.test.ts compares the
 * result with the reader's own panel after the browser-side fill.
 */
function filledPanel(panel: string, row: SubtreeRow, rootSourceUrl: string | null): string {
  if (!panel) return panel;
  let out = panel;
  const url = row.source_url || rootSourceUrl;
  if (url) {
    out = out.replace(
      '<div class="summary-status"></div>',
      () => `<div class="summary-status">${summarySourceLinkHtml(url, isFederalKey(regKeyOf(row.id)))}</div>`
    );
  }
  const badge = summaryStatusBadge(row);
  if (badge) {
    const open = `<p class="summary-badge ${summaryBadgeClass(badge.kind)}">`;
    out = out.replace(open, () => `${open.slice(0, -1)} title="${escapeHtml(badge.title)}">`);
  }
  const ctxKey = applicabilityContextKey(row.id);
  const ctx = ctxKey ? applicabilityContextFor(ctxKey) : null;
  if (ctxKey && ctx) {
    const marker = `<p class="summary-context" data-ctx="${escapeHtml(ctxKey)}"></p>`;
    out = out.replace(marker, () => `${marker.slice(0, -4)}${applicabilityContextHtml(ctx)}</p>`);
  }
  // The "In this provision" list: the reader's rows are spans a script turns
  // into popups; here each is a link to the row on this page.
  return out.replace(
    /<span class="xref summary-child-link" data-target="([^"]*)">([^<]*)<\/span>/g,
    '<a class="xref summary-child-link" href="#$1">$2</a>'
  );
}

export type SubtreeRender = {
  /** Ids of the rows rendered, in order; [] when nothing may be shown. */
  ids: string[];
  /** The children of #preview-doc; "" when nothing may be shown. */
  html: string;
};

export type SubtreeOptions = {
  /** The regulation key of the page ("7"). */
  reg: string;
  focusedId: string;
  /** The regulation root's source_url, for a row that has none of its own. */
  rootSourceUrl: string | null;
  /**
   * The regulation's summaries still waiting for the automated check
   * (fetchRegulationTeaser's pendingSummaries). While above 0 no summary is
   * shown (gatePublicSummaries, owner decision 5 Oct 2026).
   */
  pendingSummaries: number;
};

/**
 * The public subtree as the reader's markup: for each row, in order,
 *
 *   <div id="{id}" class="item depth-N" data-citation="{citation}">
 *     {the official text, badged and linked as the reader does}
 *     {its summary panel, when its summary passes gatePublicSummaries}
 *   </div>
 *
 * Rows go through publicSubtree first (the caller may pass anything the
 * database returned). Every row is an `item`: the rows of a public subtree
 * are provisions, and a Part or an Appendix would need its own block markup
 * that no public subtree has needed.
 */
export function renderSubtreeHtml(rows: readonly SubtreeRow[], opts: SubtreeOptions): SubtreeRender {
  const fenced = publicSubtree(rows, opts.focusedId);
  if (fenced.length === 0) return { ids: [], html: "" };

  const key = regKeyOf(opts.focusedId) ?? opts.reg;
  const gated = gatePublicSummaries(fenced, new Map([[key, opts.pendingSummaries]])).map((r) => ({
    ...r,
    // The reader's rows are sanitised once, when they are fetched.
    full_text: sanitizeHtml(r.full_text),
  }));
  const ids = new Set(gated.map((r) => r.id));
  const childrenOf = new Map<string, SubtreeRow[]>();
  for (const r of gated) {
    if (!r.parent_id || !ids.has(r.parent_id)) continue;
    const list = childrenOf.get(r.parent_id);
    if (list) list.push(r);
    else childrenOf.set(r.parent_id, [r]);
  }
  const byId = new Map(gated.map((r) => [r.id, r]));
  const depths = subtreeDepths(gated, opts.focusedId);
  const links: LinkContext = { ids };

  const html = gated
    .map((p) => {
      const kids = childrenOf.get(p.id);
      const panel = filledPanel(
        summaryPanelHtml(
          p,
          opts.rootSourceUrl,
          kids?.length
            ? kids.map((c) => ({ id: c.id, citation: c.citation, snippet: snippetAfterCitation(c.full_text, c.citation, 60) }))
            : undefined,
          applicabilityContextKey(p.id)
        ),
        p,
        opts.rootSourceUrl
      );
      // The top of an embedded federal block gets the reader's dashed divider.
      const isFedRoot =
        p.jurisdiction_level === "federal" && byId.get(p.parent_id ?? "")?.jurisdiction_level !== "federal";
      const text = withItemIdBadge(promoteHeadingParagraph(rewriteSubtreeLinks(p.full_text, links)), p.citation);
      return `<div id="${escapeHtml(p.id)}" class="item depth-${depths.get(p.id)}${isFedRoot ? " fed-block" : ""}" data-citation="${escapeHtml(
        p.citation
      )}">${text}${panel}</div>`;
    })
    .join("");
  return { ids: gated.map((r) => r.id), html };
}

// ---------------------------------------------------------------------------
// The way back, and the redirect that keeps it
// ---------------------------------------------------------------------------

/**
 * The preview's return link: "← Back to GP05 · VI.C" when ?from= is a
 * provision of ANOTHER regulation (foreignOriginOf, the reader's own check),
 * to where a visitor opens that provision (provisionDestination: GP05's
 * reader, otherwise its focused preview), carrying ?tour=1 when this page has
 * it. null for no ?from=, a junk one, or one in this regulation.
 */
export function previewReturnLink(searchParams: SearchParams, reg: string): { href: string; label: string } | null {
  const from = firstValue(searchParams.from);
  if (typeof from !== "string") return null;
  const origin = foreignOriginOf(`?${new URLSearchParams({ from }).toString()}`, reg);
  if (!origin) return null;
  const href = provisionDestination({ id: origin, reg_key: regKeyOf(origin) }, { hasAccess: false });
  return {
    href: tourRequested(searchParams[TOUR_PARAM]) ? withTourParam(href) : href,
    label: `← Back to ${originTrailLabel(origin)}`,
  };
}

/**
 * Where a subscriber (or a reader of GP05) who lands on a focused preview is
 * sent: the provision in the reader, keeping ?from= (a valid origin only; the
 * reader draws "← Back to ..." from it) and ?tour=1, so the walkthrough and
 * the return bar survive the redirect:
 * "/regulations/7?from=sec-gp05-VI-C&tour=1#sec-7-B-I-C-1", or
 * "/regulations/7#sec-7-B-I-C-1" when there is neither.
 */
export function readerRedirectHref(reg: string, id: string, searchParams: SearchParams): string {
  const from = firstValue(searchParams.from);
  const origin = typeof from === "string" ? foreignOriginOf(`?${new URLSearchParams({ from }).toString()}`, reg) : null;
  const href = `/regulations/${reg}${origin ? `?from=${encodeURIComponent(origin)}` : ""}#${id}`;
  return tourRequested(searchParams[TOUR_PARAM]) ? withTourParam(href) : href;
}
