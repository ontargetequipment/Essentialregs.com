import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Release state of a document (regulation_releases, migration
 * 20261008040000). A newly imported reg_key is `staged`: invisible to
 * subscribers in the reader, keyword search, Ask, related provisions, the
 * previews and the indexes until `python pipeline/import_ccr.py release`
 * flips it to `released`. No row means released (every document that
 * existed before the state did).
 *
 * The database enforces the subscriber side (RLS, the Ask functions). This
 * module is for the app's service-role reads, which bypass RLS: the
 * regulation roots behind /federal, /states, /general-permits, /sample and
 * the sitemap, the /preview teaser, the related-provisions teaser and the
 * cached reader body. Admins (ADMIN_EMAILS) still see a staged document in
 * the reader and the review queue so it can be checked before release.
 */
export const fetchStagedRegKeys = cache(async (): Promise<Set<string>> => {
  const admin = createAdminClient();
  const { data, error } = await admin.from("regulation_releases").select("reg_key").eq("status", "staged");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r: { reg_key: string }) => r.reg_key));
});

export async function isRegReleased(reg: string): Promise<boolean> {
  return !(await fetchStagedRegKeys()).has(reg);
}
