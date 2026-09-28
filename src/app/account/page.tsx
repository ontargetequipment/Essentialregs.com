import { redirect } from "next/navigation";
import { getAccessStatus, type AccessStatus } from "@/lib/access";
import { ANNUAL_PLAN_NAME, planDisplayName } from "@/lib/pricing";
import { logout } from "@/app/auth/actions";
import { PlanChoice } from "@/components/PlanChoice";

export const metadata = { title: "Your account" };

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Denver",
  });
}

/** One-line description of where the subscription stands. */
function planSummary(access: AccessStatus): string {
  const end = formatDate(access.currentPeriodEnd);
  // profiles.plan holds the Price's lookup key (individual_monthly /
  // individual_annual); older rows may hold a nickname or raw id.
  const plan = planDisplayName(access.plan) ?? ANNUAL_PLAN_NAME;

  switch (access.status) {
    case "active":
      if (access.cancelAtPeriodEnd) {
        return end ? `Canceled — access until ${end}` : "Canceled at end of period";
      }
      return end ? `${plan} — active, renews ${end}` : `${plan} — active`;
    case "trialing":
      return end ? `${plan} — trial, first charge ${end}` : `${plan} — trial`;
    case "past_due":
    case "unpaid":
      return `${plan} — payment failed. Update your card to keep access.`;
    case "canceled":
      // A cancel-at-period-end stays 'active' until the period ends (handled
      // above); by the time Stripe reports 'canceled' access has ended.
      return end ? `Canceled — ended ${end}` : "Canceled";
    case "incomplete":
    case "incomplete_expired":
      return "Checkout didn't finish — no active subscription.";
    case null:
      return access.manualOverride ? "Complimentary access" : "No subscription";
    default:
      return `${plan} — ${access.status}`;
  }
}

export default async function AccountPage(props: PageProps<"/account">) {
  const [access, searchParams] = await Promise.all([
    getAccessStatus(),
    props.searchParams,
  ]);

  if (!access.user) {
    redirect("/login");
  }

  const justCheckedOut = searchParams.checkout === "success";

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">Your account</h1>

      {justCheckedOut && (
        <div className="mt-6 rounded-md border border-line bg-accent-soft px-4 py-3 text-sm text-ink">
          <p className="font-medium">Thanks — your subscription is being set up.</p>
          {!access.hasAccess && (
            <p className="mt-1 text-ink-soft">
              Stripe is confirming the payment. This usually takes a few
              seconds; refresh this page if the status below hasn&apos;t updated yet.
            </p>
          )}
        </div>
      )}

      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-line pb-3">
          <dt className="text-muted">Email</dt>
          <dd className="break-all font-medium text-ink">{access.user.email}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-line pb-3">
          <dt className="text-muted">Plan</dt>
          <dd className="font-medium text-ink">
            {planSummary(access)}
            {access.status === "trialing" && (
              <span className="mt-1 block text-xs font-normal text-muted">
                Cancel before then from Manage billing and you won&apos;t be charged.
              </span>
            )}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-line pb-3">
          <dt className="text-muted">Access</dt>
          <dd className="font-medium text-ink">
            {access.hasAccess ? "Full access — all regulations" : "Sample content only"}
          </dd>
        </div>
      </dl>

      {/* Both plans, so a new user picks monthly or annual here rather than
          being sent to Checkout for one of them (owner, 27 Sep 2026). */}
      {!access.hasAccess && <PlanChoice access={access} className="mt-8" />}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {access.stripeCustomerId && (
          <form method="post" action="/api/stripe/portal">
            <button
              type="submit"
              className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-accent-soft"
            >
              Manage billing
            </button>
          </form>
        )}

        <form action={logout}>
          <button
            type="submit"
            className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-accent-soft"
          >
            Log out
          </button>
        </form>
      </div>

      {access.stripeCustomerId && (
        <>
          <p className="mt-3 text-xs text-muted">
            Manage billing opens Stripe&apos;s customer portal to update your
            card, download invoices, or cancel.
          </p>
          {/* Owner decision, 27 Sep 2026: the portal schedules a downgrade
              for the period end (scripts/stripe-setup-lib.ts portalParams). */}
          <p className="mt-1 text-xs text-muted">
            Switching from annual to monthly takes effect at the end of your
            paid year — no refunds or partial credits.
          </p>
        </>
      )}
    </div>
  );
}
