"use client";

import { useEffect } from "react";
import {
  buildSearchIndexFromDom,
  fillContainsBoxes,
  fillSummaryLinks,
  readReaderModel,
} from "@/lib/reader-client";
import { popupEyebrow, ReturnTrail, rowAtViewportTop, rowLabel } from "@/lib/reader-nav";
import type { SearchRow } from "@/lib/snippet";

/**
 * Options of goToProvision, the one way the reader moves to a provision.
 *
 *   push  true for a user's own navigation (popup "Go to full section", a
 *         sidebar link, a jump-box landing, the return bar): the entry being
 *         left is stamped with the provision the reader was on, and a new
 *         history entry for "#<id>" is pushed, so Back is meaningful. false
 *         for a deep link on load and for popstate, which move without
 *         touching history.
 *   from  the provision the user is leaving, pushed onto the return trail
 *         (push only). Omitted: the row at the top of the reading pane.
 *         null: record nothing -- the return bar's own Back button, a deep
 *         link, popstate.
 */
export type GoToOptions = { push: boolean; from?: string | null };

/** What the reader writes into history.state; Next keeps its own keys beside it. */
type ReaderHistoryState = { readerAnchor?: string } | null;

/**
 * Viewport y of "the top of the reading pane": just under the return bar,
 * where goToProvision lands a target (scroll-margin-top on #doc's rows in
 * reader.css). Used to tell which provision the reader is on.
 */
const PANE_TOP_Y = 72;

