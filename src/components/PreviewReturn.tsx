"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { READER_TRAIL_RESET_EVENT } from "@/lib/reader-nav";
import {
  PREVIEW_TRAIL_KEY,
  parsePreviewTrail,
  popPreviewTrail,
  previewTrailBar,
  reconcilePreviewTrail,
  type PreviewHop,
} from "@/lib/preview-trail";

/**
 * The focused preview's "← Back to …" bar (walkthrough v3, 13 Oct 2026).
 * The server renders it from the URL's one `?from=` (`origin`:
 * previewReturnLink, preview-subtree.ts); this component keeps the trail of
 * hops behind it in sessionStorage (preview-trail.ts) and, once mounted,
 * shows the trail's top hop with how many hops there are and where the next
 * Back goes ("← Back to Regulation 7 · I.C.1 · then GP05 · VI.C").
 *
 * The server markup and the first client render are the same (`origin`),
 * so there is nothing to hydrate differently; the trail is read after
 * mount (useSyncExternalStore, a null server snapshot) and reconciled with
 * the page's origin in an effect. Taking the link pops the top hop. The
 * walkthrough's Restart and Skip clear the key and send
 * READER_TRAIL_RESET_EVENT, which re-reads it. Storage can be blocked: the
 * bar is then the server's, for this page only.
 */

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener(READER_TRAIL_RESET_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener(READER_TRAIL_RESET_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(PREVIEW_TRAIL_KEY);
  } catch {
    return null;
  }
}
function writeTrail(trail: readonly PreviewHop[]): void {
  try {
    if (trail.length) window.sessionStorage.setItem(PREVIEW_TRAIL_KEY, JSON.stringify(trail));
    else window.sessionStorage.removeItem(PREVIEW_TRAIL_KEY);
  } catch {
    /* blocked storage: the bar stays the server's */
  }
  listeners.forEach((l) => l());
}
const serverRaw = () => null;

export function PreviewReturn({ origin, reg }: { origin: PreviewHop; reg: string }) {
  const raw = useSyncExternalStore(subscribe, readRaw, serverRaw);
  const trail = parsePreviewTrail(raw);

  // On arrival: the origin becomes the trail's top (reconcilePreviewTrail
  // decides whether that starts, extends or keeps the trail).
  useEffect(() => {
    const next = reconcilePreviewTrail(parsePreviewTrail(readRaw()), origin, reg);
    if (JSON.stringify(next) !== JSON.stringify(parsePreviewTrail(readRaw()))) writeTrail(next);
  }, [origin, reg]);

  const bar = previewTrailBar(trail, origin);
  const onClick = useCallback(() => {
    writeTrail(popPreviewTrail(parsePreviewTrail(readRaw())));
  }, []);

  return (
    <a
      id="preview-return"
      data-testid="preview-return"
      data-hops={bar ? bar.count : 1}
      href={bar ? bar.href : origin.href}
      onClick={onClick}
      className="mb-5 inline-flex min-h-11 flex-wrap items-center gap-x-1 rounded-full border border-line bg-panel px-4 text-sm font-semibold text-accent shadow-sm hover:bg-accent-soft"
    >
      <span>{bar ? bar.label : origin.label}</span>
      {bar && bar.then && (
        <span className="font-normal text-muted" data-testid="preview-return-then">
          · then {bar.then}
        </span>
      )}
    </a>
  );
}
