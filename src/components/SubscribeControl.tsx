import Link from "next/link";
import type { AccessStatus } from "@/lib/access";
import { PLAN_NAMES, TRIAL_DAYS, type BillingInterval } from "@/lib/pricing";
import { buttonClass } from "@/lib/ui";

// Every box's button is the site's one green button (src/lib/ui.ts),
// including "Switch to ..." on the plan the visitor did not pick: the ring
// and "Your choice" badge on the chosen box (PlanChoice) mark the choice.
// Full-width 44px tap rows below `sm`, inline from `sm` up (matches the
// homepage hero buttons); `fullWidth` keeps the row at every width, for the
// narrow price boxes on the pricing card.
const BUTTON = { auto: buttonClass({ width: "mobile" }), full: buttonClass({ width: "full" }) } as const;

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
 * /auth/confirm lands a new account): this box's button is "Start your
 * 7-day free trial!" when it IS that plan, and "Switch to <other plan>"
 * when it isn't. Without `chosen` every box gets the same button, as
 * before.
 *
 * `fullWidth` keeps the control a full row at every viewport width (the
 * pricing card's price boxes); by default it is a full row below `sm` only.
 *
 * `label` overrides the button's text, the logged-out link's too (since
 * 10 Oct 2026: /pricing says "Start your 7-day free trial!" there). For the
 * checkout button the default names the
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
}: {
  access: AccessStatus;
  /** Which price the checkout button buys. */
  interval: BillingInterval;
  /** The plan the visitor already picked, if any (see above). */
  chosen?: BillingInterval | null;
  label?: string;
  fullWidth?: boolean;
  className?: string;
}) {
  const button = BUTTON[fullWidth ? "full" : "auto"];
  const otherPlan = chosen !== null && chosen !== interval;

  if (!access.user) {
    return (
      <Link
        href={`/signup?plan=${interval}`}
        className={`${button} ${className}`}
      >
        {label ?? "Create an account to subscribe"}
      </Link>
    );
  }

  if (access.hasAccess) {
    return (
      <Link href="/states/colorado" className={`${button} ${className}`}>
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
        ? `Start your ${TRIAL_DAYS}-day free trial!`
        : "Subscribe"
      : trialOffered
      ? `Start ${TRIAL_DAYS}-day free trial!`
      : "Subscribe");

  return (
    <form method="post" action="/api/stripe/checkout" className={className}>
      <input type="hidden" name="interval" value={interval} />
      <button type="submit" className={button}>
        {text}
      </button>
    </form>
  );
}
