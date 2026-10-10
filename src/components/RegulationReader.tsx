"use client";

import { useEffect } from "react";
import {
  buildSearchIndexFromDom,
  fillContainsBoxes,
  fillApplicabilityContexts,
  fillSummaryBadges,
  fillSummaryLinks,
  readReaderModel,
} from "@/lib/reader-client";
import {
  citedParamOf,
  documentDateLine,
  documentRootOf,
  documentShortName,
  foreignOriginOf,
  hashTargetOf,
  isLockedPreview,
  isUsablePreview,
  lockedPopup,
  originTrailLabel,
  popupEyebrow,
  printedEffectiveDate,
  type ProvisionPreviewPayload,
  regulationHref,
  renumberedNote,
  ReturnTrail,
  rowAtViewportTop,
  rowLabel,
  stripReaderParams,
  validProvisionId,
  versionNote,
} from "@/lib/reader-nav";
import { regKeyOf, regulationDisplayName, textLabelFor } from "@/lib/regulation-names";
import { normalizeJumpKey, summaryBadgeClass } from "@/lib/snippet";
import { isPublicReaderReg, provisionDestination } from "@/lib/destination";
import { readRecentVisits, recentListHtml, recordRecentVisit } from "@/lib/reader-client";
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

/**
 * What the reader writes into history.state; Next keeps its own keys beside
 * it. `readerReturnFrom` is the provision of ANOTHER regulation this page was
 * opened from (the `?from=` the URL carried, which is stripped on load): kept
 * in the entry so a reload, or React re-running the effect, still shows the
 * "Back to <other regulation>" bar.
 */
type ReaderHistoryState = { readerAnchor?: string; readerReturnFrom?: string } | null;

/** The popup footer link's default text; a cross-regulation preview swaps it for "Open in <name> →". */
const GOTO_LABEL = "Go to full section →";


/**
 * Viewport y of "the top of the reading pane": just under the sticky site
 * header (66px, layout.tsx) and the return bar, where goToProvision lands a
 * target (scroll-margin-top: 130px on #doc's rows in reader.css, plus 8px of
 * air). Used to tell which provision the reader is on.
 */
const PANE_TOP_Y = 138;

