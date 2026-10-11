import { regKeyOf } from "@/lib/regulation-names";
import {
  gatePublicSummaries,
  promoteHeadingParagraph,
  sanitizeHtml,
  summaryOverview,
  summaryParagraphs,
  summaryStatusBadge,
  titleWithoutCitation,
  withItemIdBadge,
} from "@/lib/regulation-pure";
import { isPublicReaderReg } from "@/lib/destination";
import { publicSubtree, renderPopupRows, type SubtreeRow } from "@/lib/preview-subtree";
import type { SummaryBadgeKind } from "@/lib/snippet";
import { PROVISION_ID } from "@/lib/types";

/**
 * GET /api/provision/[id] -- the gated, one-provision read behind the
 * reader's preview of a link into ANOTHER regulation (RegulationReader.tsx).
 * The decision lives here, with its two effects injected, so
 * scripts/provision-preview.test.ts can prove the gate without Next or a
 * database; route.ts supplies the real ones.
 *
 * Gate, in order:
 *   400  the id is not a provision id (the same PROVISION_ID the rest of the
 *        codebase validates with, bounded, and "sec-<reg>-" shaped);
 *   200 locked  the viewer is not entitled (signed out, or signed in without
 *        access -- getAccessStatus().hasAccess, the same predicate the reader
 *        page gates on, which mirrors the RLS policy) and the provision is
 *        not in a regulation whose reader is open to visitors: the answer is
 *        the LABEL of the provision (id, regulation key, citation, title,
 *        breadcrumb), read label-only with the service role, and no text.
 *        Until Sprint 4 (10 Oct 2026) this was a 401 / 403, and the reader
 *        answered it by replaying the click as plain navigation into the 404
 *        the visitor's own reader gives for the other regulation -- a silent
 *        redirect to an error page. Now the reader opens the same popup it
 *        opens for a subscriber, with the "in the full corpus" panel
 *        (RegulationReader.tsx). 404 when no such row exists, or its
 *        regulation is staged;
 *   200  an unentitled viewer asking for a row of a PUBLIC_READER_REGS
 *        regulation (GP05) gets the normal full payload below, through the
 *        RLS-bound read;
 *   200 public  an unentitled viewer asking for a PUBLIC row of any other
 *        regulation (Regulation 7 I.C.1 and below, is_public since Sprint 7,
 *        11 Oct 2026) gets the normal payload plus `public: true`, its summary
 *        panel and its public sub-rows. The decision is the database's: the
 *        rows are read with the visitor's own RLS-bound client
 *        (fetchSubtree) and then fenced again here (publicSubtree: the
 *        focused row must itself be is_public, so a locked parent of a public
 *        row is still the locked label). A row that comes back empty, or a
 *        read that fails, is the locked label below, never an error and never
 *        text;
 *   404  the RLS-bound read returned no row (missing id, or a row this
 *        session may not read -- the same null /regs/[id] 404s on).
 * The full text is read with the visitor's own cookie-scoped client, never
 * the service role, so the database stays the enforcement point even if the
 * predicate above drifted. The one service-role read is the label.
 *
 * The body is only what the popup needs: the id, its regulation key, the
 * citation, the title, the text -- sanitised, and badged the way the
 * reader's own rows are (promoteHeadingParagraph + withItemIdBadge) -- and,
 * since 7 Oct 2026, the plain-English summary cut to its overview with its
 * review-status badge (the preview of a WHOLE document, a link to
 * /regulations/<key> with no provision in its hash, shows a document's
 * title, citation, effective date and the overview of its top-level
 * summary). No reviewer name, no other metadata.
 */
