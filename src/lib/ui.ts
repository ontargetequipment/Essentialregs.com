// The one button style for every call to action on the site (Oct 2026):
// white on accent (7.49:1), semibold, rounded. Used as a className on a
// <Link>, an <a> or a form's <button>, so it is a class string rather than a
// component. Every size is at least 44px tall at every width (tap targets).
//
// Not for the header's nav, close/dismiss controls, disclosure toggles, the
// reader's own controls or the admin pages, which keep their own styles.

/** md: the everyday button. lg: the homepage's "See how it works!". */
export type ButtonSize = "md" | "lg";

/**
 * auto:   its own width, inline.
 * full:   a full row at every width (the narrow plan boxes, auth forms).
 * mobile: a full row below `sm`, its own width from `sm` up.
 */
export type ButtonWidth = "auto" | "full" | "mobile";

const BASE =
  "items-center justify-center gap-2 rounded-md bg-accent text-center font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60";

const SIZE: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 py-3 text-sm",
  lg: "min-h-14 px-8 py-3 text-base",
};

const WIDTH: Record<ButtonWidth, string> = {
  auto: "inline-flex",
  full: "flex w-full",
  mobile: "flex w-full sm:inline-flex sm:w-auto",
};

export function buttonClass({
  size = "md",
  width = "auto",
  className = "",
}: { size?: ButtonSize; width?: ButtonWidth; className?: string } = {}): string {
  return [WIDTH[width], BASE, SIZE[size], className].filter(Boolean).join(" ");
}

/**
 * The "FREE" pill inside a green button (the homepage's Test Methods):
 * paper on accent (about 6.8:1), so it reads as free at a glance.
 */
export const FREE_PILL =
  "rounded-full bg-paper px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-accent";

/**
 * The eyebrow style for text that IS a citation (Sprint 8, 11 Oct 2026):
 * the mono face, size, tracking and brass colour of an eyebrow, with no
 * upper-casing. Citations are case-sensitive. A federal subpart's suffix
 * is lower case (60.5365b(e), OOOOb) and so are the lettered levels of a
 * Colorado one (I.D.3.a.(i)); the eyebrow's `uppercase` printed them as
 * "§ 60.5365B(E)" and "I.D.3.A.(I)" (outside review, 10-11 Oct 2026). Use
 * this wherever a stored citation or a document's citation line prints;
 * keep the plain eyebrow (`uppercase`) for labels that are words.
 */
export const CITATION_EYEBROW_CLASS = "font-mono text-eyebrow normal-case text-tag";

/**
 * The one page width (16 Oct 2026): the header's and the footer's inner
 * wrapper and the first block of every top-level page are this container, so
 * the content's left edge lines up with the ER emblem and its right edge with
 * the header's on every page.
 *
 *   max-width  960px   (--container-shell, globals.css; 1120px until the
 *                      owner asked for a page that sits mid-screen, 16 Oct 2026)
 *   padding    24px    each side at every width (px-6): the one phone gutter
 *   centred    mx-auto
 *
 * These are the header's own values, which the homepage and the index pages
 * already shared; /sample, /pricing, /search, the card pages, the auth pages
 * and the admin pages had each picked a narrower centred column. The
 * regulation reader (src/app/regulations, reader.css) is the one route with
 * no outer frame -- a 320px sidebar against the viewport's edge and a
 * reading column centred in what is left -- so it and its /preview keep
 * their own layout.
 *
 * Inside the container, content left-aligns to its edge; nothing is centred
 * as a narrower island. Headlines, card grids and tables span it. A block of
 * paragraphs, a column of cards, a form or a list is capped at
 * `max-w-reading` (720px, --container-reading). Checked by e2e/page-width.ts
 * (the smoke spec's pages; scripts/page-alignment.ts for every page).
 *
 * `className` carries the page's own vertical padding ("py-12") or, for the
 * header, its row layout.
 */
export function pageContainerClass(className = ""): string {
  return ["mx-auto max-w-shell px-6", className].filter(Boolean).join(" ");
}
