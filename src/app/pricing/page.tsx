import type { Metadata } from "next";
import Link from "next/link";
import { getAccessStatus } from "@/lib/access";
import {
  PLAN_NAMES,
  PRICE_DISPLAY,
  PRICE_LOOKUP,
  TRIAL_DAYS,
  parseBillingInterval,
  type BillingInterval,
} from "@/lib/pricing";
import { PLAN_ORDER, PlanCards, PlanChoice } from "@/components/PlanChoice";

export const metadata: Metadata = {
  title: "Pricing",
  description: "EssentialRegs is $25 / month or $250 / year, with a 7-day free trial on either plan.",
};

// The plan choice and nothing else, so it is the first thing on screen on a
// phone: no hero, no feature list. /auth/confirm sends a freshly confirmed
// user here (?confirmed=1) instead of the homepage, where the card sat
// below the fold (owner, 27 Sep 2026). The homepage #pricing card stays.
// A valid ?plan=<month|year> (the plan picked on /signup, carried through
// the confirmation link) highlights that box and makes its button the
// primary one; without it the page is the plain two-box choice.
export default async function PricingPage(props: PageProps<"/pricing">) {
  const [access, searchParams] = await Promise.all([getAccessStatus(), props.searchParams]);

  const confirmed = searchParams.confirmed === "1";
  const chosen = parseBillingInterval(searchParams.plan);

  // A subscriber (or a comped account) has nothing to buy here, but the
  // Pricing link in the header still has to show them the prices: until
  // 3 Oct 2026 this redirected to the Colorado catalog, so a paying
  // customer could not see what the plans cost (reviewer, Oct 2026). Show
  // the same two boxes, read-only, with their own plan marked and billing
  // changes pointed at the account page.
  if (access.hasAccess) {
    const current = (PLAN_ORDER as readonly BillingInterval[]).find((i) => PRICE_LOOKUP[i] === access.plan) ?? null;
    return (
      <div className="mx-auto max-w-md px-6 py-10 sm:py-14">
        <h1 className="font-serif text-section font-bold tracking-tight text-ink">Plans and pricing</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {access.manualOverride && !current
            ? "Your account has complimentary access; no plan is needed."
            : current
              ? `You are on the ${PLAN_NAMES[current]} plan.`
              : "You have an active subscription."}{" "}
          Change plans, update your card, or cancel from your{" "}
          <Link href="/account" className="font-medium underline underline-offset-2 hover:text-accent">
            account page
          </Link>
          .
        </p>
        <PlanCards
          chosen={current}
          className="mt-5"
          cta={(interval) => (
            <p className="text-xs text-muted">
              {interval === current ? "Your current plan." : `${PRICE_DISPLAY[interval]}, billed ${interval === "year" ? "yearly" : "monthly"}.`}
            </p>
          )}
        />
        <p className="mt-6 text-xs text-muted">
          Need multiple seats for your team?{" "}
          <Link
            href="/contact-sales"
            className="inline-flex min-h-11 items-center font-medium text-ink-soft underline underline-offset-2 hover:text-accent sm:inline sm:min-h-0"
          >
            Contact sales
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-10 sm:py-14">
      {confirmed && (
        <p
          role="status"
          className="mb-4 rounded-md border border-line bg-accent-soft px-4 py-3 text-sm font-medium text-ink"
        >
          {chosen
            ? `Your email is confirmed — start your free trial on the ${PLAN_NAMES[chosen]} plan below.`
            : "Your email is confirmed — pick a plan to start your free trial."}
        </p>
      )}
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">Choose your plan</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {TRIAL_DAYS}-day free trial on either plan. A card is required to start;
        cancel before the trial ends and you won&apos;t be charged.
      </p>

      <PlanChoice access={access} chosen={chosen} className="mt-5" />

      <p className="mt-6 text-xs text-muted">
        Need multiple seats for your team?{" "}
        {/* inline-flex + min-h-11 below `sm` grows this inline link to a
            44px-tall tap target; `sm:` puts it back to a plain inline link. */}
        <Link
          href="/contact-sales"
          className="inline-flex min-h-11 items-center font-medium text-ink-soft underline underline-offset-2 hover:text-accent sm:inline sm:min-h-0"
        >
          Contact sales
        </Link>
        .
      </p>
    </div>
  );
}
