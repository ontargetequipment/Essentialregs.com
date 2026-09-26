"use client";

import { useActionState } from "react";
import { updatePassword } from "../auth/actions";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, undefined);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink-soft">
          New password
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
          Confirm new password
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
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
