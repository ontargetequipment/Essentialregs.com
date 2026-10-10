import { regKeyOf } from "@/lib/regulation-names";
import {
  promoteHeadingParagraph,
  sanitizeHtml,
  summaryOverview,
  summaryParagraphs,
  summaryStatusBadge,
  withItemIdBadge,
} from "@/lib/regulation-pure";
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
 *   401  nobody is signed in;
 *   403  signed in without access (getAccessStatus().hasAccess -- the same
 *        predicate the reader page gates on, which mirrors the RLS policy);
 *   404  the RLS-bound read returned no row (missing id, or a row this
 *        session may not read -- the same null /regs/[id] 404s on).
 * The row is read with the visitor's own cookie-scoped client, never the
 * service role, so the database stays the enforcement point even if the
 * predicate above drifted.
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

export type PreviewDeps = {
  /** getAccessStatus(): who is signed in and whether they may read the corpus. */
  access: () => Promise<{ signedIn: boolean; hasAccess: boolean }>;
  /** The RLS-bound read of one provision; null when there is no such readable row. */
  fetchRow: (id: string) => Promise<PreviewRow | null>;
};

export type PreviewResult =
  | { status: 200; body: ProvisionPreview }
  | { status: 400 | 401 | 403 | 404; body: { error: string } };

/** The id if it may be looked up at all, else null. */
export function validPreviewId(id: string): string | null {
  if (!id || id.length > 200 || !PROVISION_ID.test(id) || !regKeyOf(id)) return null;
  return id;
}

/** The summary part of the payload: the overview and the badge, or null (no summary, or rejected). Pure. */
export function previewSummary(row: Pick<PreviewRow, "ai_summary" | "summary_status" | "reviewed_at" | "reviewed_by">): ProvisionPreview["summary"] {
  if (row.summary_status === "rejected") return null;
  const paragraphs = summaryParagraphs(row.ai_summary ?? "");
  if (!paragraphs.length) return null;
  const overview = summaryOverview(paragraphs)?.overview ?? paragraphs[0];
  const badge = summaryStatusBadge({
    summary_status: row.summary_status ?? null,
    reviewed_at: row.reviewed_at ?? null,
    reviewed_by: row.reviewed_by ?? null,
  });
  return { overview, badge: badge ? { kind: badge.kind, label: badge.label } : null };
}

export async function loadProvisionPreview(rawId: string, deps: PreviewDeps): Promise<PreviewResult> {
  const id = validPreviewId(rawId);
  if (!id) return { status: 400, body: { error: "Invalid id." } };
  const { signedIn, hasAccess } = await deps.access();
  if (!signedIn) return { status: 401, body: { error: "Sign in to preview this provision." } };
  if (!hasAccess) return { status: 403, body: { error: "A subscription is required to preview this provision." } };
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
