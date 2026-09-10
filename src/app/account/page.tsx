import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";

export const metadata = { title: "Your account — EssentialRegs" };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("access_granted, created_at")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Your account</h1>

      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between border-b border-zinc-200 pb-3">
          <dt className="text-zinc-500">Email</dt>
          <dd className="font-medium text-zinc-900">{user.email}</dd>
        </div>
        <div className="flex justify-between border-b border-zinc-200 pb-3">
          <dt className="text-zinc-500">Access</dt>
          <dd className="font-medium text-zinc-900">
            {profile?.access_granted
              ? "Full access (early access)"
              : "Sample content only — full access not yet granted"}
          </dd>
        </div>
      </dl>

      <form action={logout} className="mt-8">
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
        >
          Log out
        </button>
      </form>
    </div>
  );
}
