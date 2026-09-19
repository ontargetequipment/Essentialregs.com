# CHANGES — 14 new regulations (11 APCD general permits + 3 federal engine subparts)

Scope: `work/src` only (this agent's files). `/search`, `ProvisionCard.tsx` and
the related-provisions component were not touched.

## 1. `src/lib/regulation.ts`

- **`kindOf`**: ids containing `-ATTACHMENT-` now classify as `"appendix"`,
  same as `-APPENDIX-` (GP02/GP12 attachments use that naming from the
  importer instead of `-APPENDIX-`).
- **`groupColoradoRegulations`**: pulls ids whose `regulationNumber()` matches
  `/^gp\d\d$/` out of the AQCC bucket (they share `issuing_body`
  `"CDPHE-APCD"` but aren't AQCC regulations) into a new `"APCD General
  Permits"` group, sorted by permit number, emitted between the AQCC and ECMC
  groups.
- **`regulationCardInfo`**: added a GP branch. It strips one of a small set of
  known leading-boilerplate variants ("GENERAL CONSTRUCTION PERMIT — Oil and
  Gas Industry — ", "... — Oil and Gas — ", the bare "GENERAL CONSTRUCTION
  PERMIT — ", or GP12's "GENERAL PERMIT 12 (GP12) — ") and the trailing
  "— GP02 Issuance 4, July 23, 2025" (regex-captured, not per-key) to build
  `"GP02 — <subject>"` / `"Issuance 4 · July 23, 2025"`. A small
  `GP_CLOSURE_NOTE` const map appends " · closed to new registrations July
  15, 2026" to gp09/gp10's subtitle only — display-only, no stored-data
  change.
- **`groupFederalRegulations`**: now groups by CFR part parsed out of each
  row's `citation` ("40 CFR Part 60 Subpart JJJJ" → part "60") instead of by
  `issuing_body` — Part 60 and Part 63 both come from EPA, so issuing_body
  alone can no longer tell them apart now that a Part 63 subpart (zzzz) is in
  the corpus. Groups: `"EPA — 40 CFR Part 60 (New Source Performance
  Standards)"`, `"EPA — 40 CFR Part 63 (NESHAP)"`, ordered by part number.
- **`regulationCardInfo`**'s federal/fallback branch: now strips a leading
  `"<citation> — "` off the stored title (so "40 CFR Part 60 Subpart JJJJ —
  Standards of Performance for..." → "Standards of Performance for...") and
  sets `subtitle` to the citation, instead of showing the raw title with
  `subtitle: null`.
- `regulationCardInfo`'s parameter type widened to include `citation` (needed
  for the federal-title stripping above); its one caller
  (`RegulationList.tsx`) already had it in scope.

## 2. New page: `src/app/general-permits/page.tsx`

Server component at `/general-permits`, same access/fetch pattern as
`/regulations` and `/federal` (`getAccessStatus()` + `fetchRegulationList()`,
RLS-bound — no widening of what an unauthenticated/unsubscribed request can
read). Filters the root list to `gp01..gp12`, intro paragraphs on what APCD
general permits are and that every condition has to be met, a link back to
`/regulations`, the permit cards (via `RegulationList` in `flat` mode — the
grouping is redundant here since the whole page is already the one group),
and a closing note linking to CDPHE's own general-permits page for
application forms/fees (not reproduced — we don't store fees).

- **`RegulationList.tsx`** gained an optional `appliesTo?: Record<string,
  string>` prop: a one-line "Applies to ..." description rendered under a
  card's subtitle when present, keyed by `regulationNumber()`. Purely
  additive — every other caller passes nothing and renders exactly as before.
  Considered a `mode="permits"` per the task's suggestion, but the intro/note
  copy and the applies-to map are page-specific display data, not a grouping
  rule, so a prop kept `RegulationList` from having to know about GP-specific
  copy.
- The Colorado index's `"APCD General Permits"` group heading (mode
  `"state"`, group key `"gp"`) now links to `/general-permits`; every other
  heading is unchanged plain text. The `/general-permits` page itself uses
  `mode="flat"` specifically so it doesn't render that heading as a link to
  itself.

## 3. Links

- `src/components/MobileNav.tsx`: `REGULATION_LINKS` gets `{ href:
  "/general-permits", label: "General permits" }` between Colorado and
  Federal (both the mobile list and the desktop dropdown are driven off this
  one array, so one edit updates both).
- `src/app/sitemap.ts`: added `/general-permits` to `STATIC_ROUTES`, same
  priority/frequency as `/regulations` and `/federal`.
- `src/app/federal/page.tsx`: intro copy updated from "40 CFR Part 60
  subparts" to mention Part 63 (NESHAP) too, since the federal index now
  spans both parts.

## 4. Proof

- `npm install && npx tsc --noEmit -p tsconfig.json` in `work/`: 6 errors,
  all pre-existing unresolved-module errors documented previously
  (`@/lib/supabase/server`, `@/lib/supabase/admin`, `@/lib/pricing`,
  `@/components/SubscribeControl`, `@/lib/site` — the trimmed checkout
  doesn't include those files). **No new errors** in any file this agent
  touched.
- `render_check.mjs` (scratch, not shipped) renders `groupColoradoRegulations`,
  `groupFederalRegulations`, `regulationCardInfo`, and the `/general-permits`
  card list against `root_rows_fixture.json`. Excerpt:

  ```
  -- APCD General Permits --
    [APCD General Permit GP01] GP01 — Condensate Storage Tank Batteries  |  Issuance 6 · July 23, 2025
    [APCD General Permit GP02] GP02 — Natural Gas Fired Reciprocating Internal Combustion Engines (RICE)  |  Issuance 4 · July 23, 2025
    [APCD General Permit GP09] GP09 — Well Production Facilities (attainment areas)  |  Issuance 3 · July 23, 2025 · closed to new registrations July 15, 2026
    [APCD General Permit GP12] GP12 — Oil and Gas - WELL PRODUCTION FACILITIES  |  Issuance 1 · May 28, 2026

  -- EPA — 40 CFR Part 60 (New Source Performance Standards) --
    [40 CFR Part 60 Subpart JJJJ] Standards of Performance for Stationary Spark Ignition Internal Combustion Engines  |  40 CFR Part 60 Subpart JJJJ
    [40 CFR Part 60 Subpart IIII] Standards of Performance for Stationary Compression Ignition Internal Combustion Engines  |  40 CFR Part 60 Subpart IIII

  -- EPA — 40 CFR Part 63 (NESHAP) --
    [40 CFR Part 63 Subpart ZZZZ] National Emissions Standards for Hazardous Air Pollutants for Stationary Reciprocating Internal Combustion Engines  |  40 CFR Part 63 Subpart ZZZZ

  /general-permits card:
    [APCD General Permit GP02] GP02 — Natural Gas Fired Reciprocating Internal Combustion Engines (RICE)
        Issuance 4 · July 23, 2025
        Applies to natural-gas-fired reciprocating internal combustion engines at oil and gas operations.
  ```

  Full output is reproducible via the script (not included in the repo,
  scratch-only per instructions).

`site.patch` = `diff -ruN orig/src work/src`, 396 lines, touching:
`app/federal/page.tsx`, `app/general-permits/page.tsx` (new),
`app/sitemap.ts`, `components/MobileNav.tsx`, `components/RegulationList.tsx`,
`lib/regulation.ts`.

## Notes / things worth a second look

- GP12's stored title uses a plain hyphen ("Oil and Gas - WELL PRODUCTION
  FACILITIES") rather than the em dash used everywhere else, and doesn't
  repeat "GP12" before "Issuance" the way GP01-GP11 repeat their own number.
  Both are handled (the trailing-suffix regex makes the "GPxx " repeat
  optional; the inner hyphen is left alone since it's inside the kept
  subject, not part of a stripped boundary), but GP12's card title reads
  "GP12 — Oil and Gas - WELL PRODUCTION FACILITIES" — a little awkward with
  two different dash characters back to back. Not specified explicitly in
  the task (only GP02's exact target string was given), so left as the
  literal result of the general stripping rule rather than special-cased.
- gp06's title has an inner en dash ("Diesel Fuel – Fired Reciprocating...")
  that's part of the kept subject, not the boilerplate — untouched by the
  stripping regexes, so it survives into the card title as printed.
