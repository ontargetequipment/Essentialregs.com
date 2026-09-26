import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Set a new password" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Reaching this page requires the short-lived session /auth/confirm sets
  // up after verifying the emailed recovery link — no session means the
  // link was missing, already used, or expired.
  if (!user) {
    redirect("/forgot-password");
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">Set a new password</h1>
      <p className="mt-2 text-sm text-ink-soft">for {user.email}</p>

      <ResetPasswordForm />
    </div>
  );
}
