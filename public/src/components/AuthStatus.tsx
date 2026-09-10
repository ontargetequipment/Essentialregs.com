import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";

// Rendered inside a <Suspense> boundary in the root layout so that reading
// the session (an awaited call) doesn't delay the rest of the shell from
// streaming — see the Next.js auth guide's "Auth and streaming" section.
export async function AuthStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex items-center gap-4">
        <Link href="/login" className="hover:text-zinc-950">
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-800"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link href="/account" className="text-zinc-500 hover:text-zinc-950">
        {user.email}
      </Link>
      <form action={logout}>
        <button type="submit" className="hover:text-zinc-950">
          Log out
        </button>
      </form>
    </div>
  );
}
