import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Recompute the stored /changelog counts (refresh_changelog_snapshot(),
 * service_role only) after an admin review action writes provision_changes.
 * Never throws: the review is already written, and the pipeline's next run
 * refreshes the snapshot anyway.
 */
export async function refreshChangelogSnapshot(): Promise<boolean> {
  try {
    const { error } = await createAdminClient().rpc("refresh_changelog_snapshot");
    if (error) throw new Error(error.message);
    return true;
  } catch (e) {
    console.error("changelog snapshot refresh failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
