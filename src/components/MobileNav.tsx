"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Small magnifying-glass glyph for the header search button/link. */
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M16.5 16.5l-4.2-4.2" />
    </svg>
  );
}

/**
 * Site-wide header nav. Below `sm` this collapses behind a hamburger button
 * instead of the plain horizontal row that used to overflow on phone-width
 * screens (logo running into "Regulations", "Log in"/"Sign up" wrapping
 * mid-word). `authSlot` is passed in from the root layout (a Server
 * Component tree, including a Suspense boundary around the async
 * AuthStatus) since this component itself has to be a Client Component to
 * hold the open/closed state.
 */
export function MobileNav({ authSlot }: { authSlot: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the menu on navigation. The root layout doesn't remount between
  // routes, so without this the dropdown would still be showing "open"
  // after tapping a link to a new page. Adjusted during render (React's
  // recommended pattern for "reset state when a prop changes") rather than
  // in an effect, which would cause an extra render pass.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="-mr-2 flex h-10 w-10 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 sm:hidden"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          {open ? (
            <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" />
          ) : (
            <path d="M2.5 5h15M2.5 10h15M2.5 15h15" />
          )}
        </svg>
      </button>

      <nav
        className={[
          open ? "flex" : "hidden",
          "absolute left-0 right-0 top-full flex-col gap-4 border-t border-zinc-200 bg-white px-6 py-4 text-sm font-medium text-zinc-600 shadow-sm",
          // On desktop the nav takes the rest of the header row (min-w-0 so
          // it can shrink) and right-aligns; that's what lets the search
          // box below grow to ~180px when there's room and give way to the
          // links when there isn't, instead of overflowing the row.
          "sm:static sm:ml-6 sm:flex sm:min-w-0 sm:flex-1 sm:flex-row sm:items-center sm:justify-end sm:gap-6 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none",
        ].join(" ")}
      >
        {/* Plain GET form to /search — works before hydration and needs no
            state. First item in the mobile dropdown; a compact box in the
            desktop row from `md` up. Between `sm` and `md` the row is too
            tight for an input next to the links, so a bare icon link to
            /search stands in for it there. h-8 keeps the input shorter than
            the 40px logo/hamburger line so the header height doesn't change. */}
        <form
          action="/search"
          method="get"
          role="search"
          className="flex items-center gap-1.5 sm:hidden md:flex md:min-w-0 md:max-w-[216px] md:flex-1"
        >
          <input
            type="search"
            name="q"
            placeholder="Search regulations"
            aria-label="Search regulations"
            autoComplete="off"
            className="h-8 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2.5 text-sm font-normal text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
          <button
            type="submit"
            aria-label="Search"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <SearchIcon />
          </button>
        </form>
        <Link
          href="/search"
          aria-label="Search"
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 sm:flex md:hidden"
        >
          <SearchIcon />
        </Link>
        <Link href="/regulations" className="hover:text-zinc-950">
          Regulations
        </Link>
        <Link href="/sample" className="hover:text-zinc-950">
          Sample
        </Link>
        <Link href="/#pricing" className="hover:text-zinc-950">
          Pricing
        </Link>
        {authSlot}
      </nav>
    </>
  );
}
