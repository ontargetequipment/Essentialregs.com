import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseTourEvent } from "@/lib/tour";

export const runtime = "nodejs";

/** A tour event body is ~80 bytes; anything much bigger is not one. */
const MAX_BODY = 1024;

const NO_STORE = { "Cache-Control": "no-store" };

function deploymentEnv(): "production" | "preview" | "development" {
  const env = process.env.VERCEL_ENV;
  return env === "production" || env === "preview" ? env : "development";
}

/**
 * POST /api/tour-event {event, step, sid}
 *
 * Counts the guided GP05 walkthrough (Sprint 6, 10 Oct 2026; src/lib/tour.ts,
 * ReaderTour.tsx): one row in public.tour_events per event, inserted through
 * the request's own Supabase client, which RLS lets INSERT and nothing else
 * (migration 20261011014953_tour_events.sql). Vercel's custom events (track())
 * would have done this, but they need a Pro plan and this project is on
 * Hobby.
 *
 * Counts only: the event, the step, the tour's random session id and the
 * deployment environment. No user id, no IP, no URL. A request from a
 * browser that says it is automated (x-tour-automated: the Playwright smoke
 * suite, see sendTourEvent) is answered and not stored, so the smoke runs
 * never show up in the counts. 204 when stored (500 when the insert fails,
 * 400/403/413 for a request that is not a tour event): the tour sends and
 * forgets, and never shows an error from it.
 */
export async function POST(req: Request) {
  // Same-site only: the tour posts from the site's own pages.
  const origin = req.headers.get("origin");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      /* unparseable: refused below */
    }
    const hosts = [req.headers.get("host"), req.headers.get("x-forwarded-host")].filter(Boolean);
    if (!originHost || !hosts.includes(originHost)) {
      return new NextResponse(null, { status: 403, headers: NO_STORE });
    }
  }

  const text = await req.text();
  if (text.length > MAX_BODY) return new NextResponse(null, { status: 413, headers: NO_STORE });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400, headers: NO_STORE });
  }
  const input = parseTourEvent(body);
  if (!input) return new NextResponse(null, { status: 400, headers: NO_STORE });

  if (req.headers.get("x-tour-automated") === "1") {
    return new NextResponse(null, { status: 204, headers: { ...NO_STORE, "x-tour-event": "skipped" } });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("tour_events").insert({
      event: input.event,
      step: input.step,
      session_id: input.sid,
      env: deploymentEnv(),
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("tour event:", e instanceof Error ? e.message : e);
    return new NextResponse(null, { status: 500, headers: NO_STORE });
  }
  return new NextResponse(null, { status: 204, headers: { ...NO_STORE, "x-tour-event": "stored" } });
}
