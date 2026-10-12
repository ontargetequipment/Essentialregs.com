"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/regulation-request";

/**
 * /admin/requests row save: status and notes. requireAdmin() here as well as
 * on the page (this is a POST target like any other), then the service-role
 * client (regulation_requests has no policies for any client role).
 */
export async function updateRegulationRequest(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000);
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  if (!(REQUEST_STATUSES as readonly string[]).includes(statusRaw)) return;
  const status = statusRaw as RequestStatus;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("regulation_requests")
    .update({ status, notes: notes || null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/requests");
}