export type ProvisionPreview = {
  id: string;
  reg_key: string;
  citation: string;
  /** The row's title as stored (for a root row, the document's title). */
  title: string;
  /** Sanitised HTML of the provision's own text. */
  html: string;
  /**
   * The row's plain-English summary: its first two sentences (summaryOverview,
   * the same cut the reader panel makes; the first paragraph when it has no
   * more than two) and the review-status badge the reader shows. null when
   * the row has no summary or the summary is rejected (withheld everywhere).
   */
  summary: { overview: string; badge: { kind: SummaryBadgeKind; label: string } | null } | null;
  /**
   * Only on the answer to a viewer who cannot read the corpus for a row that
   * is public anyway (see the gate above): `public` marks it, `panel` is the
   * row's summary panel markup (its "Plain-English summary" control, review
   * badge and official-source link; "" when its summary is not approved or
   * its regulation's review run has not finished), `below` the public rows
   * under it as `<div class="item">` blocks of text and panel ("" for a
   * leaf). All of it is server-built and escaped like the reader's own rows.
   */
  public?: true;
  panel?: string;
  below?: string;
};

/**
 * What an unentitled viewer gets instead of a provision's text (Sprint 4,
 * 10 Oct 2026): `locked: true` and the label. Never html, never a summary.
 * `title` is already citation-stripped ("" when it added nothing).
 */
export type LockedProvisionPreview = {
  locked: true;
  id: string;
  reg_key: string;
  citation: string;
  title: string;
  /** Ancestor headings below the regulation; null when directly under it. */
  path: string | null;
};

/** The columns the label read may return, and no others (fetchProvisionTeaser). */
export type PreviewLabel = {
  id: string;
  citation: string;
  title?: string | null;
  context_path?: string | null;
};

export type PreviewRow = {
  id: string;
  citation: string;
  title?: string | null;
  full_text: string;
  ai_summary?: string | null;
  summary_status?: string | null;
  reviewed_at?: string | null;
  /** Server only: reduced to the badge kind; the payload carries the badge, never this. */
  reviewed_by?: string | null;
};

/** What the summary panel of a public row needs of its regulation (fetchPanelContext). */
export type PanelContext = {
  /** The regulation root's source_url, for a row that has none of its own. */
  rootSourceUrl: string | null;
  /** The regulation's summaries still waiting for the automated review (gatePublicSummaries). */
  pendingSummaries: number;
};

export type PreviewDeps = {
  /** getAccessStatus(): who is signed in and whether they may read the corpus. */
  access: () => Promise<{ signedIn: boolean; hasAccess: boolean }>;
  /** The RLS-bound read of one provision; null when there is no such readable row. */
  fetchRow: (id: string) => Promise<PreviewRow | null>;
  /**
   * Label-only, service-role read of one provision for a viewer who cannot
   * read it: id, citation, title, context_path and nothing else. null for no
   * such row and for a staged regulation (fetchProvisionTeaser).
   */
  fetchLabel: (id: string) => Promise<PreviewLabel | null>;
  /**
   * The row and everything under it that the viewer's OWN RLS-bound session
   * may read (fetchSubtreeRows): for a visitor, its public rows. Not trusted
   * -- publicSubtree fences the answer.
   */
  fetchSubtree: (id: string) => Promise<SubtreeRow[]>;
  /** The regulation's root source link and pending-summary count; null for a staged regulation. */
  fetchPanelContext: (regKey: string) => Promise<PanelContext | null>;
  /** Regulations whose reader is open to a visitor; defaults to PUBLIC_READER_REGS. */
  publicRegs?: readonly string[];
};

export type PreviewResult =
  | { status: 200; body: ProvisionPreview | LockedProvisionPreview }
  | { status: 400 | 401 | 403 | 404; body: { error: string } };

/** The id if it may be looked up at all, else null. */
export function validPreviewId(id: string): string | null {
  if (!id || id.length > 200 || !PROVISION_ID.test(id) || !regKeyOf(id)) return null;
  return id;
}

