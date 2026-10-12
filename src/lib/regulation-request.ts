/**
 * The "Request a regulation" form (/request, 12 Oct 2026): the field rules,
 * the jurisdiction list and the two spam guards, as pure functions so the
 * server action (src/app/request/actions.ts) and the unit test
 * (scripts/regulation-request.test.ts) share one definition. No Next, no
 * Supabase, no `server-only` here: the client form imports the jurisdiction
 * list and the field limits too.
 */

/** The fifty states, alphabetically, as the select lists them and as `jurisdiction` stores them. */
export const US_STATES: readonly string[] = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
  "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
  "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
];

/** `jurisdiction` is 'federal', one of US_STATES, or 'other' (what the column stores). */
export const JURISDICTION_FEDERAL = "federal";
export const JURISDICTION_OTHER = "other";

/** The select's options in display order: Federal, each state alphabetically, Other. */
export const JURISDICTION_OPTIONS: readonly { value: string; label: string }[] = [
  { value: JURISDICTION_FEDERAL, label: "Federal" },
  ...US_STATES.map((name) => ({ value: name, label: name })),
  { value: JURISDICTION_OTHER, label: "Other" },
];

const JURISDICTION_VALUES = new Set(JURISDICTION_OPTIONS.map((o) => o.value));

/** "Federal", the state's name, or "Other": how a stored jurisdiction prints (emails, the admin list). */
export function jurisdictionLabel(value: string): string {
  return JURISDICTION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** Field limits (characters). The migration's check constraints match. */
export const LIMITS = {
  regulationMin: 3,
  regulationMax: 200,
  agencyMax: 200,
  sourceUrlMax: 2000,
  reasonMax: 1000,
  emailMax: 320,
  companyMax: 200,
} as const;

/** A submission must arrive at least this long after the form rendered. */
export const MIN_SUBMIT_MS = 3000;

/** The row's triage states, in the order the admin list shows them. */
export const REQUEST_STATUSES = ["new", "planned", "building", "done", "declined"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Per-24-hour caps, checked in the database before the insert. */
export const MAX_PER_EMAIL_PER_DAY = 5;
export const MAX_PER_IP_PER_DAY = 20;

/** The honeypot field's name: a plausible one a bot fills, hidden from people. */
export const HONEYPOT_FIELD = "website";
/** The hidden field carrying the render time (ms since the epoch). */
export const RENDERED_AT_FIELD = "rendered_at";

export type RequestFields = {
  regulation: string;
  jurisdiction: string;
  agency: string;
  source_url: string;
  reason: string;
  email: string;
  company: string;
};

export type RequestFieldErrors = Partial<Record<keyof RequestFields, string>>;

/** A validated request, trimmed, with empty optionals as null (what the row stores). */
export type ValidRequest = {
  regulation: string;
  jurisdiction: string;
  agency: string | null;
  source_url: string | null;
  reason: string | null;
  email: string;
  company: string | null;
};

export type ValidationResult =
  | { ok: true; value: ValidRequest }
  | { ok: false; errors: RequestFieldErrors };

/**
 * One address, no spaces, something either side of a single @ and a dot in
 * the domain. Deliberately loose beyond that: this is the reply-to for an
 * email a person reads, not an account.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trims, collapses inner whitespace runs to one space. */
function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Trims; keeps line breaks (the textarea). */
function cleanMultiline(s: string): string {
  return s.replace(/\r\n?/g, "\n").trim();
}

/** http(s) only, parseable, no credentials. */
export function isAllowedSourceUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  return url.hostname.length > 0;
}

/** Server-side validation of the form's fields. Every rule the HTML enforces is re-checked here. */
export function validateRegulationRequest(fields: RequestFields): ValidationResult {
  const errors: RequestFieldErrors = {};

  const regulation = clean(fields.regulation);
  if (regulation.length < LIMITS.regulationMin) {
    errors.regulation = `Tell us which regulation (at least ${LIMITS.regulationMin} characters).`;
  } else if (regulation.length > LIMITS.regulationMax) {
    errors.regulation = `Keep the regulation name under ${LIMITS.regulationMax} characters.`;
  }

  const jurisdiction = fields.jurisdiction.trim();
  if (!JURISDICTION_VALUES.has(jurisdiction)) {
    errors.jurisdiction = "Choose Federal, a state, or Other.";
  }

  const agency = clean(fields.agency);
  if (agency.length > LIMITS.agencyMax) {
    errors.agency = `Keep the agency under ${LIMITS.agencyMax} characters.`;
  }

  const source_url = fields.source_url.trim();
  if (source_url) {
    if (source_url.length > LIMITS.sourceUrlMax) {
      errors.source_url = "That link is too long.";
    } else if (!isAllowedSourceUrl(source_url)) {
      errors.source_url = "The link must start with http:// or https://.";
    }
  }

  const reason = cleanMultiline(fields.reason);
  if (reason.length > LIMITS.reasonMax) {
    errors.reason = `Keep this under ${LIMITS.reasonMax} characters.`;
  }

  const email = fields.email.trim().toLowerCase();
  if (!email) {
    errors.email = "Enter the email address to reach you at.";
  } else if (email.length > LIMITS.emailMax || !EMAIL_RE.test(email)) {
    errors.email = "That doesn't look like an email address.";
  }

  const company = clean(fields.company);
  if (company.length > LIMITS.companyMax) {
    errors.company = `Keep the company under ${LIMITS.companyMax} characters.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      regulation,
      jurisdiction,
      agency: agency || null,
      source_url: source_url || null,
      reason: reason || null,
      email,
      company: company || null,
    },
  };
}

/** True when the hidden honeypot field came back with anything in it: a bot filled the whole form. */
export function honeypotTripped(honeypotValue: unknown): boolean {
  return typeof honeypotValue === "string" ? honeypotValue.trim().length > 0 : honeypotValue != null;
}

/**
 * True when the form was submitted less than MIN_SUBMIT_MS after it rendered,
 * or the render time is missing or unreadable (a POST that skipped the page).
 * A render time in the future is also rejected. `now` is injectable for tests.
 */
export function submittedTooFast(renderedAtRaw: unknown, now: number = Date.now(), minMs: number = MIN_SUBMIT_MS): boolean {
  if (typeof renderedAtRaw !== "string" || !/^\d{10,16}$/.test(renderedAtRaw.trim())) return true;
  const renderedAt = Number(renderedAtRaw.trim());
  if (!Number.isFinite(renderedAt)) return true;
  if (renderedAt > now) return true;
  return now - renderedAt < minMs;
}

/** Reads the form's fields out of a FormData-like object (missing ones as ""). */
export function readRequestFields(get: (name: string) => unknown): RequestFields {
  const str = (name: string) => {
    const v = get(name);
    return typeof v === "string" ? v : "";
  };
  return {
    regulation: str("regulation"),
    jurisdiction: str("jurisdiction"),
    agency: str("agency"),
    source_url: str("source_url"),
    reason: str("reason"),
    email: str("email"),
    company: str("company"),
  };
}

/** The notification's subject line: "Regulation request: <regulation> (<Jurisdiction>)". */
export function requestSubject(value: Pick<ValidRequest, "regulation" | "jurisdiction">): string {
  return `Regulation request: ${value.regulation} (${jurisdictionLabel(value.jurisdiction)})`;
}

/** The notification's plain-text body: every field, then the admin link. */
export function requestEmailBody(
  value: ValidRequest,
  extra: { id: string; createdAt: string; userId: string | null; adminUrl: string }
): string {
  const line = (label: string, v: string | null) => `${label}: ${v ?? "-"}`;
  return [
    "A new regulation request from essentialregs.com/request.",
    "",
    line("Regulation", value.regulation),
    line("Jurisdiction", jurisdictionLabel(value.jurisdiction)),
    line("Agency", value.agency),
    line("Link to the official text", value.source_url),
    line("What they are working on", value.reason),
    line("Email", value.email),
    line("Company", value.company),
    line("Signed in", extra.userId ? `yes (user ${extra.userId})` : "no"),
    line("Received", extra.createdAt),
    line("Request id", extra.id),
    "",
    `Triage it: ${extra.adminUrl}`,
    "",
    "Reply to this email to reach the requester.",
  ].join("\n");
}
