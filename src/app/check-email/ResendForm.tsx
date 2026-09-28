"use client";

import { useActionState } from "react";
import type { BillingInterval } from "@/lib/pricing";
import { resendConfirmation } from "../auth/actions";

export function ResendForm({ email, plan }: { email: string; plan?: BillingInterval }) {
  const [state, formAction, pending] = useActionState(resendConfirmation, undefined);

  if (state?.message) {
    return (
      <p role="status" className="mt-6 text-sm text-accent">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-3">
      {plan && <input type="hidden" name="plan" value={plan} />}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink-soft">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={email}
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink hover:border-accent disabled:opacity-60"
      >
        {pending ? "Sending…" : "Resend confirmation email"}
      </button>
    </form>
  );
}