function decodeHash(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Client-side behavior for the regulation reader: mobile sidebar toggle,
 * click-a-cross-reference-to-preview-it popups (a provision of this
 * regulation, a provision of another regulation through /api/provision,
 * or a whole other document through its root row), the jump/search box,
 * and every "go to a provision" path (goToProvision below), with the
 * return trail those leave behind.
 *
 * This mirrors the vanilla-JS reader script from the source document almost
 * line for line — deliberately. The sidebar and main document are rendered
 * server-side as plain HTML with the same ids/classes the original used, so
 * the simplest, most robust way to make them interactive is the same
 * DOM-event-delegation approach the original used, run once on mount,
 * rather than re-modeling all of this as React state.
 *
 * `publicMode` (Sprint 4, 10 Oct 2026) is true when the page was rendered for
 * a visitor with no access (GP05, the free sample). Nothing in the document
 * depends on it -- the sidebar, jump box, summaries, same-document previews
 * and return trail run on the DOM the page shipped -- except what would
 * otherwise lead a visitor into a 404: the Recent list (it keeps the entries
 * of regulations a visitor can open; sessionStorage may still hold a
 * subscriber's from before they logged out) and the "back to" link of a
 * `?from=` arrival. The cross-regulation popup needs no flag: /api/provision
 * answers a visitor with a locked label (provision-preview.ts) and the popup
 * says so.
 */
export function RegulationReader({ publicMode = false }: { publicMode?: boolean } = {}) {
  useEffect(() => {
    const doc = document.getElementById("doc");
    const backdrop = document.getElementById("backdrop");
    const popupEyebrowEl = document.getElementById("popup-eyebrow");
    const popupTitle = document.getElementById("popup-title");
    const popupNote = document.getElementById("popup-note");
    const popupVersionNote = document.getElementById("popup-version-note");
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
    // panel's badge tooltip and source link, right now, so a hash jump below lands on a
    // finished page and a popup's clone of an item is complete. The search
    // index is the same rows again, built on first use or when idle.
    const model = readReaderModel(doc);
    fillSummaryBadges(model);
    fillSummaryLinks(model);
    fillApplicabilityContexts(model);
    fillContainsBoxes(model);
    let searchIndex: SearchRow[] | null = null;
    const getSearchIndex = () => (searchIndex ??= buildSearchIndexFromDom(model));
    const idle =
      "requestIdleCallback" in window ? window.requestIdleCallback(() => getSearchIndex()) : null;

    const trail = new ReturnTrail();

    // This page's regulation key: the root row's, else the URL's
    // (/regulations/<reg>).
    const rootRow = model.rows.find((r) => r.kind === "reg");
    const pageKey =
      (rootRow ? regKeyOf(rootRow.id) : null) ?? window.location.pathname.split("/")[2] ?? null;

    // The sidebar's "Recent" list (Sprint 3): the last ten provisions this
    // browser landed on in any reader, from sessionStorage. Hidden while
    // empty; filled now and after every landing below.
    const recentWrap = document.getElementById("recent-wrap") as HTMLDetailsElement | null;
    const recentList = document.getElementById("recent-list");
    const pageName = pageKey ? regulationDisplayName(pageKey) : "";
    function renderRecent(visits = readRecentVisits()) {
      if (!recentWrap || !recentList) return;
      if (publicMode) visits = visits.filter((v) => isPublicReaderReg(v.reg));
      recentList.innerHTML = recentListHtml(visits);
      recentWrap.hidden = visits.length === 0;
    }
    renderRecent();

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
    // True while the popup previews a provision of ANOTHER regulation: its
    // footer link is then a real link to that reader, left to navigate.
    let popupRemote = false;
    // The newest cross-regulation preview request; a stale answer (or one
    // that lands after the popup was closed or the page left) is dropped.
    let previewSeq = 0;
    let previewAbort: AbortController | null = null;
    // The link whose click is being replayed as plain navigation (see
    // fallBackToNavigation); onDocClick lets exactly that click through.
    let replayed: Element | null = null;

    // The two optional lines under a cross-regulation preview's title: the
    // renumbered-definition line and the version line (reader-nav.ts:
    // renumberedNote, versionNote). Each hidden when empty.
    function setPopupNote(text: string | null, version: string | null = null) {
      if (popupNote) {
        popupNote.textContent = text ?? "";
        popupNote.hidden = !text;
      }
      if (popupVersionNote) {
        popupVersionNote.textContent = version ?? "";
        popupVersionNote.hidden = !version;
      }
    }
    // The text that follows a link inside its row (or the popup body, for a
    // link inside a preview): where a citing provision prints the effective
    // date of the regulation it cites ("... Section II.A.46 (Adopted:
    // 04/18/2025, Effective: 06/14/2025)"). Read only; printedEffectiveDate
    // decides whether it holds one.
    function textAfterLink(link: Element): string {
      const scope = link.closest("#doc > [id], #popup-body") ?? link.parentElement;
      if (!scope) return "";
      const range = document.createRange();
      range.selectNodeContents(scope);
      range.setStartAfter(link);
      return range.toString();
    }
    function showPopup(slug: string, origin: string | null) {
      setPopupNote(null);
      const el = rowEl(slug);
      if (!el || !backdrop || !popupBody || !popupTitle) return;
      previewSeq++;
      previewAbort?.abort();
      popupSlug = slug;
      popupOrigin = origin;
      popupRemote = false;
      if (popupGoto) {
        popupGoto.textContent = GOTO_LABEL;
        popupGoto.style.display = "";
      }
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
      if (popupTextLabel) {
        // "Regulatory text" on a federal document, "Official text" on a Colorado one.
        popupTextLabel.textContent = textLabelFor(pageKey);
        popupTextLabel.hidden = !clone.querySelector("details.summary-panel");
      }
      if (popupGoto) popupGoto.setAttribute("href", "#" + slug);
      backdrop.classList.add("show");
    }
    function closePopup() {
      previewSeq++; // a preview still in flight must not open a popup nobody asked for now
      previewAbort?.abort();
      backdrop?.classList.remove("show");
      setPopupNote(null);
    }

    // A reference into another regulation. The link is an ordinary <a href=
    // "/regulations/<key>#<id>"> that works with no script; a plain left
    // click fetches the target through the gated /api/provision route and
    // previews it here. A viewer without access gets a locked label from that
    // route (Sprint 4, 10 Oct 2026) and the popup says the provision is in
    // the full corpus, with the trial and the focused preview: never a
    // silent redirect into the reader's 404. Anything else that does not
    // come back as a clean preview (404, network, junk) replays the click as
    // plain navigation -- the click is never swallowed.
    function fallBackToNavigation(link: HTMLAnchorElement) {
      if (link.isConnected) {
        replayed = link;
        link.click();
        replayed = null;
      } else {
        window.location.assign(link.href);
      }
    }
    async function previewOtherRegulation(
      fallBack: () => void,
      targetId: string,
      origin: string | null,
      cited: string | null = null,
      printedEffective: string | null = null,
      asDocument = false
    ) {
      const seq = ++previewSeq;
      previewAbort?.abort();
      const abort = (previewAbort = new AbortController());
      let data: ProvisionPreviewPayload;
      try {
        const res = await fetch(`/api/provision/${encodeURIComponent(targetId)}`, {
          credentials: "same-origin",
          signal: abort.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: unknown = await res.json();
        if (isLockedPreview(json, targetId)) {
          showLockedPreview(json, seq, asDocument);
          return;
        }
        data = json as ProvisionPreviewPayload;
        if (!isUsablePreview(data, targetId)) throw new Error("bad payload");
      } catch {
        // An unknown target (404), a refusal or an empty payload never
        // opens an empty preview (the fifth review's PHMSA links): close
        // whatever popup is showing and follow the link instead.
        if (seq === previewSeq) {
          closePopup();
          fallBack();
        }
        return;
      }
      if (seq !== previewSeq || !backdrop || !popupBody || !popupTitle) return;
      const key = regKeyOf(targetId);
      const name = key ? regulationDisplayName(key) : targetId;
      popupSlug = null;
      popupOrigin = null;
      popupRemote = true;
      if (popupGoto) popupGoto.style.display = "";
      if (popupEyebrowEl) popupEyebrowEl.textContent = name;
      const wrap = document.createElement("div");
      wrap.className = "item";
      if (asDocument) {
        // A whole document (its root row): the document's title, its
        // citation and the date we hold it as of (the manifest, through
        // source-dates.generated.ts), then the two-sentence overview of its
        // top-level summary with the review badge, exactly as the reader's
        // own panel would cut it (provision-preview.ts). The root's text is
        // its title again, so it is not repeated.
        popupTitle.textContent = data.title || data.citation || name;
        const citation = data.citation && data.citation !== name && data.citation !== data.title ? data.citation : null;
        setPopupNote(citation, documentDateLine(key));
        wrap.innerHTML = documentPreviewHtml(data);
      } else {
        popupTitle.textContent = data.citation || targetId;
        // Under the title: a renumbered definition citation (the importer put
        // the printed section in the href's ?cited=) gets one line saying so;
        // a citing document older than the cited regulation's current text
        // gets the version line (the dates come from the manifest through
        // source-dates.generated.ts, never from this file).
        const renumbered = cited ? renumberedNote(documentShortName(pageKey), cited, data.citation, name) : null;
        setPopupNote(renumbered, versionNote(pageKey, key, printedEffective, renumbered !== null));
        wrap.innerHTML = data.html; // sanitised server-side (provision-preview.ts)
      }
      popupBody.innerHTML = "";
      popupBody.appendChild(wrap);
      if (popupTextLabel) popupTextLabel.hidden = true;
      if (popupGoto) {
        popupGoto.setAttribute("href", regulationHref(targetId, origin, cited));
        popupGoto.textContent = asDocument ? `Open ${documentShortName(key)} →` : `Open in ${name} →`;
      }
      backdrop.classList.add("show");
    }

    /**
     * The popup for a target the viewer cannot open (a locked label from
     * /api/provision): the regulation's name, the citation, the provision's
     * title and the "in the full corpus" panel (lockedPopup, reader-nav.ts,
     * which escapes everything). The footer link is hidden: it would lead
     * into the 404 the reader gives a visitor for that regulation.
     */
    function showLockedPreview(data: Parameters<typeof lockedPopup>[0], seq: number, asDocument: boolean) {
      if (seq !== previewSeq || !backdrop || !popupBody || !popupTitle) return;
      const view = lockedPopup(data, asDocument);
      popupSlug = null;
      popupOrigin = null;
      popupRemote = true;
      if (popupEyebrowEl) popupEyebrowEl.textContent = view.eyebrow;
      popupTitle.textContent = view.title;
      setPopupNote(view.note);
      const wrap = document.createElement("div");
      wrap.className = "item";
      wrap.innerHTML = view.panelHtml;
      popupBody.innerHTML = "";
      popupBody.appendChild(wrap);
      if (popupTextLabel) popupTextLabel.hidden = true;
      if (popupGoto) popupGoto.style.display = "none";
      backdrop.classList.add("show");
    }

    /**
     * The body of a whole-document preview: the summary overview under the
     * reader's own panel markup (open, so it reads at once) with the
     * review-status badge, or one line saying the document has no summary
     * yet. Every string is escaped here; nothing from the payload is
     * inserted as markup.
     */
    function documentPreviewHtml(data: ProvisionPreviewPayload): string {
      const summary = data.summary;
      if (!summary || !summary.overview) {
        return `<p class="doc-preview-empty">This document has no plain-English summary yet. Open it to read its provisions.</p>`;
      }
      const badge = summary.badge
        ? `<p class="summary-badge ${summaryBadgeClass(summary.badge.kind)}">${escapeHtml(summary.badge.label)}</p>`
        : "";
      return (
        `<details class="summary-panel" open><summary>Plain-English summary</summary>` +
        `<div class="summary-body">${badge}<p class="summary-overview">${escapeHtml(summary.overview)}</p></div></details>`
      );
    }

    function currentProvisionId(): string | null {
      return rowAtViewportTop(model.rows, PANE_TOP_Y)?.id ?? null;
    }

    // The provision of another regulation this page was opened from
    // (?from=, see the load block below): a real link back to it, shown when
    // the in-document trail has nothing on it.
    let otherOrigin: { href: string; label: string } | null = null;
    let otherLink: HTMLAnchorElement | null = null;

    function renderTrail() {
      if (!trailBar || !trailLabel) return;
      const top = trail.peek();
      if (otherLink) otherLink.hidden = true;
      if (trailBack) trailBack.hidden = false;
      if (!top) {
        if (!otherOrigin || !trailBack) {
          trailBar.hidden = true;
          return;
        }
        if (!otherLink) {
          otherLink = document.createElement("a");
          otherLink.id = "return-trail-ext";
          trailBack.insertAdjacentElement("beforebegin", otherLink);
        }
        otherLink.href = otherOrigin.href;
        otherLink.textContent = `← Back to ${otherOrigin.label}`;
        otherLink.hidden = false;
        trailBack.hidden = true;
        trailBar.hidden = false;
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
      if (pageKey && id !== rootRow?.id) {
        renderRecent(recordRecentVisit({ id, reg: pageKey, citation: labelOf(id), name: pageName }));
      }
      return true;
    }

    // The provision of THIS regulation a link sits in: its #doc row, or, for
    // a link inside the popup's clone of a row, that row (the clone keeps the
    // row's id). null inside a preview of another regulation's provision.
    function originOf(el: Element): string | null {
      const row = el.closest("#doc > [id]");
      if (row) return row.id;
      const clone = el.closest("#popup-body > [id]");
      return clone && !popupRemote && model.byId.has(clone.id) ? clone.id : null;
    }

    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const external = target.closest("a.xref-external-reg") as HTMLAnchorElement | null;
      if (external) {
        // Plain navigation, untouched: the replay of a failed preview, a
        // modified or non-primary click (new tab / window / download), a
        // link that opens elsewhere, a link that is neither a provision nor
        // a whole document of the corpus, a target that is on this very
        // page (this regulation's own root included), or a click something
        // else already handled.
        if (replayed === external) return;
        const href = external.getAttribute("href");
        const sectionId = hashTargetOf(href);
        // "/regulations/8" with no provision in its hash: the whole document,
        // previewed through its root row (documentRootOf).
        const documentId = sectionId ? null : documentRootOf(href);
        const targetId = sectionId ?? documentId;
        if (
          !targetId ||
          model.byId.has(targetId) ||
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          (external.target && external.target !== "_self") ||
          external.hasAttribute("download")
        ) {
          return;
        }
        e.preventDefault();
        void previewOtherRegulation(
          () => fallBackToNavigation(external),
          targetId,
          originOf(external),
          sectionId ? citedParamOf(href) : null,
          sectionId ? printedEffectiveDate(textAfterLink(external)) : null,
          !sectionId
        );
        return;
      }
      const xref = target.closest(".xref");
      if (xref) {
        e.preventDefault();
        const slug = xref.getAttribute("data-target");
        // A reference inside a preview of another regulation's provision
        // points at that regulation's own provisions, none of which are on
        // this page: preview it the same way, or go there.
        const remote = slug && !model.byId.has(slug) ? validProvisionId(slug) : null;
        if (remote && regKeyOf(remote)?.toLowerCase() !== pageKey?.toLowerCase()) {
          void previewOtherRegulation(() => window.location.assign(regulationHref(remote)), remote, originOf(xref));
          return;
        }
        // The row the reference sits in, when it is on the page itself (a
        // reference inside the popup's clone has no #doc row).
        const originRow = xref.closest("#doc > [id]");
        if (slug) showPopup(slug, originRow?.id ?? null);
        return;
      }
      if (target.closest("#popup-goto")) {
        // A preview of another regulation: the footer is a real link to it.
        if (popupRemote) return;
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
      if (!target.closest("#jump-wrap")) hideResults();
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
      otherOrigin = null;
      // Forget it in the history entry too, so a reload does not bring it back.
      const state = window.history.state as ReaderHistoryState;
      if (state?.readerReturnFrom) {
        window.history.replaceState({ ...state, readerReturnFrom: undefined }, "", window.location.href);
      }
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
      // A Recent entry of this regulation jumps the same way; one of another
      // regulation is a plain link to that reader (the hash lands it there).
      const recent = target.closest("a.recent-link");
      if (recent) {
        const rid = recent.getAttribute("data-id") ?? "";
        if (!model.byId.has(rid)) return;
        e.preventDefault();
        goToProvision(rid, { push: true });
        closeSidebar();
        return;
      }
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
    function escapeAttr(s: string) {
      return escapeHtml(s).replace(/"/g, "&quot;");
    }

    // The jump box is an ARIA combobox over a listbox: the input keeps focus
    // while ArrowUp/ArrowDown move an "active" option (aria-activedescendant),
    // Enter opens it, Escape closes the list. Options carry stable ids
    // ("jump-opt-<provision id>") and aria-selected.
    jumpbox.setAttribute("role", "combobox");
    jumpbox.setAttribute("aria-autocomplete", "list");
    jumpbox.setAttribute("aria-haspopup", "listbox");
    jumpbox.setAttribute("aria-controls", jumpResults.id);
    jumpbox.setAttribute("aria-expanded", "false");
    jumpResults.setAttribute("role", "listbox");
    jumpResults.setAttribute("aria-label", "Matching provisions");

    let activeIdx = -1;
    function optionEls(): HTMLElement[] {
      return jumpResults
        ? Array.from(jumpResults.querySelectorAll<HTMLElement>('.jr-item[role="option"][data-slug]'))
        : [];
    }
    function setActive(idx: number) {
      const opts = optionEls();
      activeIdx = opts.length ? idx : -1;
      opts.forEach((el, i) => {
        const on = i === activeIdx;
        el.classList.toggle("active", on);
        el.setAttribute("aria-selected", on ? "true" : "false");
      });
      if (activeIdx >= 0) {
        jumpbox?.setAttribute("aria-activedescendant", opts[activeIdx].id);
        opts[activeIdx].scrollIntoView?.({ block: "nearest" });
      } else {
        jumpbox?.removeAttribute("aria-activedescendant");
      }
    }
    function resultsShown(): boolean {
      return !!jumpResults?.classList.contains("show");
    }
    function showResults() {
      jumpResults?.classList.add("show");
      jumpbox?.setAttribute("aria-expanded", "true");
    }
    function hideResults() {
      jumpResults?.classList.remove("show");
      jumpbox?.setAttribute("aria-expanded", "false");
      setActive(-1);
    }

    function runSearch(qRaw: string) {
      const q = qRaw.trim().toLowerCase();
      if (!jumpResults) return;
      setActive(-1);
      if (!q) {
        jumpResults.innerHTML = "";
        hideResults();
        return;
      }
      // Citations match on the normalized key (no §, no spaces), the text on
      // the query as typed: "60.5416 (b)(1)" finds "§ 60.5416(b)(1)".
      const qKey = normalizeJumpKey(qRaw);
      const idMatches: SearchRow[] = [];
      const textMatches: SearchRow[] = [];
      for (const row of getSearchIndex()) {
        if (qKey && normalizeJumpKey(row[1]).indexOf(qKey) === 0) {
          idMatches.push(row);
        } else if (row[2].toLowerCase().indexOf(q) !== -1) {
          textMatches.push(row);
        }
        if (idMatches.length >= 12) break;
      }
      const combined = idMatches.concat(textMatches).slice(0, 15);
      if (!combined.length) {
        jumpResults.innerHTML = '<div class="jr-item jr-empty">No matches</div>';
        showResults();
        return;
      }
      jumpResults.innerHTML = combined
        .map((row) => {
          // row[2] is "" for a row whose text is only its own citation
          // (snippetAfterCitation no longer falls back to the label) --
          // skip the span rather than emit an empty one.
          const snip = row[2] ? `<span class="jr-snip">${escapeHtml(row[2])}</span>` : "";
          return `<div class="jr-item" role="option" id="jump-opt-${escapeAttr(
            row[0]
          )}" aria-selected="false" data-slug="${escapeAttr(row[0])}"><span class="jr-id">${escapeHtml(
            row[1]
          )}</span>${snip}</div>`;
        })
        .join("");
      showResults();
    }
    function onJumpInput() {
      if (jumpbox) runSearch(jumpbox.value);
    }
    function onJumpFocus() {
      if (jumpbox?.value) runSearch(jumpbox.value);
    }
    function openResult(slug: string) {
      if (!jumpbox) return;
      hideResults();
      jumpbox.value = "";
      goToProvision(slug, { push: true });
    }
    function onJumpResultsClick(e: MouseEvent) {
      const item = (e.target as HTMLElement).closest(".jr-item") as HTMLElement | null;
      const slug = item?.dataset.slug;
      if (slug) openResult(slug);
    }

    // What an exact entry names -- a provision id as typed, or a citation
    // ("II.B.4" == "II.B.4.") -- for Enter when no result is on screen.
    const normCitation = (s: string) => normalizeJumpKey(s).replace(/\.+$/, "");
    function exactMatch(value: string): string | null {
      const v = value.trim();
      if (!v) return null;
      if (model.byId.has(v)) return v;
      const c = normCitation(v);
      return model.rows.find((r) => r.citation && normCitation(r.citation) === c)?.id ?? null;
    }

    function onJumpKeydown(e: KeyboardEvent) {
      if (e.isComposing || !jumpbox) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!resultsShown()) {
          if (!jumpbox.value.trim()) return;
          runSearch(jumpbox.value);
        }
        const n = optionEls().length;
        if (!n) return;
        e.preventDefault();
        const down = e.key === "ArrowDown";
        setActive(activeIdx < 0 ? (down ? 0 : n - 1) : (activeIdx + (down ? 1 : n - 1)) % n);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (!resultsShown() && jumpbox.value.trim()) runSearch(jumpbox.value);
        const opts = optionEls();
        const slug = (opts[activeIdx] ?? opts[0])?.dataset.slug ?? exactMatch(jumpbox.value);
        if (slug) openResult(slug);
        return;
      }
      if (e.key === "Escape" && (resultsShown() || activeIdx >= 0)) hideResults();
    }
    jumpbox.addEventListener("input", onJumpInput);
    jumpbox.addEventListener("focus", onJumpFocus);
    jumpbox.addEventListener("keydown", onJumpKeydown);
    jumpResults.addEventListener("click", onJumpResultsClick);

    // Deep link (/regulations/3#sec-3-A-II-B-3): the browser already jumped
    // to the row before hydration; land on it again now that the contains
    // boxes have changed the layout. No history entry, no trail.
    //
    // Opened from another regulation (/regulations/7?from=sec-gp12-I-A#sec-7-B-I-B-33,
    // the "Open in Regulation 7" link of a cross-regulation preview, or any
    // such reference followed as a plain link): `from` names the provision
    // the reader came from. Only a valid provision id of a DIFFERENT
    // regulation counts; it becomes the return bar's link back, is stripped
    // from the URL (hash and the other params stay) and is kept in the
    // history entry's state so a reload still shows the bar. `cited` (the
    // printed section of a renumbered definition citation, see
    // citedParamOf) rides along on such a link and is stripped the same
    // way; the note it feeds is the preview popup's, not this page's.
    const fromUrl = foreignOriginOf(window.location.search, pageKey);
    const fromState = (window.history.state as ReaderHistoryState)?.readerReturnFrom;
    const fromOther = fromUrl ?? foreignOriginOf(`?from=${encodeURIComponent(fromState ?? "")}`, pageKey);
    const hasCited = new URLSearchParams(window.location.search).has("cited");
    if (fromUrl || hasCited) {
      const strip = [...(fromUrl ? ["from"] : []), ...(hasCited ? ["cited"] : [])];
      const prev = (window.history.state ?? {}) as Record<string, unknown>;
      window.history.replaceState(
        fromUrl ? { ...prev, readerReturnFrom: fromUrl } : prev,
        "",
        `${window.location.pathname}${stripReaderParams(window.location.search, strip)}${window.location.hash}`
      );
    }
    if (fromOther) {
      const key = regKeyOf(fromOther);
      otherOrigin = {
        // A visitor's way back must not be a 404 either: provisionDestination
        // sends a regulation they cannot read to its focused preview.
        href: publicMode
          ? provisionDestination({ id: fromOther, reg_key: key }, { hasAccess: false })
          : `/regulations/${key}#${fromOther}`,
        label: originTrailLabel(fromOther),
      };
      renderTrail();
    }

    let deepLink: ReturnType<typeof setTimeout> | null = null;
    if (window.location.hash) {
      const slug = decodeHash(window.location.hash.slice(1));
      openGroupFor(slug);
      deepLink = setTimeout(() => goToProvision(slug, { push: false, from: null }), 50);
    }

    return () => {
      previewSeq++;
      previewAbort?.abort();
      otherLink?.remove();
      if (trailBack) trailBack.hidden = false;
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
      jumpbox.removeEventListener("keydown", onJumpKeydown);
      jumpResults.removeEventListener("click", onJumpResultsClick);
    };
  }, [publicMode]);

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
              <p id="popup-note" hidden />
              <p id="popup-version-note" hidden />
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
