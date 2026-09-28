import Link from "next/link";
import { PLAN_NAMES, parseBillingInterval } from "@/lib/pricing";
import { ResendForm } from "./ResendForm";

export const metadata = { title: "Check your email" };

const INLINE_LINK = "font-medium text-ink underline underline-offset-2";

// Where the signup action sends a new account (owner, 28 Sep 2026): a
// screen of its own instead of a line under the emptied form. Also the
// place a stuck user is pointed to from /login (a link that failed, or an
// account that was never confirmed) to get a fresh link.
// ?email= prefills the resend form; ?plan= keeps the chosen plan on the new
// link so it still lands on /pricing with that card highlighted.
export default async function CheckEmailPage(props: PageProps<"/check-email">) {
  const { email, plan } = await props.searchParams;
  const address = typeof email === "string" ? email.trim() : "";
  const interval = parseBillingInterval(plan);

  return (
    <div className="mx-auto max-w-md px-6 py-10 sm:py-14">
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">Check your email</h1>
      <p className="mt-3 text-sm text-ink-soft">
        {address ? (
          <>
            We sent a confirmation link to <span className="font-medium text-ink">{address}</span>.
          </>
        ) : (
          "We send a confirmation link to the address you signed up with."
        )}{" "}
        Open it to confirm your address
        {interval ? ` and start your free trial on the ${PLAN_NAMES[interval]} plan` : ""}.
      </p>
      <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-ink-soft marker:text-muted">
        <li>The link works on any device: sign up on your laptop, open it on your phone.</li>
        <li>Gmail groups our emails into one thread; open the newest one.</li>
        <li>Nothing after a few minutes? Check your spam folder, then resend below.</li>
      </ul>

      <ResendForm email={address} plan={interval ?? undefined} />

      <p className="mt-6 text-sm text-ink-soft">
        Already confirmed?{" "}
        <Link href="/login" className={INLINE_LINK}>
          Log in
        </Link>
      </p>
    </div>
  );
}
