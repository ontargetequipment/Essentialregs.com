import { regKeyOf } from "@/lib/regulation-names";
import { promoteHeadingParagraph, sanitizeHtml, withItemIdBadge } from "@/lib/regulation-pure";
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
 * citation and the text -- sanitised, and badged the way the reader's own
 * rows are (promoteHeadingParagraph + withItemIdBadge). No summary, no
 * metadata.
 */
export type ProvisionPreview = {
  id: string;
  reg_key: string;
  citation: string;
  /** Sanitised HTML of the provision's own text. */
  html: string;
};

export type PreviewRow = { id: string; citation: string; full_text: string };

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
      html: withItemIdBadge(promoteHeadingParagraph(sanitizeHtml(row.full_text)), row.citation),
    },
  };
}
