"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { SEARCH_BOX_ID, tabHref } from "@/lib/search-hrefs";

/**
 * The Keyword / Ask tablist on /search. Each tab is a real link (so it works
 * without JavaScript and in a new tab) whose href carries the query from the
 * URL. On a plain click the tab switches right away with whatever is in the
 * search box at that moment -- a visitor who types a question and then
 * clicks "Ask" keeps the question (the href alone would carry only the
 * previous URL's `q`, and Enter in the box submits the current tab's form
 * instead of switching). The box is found by SEARCH_BOX_ID: the site header
 * has a search form of its own earlier in the DOM. Modified clicks (new tab, middle button) and a
 * click on the active tab are left to the browser.
 */
export function SearchTabs({
  mode,
  q,
  includeBasis,
}: {
  mode: "keyword" | "ask";
  q: string;
  includeBasis: boolean;
}) {
  const router = useRouter();
  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      active ? "bg-accent text-white" : "text-ink-soft hover:bg-accent-soft hover:text-ink"
    }`;
  const onClick = (target: "keyword" | "ask") => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const box = document.getElementById(SEARCH_BOX_ID) as HTMLInputElement | null;
    const typed = (box?.value ?? q).trim();
    if (target === mode && typed === q) return;
    e.preventDefault();
    router.push(tabHref(target, typed, includeBasis));
  };
  return (
    <div className="mt-4 inline-flex gap-1 rounded-lg border border-line bg-panel p-1" role="tablist">
      <Link
        href={tabHref("keyword", q, includeBasis)}
        className={tabClass(mode === "keyword")}
        role="tab"
        aria-selected={mode === "keyword"}
        onClick={onClick("keyword")}
      >
        Keyword
      </Link>
      <Link
        href={tabHref("ask", q, includeBasis)}
        className={tabClass(mode === "ask")}
        role="tab"
        aria-selected={mode === "ask"}
        onClick={onClick("ask")}
      >
        Ask
      </Link>
    </div>
  );
}
