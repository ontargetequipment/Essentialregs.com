"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { refreshChangelogSnapshot } from "@/lib/changelog-refresh";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Every action here does the same three things: requireAdmin() (never trust
 * the form was only reachable to an admin — this route is a POST target
 * like any other), write through the service-role admin client (there is no
 * update policy on `provisions` for any client role, and no insert policy
 * on `provision_changes` — see supabase/migrations/004_review.sql), then
 * revalidate the reader, the queue itself, and the public changelog so all
 * three reflect the change on next load.
 *
 * ReviewBuiltIn (owner decision, Brody, 5 Oct 2026): a summary becomes
 * approved or edited ONLY through pipeline/review.py. The former Approve and
 * "Save edit & approve" actions are gone; this page can reject a summary,
 * send one back to pending (the next chained run reviews it again), or save
 * an edited text as pending so the reviewer checks the edit. The database
 * trigger provisions_summary_approval_only_by_pipeline (migration
 * 20261006090000) refuses any other approval, and corpus QA check 21
 * (approved_outside_pipeline) fails CI if one ever appears.
 */
async function revalidateAfterReview() {
  // /changelog reads a stored snapshot (7 Oct 2026): refresh it so the
  // review just logged shows, then revalidate. A failed refresh is logged,
  // not raised -- the review itself is already written.
  await refreshChangelogSnapshot();
  revalidatePath("/regulations/[reg]", "page");
  revalidatePath("/admin/review");
  revalidatePath("/changelog");
}

/** Send a summary back to pending: the next chained run reviews it again. */
export async function sendBackToPending(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!id) return;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("provisions")
    .update({
      summary_status: "pending",
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const { error: changeError } = await supabase
    .from("provision_changes")
    .insert({
      provision_id: id,
      change_type: "summary_regenerated",
      note: `Sent back to pending by ${admin.email} for AI review${note ? `: ${note}` : ""}`,
    });
  if (changeError) throw new Error(changeError.message);

  await revalidateAfterReview();
}

/**
 * Save an edited text as PENDING. The edit is not approved here: the
 * reviewer checks it against the official text in the next chained run,
 * and only then does the row read "AI-generated · automated check against source text".
 */
export async function saveEditForReview(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const edited = String(formData.get("summary") ?? "").trim();
  if (!id || !edited) return;

  const supabase = createAdminClient();

  // Read the row's current ai_summary/summary_original first: the
  // "coalesce(summary_original, ai_summary)" has to happen here rather
  // than in the UPDATE itself, since supabase-js's .update() can't
  // reference another column's existing value.
  const { data: current, error: fetchError } = await supabase
    .from("provisions")
    .select("ai_summary, summary_original")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!current) return;

  const { error } = await supabase
    .from("provisions")
    .update({
      ai_summary: edited,
      summary_original: current.summary_original ?? current.ai_summary,
      summary_status: "pending",
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const { error: changeError } = await supabase
    .from("provision_changes")
    .insert({
      provision_id: id,
      change_type: "summary_regenerated",
      note: `Edited by ${admin.email}; pending AI review`,
    });
  if (changeError) throw new Error(changeError.message);

  await revalidateAfterReview();
}

export async function rejectSummary(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!id) return;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("provisions")
    .update({
      summary_status: "rejected",
      last_verified_date: null,
      reviewed_by: admin.email,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const { error: changeError } = await supabase
    .from("provision_changes")
    .insert({
      provision_id: id,
      change_type: "summary_rejected",
      note: note || null,
    });
  if (changeError) throw new Error(changeError.message);

  await revalidateAfterReview();
}
