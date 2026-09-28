import Link from "next/link";
import type { AccessStatus } from "@/lib/access";
import { TRIAL_DAYS, type BillingInterval } from "@/lib/pricing";

const PRIMARY =
  "rounded-md bg-accent text-center text-sm font-semibold text-white hover:bg-accent/90";
// The logged-out "create an account" step is the card's one call to action
// too, so it gets the same accent button rather than a second colour.
const SECONDARY = PRIMARY;
const SIZE = { normal: "px-5 py-3", compact: "px-4 py-2" } as const;
// Full-width 44px tap rows below `sm`, inline from `sm` up (matches the
// homepage hero buttons); `fullWidth` keeps the row at every width, for the
// narrow price boxes on the pricing card.
const WIDTH = {
  auto: "inline-block w-full sm:w-auto",
  full: "block w-full",
} as const;

/**
 * The one subscribe/upsell control, used on the homepage pricing card (once
 * per price box), the account page, and the /regulations upsell panel so
 * every entry point behaves the same:
 *   - logged out       -> create an account (returns to /pricing afterwards)
 *   - logged in, free  -> POST to /api/stripe/checkout (plain form, no JS)
 *                         with the chosen `interval` as a hidden field
 *   - has access       -> straight to the regulations
 *
 * `fullWidth` keeps the control a full row at every viewport width (the
 * pricing card's price boxes); by default it is a full row below `sm` only.
 *
 * `label` overrides the checkout button's text. The default names the
 * free trial only for an account that has never had a subscription, which
 * is exactly when the checkout route grants one (src/app/api/stripe/
 * checkout/route.ts) — a lapsed subscriber sees plain "Subscribe".
 */
export function SubscribeControl({
  access,
  interval,
  label,
  fullWidth = false,
  className = "",
  size = "normal",
}: {
  access: AccessStatus;
  /** Which price the checkout button buys. */
  interval: BillingInterval;
  label?: string;
  fullWidth?: boolean;
  className?: string;
  /** "compact" matches the site's px-4/py-2 secondary buttons (account page). */
  size?: keyof typeof SIZE;
}) {
  const width = WIDTH[fullWidth ? "full" : "auto"];

  if (!access.user) {
    return (
      <Link
        href="/signup?next=/pricing"
        className={`${SECONDARY} ${SIZE[size]} ${width} ${className}`}
      >
        Create an account to subscribe
      </Link>
    );
  }

  if (access.hasAccess) {
    return (
      <Link href="/regulations" className={`${PRIMARY} ${SIZE[size]} ${width} ${className}`}>
        You&apos;re subscribed — open the regulations
      </Link>
    );
  }

  const text =
    label ?? (access.stripeSubscriptionId ? "Subscribe" : `Start ${TRIAL_DAYS}-day free trial`);

  return (
    <form method="post" action="/api/stripe/checkout" className={className}>
      <input type="hidden" name="interval" value={interval} />
      <button type="submit" className={`${PRIMARY} ${SIZE[size]} ${width}`}>
        {text}
      </button>
    </form>
  );
}
