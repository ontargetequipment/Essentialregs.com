import type { Page } from "@playwright/test";

/**
 * The one page width (16 Oct 2026, src/lib/ui.ts pageContainerClass): the
 * header's inner wrapper and the first block of <main> are both that
 * container, so their left and right edges must coincide on every page, at
 * every viewport. Shared by the smoke spec (five representative pages) and
 * scripts/page-alignment.ts (every top-level page, both widths).
 *
 * HEADER_INNER falls back to the header's one direct <div> so the script can
 * also measure a build from before the test id existed (the "before" numbers).
 */
export const HEADER_INNER = "header [data-testid='site-header-inner'], header > div";
export const MAIN_BLOCK = "main > :first-child";

/** The two viewports the check runs at: a desktop and a phone. */
export const WIDTHS = [1360, 390] as const;

/** How far apart (px) the two edges may be and still count as aligned. */
export const TOLERANCE = 1;

export type Edges = { left: number; right: number };

export type PageWidthMeasure = {
  header: Edges;
  main: Edges;
  /** document.documentElement.scrollWidth - clientWidth; > 0 means a sideways scroll. */
  overflow: number;
};

/** Reads both wrappers' bounding rects and the page's sideways overflow, at the current viewport. */
export async function measurePageWidth(page: Page): Promise<PageWidthMeasure> {
  // No inner function inside the callback: tsx (scripts/page-alignment.ts)
  // would wrap one in an esbuild `__name` helper that does not exist in the page.
  return page.evaluate(
    ({ headerSel, mainSel }) => {
      const header = document.querySelector(headerSel);
      const main = document.querySelector(mainSel);
      if (!header) throw new Error(`page-width: no element matches ${headerSel}`);
      if (!main) throw new Error(`page-width: no element matches ${mainSel}`);
      const h = header.getBoundingClientRect();
      const m = main.getBoundingClientRect();
      const root = document.documentElement;
      return {
        header: { left: h.left, right: h.right },
        main: { left: m.left, right: m.right },
        overflow: root.scrollWidth - root.clientWidth,
      };
    },
    { headerSel: HEADER_INNER, mainSel: MAIN_BLOCK },
  );
}

/** The ways a measurement can fail, as one short line each; empty means aligned. */
export function pageWidthProblems(m: PageWidthMeasure): string[] {
  const problems: string[] = [];
  const dl = Math.abs(m.main.left - m.header.left);
  const dr = Math.abs(m.main.right - m.header.right);
  if (dl > TOLERANCE) problems.push(`left edge off by ${dl.toFixed(1)}px (header ${m.header.left.toFixed(1)}, main ${m.main.left.toFixed(1)})`);
  if (dr > TOLERANCE) problems.push(`right edge off by ${dr.toFixed(1)}px (header ${m.header.right.toFixed(1)}, main ${m.main.right.toFixed(1)})`);
  if (m.overflow > 0) problems.push(`${m.overflow}px of sideways scroll`);
  return problems;
}
