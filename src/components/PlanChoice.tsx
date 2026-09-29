import type { ReactNode } from "react";
import type { AccessStatus } from "@/lib/access";
import {
  ANNUAL_SAVINGS_NOTE,
  PLAN_NAMES,
  PRICE_DISPLAY,
  TRIAL_DAYS,
  type BillingInterval,
} from "@/lib/pricing";
import { SubscribeControl } from "@/components/SubscribeControl";

/** Monthly first, annual (the better value) second, everywhere the two appear. */
export const PLAN_ORDER: readonly BillingInterval[] = ["month", "year"];

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

// The annual box has always been the tinted one; the monthly box is plain.
const BOX: Record<BillingInterval, string> = {
  month: "border-line bg-paper",
  year: "border-accent bg-accent-soft",
};

const BADGE = "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold text-white";

/**
 * One plan's box: name, price, the annual "best value" badge, and whatever
 * call to action the caller puts at the bottom (children). `chosen` marks
 * the plan the visitor already picked with a ring and a "Your choice" badge.
 */
export function PlanCard({
  interval,
  chosen = false,
  children,
}: {
  interval: BillingInterval;
  chosen?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col rounded-md border p-4 ${BOX[interval]} ${chosen ? "ring-2 ring-accent" : ""}`}
      data-plan={interval}
      data-chosen={chosen || undefined}
    >
      <p className="font-mono text-eyebrow uppercase text-tag">{PLAN_NAMES[interval]}</p>
      <Price display={PRICE_DISPLAY[interval]} />
      {(chosen || interval === "year") && (
        <p className="mt-2 flex flex-wrap gap-1.5">
          {chosen && <span className={`${BADGE} bg-ink`}>Your choice</span>}
          {interval === "year" && (
            <span className={`${BADGE} bg-accent`}>Best value · {ANNUAL_SAVINGS_NOTE}</span>
          )}
        </p>
      )}
      {/* flex-1 + justify-end: both boxes' buttons sit on the same baseline
          at `sm` even when only one box has a badge row. */}
      <div className="mt-4 flex flex-1 flex-col justify-end">{children}</div>
    </div>
  );
}

/**
 * The two plan boxes side by side, `cta` rendering each one's call to
 * action. /signup (step 1) uses this with a "Choose Monthly" / "Choose
 * Annual" link per box; PlanChoice below puts a SubscribeControl in each.
 */
export function PlanCards({
  chosen = null,
  cta,
  className = "",
}: {
  chosen?: BillingInterval | null;
  cta: (interval: BillingInterval) => ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      {PLAN_ORDER.map((interval) => (
        <PlanCard key={interval} interval={interval} chosen={chosen === interval}>
          {cta(interval)}
        </PlanCard>
      ))}
    </div>
  );
}

/** The trial terms, shown wherever the checkout would actually grant a trial. */
export function TrialNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted ${className}`}>
      {TRIAL_DAYS} days free, then the price you picked. We ask for a card up
      front and charge it when the trial ends; cancel before then from your
      account page and you pay nothing.
    </p>
  );
}

/**
 * The two plans side by side, each with its own call to action, so a
 * non-subscriber always sees the monthly option before reaching Stripe
 * Checkout (owner, 27 Sep 2026). One source of truth for the homepage
 * pricing card, /pricing, the account page and the /states/colorado subscribe
 * panel.
 *
 *   - entitled             -> renders nothing (the caller shows its own link)
 *   - logged in, no access -> a checkout form per plan (SubscribeControl)
 *   - logged out           -> a "Create an account" link per plan, each
 *                             going to /signup?plan=<interval> (the account
 *                             step of the plan-first signup)
 *
 * `chosen` (/pricing?plan=<interval>, where /auth/confirm lands a new
 * account) highlights that box and makes its button the primary "Start
 * your 7-day free trial"; the other box stays, with a secondary "Switch
 * to ..." button. Without it both boxes look the same as always.
 *
 * The trial sentence appears whenever the checkout would grant a trial: an
 * account that has never had a subscription, or a visitor who isn't logged
 * in yet.
 */
export function PlanChoice({
  access,
  chosen = null,
  className = "",
}: {
  access: AccessStatus;
  chosen?: BillingInterval | null;
  className?: string;
}) {
  if (access.hasAccess) return null;

  const trialOffered = !access.stripeSubscriptionId;

  return (
    <div className={className}>
      {/* One SubscribeControl per price box: the hidden `interval` field on
          its form picks the Stripe Price the checkout sells
          (src/lib/pricing.ts PRICE_LOOKUP). */}
      <PlanCards
        chosen={chosen}
        cta={(interval) => (
          <SubscribeControl access={access} interval={interval} chosen={chosen} fullWidth />
        )}
      />
      {trialOffered && <TrialNote className="mt-3" />}
    </div>
  );
}
