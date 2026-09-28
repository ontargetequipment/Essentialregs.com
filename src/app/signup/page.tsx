import Link from "next/link";
import { PLAN_NAMES, PRICE_DISPLAY, TRIAL_DAYS, parseBillingInterval } from "@/lib/pricing";
import { PlanCards, TrialNote } from "@/components/PlanChoice";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Sign up" };

const INLINE_LINK = "font-medium text-ink underline underline-offset-2";
const CHOOSE =
  "block w-full rounded-md bg-accent px-5 py-3 text-center text-sm font-semibold text-white hover:bg-accent/90";

// Signing up is two steps (owner, 28 Sep 2026): pick a plan, then create the
// account. Step 1 is /signup (no valid ?plan=): the two plan boxes, each
// with a "Choose ..." link to step 2. Step 2 is /signup?plan=<month|year>:
// the email/password form with the chosen plan named above it and carried
// as a hidden field, so the confirmation link brings the user back to
// /pricing with that plan already highlighted (src/app/auth/actions.ts).
export default async function SignupPage(props: PageProps<"/signup">) {
  const { plan } = await props.searchParams;
  const interval = parseBillingInterval(plan);

  if (!interval) {
    return (
      <div className="mx-auto max-w-md px-6 py-10 sm:py-14">
        <h1 className="font-serif text-section font-bold tracking-tight text-ink">Choose your plan</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Already have an account?{" "}
          <Link href="/login" className={INLINE_LINK}>
            Log in
          </Link>
        </p>
        <p className="mt-4 text-sm text-ink-soft">
          {TRIAL_DAYS}-day free trial on either plan. Pick one, then create your
          account; the card comes after you&apos;ve confirmed your email.
        </p>

        <PlanCards
          className="mt-5"
          cta={(i) => (
            <Link href={`/signup?plan=${i}`} className={CHOOSE}>
              Choose {PLAN_NAMES[i]}
            </Link>
          )}
        />
        <TrialNote className="mt-3" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">Create an account</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Already have one?{" "}
        <Link href="/login" className={INLINE_LINK}>
          Log in
        </Link>
      </p>

      <div className="mt-4 rounded-md border border-line bg-accent-soft px-4 py-3 text-sm text-ink">
        <p className="font-medium">
          Your plan: {PLAN_NAMES[interval]} — {PRICE_DISPLAY[interval]} after a {TRIAL_DAYS}-day
          free trial
        </p>
        <p className="mt-1 text-xs">
          <Link href="/signup" className="text-ink-soft underline underline-offset-2 hover:text-ink">
            Change plan
          </Link>
        </p>
      </div>
      <p className="mt-4 text-sm text-ink-soft">
        Confirm your email, then add a card to start the trial. Cancel before
        it ends and you pay nothing.
      </p>

      <SignupForm plan={interval} />
    </div>
  );
}
