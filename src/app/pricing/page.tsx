import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessStatus } from "@/lib/access";
import { PLAN_NAMES, TRIAL_DAYS, parseBillingInterval } from "@/lib/pricing";
import { PlanChoice } from "@/components/PlanChoice";

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

  // Nothing to choose for a subscriber (or a comped account).
  if (access.hasAccess) redirect("/regulations");

  const confirmed = searchParams.confirmed === "1";
  const chosen = parseBillingInterval(searchParams.plan);

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
