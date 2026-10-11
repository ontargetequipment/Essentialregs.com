"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "../auth/actions";
import { buttonClass } from "@/lib/ui";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);

  if (state?.message) {
    return <p className="mt-8 text-sm text-accent">{state.message}</p>;
  }

  return (
    <form action={formAction} className="mt-8 space-y-4">
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

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className={buttonClass({ width: "full" })}
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
