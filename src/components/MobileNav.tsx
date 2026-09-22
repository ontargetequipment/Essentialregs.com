"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/** The three regulation indexes behind the "Regulations" header entry. */
const REGULATION_LINKS = [
  { href: "/regulations", label: "Colorado (state)" },
  { href: "/general-permits", label: "General permits" },
  { href: "/federal", label: "Federal" },
] as const;

/** Small magnifying-glass glyph for the header search button/link. */
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M16.5 16.5l-4.2-4.2" />
    </svg>
  );
}

/** × glyph for the drawer's close button. */
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" />
    </svg>
  );
}

/** Shared row style for links in the mobile drawer's body: full-width, ≥48px tall. */
const DRAWER_LINK = "flex min-h-12 items-center text-base text-ink-soft hover:text-ink";

/**
 * Site-wide header nav.
 *
 * Below `sm` this is a full-height off-canvas drawer sliding in from the
 * right, above a scrim — the same pattern as the regulation reader's own
 * mobile sidebar (`#sidebar` / `#sidebar-scrim` in reader.css), so the two
 * "hamburger menu" experiences on the site behave the same way. `sm` and up
 * is the plain horizontal nav row with the inline search box and the
 * click-to-open Regulations dropdown, unchanged.
 *
 * `authSlot` is passed in from the root layout (a Server Component tree,
 * including a Suspense boundary around the async AuthStatus) since this
 * component itself has to be a Client Component to hold the open/closed
 * state. It's rendered twice below — once in the drawer footer, once in the
 * desktop row — which is safe: it's an already-resolved RSC element, not a
 * function, so placing it in two spots doesn't re-run the Supabase call,
 * just paints the same result twice. The two spots never show at once
 * (drawer is `sm:hidden`, the desktop row is `hidden sm:flex`).
 */
export function MobileNav({ authSlot }: { authSlot: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [regsOpen, setRegsOpen] = useState(false);
  const pathname = usePathname();

  // Close the menu on navigation. The root layout doesn't remount between
  // routes, so without this the drawer/dropdown would still be showing
  // "open" after tapping a link to a new page. Adjusted during render
  // (React's recommended pattern for "reset state when a prop changes")
  // rather than in an effect, which would cause an extra render pass.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
    setRegsOpen(false);
  }

  // Lock body scroll while the drawer is open and restore whatever the
  // previous inline value was on close/unmount — matches how reader.css's
  // own off-canvas #sidebar behaves.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Escape closes the drawer, same as the desktop dropdown below.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Desktop "Regulations" dropdown: click to open (not hover, so it works
  // the same for keyboard, touch and mouse), closes on outside click, Escape
  // or navigation. Listeners are only attached while it's open.
  const regsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!regsOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (regsRef.current && !regsRef.current.contains(e.target as Node)) {
        setRegsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRegsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [regsOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="-mr-2 flex h-10 w-10 items-center justify-center rounded-md text-ink-soft hover:bg-accent-soft hover:text-ink sm:hidden"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <path d="M2.5 5h15M2.5 10h15M2.5 15h15" />
        </svg>
      </button>

      {/* Scrim: dims and blocks the page (including the site header) behind
          the open drawer, and doubles as a click-to-close target. Stays in
          the DOM at all times so it can transition; pointer-events-none and
          aria-hidden keep it inert while closed. */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={[
          "fixed inset-0 z-50 bg-[rgba(20,26,22,0.45)] transition-opacity duration-200 sm:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      {/* Mobile off-canvas drawer. Fixed (not absolute) so it's positioned
          against the viewport and reaches full height regardless of where
          in the header it's mounted. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={[
          "fixed inset-y-0 right-0 z-[60] flex w-80 flex-col bg-panel shadow-[0_0_40px_rgba(0,0,0,0.2)] transition-transform duration-200 ease-out sm:hidden",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-[66px] shrink-0 items-center justify-between border-b border-line px-5">
          <span className="font-serif text-[17px] font-bold text-ink">Menu</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-12 w-12 items-center justify-center rounded-md text-ink-soft hover:bg-accent-soft hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <form action="/search" method="get" role="search" className="flex items-center gap-2">
            <input
              type="search"
              name="q"
              placeholder="Search regulations"
              aria-label="Search regulations"
              autoComplete="off"
              className="h-12 min-w-0 flex-1 rounded-md border border-line bg-panel px-3 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="submit"
              aria-label="Search"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-line text-ink-soft hover:bg-accent-soft hover:text-ink"
            >
              <SearchIcon />
            </button>
          </form>

          <div className="mt-6">
            <p className="font-mono text-eyebrow uppercase text-tag">Regulations</p>
            <ul className="mt-2 flex flex-col">
              {REGULATION_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={DRAWER_LINK}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-2 flex flex-col border-t border-line pt-2">
            <Link href="/sample" className={DRAWER_LINK}>
              Sample
            </Link>
            <Link href="/#pricing" className={DRAWER_LINK}>
              Pricing
            </Link>
            <Link href="/about" className={DRAWER_LINK}>
              About
            </Link>
          </div>
        </div>

        <div className="shrink-0 border-t border-line px-5 py-4">{authSlot}</div>
      </div>

      {/* Desktop nav row — unchanged behavior from `sm` up. */}
      <nav className="hidden min-w-0 flex-1 items-center justify-end gap-6 text-sm font-medium text-ink-soft sm:ml-6 sm:flex">
        {/* Plain GET form to /search — works before hydration and needs no
            state. A compact box from `md` up; between `sm` and `md` the row
            is too tight for an input next to the links, so a bare icon link
            to /search stands in for it there. h-8 keeps the input shorter
            than the 40px logo/hamburger line so the header height doesn't
            change. */}
        <form
          action="/search"
          method="get"
          role="search"
          className="hidden items-center gap-1.5 md:flex md:min-w-0 md:max-w-[216px] md:flex-1"
        >
          <input
            type="search"
            name="q"
            placeholder="Search regulations"
            aria-label="Search regulations"
            autoComplete="off"
            className="h-8 min-w-0 flex-1 rounded-md border border-line bg-panel px-2.5 text-sm font-normal text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="submit"
            aria-label="Search"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-accent-soft hover:text-ink"
          >
            <SearchIcon />
          </button>
        </form>
        <Link
          href="/search"
          aria-label="Search"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-accent-soft hover:text-ink md:hidden"
        >
          <SearchIcon />
        </Link>
        {/* Click-to-open dropdown for the three regulation indexes. */}
        <div ref={regsRef} className="relative">
          <button
            type="button"
            onClick={() => setRegsOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={regsOpen}
            className="flex items-center gap-1 hover:text-ink"
          >
            Regulations
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
          {regsOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full z-10 mt-2 flex min-w-40 flex-col rounded-md border border-line bg-panel py-1 shadow-md"
            >
              {REGULATION_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  role="menuitem"
                  onClick={() => setRegsOpen(false)}
                  className="px-4 py-2 hover:bg-accent-soft hover:text-ink"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        <Link href="/sample" className="hover:text-ink">
          Sample
        </Link>
        <Link href="/#pricing" className="hover:text-ink">
          Pricing
        </Link>
        {authSlot}
      </nav>
    </>
  );
}
