import type { AccessStatus } from "@/lib/access";
import {
  ANNUAL_PLAN_NAME,
  ANNUAL_PRICE_DISPLAY,
  ANNUAL_SAVINGS_NOTE,
  MONTHLY_PLAN_NAME,
  MONTHLY_PRICE_DISPLAY,
  TRIAL_DAYS,
} from "@/lib/pricing";
import { SubscribeControl } from "@/components/SubscribeControl";

/** "$25 / month" as a big serif amount and a small period. */
function Price({ display }: { display: string }) {
  const [amount, period] = display.split(" / ");
  return (
    <p className="mt-1 font-serif text-section font-bold tracking-tight text-ink">
      {amount}
      {period && <span className="text-base font-normal tracking-normal text-muted"> / {period}</span>}
    </p>
  );
}

/**
 * The two plans side by side, each with its own call to action, so a
 * non-subscriber always sees the monthly option before reaching Stripe
 * Checkout (owner, 27 Sep 2026). One source of truth for the homepage
 * pricing card, the account page and the /regulations subscribe panel.
 *
 *   - entitled            -> renders nothing (the caller shows its own link)
 *   - logged in, no access -> a checkout form per plan (SubscribeControl)
 *   - logged out           -> `anonymousCta` decides: "single" (default) shows
 *                             the two prices and ONE "Create an account"
 *                             link below them; "per-plan" puts the link in
 *                             each box, which is what the homepage card has
 *                             always done (and what the smoke test asserts).
 *
 * The trial sentence appears whenever the checkout would grant a trial: an
 * account that has never had a subscription, or a visitor who isn't logged
 * in yet.
 */
export function PlanChoice({
  access,
  anonymousCta = "single",
  className = "",
}: {
  access: AccessStatus;
  anonymousCta?: "single" | "per-plan";
  className?: string;
}) {
  if (access.hasAccess) return null;

  const trialOffered = !access.stripeSubscriptionId;
  const ctaInBoxes = Boolean(access.user) || anonymousCta === "per-plan";

  return (
    <div className={className}>
      {/* One SubscribeControl per price box: the hidden `interval` field on
          its form picks the Stripe Price the checkout sells
          (src/lib/pricing.ts PRICE_LOOKUP). */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col rounded-md border border-line bg-paper p-4">
          <p className="font-mono text-eyebrow uppercase text-tag">{MONTHLY_PLAN_NAME}</p>
          <Price display={MONTHLY_PRICE_DISPLAY} />
          {ctaInBoxes && (
            /* flex-1 + justify-end: both boxes' buttons sit on the same
               baseline at `sm` even though only the annual box has a badge. */
            <div className="mt-4 flex flex-1 flex-col justify-end">
              <SubscribeControl access={access} interval="month" fullWidth />
            </div>
          )}
        </div>
        <div className="flex flex-col rounded-md border border-accent bg-accent-soft p-4">
          <p className="font-mono text-eyebrow uppercase text-tag">{ANNUAL_PLAN_NAME}</p>
          <Price display={ANNUAL_PRICE_DISPLAY} />
          <p className="mt-2">
            <span className="inline-block whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
              Best value · {ANNUAL_SAVINGS_NOTE}
            </span>
          </p>
          {ctaInBoxes && (
            <div className="mt-4 flex flex-1 flex-col justify-end">
              <SubscribeControl access={access} interval="year" fullWidth />
            </div>
          )}
        </div>
      </div>
      {!ctaInBoxes && (
        /* Logged out, one link: the interval is moot here, since the visitor
           picks a plan on #pricing after signing up. */
        <SubscribeControl access={access} interval="year" className="mt-4" />
      )}
      {trialOffered && (
        <p className="mt-3 text-xs text-muted">
          {TRIAL_DAYS} days free, then the price you picked. We ask for a
          card up front and charge it when the trial ends; cancel before
          then from your account page and you pay nothing.
        </p>
      )}
    </div>
  );
}
