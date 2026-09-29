import Link from "next/link";
import type { AccessStatus } from "@/lib/access";
import { PLAN_NAMES, TRIAL_DAYS, type BillingInterval } from "@/lib/pricing";

const PRIMARY =
  "rounded-md bg-accent text-center text-sm font-semibold text-white hover:bg-accent/90";
// The quieter button for the plan the visitor did NOT pick (PlanChoice's
// `chosen`): still a full call to action, just not the accent one, so the
// eye lands on the chosen card first.
const SECONDARY =
  "rounded-md border border-line bg-panel text-center text-sm font-semibold text-ink-soft hover:border-accent hover:text-ink";
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
 * per price box), the account page, the /pricing page and the /states/colorado
 * upsell panel so every entry point behaves the same:
 *   - logged out       -> create an account, with this box's plan already
 *                         chosen (/signup?plan=<interval>, the account step
 *                         of the plan-first signup)
 *   - logged in, free  -> POST to /api/stripe/checkout (plain form, no JS)
 *                         with the chosen `interval` as a hidden field
 *   - has access       -> straight to the regulations
 *
 * `chosen` is the plan the visitor already picked (/pricing?plan=, where
 * /auth/confirm lands a new account): this box's button is the primary
 * "Start your 7-day free trial" when it IS that plan, and a secondary
 * "Switch to <other plan>" when it isn't. Without `chosen` every box gets
 * the primary button, as before.
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
  chosen = null,
  label,
  fullWidth = false,
  className = "",
  size = "normal",
}: {
  access: AccessStatus;
  /** Which price the checkout button buys. */
  interval: BillingInterval;
  /** The plan the visitor already picked, if any (see above). */
  chosen?: BillingInterval | null;
  label?: string;
  fullWidth?: boolean;
  className?: string;
  /** "compact" matches the site's px-4/py-2 secondary buttons (account page). */
  size?: keyof typeof SIZE;
}) {
  const width = WIDTH[fullWidth ? "full" : "auto"];
  const otherPlan = chosen !== null && chosen !== interval;
  const style = otherPlan ? SECONDARY : PRIMARY;

  if (!access.user) {
    return (
      <Link
        href={`/signup?plan=${interval}`}
        className={`${style} ${SIZE[size]} ${width} ${className}`}
      >
        Create an account to subscribe
      </Link>
    );
  }

  if (access.hasAccess) {
    return (
      <Link href="/states/colorado" className={`${PRIMARY} ${SIZE[size]} ${width} ${className}`}>
        You&apos;re subscribed — open the regulations
      </Link>
    );
  }

  const trialOffered = !access.stripeSubscriptionId;
  const text =
    label ??
    (otherPlan
      ? `Switch to ${PLAN_NAMES[interval]}`
      : chosen
      ? trialOffered
        ? `Start your ${TRIAL_DAYS}-day free trial`
        : "Subscribe"
      : trialOffered
      ? `Start ${TRIAL_DAYS}-day free trial`
      : "Subscribe");

  return (
    <form method="post" action="/api/stripe/checkout" className={className}>
      <input type="hidden" name="interval" value={interval} />
      <button type="submit" className={`${style} ${SIZE[size]} ${width}`}>
        {text}
      </button>
    </form>
  );
}
