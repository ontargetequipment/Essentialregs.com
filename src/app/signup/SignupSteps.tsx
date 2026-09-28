"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { BillingInterval } from "@/lib/pricing";
import { LAST_UPDATED } from "@/components/LegalPage";
import { SignupForm } from "./SignupForm";

const INLINE_LINK = "font-medium text-ink underline underline-offset-2";

// How close to the bottom of the scroll box counts as "read to the end";
// a few pixels of slack for fractional scroll positions on zoomed pages.
const END_SLACK_PX = 8;

/**
 * The two screens of /signup?plan=<interval> (owner, 28 Sep 2026):
 *
 *   1. the disclaimer, in full (the same text as /disclaimer, passed in as
 *      `disclaimer` so this file never carries a copy of it), in a scroll
 *      box. The acceptance checkbox and the Continue button stay disabled
 *      until the box has been scrolled to the end; Continue also needs the
 *      box ticked.
 *   2. the email/password form, which carries `plan`, `accepted=1` and the
 *      disclaimer version as hidden fields. The signup action refuses to
 *      create an account without them (src/lib/disclaimer.ts).
 *
 * The step lives in component state, not the URL, so no query string gets
 * anyone past screen 1. Reloading starts over, which is the point.
 */
export function SignupSteps({ plan, disclaimer }: { plan: BillingInterval; disclaimer: ReactNode }) {
  const [accepted, setAccepted] = useState(false);

  if (accepted) {
    return (
      <>
        <p className="mt-4 text-sm text-ink-soft">
          Confirm your email, then add a card to start the trial. Cancel before
          it ends and you pay nothing.
        </p>
        <SignupForm plan={plan} />
      </>
    );
  }

  return <DisclaimerGate onContinue={() => setAccepted(true)}>{disclaimer}</DisclaimerGate>;
}

function DisclaimerGate({ children, onContinue }: { children: ReactNode; onContinue: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [ticked, setTicked] = useState(false);
  const checkboxId = useId();
  const hintId = useId();

  const checkEnd = useCallback(() => {
    const el = boxRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - END_SLACK_PX) {
      setReachedEnd(true);
    }
  }, []);

  // A viewport tall enough to show the whole text has nothing to scroll:
  // check once on mount, and again whenever the box or its content resizes.
  useEffect(() => {
    checkEnd();
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(checkEnd);
    observer.observe(el);
    return () => observer.disconnect();
  }, [checkEnd]);

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold text-ink">Before you create your account</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Please read our disclaimer. Scroll to the end to continue.
      </p>

      {/* tabIndex makes the box keyboard-scrollable; the region role and
          label tell a screen reader what it is. */}
      <div
        ref={boxRef}
        onScroll={checkEnd}
        tabIndex={0}
        role="region"
        aria-label="Disclaimer"
        aria-describedby={hintId}
        data-testid="disclaimer-scroll"
        className="mt-4 max-h-[55vh] overflow-y-auto rounded-md border border-line bg-panel p-4 focus:border-accent focus:outline-none"
      >
        <p className="font-mono text-eyebrow uppercase text-tag">Disclaimer · Last updated: {LAST_UPDATED}</p>
        <div className="mt-3">{children}</div>
        <p className="mt-6 text-xs text-muted" data-testid="disclaimer-end">
          End of disclaimer.
        </p>
      </div>
      <p id={hintId} className="mt-2 text-xs text-muted" aria-live="polite">
        {reachedEnd ? "Thanks for reading." : "Scroll to the end of the disclaimer to enable the checkbox."}
      </p>

      <div className="mt-4 flex items-start gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          checked={ticked}
          disabled={!reachedEnd}
          onChange={(e) => setTicked(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-accent disabled:opacity-50"
        />
        <label htmlFor={checkboxId} className={`text-sm ${reachedEnd ? "text-ink" : "text-muted"}`}>
          I have read the disclaimer and agree to the{" "}
          <Link href="/terms" target="_blank" rel="noopener" className={INLINE_LINK}>
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" rel="noopener" className={INLINE_LINK}>
            Privacy Policy
          </Link>
          .
        </label>
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!reachedEnd || !ticked}
        className="mt-4 w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Continue
      </button>
    </div>
  );
}
