"use client";

import { useEffect } from "react";
import type { SearchRow } from "@/lib/regulation";

/**
 * Client-side behavior for the regulation reader: mobile sidebar toggle,
 * click-a-cross-reference-to-preview-it popups, and the jump/search box.
 *
 * This mirrors the vanilla-JS reader script from the source document almost
 * line for line — deliberately. The sidebar and main document are rendered
 * server-side as plain HTML with the same ids/classes the original used, so
 * the simplest, most robust way to make them interactive is the same
 * DOM-event-delegation approach the original used, run once on mount,
 * rather than re-modeling all of this as React state.
 */
export function RegulationReader({ searchIndex }: { searchIndex: SearchRow[] }) {
  useEffect(() => {
    const backdrop = document.getElementById("backdrop");
    const popupEyebrow = document.getElementById("popup-eyebrow");
    const popupTitle = document.getElementById("popup-title");
    const popupBody = document.getElementById("popup-body");
    const popupGoto = document.getElementById("popup-goto") as HTMLAnchorElement | null;
    const sidebar = document.getElementById("sidebar");
    const toggle = document.getElementById("mobile-toggle");
    const jumpbox = document.getElementById("jumpbox") as HTMLInputElement | null;
    const jumpResults = document.getElementById("jump-results");

    if (!backdrop || !popupTitle || !popupBody || !sidebar || !jumpbox || !jumpResults) {
      return;
    }

    function labelFor(el: Element): string {
      const idSpan = el.querySelector(".item-id");
      if (idSpan?.textContent) return idSpan.textContent.trim();
      const h = el.querySelector("h1, h2");
      if (h?.textContent) return h.textContent.trim();
      return "";
    }

    function showPopup(slug: string) {
      const el = document.getElementById(slug);
      if (!el || !backdrop || !popupBody || !popupTitle) return;
      popupTitle.textContent = labelFor(el) || slug;
      if (popupEyebrow) popupEyebrow.textContent = slug;
      const clone = el.cloneNode(true) as HTMLElement;
      popupBody.innerHTML = "";
      popupBody.appendChild(clone);
      if (popupGoto) {
        popupGoto.onclick = (e) => {
          e.preventDefault();
          closePopup();
          goTo(slug);
        };
      }
      backdrop.classList.add("show");
    }
    function closePopup() {
      backdrop?.classList.remove("show");
    }
    function goTo(slug: string) {
      const el = document.getElementById(slug);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.remove("flash");
      void (el as HTMLElement).offsetWidth;
      el.classList.add("flash");
      if (window.history.pushState) window.history.pushState(null, "", "#" + slug);
    }

    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const xref = target.closest(".xref");
      if (xref) {
        e.preventDefault();
        const slug = xref.getAttribute("data-target");
        if (slug) showPopup(slug);
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
      if (e.key === "Escape") closePopup();
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeydown);

    function onToggleClick() {
      sidebar?.classList.toggle("open");
    }
    toggle?.addEventListener("click", onToggleClick);

    function onSidebarClick(e: MouseEvent) {
      if ((e.target as HTMLElement).closest("a.nav-link")) {
        sidebar?.classList.remove("open");
      }
    }
    sidebar.addEventListener("click", onSidebarClick);

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
      for (const row of searchIndex) {
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
        .map(
          (row) =>
            `<div class="jr-item" data-slug="${escapeHtml(row[0])}"><span class="jr-id">${escapeHtml(
              row[1]
            )}</span><span class="jr-snip">${escapeHtml(row[2])}</span></div>`
        )
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
        goTo(slug);
      }
    }
    jumpbox.addEventListener("input", onJumpInput);
    jumpbox.addEventListener("focus", onJumpFocus);
    jumpResults.addEventListener("click", onJumpResultsClick);

    if (window.location.hash) {
      const slug = window.location.hash.slice(1);
      setTimeout(() => goTo(slug), 50);
    }

    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeydown);
      toggle?.removeEventListener("click", onToggleClick);
      sidebar.removeEventListener("click", onSidebarClick);
      jumpbox.removeEventListener("input", onJumpInput);
      jumpbox.removeEventListener("focus", onJumpFocus);
      jumpResults.removeEventListener("click", onJumpResultsClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <button id="mobile-toggle" aria-label="Toggle navigation" type="button">
        &#9776; Contents
      </button>
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
