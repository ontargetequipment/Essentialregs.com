"use client";

import { useActionState } from "react";
import { buttonClass } from "@/lib/ui";
import {
  HONEYPOT_FIELD,
  JURISDICTION_OPTIONS,
  LIMITS,
  RENDERED_AT_FIELD,
} from "@/lib/regulation-request";
import { submitRegulationRequest, type RequestFormState } from "./actions";

const LABEL = "block text-sm font-medium text-ink-soft";
const INPUT =
  "mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";
const HINT = "mt-1 text-xs text-muted";
const ERROR = "mt-1 text-xs text-red-700";

/**
 * The /request form. `renderedAt` is the server's render time, carried in a
 * hidden field so the action can reject a submission made under three
 * seconds later; `userEmail` (signed in) prefills a read-only Email field.
 */
export function RequestForm({ renderedAt, userEmail }: { renderedAt: number; userEmail: string | null }) {
  const [state, formAction, pending] = useActionState<RequestFormState, FormData>(
    submitRegulationRequest,
    undefined
  );

  if (state?.ok) {
    return (
      <section
        role="status"
        className="rounded-lg border border-line bg-panel p-6 shadow-sm"
        data-request-success
      >
        <p className="font-mono text-eyebrow uppercase text-tag">Request received</p>
        <p className="mt-2 text-base leading-relaxed text-ink">
          Thanks — it&rsquo;s in the queue. We&rsquo;ll email you at{" "}
          <strong className="font-semibold">{state.email}</strong> if we build it.
        </p>
      </section>
    );
  }

  const fieldErrors = state && !state.ok ? state.fieldErrors ?? {} : {};
  // What was typed, carried back after an error (React resets the form when
  // the action returns); empty on first render.
  const v = state && !state.ok ? state.values : null;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate={false}>
      <input type="hidden" name={RENDERED_AT_FIELD} value={renderedAt} />
      {/* Honeypot: off-screen, not in the tab order, not announced. People
          never see it; a bot that fills every field trips it. */}
      <div aria-hidden="true" className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="request-website">Website</label>
        <input id="request-website" name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div>
        <label htmlFor="request-regulation" className={LABEL}>
          Regulation <span className="text-red-700">*</span>
        </label>
        <input
          id="request-regulation"
          name="regulation"
          type="text"
          required
          minLength={LIMITS.regulationMin}
          maxLength={LIMITS.regulationMax}
          placeholder="e.g. OSHA 29 CFR 1910, or Wyoming Oil & Gas Conservation Commission rules"
          defaultValue={v?.regulation}
          className={INPUT}
          aria-invalid={fieldErrors.regulation ? true : undefined}
        />
        {fieldErrors.regulation ? (
          <p className={ERROR}>{fieldErrors.regulation}</p>
        ) : (
          <p className={HINT}>The rule, part or program you need. A citation or a plain name both work.</p>
        )}
      </div>

      <div>
        <label htmlFor="request-jurisdiction" className={LABEL}>
          Jurisdiction <span className="text-red-700">*</span>
        </label>
        {/* Keyed on the carried value: React applies a select's defaultValue
            as the browser's default selection only on mount, so after the
            post-action form reset an un-keyed select would snap back to the
            placeholder (seen on the preview, 12 Oct 2026). */}
        <select
          key={`jurisdiction-${v?.jurisdiction ?? ""}`}
          id="request-jurisdiction"
          name="jurisdiction"
          required
          defaultValue={v?.jurisdiction || ""}
          className={INPUT}
          aria-invalid={fieldErrors.jurisdiction ? true : undefined}
        >
          <option value="" disabled>
            Choose one
          </option>
          {JURISDICTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {fieldErrors.jurisdiction && <p className={ERROR}>{fieldErrors.jurisdiction}</p>}
      </div>

      <div>
        <label htmlFor="request-agency" className={LABEL}>
          Agency <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="request-agency"
          name="agency"
          type="text"
          maxLength={LIMITS.agencyMax}
          placeholder="e.g. Texas Commission on Environmental Quality"
          defaultValue={v?.agency}
          className={INPUT}
          aria-invalid={fieldErrors.agency ? true : undefined}
        />
        {fieldErrors.agency && <p className={ERROR}>{fieldErrors.agency}</p>}
      </div>

      <div>
        <label htmlFor="request-source-url" className={LABEL}>
          Link to the official text <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="request-source-url"
          name="source_url"
          type="url"
          inputMode="url"
          maxLength={LIMITS.sourceUrlMax}
          placeholder="https://"
          defaultValue={v?.source_url}
          className={INPUT}
          aria-invalid={fieldErrors.source_url ? true : undefined}
        />
        {fieldErrors.source_url && <p className={ERROR}>{fieldErrors.source_url}</p>}
      </div>

      <div>
        <label htmlFor="request-reason" className={LABEL}>
          What are you working on? <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="request-reason"
          name="reason"
          rows={4}
          maxLength={LIMITS.reasonMax}
          placeholder="The permit, audit or project this is for, and how often you'd use it."
          defaultValue={v?.reason}
          className={INPUT}
          aria-invalid={fieldErrors.reason ? true : undefined}
        />
        {fieldErrors.reason && <p className={ERROR}>{fieldErrors.reason}</p>}
      </div>

      <div>
        <label htmlFor="request-email" className={LABEL}>
          Email <span className="text-red-700">*</span>
        </label>
        <input
          id="request-email"
          name="email"
          type="email"
          required
          maxLength={LIMITS.emailMax}
          autoComplete="email"
          defaultValue={userEmail ?? v?.email}
          readOnly={userEmail !== null}
          className={`${INPUT} ${userEmail ? "bg-paper text-ink-soft" : ""}`}
          aria-invalid={fieldErrors.email ? true : undefined}
        />
        {fieldErrors.email ? (
          <p className={ERROR}>{fieldErrors.email}</p>
        ) : (
          <p className={HINT}>
            {userEmail ? "Your account's email." : "Only used to tell you when it's built."}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="request-company" className={LABEL}>
          Company <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="request-company"
          name="company"
          type="text"
          maxLength={LIMITS.companyMax}
          autoComplete="organization"
          defaultValue={v?.company}
          className={INPUT}
          aria-invalid={fieldErrors.company ? true : undefined}
        />
        {fieldErrors.company && <p className={ERROR}>{fieldErrors.company}</p>}
      </div>

      {state && !state.ok && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <div>
        <button type="submit" disabled={pending} className={buttonClass({ width: "mobile" })}>
          {pending ? "Sending…" : "Send request"}
        </button>
      </div>
    </form>
  );
}
