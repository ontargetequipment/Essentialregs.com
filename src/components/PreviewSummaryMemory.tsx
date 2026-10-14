"use client";

import { useEffect } from "react";
import { OPEN_SUMMARIES_KEY, parseOpenSummaries, withOpenSummary } from "@/lib/open-summaries";

/**
 * Remembers which summary panels the visitor opened on the preview pages and
 * re-opens them on the way back (v3.1, 13 Oct 2026; src/lib/open-summaries.ts
 * says why and what is stored). Renders nothing: on mount it opens every
 * panel of #preview-doc whose row is in the stored list, then listens for
 * the rows' own <details> toggling (`toggle` does not bubble, so in the
 * capture phase) and writes the list back. Only a row's own panel counts
 * (`#preview-doc > [id] > details.summary-panel`), never a panel inside a
 * popup or a nested block. Blocked storage leaves the page as the server
 * rendered it.
 */
export function PreviewSummaryMemory() {
  useEffect(() => {
    const doc = document.getElementById("preview-doc");
    if (!doc) return;
    const read = (): string[] => {
      try {
        return parseOpenSummaries(window.sessionStorage.getItem(OPEN_SUMMARIES_KEY));
      } catch {
        return [];
      }
    };
    const write = (ids: string[]): void => {
      try {
        if (ids.length) window.sessionStorage.setItem(OPEN_SUMMARIES_KEY, JSON.stringify(ids));
        else window.sessionStorage.removeItem(OPEN_SUMMARIES_KEY);
      } catch {
        /* blocked storage: nothing to remember */
      }
    };
    /** The row's own summary panel: a <details class="summary-panel"> that is the direct child of a direct child of #preview-doc. */
    const rowOf = (panel: Element): HTMLElement | null => {
      const row = panel.parentElement;
      return row && row.parentElement === doc && row.id ? row : null;
    };

    for (const id of read()) {
      const row = Array.from(doc.children).find((el) => el.id === id);
      const panel = row?.querySelector(":scope > details.summary-panel");
      if (panel instanceof HTMLDetailsElement && !panel.open) panel.open = true;
    }

    const onToggle = (e: Event) => {
      const panel = e.target;
      if (!(panel instanceof HTMLDetailsElement) || !panel.classList.contains("summary-panel")) return;
      const row = rowOf(panel);
      if (!row) return;
      write(withOpenSummary(read(), row.id, panel.open));
    };
    doc.addEventListener("toggle", onToggle, true);
    return () => doc.removeEventListener("toggle", onToggle, true);
  }, []);
  return null;
}
