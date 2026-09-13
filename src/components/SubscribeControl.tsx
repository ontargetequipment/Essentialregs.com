import Link from "next/link";
import type { AccessStatus } from "@/lib/access";

const PRIMARY =
  "inline-block rounded-md bg-emerald-700 text-center text-sm font-semibold text-white hover:bg-emerald-800";
const SECONDARY =
  "inline-block rounded-md bg-zinc-900 text-center text-sm font-semibold text-white hover:bg-zinc-800";
const SIZE = { normal: "px-5 py-3", compact: "px-4 py-2" } as const;

/**
 * The one subscribe/upsell control, used on the homepage pricing card, the
 * account page, and the /regulations upsell panel so every entry point
 * behaves the same:
 *   - logged out       -> create an account (returns to #pricing afterwards)
 *   - logged in, free  -> POST to /api/stripe/checkout (plain form, no JS)
 *   - has access       -> straight to the regulations
 */
export function SubscribeControl({
  access,
  className = "",
  size = "normal",
}: {
  access: AccessStatus;
  className?: string;
  /** "compact" matches the site's px-4/py-2 secondary buttons (account page). */
  size?: keyof typeof SIZE;
}) {
  if (!access.user) {
    return (
      <Link
        href="/signup?next=/%23pricing"
        className={`${SECONDARY} ${SIZE[size]} ${className}`}
      >
        Create an account to subscribe
      </Link>
    );
  }

  if (access.hasAccess) {
    return (
      <Link href="/regulations" className={`${PRIMARY} ${SIZE[size]} ${className}`}>
        You&apos;re subscribed — open the regulations
      </Link>
    );
  }

  return (
    <form method="post" action="/api/stripe/checkout" className={className}>
      <button type="submit" className={`${PRIMARY} ${SIZE[size]}`}>
        Subscribe
      </button>
    </form>
  );
}
