"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayDenver } from "@/lib/changelog";

/**
 * Every action here does the same three things: requireAdmin() (never trust
 * the form was only reachable to an admin — this route is a POST target
 * like any other), write through the service-role admin client (there is no
 * update policy on `provisions` for any client role, and no insert policy
 * on `provision_changes` — see supabase/migrations/004_review.sql), then
 * revalidate the reader, the queue itself, and the public changelog so all
 * three reflect the change on next load.
 */
function revalidateAfterReview() {
  revalidatePath("/regulations/[reg]", "page");
  revalidatePath("/admin/review");
  revalidatePath("/changelog");
}

export async function approveSummary(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("provisions")
    .update({
      summary_status: "approved",
      last_verified_date: todayDenver(),
      reviewed_by: admin.email,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const { error: changeError } = await supabase
    .from("provision_changes")
    .insert({ provision_id: id, change_type: "summary_approved" });
  if (changeError) throw new Error(changeError.message);

  revalidateAfterReview();
}

export async function saveEditAndApprove(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const edited = String(formData.get("summary") ?? "").trim();
  if (!id || !edited) return;

  const supabase = createAdminClient();

  // Read the row's current ai_summary/summary_original first: the
  // "coalesce(summary_original, ai_summary)" the spec calls for has to
  // happen here rather than in the UPDATE itself, since supabase-js's
  // .update() can't reference another column's existing value.
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
      summary_status: "edited",
      last_verified_date: todayDenver(),
      reviewed_by: admin.email,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const { error: changeError } = await supabase
    .from("provision_changes")
    .insert({ provision_id: id, change_type: "summary_edited" });
  if (changeError) throw new Error(changeError.message);

  revalidateAfterReview();
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

  revalidateAfterReview();
}
