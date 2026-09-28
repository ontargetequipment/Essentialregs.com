"use client";

import { useActionState } from "react";
import type { BillingInterval } from "@/lib/pricing";
import { ACCEPT_FIELD, ACCEPT_VALUE, DISCLAIMER_VERSION, VERSION_FIELD } from "@/lib/disclaimer";
import { signup } from "../auth/actions";

export function SignupForm({ plan }: { plan: BillingInterval }) {
  const [state, formAction, pending] = useActionState(signup, undefined);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {/* The plan chosen on /signup (step 1): the signup action turns it into
          the confirmation link's `next` (/pricing?plan=<plan>). */}
      <input type="hidden" name="plan" value={plan} />
      {/* This form only renders once the disclaimer gate (SignupSteps) has
          been passed; these say so, and which revision of the text was
          accepted. The signup action refuses to create an account without
          them (src/lib/disclaimer.ts). */}
      <input type="hidden" name={ACCEPT_FIELD} value={ACCEPT_VALUE} />
      <input type="hidden" name={VERSION_FIELD} value={DISCLAIMER_VERSION} />
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink-soft">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink-soft">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink-soft">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Sign up"}
      </button>
    </form>
  );
}
