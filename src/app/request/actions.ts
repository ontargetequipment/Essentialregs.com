"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";
import {
  HONEYPOT_FIELD,
  MAX_PER_EMAIL_PER_DAY,
  MAX_PER_IP_PER_DAY,
  RENDERED_AT_FIELD,
  honeypotTripped,
  readRequestFields,
  requestEmailBody,
  requestSubject,
  submittedTooFast,
  validateRegulationRequest,
  type RequestFieldErrors,
  type RequestFields,
} from "@/lib/regulation-request";

/**
 * The /request form's result. `ok: true` is the success state ("Thanks — it's
 * in the queue. We'll email you at <email> ..."); `ok: false` re-shows the
 * form with one message at the top and, when a field is at fault, a message
 * under it. `values` carries what was typed back to the form: React 19 resets
 * a form after its action returns, so without them a too-fast or invalid
 * submission would wipe the fields and the person would have to start over.
 */
export type RequestFormState =
  | { ok: true; email: string }
  | { ok: false; error: string; fieldErrors?: RequestFieldErrors; values: RequestFields }
  | undefined;

const TOO_FAST = "That was quick. Take a moment to check the form, then send it again.";
const TOO_MANY = "We have received several requests from you in the last day. Please try again tomorrow, or email support@essentialregs.com.";
const FAILED = "Something went wrong saving your request. Please try again in a minute.";

const REGREQUEST_TO = "regrequest@essentialregs.com";
const REGREQUEST_FROM = "EssentialRegs <noreply@essentialregs.com>";

let warnedNoResendKey = false;
let warnedNoSalt = false;

/**
 * sha256 of the salt and the client address. Never the raw address: the hash
 * is only compared with itself for the per-day cap. The first address in
 * x-forwarded-for is the client as Vercel saw it (x-real-ip is the same
 * value there). Without REQUEST_IP_SALT the hash still has no raw address in
 * it, but it is reproducible by anyone who knows the scheme, so the missing
 * salt is logged once.
 */
function hashClientIp(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "";
  const ip = forwarded.split(",")[0]?.trim();
  if (!ip) return null;
  const salt = process.env.REQUEST_IP_SALT ?? "";
  if (!salt && !warnedNoSalt) {
    warnedNoSalt = true;
    console.warn("[request] REQUEST_IP_SALT is not set; hashing client addresses without a salt");
  }
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** The /request form's server action (useActionState signature). */
export async function submitRegulationRequest(
  _prev: RequestFormState,
  formData: FormData
): Promise<RequestFormState> {
  const fields = readRequestFields((name) => formData.get(name));

  // Spam guards first, before anything touches the database. A filled
  // honeypot gets a quiet "success" with nothing saved: the bot learns
  // nothing, and a person never sees that field. A submission under three
  // seconds after render is asked to try again (the hidden render time stays
  // the same, so the retry passes).
  if (honeypotTripped(formData.get(HONEYPOT_FIELD))) {
    console.warn("[request] honeypot tripped; dropped");
    return { ok: true, email: fields.email.trim().toLowerCase() || "you" };
  }
  if (submittedTooFast(formData.get(RENDERED_AT_FIELD))) {
    return { ok: false, error: TOO_FAST, values: fields };
  }

  // A signed-in requester's email is their account's, whatever the (read-only)
  // field said; their user id goes on the row.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) fields.email = user.email;

  const validated = validateRegulationRequest(fields);
  if (!validated.ok) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: validated.errors, values: fields };
  }
  const value = validated.value;

  const h = await headers();
  const ipHash = hashClientIp(h);
  const userAgent = (h.get("user-agent") ?? "").slice(0, 500) || null;

  const admin = createAdminClient();

  // Per-24h caps, counted in the database before the insert: 5 per email,
  // 20 per address hash.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [byEmail, byIp] = await Promise.all([
    admin
      .from("regulation_requests")
      .select("id", { count: "exact", head: true })
      .eq("email", value.email)
      .gte("created_at", since),
    ipHash
      ? admin
          .from("regulation_requests")
          .select("id", { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .gte("created_at", since)
      : Promise.resolve({ count: 0, error: null }),
  ]);
  if (byEmail.error || byIp.error) {
    console.error("[request] cap check failed", byEmail.error?.message ?? byIp.error?.message);
    return { ok: false, error: FAILED, values: fields };
  }
  if ((byEmail.count ?? 0) >= MAX_PER_EMAIL_PER_DAY || (byIp.count ?? 0) >= MAX_PER_IP_PER_DAY) {
    return { ok: false, error: TOO_MANY, values: fields };
  }

  const { data: row, error } = await admin
    .from("regulation_requests")
    .insert({
      regulation: value.regulation,
      jurisdiction: value.jurisdiction,
      agency: value.agency,
      source_url: value.source_url,
      reason: value.reason,
      email: value.email,
      company: value.company,
      user_id: user?.id ?? null,
      ip_hash: ipHash,
      user_agent: userAgent,
    })
    .select("id, created_at")
    .single();
  if (error || !row) {
    console.error("[request] insert failed", error?.message);
    return { ok: false, error: FAILED, values: fields };
  }

  // The notification is best-effort: the request is saved either way, and
  // the requester never sees a difference.
  await notifyRegRequest({
    body: requestEmailBody(value, {
      id: row.id,
      createdAt: row.created_at,
      userId: user?.id ?? null,
      adminUrl: `${SITE_URL}/admin/requests`,
    }),
    subject: requestSubject(value),
    replyTo: value.email,
  });

  return { ok: true, email: value.email };
}

/**
 * One plain-text email to regrequest@ through Resend's HTTP API
 * (https://resend.com/docs/api-reference/emails/send-email). Skipped, with
 * one log line per process, when RESEND_API_KEY is not set; a failure is
 * logged and swallowed.
 */
async function notifyRegRequest(mail: { subject: string; body: string; replyTo: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (!warnedNoResendKey) {
      warnedNoResendKey = true;
      console.warn("[request] RESEND_API_KEY is not set; requests are saved but regrequest@ is not emailed");
    }
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: REGREQUEST_FROM,
        to: [REGREQUEST_TO],
        reply_to: mail.replyTo,
        subject: mail.subject,
        text: mail.body,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[request] Resend answered", res.status, (await res.text()).slice(0, 300));
    }
  } catch (err) {
    console.error("[request] Resend call failed", err instanceof Error ? err.message : err);
  }
}
