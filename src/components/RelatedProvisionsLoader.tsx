"use client";

import { useEffect } from "react";
import { provisionDestination } from "@/lib/destination";
import { displayCitation } from "@/lib/federal-citation";

type Item = {
  id: string;
  citation: string;
  title: string;
  reg_key: string | null;
  path: string | null;
  summary: string | null;
  /** summaryStatusBadge's result for `summary`, computed by /api/related (lib/related.ts). */
  summary_badge: { kind: "reviewed" | "human" | "pending"; label: string; compactLabel: string; title: string } | null;
  badge: string;
  regLabel: string;
  crossReg: boolean;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Fills the reader's collapsed "Related by meaning, not cited" panels on first open.
 * The panels are plain HTML from relatedPanelHtml() (lib/related.ts), so
 * this listens for <details> toggles at the document level (capture phase:
 * `toggle` doesn't bubble) and fetches /api/related once per panel.
 *
 * Same-regulation neighbours are rendered as `.xref` spans, which the
 * existing reader script (RegulationReader.tsx) already turns into
 * click-to-preview popups. Cross-regulation neighbours are ordinary links,
 * opened by who is looking (provisionDestination, Sprint 4, 10 Oct 2026): the
 * exact provision in the reader for a subscriber, the focused preview for a
 * visitor. A visitor's /api/related already returns only public-to-public
 * neighbours (RLS), so with GP05 the only regulation they can see is their
 * own page's; the destination rule is the backstop if that ever widens.
 */
export function RelatedProvisionsLoader({ currentReg, publicMode = false }: { currentReg: string; publicMode?: boolean }) {
  useEffect(() => {
    const loaded = new Set<string>();

    function render(body: HTMLElement, items: Item[]) {
      if (!items.length) {
        body.innerHTML = '<p class="related-note">No related provisions found for this section.</p>';
        return;
      }
      const li = items
        .map((it) => {
          const sameReg = it.reg_key === currentReg;
          const link = sameReg
            ? `<span class="xref related-link" data-target="${esc(it.id)}">${esc(displayCitation(it.reg_key, it.citation))}</span>`
            : `<a class="related-link" href="${esc(
                provisionDestination({ id: it.id, reg_key: it.reg_key }, { hasAccess: !publicMode })
              )}">${esc(displayCitation(it.reg_key, it.citation))}</a>`;
          const title = it.title ? `<span class="related-title">${esc(it.title)}</span>` : "";
          const path = it.path ? `<span class="related-path">${esc(it.path)}</span>` : "";
          // Same "Plain-English summary" label as the Ask cards (backlog #16), so the
          // excerpt is never unlabelled prose next to the provision's own words, and
          // the same review-status badge beside it (owner decision, 29 Sep 2026).
          const review = it.summary_badge
            ? `<span class="summary-badge related-review is-${esc(it.summary_badge.kind)}" title="${esc(
                it.summary_badge.title
              )}">${esc(it.summary_badge.compactLabel)}</span>`
            : "";
          const summary = it.summary
            ? `<span class="related-label">Plain-English summary${review}</span><span class="related-snip">${esc(it.summary)}</span>`
            : "";
          return (
            `<li><span class="related-badge related-badge-${esc(it.badge.toLowerCase())}">${esc(it.badge)}</span>` +
            `<span class="related-reg">${esc(it.regLabel)}</span> ${link} ${path}${title}${summary}</li>`
          );
        })
        .join("");
      body.innerHTML = `<p class="related-note">Found by meaning; this provision does not cite them.</p><ul class="related-list">${li}</ul>`;
    }

    async function load(panel: HTMLDetailsElement) {
      const id = panel.dataset.relatedFor;
      const body = panel.querySelector<HTMLElement>(".related-body");
      if (!id || !body || loaded.has(id)) return;
      loaded.add(id);
      try {
        const res = await fetch(`/api/related?id=${encodeURIComponent(id)}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { items: Item[] };
        render(body, json.items ?? []);
      } catch {
        loaded.delete(id);
        body.innerHTML = '<p class="related-note">Couldn’t load related provisions. Open the panel again to retry.</p>';
      }
    }

    function onToggle(e: Event) {
      const panel = e.target as HTMLDetailsElement | null;
      if (panel?.tagName === "DETAILS" && panel.classList.contains("related-panel") && panel.open) {
        void load(panel);
      }
    }
    document.addEventListener("toggle", onToggle, true);
    return () => document.removeEventListener("toggle", onToggle, true);
  }, [currentReg, publicMode]);

  return null;
}