/** The summary part of the payload: the overview and the badge, or null (no summary, or rejected). Pure. */
export function previewSummary(
  row: Pick<PreviewRow, "ai_summary" | "summary_status" | "reviewed_at" | "reviewed_by"> & { reviewed_by_human?: boolean }
): ProvisionPreview["summary"] {
  if (row.summary_status === "rejected") return null;
  const paragraphs = summaryParagraphs(row.ai_summary ?? "");
  if (!paragraphs.length) return null;
  const overview = summaryOverview(paragraphs)?.overview ?? paragraphs[0];
  const badge = summaryStatusBadge({
    summary_status: row.summary_status ?? null,
    reviewed_at: row.reviewed_at ?? null,
    reviewed_by: row.reviewed_by ?? null,
    reviewed_by_human: row.reviewed_by_human,
  });
  return { overview, badge: badge ? { kind: badge.kind, label: badge.label } : null };
}

export async function loadProvisionPreview(rawId: string, deps: PreviewDeps): Promise<PreviewResult> {
  const id = validPreviewId(rawId);
  if (!id) return { status: 400, body: { error: "Invalid id." } };
  const { hasAccess } = await deps.access();
  if (!hasAccess && !isPublicReaderReg(regKeyOf(id), deps.publicRegs)) {
    const open = await publicRowAnswer(id, deps);
    if (open) return open;
    const label = await deps.fetchLabel(id);
    if (!label) return { status: 404, body: { error: "Not found." } };
    return {
      status: 200,
      body: {
        locked: true,
        id: label.id,
        reg_key: regKeyOf(label.id) ?? "",
        citation: label.citation,
        title: titleWithoutCitation(label.title ?? "", label.citation),
        path: label.context_path ?? null,
      },
    };
  }
  const row = await deps.fetchRow(id);
  if (!row) return { status: 404, body: { error: "Not found." } };
  return {
    status: 200,
    body: {
      id: row.id,
      reg_key: regKeyOf(row.id) ?? "",
      citation: row.citation,
      title: row.title ?? "",
      html: withItemIdBadge(promoteHeadingParagraph(sanitizeHtml(row.full_text)), row.citation),
      summary: previewSummary(row),
    },
  };
}

/**
 * The answer for a row the viewer cannot read through the corpus but the
 * database lets them read anyway (is_public): null when it is not one (the
 * caller then answers with the locked label). Reads fail closed: an error
 * from the subtree read is a null, and an error from the panel context keeps
 * every summary withheld (a pending count above 0) while the text, which the
 * database already allowed, is still shown. A staged regulation is a 404.
 */
async function publicRowAnswer(id: string, deps: PreviewDeps): Promise<PreviewResult | null> {
  const rows = publicSubtree(await deps.fetchSubtree(id).catch(() => [] as SubtreeRow[]), id);
  if (rows.length === 0) return null;
  const key = regKeyOf(id) ?? "";
  let ctx: PanelContext | null;
  try {
    ctx = await deps.fetchPanelContext(key);
  } catch {
    ctx = { rootSourceUrl: null, pendingSummaries: 1 };
  }
  if (!ctx) return { status: 404, body: { error: "Not found." } };
  const popup = renderPopupRows(rows, { reg: key, focusedId: id, rootSourceUrl: ctx.rootSourceUrl, pendingSummaries: ctx.pendingSummaries });
  if (!popup) return null;
  const focused = rows.find((r) => r.id === id)!;
  // The summary field follows the same gate as the panel: no ungated summary rides in the JSON.
  const [gated] = gatePublicSummaries([focused], new Map([[key, ctx.pendingSummaries]]));
  return {
    status: 200,
    body: {
      id: focused.id,
      reg_key: key,
      citation: focused.citation,
      title: focused.title ?? "",
      html: popup.html,
      summary: previewSummary(gated),
      public: true,
      panel: popup.panel,
      below: popup.below,
    },
  };
}

/**
 * The Cache-Control of a /api/provision response. A full payload is private
 * for five minutes, like /api/related; a refusal and a LOCKED label are
 * never cached: a visitor who starts a trial a minute later must get the
 * text, not the lock they saw before.
 */
export function previewCacheControl(result: PreviewResult): string {
  return result.status === 200 && !("locked" in result.body) ? "private, max-age=300" : "no-store";
}
