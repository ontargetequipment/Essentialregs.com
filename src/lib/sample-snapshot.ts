import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchStagedRegKeys } from "@/lib/release";
import { fetchPendingSummaryCounts } from "@/lib/regulation";
import { gatePublicSummaries, withReviewerKind } from "@/lib/regulation-pure";
import { regKeyOf } from "@/lib/regulation-names";
import {
  SNAPSHOT,
  sampleIds,
  summaryIds,
  type SampleLabel,
  type SampleRow,
  type SampleSummary,
} from "@/lib/sample-pure";

/**
 * Request-time hydration of the /sample snapshot (Sprint 4, 10 Oct 2026):
 * the ids in src/data/sample-snapshot.json, looked up for their labels. The
 * corpus is not is_public (GP05 apart), so the lookup bypasses RLS with the
 * service-role client, and the column lists below are the whole safety:
 *
 *   - LABEL_COLUMNS for every row: id, citation, title, reg_key,
 *     jurisdiction_level, context_path. A breadcrumb and a heading, the same
 *     things the focused preview (fetchProvisionTeaser) and the search
 *     results show a visitor. NEVER full_text.
 *   - SUMMARY_COLUMNS only for the rows of a regulation open to visitors
 *     (PUBLIC_READER_REGS, i.e. GP05; summaryIds), and only after the public
 *     summary gate (gatePublicSummaries + fetchPendingSummaryCounts, the one
 *     /sample used before): a summary is shown to a visitor once its row is
 *     AI-checked and its regulation has no summary still pending the check.
 *     reviewed_by is reduced to the boolean the badge needs
 *     (withReviewerKind) and never leaves this file.
 *
 * Ids that no longer exist, and ids of a staged (unreleased) regulation, are
 * skipped, so the page lays out what is there. Two reads in parallel (labels
 * for all ids with one `.in("id", ids)`, summaries for the open ids), plus
 * the gate's count query and the staged list; the result is cached for ten
 * minutes, since a snapshot of ids changes only with a deploy and the labels
 * and review state change rarely.
 */
const LABEL_COLUMNS = "id, citation, title, reg_key, jurisdiction_level, context_path";
const SUMMARY_COLUMNS = "id, ai_summary, summary_status, reviewed_at, reviewed_by";

async function hydrate(ids: string[]): Promise<SampleRow[]> {
  const admin = createAdminClient();
  const open = summaryIds(ids);
  const regKeys = Array.from(new Set(open.map((id) => regKeyOf(id)).filter((k): k is string => !!k)));
  const [labels, summaries, staged, pending] = await Promise.all([
    admin.from("provisions").select(LABEL_COLUMNS).in("id", ids),
    open.length
      ? admin.from("provisions").select(SUMMARY_COLUMNS).in("id", open)
      : Promise.resolve({ data: [], error: null }),
    fetchStagedRegKeys(),
    fetchPendingSummaryCounts(regKeys),
  ]);
  if (labels.error) throw new Error(labels.error.message);
  if (summaries.error) throw new Error(summaries.error.message);

  type SummaryRead = { id: string; ai_summary: string | null; summary_status: string | null; reviewed_at: string | null; reviewed_by: string | null };
  const gated = gatePublicSummaries(
    ((summaries.data ?? []) as SummaryRead[]).map((r) => withReviewerKind(r)),
    pending
  );
  const summaryById = new Map<string, SampleSummary>(
    gated.map((r) => [
      r.id,
      {
        ai_summary: r.ai_summary,
        summary_status: r.summary_status,
        reviewed_at: r.reviewed_at,
        reviewed_by_human: r.reviewed_by_human,
      },
    ])
  );
  return ((labels.data ?? []) as SampleLabel[])
    .filter((r) => {
      const key = r.reg_key ?? regKeyOf(r.id);
      return !key || !staged.has(key);
    })
    .map((r) => ({ ...r, ...summaryById.get(r.id) }));
}

const hydrateCached = unstable_cache(hydrate, ["sample-snapshot-rows", SNAPSHOT.generated], {
  revalidate: 600,
  tags: ["sample"],
});

/** The snapshot's rows by id (labels; summaries for open rows). Rows that are gone or staged are absent. */
export async function loadSampleRows(): Promise<Map<string, SampleRow>> {
  const rows = await hydrateCached(sampleIds());
  return new Map(rows.map((r) => [r.id, r]));
}