function decodeHash(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Client-side behavior for the regulation reader: mobile sidebar toggle,
 * click-a-cross-reference-to-preview-it popups, the jump/search box, and
 * every "go to a provision" path (goToProvision below), with the return
 * trail those leave behind.
 *
 * This mirrors the vanilla-JS reader script from the source document almost
 * line for line — deliberately. The sidebar and main document are rendered
 * server-side as plain HTML with the same ids/classes the original used, so
 * the simplest, most robust way to make them interactive is the same
 * DOM-event-delegation approach the original used, run once on mount,
 * rather than re-modeling all of this as React state.
 */
export function RegulationReader() {
  useEffect(() => {
    const doc = document.getElementById("doc");
    const backdrop = document.getElementById("backdrop");
    const popupEyebrowEl = document.getElementById("popup-eyebrow");
    const popupTitle = document.getElementById("popup-title");
    const popupBody = document.getElementById("popup-body");
    const popupTextLabel = document.getElementById("popup-text-label");
    const popupGoto = document.getElementById("popup-goto") as HTMLAnchorElement | null;
    const sidebar = document.getElementById("sidebar");
    const toggle = document.getElementById("mobile-toggle");
    const sidebarScrim = document.getElementById("sidebar-scrim");
    const jumpbox = document.getElementById("jumpbox") as HTMLInputElement | null;
    const jumpResults = document.getElementById("jump-results");
    // The return trail bar ([reg]/page.tsx): sticky at the top of the
    // reading pane, hidden until the first goto.
    const trailBar = document.getElementById("return-trail");
    const trailBack = document.getElementById("return-trail-back");
    const trailLabel = document.getElementById("return-trail-label");
    const trailDismiss = document.getElementById("return-trail-dismiss");

    if (!backdrop || !popupTitle || !popupBody || !sidebar || !jumpbox || !jumpResults || !doc) {
      return;
    }

    // The page ships the provisions and nothing else; the furniture around
    // them is rebuilt here from the DOM (see reader-client.ts): the tree
    // from document order, then every item's contains box and every summary
    // panel's source link, right now, so a hash jump below lands on a
    // finished page and a popup's clone of an item is complete. The search
    // index is the same rows again, built on first use or when idle.
    const model = readReaderModel(doc);
    fillSummaryLinks(model);
    fillContainsBoxes(model);
    let searchIndex: SearchRow[] | null = null;
    const getSearchIndex = () => (searchIndex ??= buildSearchIndexFromDom(model));
    const idle =
      "requestIdleCallback" in window ? window.requestIdleCallback(() => getSearchIndex()) : null;

    const trail = new ReturnTrail();

    // Every lookup of a provision's element goes through the model, never
    // document.getElementById: the popup clones the row it previews, id and
    // all, and #backdrop precedes #doc in the DOM, so while a popup is open
    // getElementById(id) returns the hidden clone. That is what made "Go to
    // full section" change the hash without scrolling (it scrolled the clone,
    // inside a display:none backdrop).
    function rowEl(id: string): HTMLElement | null {
      return model.byId.get(id)?.el ?? null;
    }
    function labelOf(id: string): string {
      const row = model.byId.get(id);
      return row ? rowLabel(model, row) : id;
    }

    // id -> containing sidebar <details> group id (the 4th column of the
    // search index rows). Used so a hash-load or a "go to" jump opens the
    // sidebar group the target provision actually lives in, instead of
    // leaving it collapsed.
    function openGroupFor(slug: string) {
      if (!model.byId.has(slug)) return;
      const groupId = model.topGroupOf(slug);
      const details = document.getElementById(`navgroup-${groupId}`);
      if (details instanceof HTMLDetailsElement) details.open = true;
    }

    function labelFor(el: Element): string {
      const idSpan = el.querySelector(".item-id");
      if (idSpan?.textContent) return idSpan.textContent.trim();
      // Rows whose text already opens with their citation carry no
      // .item-id badge (withItemIdBadge skips them), so read the citation
      // back off the data attribute instead of falling through to the
      // raw internal slug below.
      const dataCitation = el.getAttribute("data-citation");
      if (dataCitation) return dataCitation.trim();
      const h = el.querySelector("h1, h2");
      if (h?.textContent) return h.textContent.trim();
      return "";
    }

    // The provision the open popup previews, and the row its cross-reference
    // was clicked in (null when clicked inside the popup itself).
    let popupSlug: string | null = null;
    let popupOrigin: string | null = null;

    function showPopup(slug: string, origin: string | null) {
      const el = rowEl(slug);
      if (!el || !backdrop || !popupBody || !popupTitle) return;
      popupSlug = slug;
      popupOrigin = origin;
      popupTitle.textContent = labelFor(el) || slug;
      // "Regulation 3 · Part A · II. · II.B." -- the display name, then the
      // ancestors' short labels (reader-nav.ts); never the internal id.
      if (popupEyebrowEl) popupEyebrowEl.textContent = popupEyebrow(model, slug);
      const clone = el.cloneNode(true) as HTMLElement;
      popupBody.innerHTML = "";
      popupBody.appendChild(clone);
      // The clone carries the row's "Plain-English summary" panel when it
      // has one; only then does the text above it need its own label, so a
      // reader can tell which is which (backlog #16). Text alone: no label.
      if (popupTextLabel) popupTextLabel.hidden = !clone.querySelector("details.summary-panel");
      if (popupGoto) popupGoto.setAttribute("href", "#" + slug);
      backdrop.classList.add("show");
    }
    function closePopup() {
      backdrop?.classList.remove("show");
    }

    function currentProvisionId(): string | null {
      return rowAtViewportTop(model.rows, PANE_TOP_Y)?.id ?? null;
    }

    function renderTrail() {
      if (!trailBar || !trailLabel) return;
      const top = trail.peek();
      if (!top) {
        trailBar.hidden = true;
        return;
      }
      trailLabel.textContent = labelOf(top);
      trailBar.hidden = false;
    }

    // Explicit window.scrollTo rather than scrollIntoView: the position is
    // computed from the row's own rect, honouring its scroll-margin-top (the
    // room the return bar needs), and an instant scroll is done before
    // anything else (Next's router reacting to the pushState, a layout
    // shift) can cut a smooth one short.
    function scrollRowIntoView(el: HTMLElement) {
      const margin = parseFloat(window.getComputedStyle(el).scrollMarginTop) || 0;
      const top = el.getBoundingClientRect().top + window.scrollY - margin;
      window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    }
    function flash(el: HTMLElement) {
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }

    /**
     * Moves the reader to a provision of this regulation. Closes the popup,
     * opens the target's sidebar group, scrolls the row to the top of the
     * reading pane, flashes it and gives it focus; with `push`, records the
     * origin on the return trail and pushes a history entry (see
     * GoToOptions). Returns false, doing nothing, for an unknown id.
     */
    function goToProvision(id: string, opts: GoToOptions): boolean {
      const el = rowEl(id);
      if (!el) return false;
      closePopup();
      openGroupFor(id);
      if (opts.push) {
        const from = opts.from === undefined ? currentProvisionId() : opts.from;
        if (from && from !== id && model.byId.has(from)) trail.push(from);
        // The entry being left usually has no hash (the reader scrolled
        // here), so stamp it with the provision the reader was on: Back
        // then lands there through onPopState below, whatever the browser's
        // own scroll restoration makes of a page this long. Spreading the
        // existing state keeps Next's router keys on the entry.
        if (from) {
          window.history.replaceState(
            { ...(window.history.state ?? {}), readerAnchor: from },
            "",
            window.location.href
          );
        }
        window.history.pushState({ readerAnchor: id }, "", "#" + id);
      }
      renderTrail();
      scrollRowIntoView(el);
      flash(el);
      // Focus follows the jump (the popup link that triggered it is hidden
      // now), without a second scroll.
      el.tabIndex = -1;
      el.focus({ preventScroll: true });
      return true;
    }

    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const xref = target.closest(".xref");
      if (xref) {
        e.preventDefault();
        const slug = xref.getAttribute("data-target");
        // The row the reference sits in, when it is on the page itself (a
        // reference inside the popup's clone has no #doc row).
        const originRow = xref.closest("#doc > [id]");
        if (slug) showPopup(slug, originRow?.id ?? null);
        return;
      }
      if (target.closest("#popup-goto")) {
        e.preventDefault();
        if (popupSlug) goToProvision(popupSlug, { push: true, from: popupOrigin ?? undefined });
        return;
      }
      if (target === backdrop) {
        closePopup();
        return;
      }
      if (target.closest("#popup-close")) {
        closePopup();
        return;
      }
      if (!target.closest("#jump-wrap")) {
        jumpResults?.classList.remove("show");
      }
    }
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closePopup();
        closeSidebar();
      }
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeydown);

    function onTrailBack() {
      const id = trail.pop();
      if (!id || !goToProvision(id, { push: true, from: null })) renderTrail();
    }
    function onTrailDismiss() {
      trail.clear();
      renderTrail();
    }
    trailBack?.addEventListener("click", onTrailBack);
    trailDismiss?.addEventListener("click", onTrailDismiss);

    // Back/Forward: the entry carries the provision the reader was on
    // (stamped by goToProvision), else its hash names one. Returning to the
    // trail's top is the return trip the bar offered, so it comes off.
    function onPopState(e: PopStateEvent) {
      const state = e.state as ReaderHistoryState;
      const id =
        state?.readerAnchor ?? (window.location.hash ? decodeHash(window.location.hash.slice(1)) : "");
      if (!id || !model.byId.has(id)) return;
      if (trail.peek() === id) trail.pop();
      goToProvision(id, { push: false, from: null });
    }
    window.addEventListener("popstate", onPopState);

    // A hash change the reader did not make itself (the URL edited by hand,
    // a hash link outside the sidebar): open the group at least.
    function onHashChange() {
      if (window.location.hash) openGroupFor(decodeHash(window.location.hash.slice(1)));
    }
    window.addEventListener("hashchange", onHashChange);

    function onToggleClick() {
      sidebar?.classList.toggle("open");
      sidebarScrim?.classList.toggle("show");
    }
    toggle?.addEventListener("click", onToggleClick);

    function closeSidebar() {
      sidebar?.classList.remove("open");
      sidebarScrim?.classList.remove("show");
    }
    function onSidebarClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // Every sidebar link (the part link in each group's <summary> and each
      // li's link) is an <a href="#id">; it goes through goToProvision like
      // the popup and the jump box, so it scrolls the same way, flashes,
      // records the return trail and pushes history. preventDefault() also
      // suppresses the <summary>'s default "toggle the parent <details>"
      // action for the part link (see [reg]/page.tsx: clicking "PART B" to
      // jump there used to also collapse/expand it as a side effect; the
      // group is opened by goToProvision anyway, so nothing is lost).
      // Clicking anywhere else in the summary -- the sub-label text, the
      // marker -- has no <a> under it, so it keeps toggling normally.
      const link = target.closest("a.nav-link");
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      if (!href.startsWith("#")) return;
      const id = decodeHash(href.slice(1));
      if (!model.byId.has(id)) return;
      e.preventDefault();
      goToProvision(id, { push: true });
      closeSidebar();
    }
    sidebar.addEventListener("click", onSidebarClick);
    sidebarScrim?.addEventListener("click", closeSidebar);

    function escapeHtml(s: string) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    function runSearch(qRaw: string) {
      const q = qRaw.trim().toLowerCase();
      if (!jumpResults) return;
      if (!q) {
        jumpResults.classList.remove("show");
        jumpResults.innerHTML = "";
        return;
      }
      const idMatches: SearchRow[] = [];
      const textMatches: SearchRow[] = [];
      for (const row of getSearchIndex()) {
        const idLower = row[1].toLowerCase();
        if (idLower.indexOf(q) === 0) {
          idMatches.push(row);
        } else if (row[2].toLowerCase().indexOf(q) !== -1) {
          textMatches.push(row);
        }
        if (idMatches.length >= 12) break;
      }
      const combined = idMatches.concat(textMatches).slice(0, 15);
      if (!combined.length) {
        jumpResults.innerHTML = '<div class="jr-item">No matches</div>';
        jumpResults.classList.add("show");
        return;
      }
      jumpResults.innerHTML = combined
        .map((row) => {
          // row[2] is "" for a row whose text is only its own citation
          // (snippetAfterCitation no longer falls back to the label) --
          // skip the span rather than emit an empty one.
          const snip = row[2] ? `<span class="jr-snip">${escapeHtml(row[2])}</span>` : "";
          return `<div class="jr-item" data-slug="${escapeHtml(row[0])}"><span class="jr-id">${escapeHtml(
            row[1]
          )}</span>${snip}</div>`;
        })
        .join("");
      jumpResults.classList.add("show");
    }
    function onJumpInput() {
      if (jumpbox) runSearch(jumpbox.value);
    }
    function onJumpFocus() {
      if (jumpbox?.value) runSearch(jumpbox.value);
    }
    function onJumpResultsClick(e: MouseEvent) {
      const item = (e.target as HTMLElement).closest(".jr-item") as HTMLElement | null;
      const slug = item?.dataset.slug;
      if (slug && jumpbox && jumpResults) {
        jumpResults.classList.remove("show");
        jumpbox.value = "";
        goToProvision(slug, { push: true });
      }
    }
    jumpbox.addEventListener("input", onJumpInput);
    jumpbox.addEventListener("focus", onJumpFocus);
    jumpResults.addEventListener("click", onJumpResultsClick);

    // Deep link (/regulations/3#sec-3-A-II-B-3): the browser already jumped
    // to the row before hydration; land on it again now that the contains
    // boxes have changed the layout. No history entry, no trail.
    let deepLink: ReturnType<typeof setTimeout> | null = null;
    if (window.location.hash) {
      const slug = decodeHash(window.location.hash.slice(1));
      openGroupFor(slug);
      deepLink = setTimeout(() => goToProvision(slug, { push: false, from: null }), 50);
    }

    return () => {
      if (idle !== null) window.cancelIdleCallback(idle);
      if (deepLink !== null) clearTimeout(deepLink);
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeydown);
      trailBack?.removeEventListener("click", onTrailBack);
      trailDismiss?.removeEventListener("click", onTrailDismiss);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onHashChange);
      toggle?.removeEventListener("click", onToggleClick);
      sidebar.removeEventListener("click", onSidebarClick);
      sidebarScrim?.removeEventListener("click", closeSidebar);
      jumpbox.removeEventListener("input", onJumpInput);
      jumpbox.removeEventListener("focus", onJumpFocus);
      jumpResults.removeEventListener("click", onJumpResultsClick);
    };
  }, []);

  return (
    <>
      <button id="mobile-toggle" aria-label="Toggle navigation" type="button">
        &#9776; Contents
      </button>
      <div id="sidebar-scrim" aria-hidden="true" />
      <div id="backdrop">
        <div id="popup" role="dialog" aria-modal="true">
          <div id="popup-head">
            <div id="popup-head-text">
              <div id="popup-eyebrow" />
              <p id="popup-title" />
            </div>
            <button id="popup-close" aria-label="Close" type="button">
              &times;
            </button>
          </div>
          <div id="popup-text-label" hidden>
            Official text
          </div>
          <div id="popup-body" />
          <div id="popup-footer">
            <a id="popup-goto" href="#">
              Go to full section →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
