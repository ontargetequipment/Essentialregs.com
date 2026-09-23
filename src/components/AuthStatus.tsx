import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";

// This slot is rendered by MobileNav in two places: inline in the desktop
// header row (sm and up), and stacked in the mobile drawer's footer as
// full-width, 48px-tall rows. The unprefixed classes below are the drawer's
// sizing; `sm:` strips it back down to the compact inline pills the desktop
// row has always had, so nothing changes above the `sm` breakpoint.
const SECONDARY_ROW =
  "flex min-h-12 items-center justify-center rounded-md border border-line px-4 text-base font-medium text-ink-soft hover:border-accent hover:text-ink sm:min-h-0 sm:justify-start sm:border-0 sm:px-0 sm:py-0 sm:text-sm sm:font-normal sm:hover:text-ink";

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Link href="/login" className={SECONDARY_ROW}>
          Log in
        </Link>
        <Link
          href="/signup"
          className="flex min-h-12 items-center justify-center rounded-md bg-accent px-4 text-base font-medium text-white hover:bg-accent/90 sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-sm"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <Link
        href="/account"
        className="flex min-h-12 items-center rounded-md border border-line px-4 text-base text-ink-soft hover:border-accent hover:text-ink sm:min-h-0 sm:border-0 sm:px-0 sm:text-sm sm:text-muted sm:hover:text-ink"
      >
        {user.email}
      </Link>
      <form action={logout}>
        <button type="submit" className={`w-full sm:w-auto ${SECONDARY_ROW}`}>
          Log out
        </button>
      </form>
    </div>
  );
}
