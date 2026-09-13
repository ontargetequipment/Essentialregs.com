import type { User } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Comma-separated allowlist of admin emails, e.g.
 * "brody@essentialregs.com, other@example.com". Case-insensitive. This is
 * deliberately an env var rather than a database flag: the review queue is
 * for exactly one or two trusted people, and an env var can't be flipped by
 * anything running with the anon or authenticated Postgres role.
 */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** True when the given (possibly null/logged-out) user's email is on the admin allowlist. */
export function isAdmin(user: Pick<User, "email"> | null | undefined): boolean {
  const email = user?.email?.toLowerCase();
  if (!email) return false;
  return adminEmails().includes(email);
}

/**
 * Gate for every admin page and server action. Logged-out visitors are sent
 * to log in (they may just not have a session yet); a logged-in non-admin
 * gets a plain 404 rather than a 403 — the review queue's existence isn't
 * something to advertise to a signed-in subscriber who stumbles onto the
 * URL. Returns the admin's own User on success so callers (e.g. server
 * actions stamping `reviewed_by`) don't need a second lookup.
 */
export async function requireAdmin(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  if (!isAdmin(user)) {
    notFound();
  }
  return user;
}
