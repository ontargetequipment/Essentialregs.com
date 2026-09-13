import { redirect } from "next/navigation";
import { getAccessStatus, type AccessStatus } from "@/lib/access";
import { ANNUAL_PLAN_NAME } from "@/lib/pricing";
import { logout } from "@/app/auth/actions";
import { SubscribeControl } from "@/components/SubscribeControl";

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
  const plan = access.plan ?? ANNUAL_PLAN_NAME;

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
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Your account</h1>

      {justCheckedOut && (
        <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-medium">Thanks — your subscription is being set up.</p>
          {!access.hasAccess && (
            <p className="mt-1 text-emerald-700">
              Stripe is confirming the payment. This usually takes a few
              seconds; refresh this page if the status below hasn&apos;t updated yet.
            </p>
          )}
        </div>
      )}

      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-zinc-200 pb-3">
          <dt className="text-zinc-500">Email</dt>
          <dd className="break-all font-medium text-zinc-900">{access.user.email}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-zinc-200 pb-3">
          <dt className="text-zinc-500">Plan</dt>
          <dd className="font-medium text-zinc-900">{planSummary(access)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-zinc-200 pb-3">
          <dt className="text-zinc-500">Access</dt>
          <dd className="font-medium text-zinc-900">
            {access.hasAccess ? "Full access — all regulations" : "Sample content only"}
          </dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {!access.hasAccess && <SubscribeControl access={access} size="compact" />}

        {access.stripeCustomerId && (
          <form method="post" action="/api/stripe/portal">
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Manage billing
            </button>
          </form>
        )}

        <form action={logout}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Log out
          </button>
        </form>
      </div>

      {access.stripeCustomerId && (
        <p className="mt-3 text-xs text-zinc-500">
          Manage billing opens Stripe&apos;s customer portal to update your
          card, download invoices, or cancel.
        </p>
      )}
    </div>
  );
}
