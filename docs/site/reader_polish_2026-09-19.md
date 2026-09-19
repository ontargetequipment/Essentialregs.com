# CHANGES.md — reader polish (Tasks 1–4)

Scope respected: only the seven files this batch owns were touched
(`src/lib/regulation.ts`, `src/app/regulations/page.tsx`,
`src/app/federal/page.tsx`, `src/components/RegulationList.tsx`,
`src/app/regulations/[reg]/page.tsx`, `src/components/RegulationReader.tsx`,
`src/app/regulations/reader.css`). Nothing under `src/app/search/**`,
`src/lib/search.ts`, or `ProvisionCard.tsx` was read or edited, and no
related-provisions code was added. `site.patch` = `diff -ru orig/src
work/src` confirms the same seven files and nothing else.

## Task 1 — heading promotion

**`src/lib/regulation.ts`**: added `promoteHeadingParagraph(html: string):
string`. It rewrites a provision's first `<p>` to
`<p class="item-heading">` when: there's at least one more `<p>` or
`<table>` after it (a heading is never the *only* paragraph — promoting a
one-paragraph provision would hide its entire content behind a bold label);
its tag-stripped text is ≤ 80 chars; it doesn't end in `.` or `;`; and it
doesn't start with a lowercase letter. **Decision on the trailing colon**:
allowed. Several genuine headings in the corpus are printed with the colon
baked in (`"Definitions:"`), and a colon-terminated introductory clause long
enough to read as a real sentence (`"...shall mean the following:"`) is
already too long to pass the 80-char check, so allowing `:` doesn't pick up
false positives in the fixtures. The function is pure, idempotent (guards on
an already-present `item-heading` class so double-application can't
duplicate it), and has no dependency beyond string/regex — it doesn't touch
`sanitizeHtmlLib` or any Supabase import, so it can be unit-tested standalone
(see stats below).

**`src/app/regulations/[reg]/page.tsx`**: applied to item rows only, wrapped
around `withItemIdBadge`:
`withItemIdBadge(promoteHeadingParagraph(p.full_text), p.citation)`.
`promoteHeadingParagraph` runs first so the badge insertion (which always
targets the *current* first `<p>`, by tag, regardless of its class) still
lands inside the now-`item-heading` paragraph — "I.G." + "Definitions" render
as one bold heading line, as specified.

**`src/app/regulations/reader.css`**: added `.item-heading` (semibold,
`font-size: 1.05em`, `margin-bottom: 4px`). No separate `#popup-body`
override was needed — the popup clones the whole DOM node (including its
class), so it inherits this rule there for free; confirmed by inspection of
the existing `#popup-body .item` rules, which only reset spacing/borders,
not the paragraph-level styles this depends on.

**Sidebar labels / jump snippet — confirmed unchanged, as the brief
predicted.** `stripHtml()` strips all tags and reads plain text regardless
of any class attribute added to a `<p>`, so the sidebar's
`stripHtml(node.full_text, 60)` and the jump index's
`stripHtml(sec.full_text, 40)` already include the (unpromoted-looking, but
textually identical) heading text before and after this change — verified
by running `promoteHeadingParagraph` + `stripHtml` on the same fixture rows
and diffing the `stripHtml` output; it's byte-identical either way, because
`promoteHeadingParagraph` only ever adds a `class` attribute, never changes
text content. No code change was needed there.

### Promotion statistics (fixtures/*.json, item rows only)

Ran `promoteHeadingParagraph` (a verbatim copy, since `regulation.ts` itself
imports `@/lib/supabase/server` / `@/lib/supabase/admin`, which aren't part
of this trimmed repo and can't be resolved by plain Node outside a real
Next.js build — see Task 4) against every `item`-kind row in each fixture:

| Fixture | item rows | promoted | % |
|---|---:|---:|---:|
| Reg 1  | 341 | 97  | 28.4% |
| Reg 9  | 213 | 60  | 28.2% |
| Reg 26 | 623 | 10  | 1.6% |
| cp     | 219 | 157 | 71.7% |
| ecmc (first 900) | 899 | 15 | 1.7% |

cp is almost all definitions (`I.G.1.` … `I.G.11x.`), which is exactly the
"term on its own line" pattern the heuristic targets, hence the much higher
rate there; Reg 26 and ECMC are mostly procedural/technical rules with long
first sentences, hence the much lower rate.

**15 random PROMOTED first paragraphs** (post-promotion text — what a reader
would see bolded):
```
[9]   sec-9-IX-M            "February 19, 2015"
[26]  sec-26-B-VI-A-1       "Applicability"
[1]   sec-1-III-D-2-i-(ii)  "General Requirement"
[cp]  sec-cp-I-G-11         "ATMOSPHERE"
[9]   sec-9-III-B-5         "Agricultural open burning"
[1]   sec-1-X-B             "Adopted: April 9, 1981"
[cp]  sec-cp-I-G-35         "DIRECT PM2.5 EMISSIONS"
[cp]  sec-cp-I-G-89         "PM10 EMISSIONS"
[9]   sec-9-IV-D-6          "Wind direction"
[1]   sec-1-X-P             "Adopted: June 21, 2007"
[cp]  sec-cp-I-G-108        "SOURCE DEFINTIONS"      (typo is in the source)
[cp]  sec-cp-I-G-90         "POTENTIAL TO EMIT"
[26]  sec-26-B-IV-A-1       "Applicability"
[1]   sec-1-III-D-2-h-(ii)  "General Requirements"
[1]   sec-1-III-D-2-e-(iii) "Applicable Emission Limitation Guideline"
```
Note for the CEO: `sec-9-IX-M` ("February 19, 2015") and `sec-1-X-B`/`X-P`
("Adopted: April 9, 1981" / "Adopted: June 21, 2007") are amendment-history
date stamps, not topic headings — they legitimately sit on their own line in
the source, so the heuristic promotes them, but "bold heading" styling reads
a little odd for a bare date. Everything else in this sample is a genuine
heading. If these date-stamp rows should render plainly instead, the fix
would be a length/word-count check (e.g. require ≥2 words) rather than
excluding dates specifically, since it's a small, low-signal edge case.

**15 random NOT-PROMOTED first paragraphs (≤80 chars, correctly rejected)**:
```
[1]    sec-1-III-D-2-i-(iv)-(C)     "other equivalent methods or techniques approved by the division."
[26]   sec-26-B-I-D-5-c-(ii)-(B)    "For each engine included in the Alternative Company-Wide Compliance Plan:"
[26]   sec-26-B-I-D-6-e-(v)         "Hours of operation at least on a calendar month basis."
[ecmc] sec-ecmc-100-DEF-CEMENT      "CEMENT shall be measured in 94-pound sacks."
[ecmc] sec-ecmc-100-DEF-GEOLOGIC-HAZARD "GEOLOGIC HAZARD is defined in § 24-65.1-103(8), C.R.S."
[ecmc] sec-ecmc-100-DEF-ACT         "ACT shall mean the Oil and Gas Conservation Act of the State of Colorado."
[26]   sec-26-B-I-D-5-b-(v)         "Compliance Deadlines for engines subject to Section I.D.5.b.(ii)."
[ecmc] sec-ecmc-304-a-(1)           "Surface disturbance at a site previously undisturbed by Oil and Gas Operations;"
[1]    sec-1-III-D-2-i-(iv)-(B)     "watering down the blasted area as soon as practicable after blasting,"
[ecmc] sec-ecmc-304-b-(7)-A-iii     "Fences; Energy and Carbon Management Commission"
[26]   sec-26-B-I-D-6-b-(v)-(D)     "With greater than or equal to 400 horsepower; and"
[26]   sec-26-B-I-D-4-c-(ii)-(A)    "APENs submitted for a Table A engine on or after May 1, 2021."
[ecmc] sec-ecmc-100-DEF-SPUD        "SPUD means the initiation of drilling the surface casing hole of a Well."
[ecmc] sec-ecmc-100-DEF-AFFECTED-PERSON "AFFECTED PERSON means any person who satisfies the requirements of Rule 507.a."
[26]   sec-26-B-III-B-2-a           "Waste Management of Colorado Denver Arapahoe Disposal Site (005-1291) (pt 003)."
```
Every one of these is correctly rejected — they're all short sentence
fragments (definitions, list items, sub-clauses), correctly ending in `.`,
`;`, or `,`/a comma-continued clause, or starting lowercase, not headings.
No false negatives observed in this sample.

Reproduce with: `node scratch/promote_stats.mjs` (script included below the
fold in this repo's scratch area — see Task 4 for why it's a verbatim copy
rather than an import).

## Task 2 — Colorado index grouped by agency

**`src/lib/regulation.ts`**: added
- `regulationNumber(id)` — factors out the `sec-(.+)-top-REG-` extraction
  that was previously inlined in `RegulationList.tsx`.
- `regulationCardInfo(reg)` — display-only aliasing (never touches stored
  data): `"Regulation Number N — <title, with the trailing '5 CCR 1001-x'
  stripped>"` + the CCR cite as a subline for numeric AQCC regs, `"Common
  Provisions Regulation"` for cp, `"ECMC Rules (Practice and Procedure)"` +
  `"2 CCR 404-1"` for ECMC's root row (whose stored title is literally
  `"PRACTICE AND PROCEDURE 2 CCR 404-1"` — unchanged in the data, only
  aliased on the card).
- `groupColoradoRegulations(regs)` — groups by `issuing_body`:
  `"CDPHE-APCD"` → "Air Quality Control Commission (5 CCR 1001)",
  `"ECMC"` → "Energy and Carbon Management Commission (2 CCR 404-1)",
  anything else → "Other". The AQCC group is sorted Common Provisions first,
  then numerically by regulation number (so "22" sorts after "9", not before
  "3" the way string/id order would).
- `groupFederalRegulations(regs)` — groups by `issuing_body` for `/federal`;
  `"EPA"` gets the friendly heading "EPA (40 CFR Part 60)", anything else
  falls back to its raw `issuing_body` string so a future non-EPA federal
  source doesn't silently vanish into an unlabeled group.

**`src/components/RegulationList.tsx`**: added a `mode?: "flat" | "state" |
"federal"` prop (default `"flat"`, i.e. today's single-list behavior,
unchanged for any future caller that doesn't pass it). `"state"` and
`"federal"` call the two grouping functions above and render a heading per
non-empty group plus the aliased title/subtitle from `regulationCardInfo`.
The link target is untouched: still `/regulations/<regulationNumber(id)>`.

**`src/app/regulations/page.tsx`**: passes `mode="state"`.
**`src/app/federal/page.tsx`**: passes `mode="federal"`.

**Assumption flagged**: the fixtures don't carry `issuing_body` at all (they
only have `id, citation, title, parent_id, sort_order, full_text, kind`), so
this couldn't be verified end-to-end against real data — grouping/ordering
was instead verified with a script that reuses each fixture's own root row
plus synthetic stand-ins for AQCC reg numbers not in this fixture batch
(2, 22, 30), assigning `issuing_body` per the brief's literal spec
(`"CDPHE-APCD"`, `"ECMC"`, `"EPA"`). If the live `issuing_body` values differ
from those three strings, the `else`-bucket ("Other") is the fallback, not a
crash, but the heading text should be spot-checked against a real
`/regulations` load once this ships.

### Rendered excerpt (synthetic regs: cp, 1, 2, 9, 22, 26, 30 as AQCC; ecmc as ECMC)

```
Order within AQCC group: cp, 1, 2, 9, 22, 26, 30

<div class="regulations-index">
  <h2>Air Quality Control Commission (5 CCR 1001)</h2>
  <div class="cards">
    <a href="/regulations/cp">
      <p class="title">Common Provisions Regulation</p>
    </a>
    <a href="/regulations/1">
      <p class="title">Regulation Number 1 — EMISSION CONTROL FOR PARTICULATE MATTER, SMOKE, CARBON MONOXIDE, AND SULFUR OXIDES</p>
      <p class="subtitle">5 CCR 1001-3</p>
    </a>
    ... (2, 9, 22, 26, 30 in numeric order) ...
  </div>
  <h2>Energy and Carbon Management Commission (2 CCR 404-1)</h2>
  <div class="cards">
    <a href="/regulations/ecmc">
      <p class="title">ECMC Rules (Practice and Procedure)</p>
      <p class="subtitle">2 CCR 404-1</p>
    </a>
  </div>
</div>
```
Full output: `node scratch/grouping_render.mjs`.

## Task 3 — collapsible sidebar

**`src/app/regulations/[reg]/page.tsx`**: each top-level node that has a
section list (parts, and — since the existing code already treated any
non-appendix top-level node generically — ECMC's series nodes too, with no
extra branch needed) now renders as a native `<details className="nav-part"
id={"navgroup-"+node.id}>` with `<summary>` wrapping the existing part-link
+ sub-label, and `<ul className="nav-items">` as the body. A top-level node
with **zero** children (including every appendix — the existing appendix
branch never rendered a section list at all, so it already matched "zero
children render as today") keeps rendering as the plain `<div
className="nav-part">`, unchanged. Default-open: the *first* node that
actually gets a `<details>` (not necessarily `topLevel[0]`, since an
appendix or empty node ahead of it never becomes a details) is rendered with
`open`.

**`src/lib/regulation.ts`**: extended `SearchRow` from a 3-tuple to
`[id, citation, snippet, topGroupId]`, and `buildSearchIndex` now computes
each provision's top-level ancestor id (the node whose parent is the
regulation root) via a small memoized walk up `parent_id`. This is a
backward-compatible addition — every existing `row[0]`/`row[1]`/`row[2]`
consumer (only `RegulationReader.tsx`, checked via grep) is unaffected; the
new `row[3]` is additive. This was necessary because the main document is
rendered as a **flat** list of sibling elements (no real DOM nesting
reflecting the `parent_id` tree — indentation is just a `depth-N` class), so
there's no way to find "which sidebar group does this id belong to" by
walking the DOM; it has to come from the tree, which only exists server-side.

**`src/components/RegulationReader.tsx`**: builds a `Map<id, topGroupId>`
from `searchIndex` once on mount, and adds `openGroupFor(slug)` (looks up the
group, finds `#navgroup-<id>`, sets `.open = true` if it's a
`<details>`). Wired in three places, covering every way the brief calls out:
- **Hash present on initial load** — `openGroupFor` is called immediately
  (before the existing 50ms-delayed `goTo()` scroll), so the group is open
  before/as the page scrolls to it.
- **`goTo(slug)`** — called at the top of the function, before the scroll.
  `goTo` is what both the jump/search-box result click and the popup's "Go
  to full section →" link invoke (via `history.pushState`, not a real hash
  navigation), so this covers "a popup 'go to' navigates".
- **A native `window.addEventListener("hashchange", ...)`** — added to
  cover plain sidebar `<a href="#id">` clicks (both the per-group summary
  link and each `<li>`'s link), which navigate via the browser's own hash
  handling and never call `goTo()` at all, so `pushState`-based hooks alone
  would miss them. `hashchange` fires for every one of those; `pushState`
  doesn't fire it, which is exactly why `goTo()` also needs its own direct
  call.

**`src/app/regulations/reader.css`**: added a `details.nav-part > summary`
rule block: hides the native `::-webkit-details-marker`, adds a custom
triangle via `::before` (rotates 90° on `[open]`) matching the existing
`.summary-panel > summary` marker treatment already in this file, `cursor:
pointer`. The shared `.nav-part` class (margin, link/sub-label styling) is
untouched and applies to both the `<div>` and `<details>` variants
automatically since it's a class selector, not tag-scoped.

One trade-off worth flagging: `<summary>` now contains an `<a>` (the
existing part-link), which the brief explicitly specifies
("summary = the existing part link + sub-label"). `<summary>` is itself
implicitly interactive, so nesting another interactive element inside it
isn't strictly HTML5-conformant, though every mainstream browser renders and
handles the click correctly (a click on the link both follows the href and
bubbles up to toggle the `<details>`, which is harmless — clicking a part's
own link into its own already-visible section doesn't need the group closed
first). Flagging in case accessibility auditing later wants the link moved
outside `<summary>` instead.

### Rendered excerpt (cp and ecmc fixtures, via a plain-string mirror of the JSX — see Task 4)

cp — 5 top-level groups, first-open index 0:
```html
<details class="nav-part" id="navgroup-sec-cp-I" open>
  <summary>
    <a href="#sec-cp-I" class="nav-link nav-part-link">I.</a>
    <div class="nav-part-sub">Definitions, Statement of Intent, and General Provisions App…</div>
  </summary>
  <ul class="nav-items">
    <li><a href="#sec-cp-I-A" class="nav-link">I.A. Applicability Emission control regulatio…</a></li>
    ... 7 total ...
  </ul>
</details>
<details class="nav-part" id="navgroup-sec-cp-II">   <!-- closed by default -->
  ...
</details>
<div class="nav-part">   <!-- IV. Reserved -- zero children, plain div, no details -->
  <a href="#sec-cp-IV" class="nav-link nav-part-link">IV.</a>
  <div class="nav-part-sub">IV. Reserved</div>
</div>
```

ecmc (first 900 rows) — 3 top-level groups visible in this slice, first-open
index 0:
```html
<details class="nav-part" id="navgroup-sec-ecmc-S-100" open>
  <summary>
    <a href="#sec-ecmc-S-100" class="nav-link nav-part-link">100 Series</a>
    <div class="nav-part-sub">100 Series — DEFINITIONS</div>
  </summary>
  <ul class="nav-items">
    <!-- 316 definition rows, collapsed by default -->
  </ul>
</details>
<details class="nav-part" id="navgroup-sec-ecmc-S-200"> <!-- closed -->
  ...24 rows...
</details>
<details class="nav-part" id="navgroup-sec-ecmc-S-300"> <!-- closed -->
  ...4 rows in this 900-row slice...
</details>
```
This confirms the main point of Task 3: the 316-row Definitions series is
collapsed by default instead of dumping 300+ links into the sidebar.
Full output: `node scratch/sidebar_render.mjs`.

## Task 4 — proof

- `npm install` succeeded in `work/` (398 packages).
- `npx tsc --noEmit -p tsconfig.json` reports 26 pre-existing errors, all
  `Cannot find module '@/lib/supabase/server'` / `'@/lib/pricing'` /
  `'@/components/SubscribeControl'` / etc. and `Cannot find name
  'PageProps'`/`'LayoutProps'`. These are **not new**: running the identical
  command against `orig/tsconfig.json` (pristine, unedited copy) produces
  the exact same 26 errors on the exact same files/lines (off by the one
  line my new `import { promoteHeadingParagraph }` adds). Confirmed by
  diffing both runs' error lists with paths normalized — identical set. The
  cause is structural to this trimmed repo: it only includes the files
  relevant to this task, so `@/lib/supabase/server`, `@/lib/pricing`,
  `@/components/SubscribeControl`, `@/lib/search`, `./actions`, and
  `@/components/AuthStatus` genuinely don't exist here, and `PageProps`/
  `LayoutProps` are types Next.js generates into `.next/types` during
  `next dev`/`next build`, which hasn't run in this checkout. **No file this
  batch owns introduced a new type error.**
- `next build`: **not feasible** in this trimmed repo, for the same reason —
  it fails immediately on the same missing modules (`@/lib/supabase/server`
  et al.) as soon as webpack tries to resolve them, before it gets anywhere
  near typechecking or rendering the pages this batch touched. Confirmed
  this isn't something introduced by this batch's edits by inspection: the
  failing imports are all pre-existing lines, unrelated to any diff in
  `site.patch`.
- Rendering proof for Tasks 1–3, since real screenshots aren't possible:
  three small Node scripts (verbatim copies of the pure logic added to
  `regulation.ts` / the JSX added to `[reg]/page.tsx`, copied rather than
  imported because `regulation.ts` pulls in the unresolvable Supabase
  imports described above) run against the fixtures and print HTML-string
  excerpts and stats — see the Task 1–3 sections above for their output.
  Scripts: `scratch/promote_stats.mjs`, `scratch/sidebar_render.mjs`,
  `scratch/grouping_render.mjs` (not part of `site.patch` — they're
  throwaway proof scripts, not application code, so they weren't added
  under `work/src/`).
- `site.patch` = `diff -ru orig/src work/src`, touching exactly the seven
  owned files listed at the top of this document and nothing else.

## Post-review fix — part-link click no longer toggles its own group

The part link now sits inside `<summary>` (Task 3), so clicking it to jump
to that Part also bubbled up and triggered the browser's default
"toggle the parent `<details>`" action — clicking "PART B" to jump there
would also collapse/expand its own section list as an unwanted side effect.

**`src/components/RegulationReader.tsx`**: `onSidebarClick` now special-cases
a click whose target is `a.nav-part-link` and which sits inside a
`details.nav-part > summary`: it calls `e.preventDefault()` — which
suppresses both default actions tied to that one click event, the anchor's
navigation *and* the summary's toggle, since they're the same event's
default action — then sets `window.location.hash` to the link's target by
hand (reproducing the scroll-to-target + URL update a normal hash-link click
would have done, and still firing `hashchange`, which re-opens this same
group anyway, so nothing is lost by suppressing the native toggle), and
closes the mobile sidebar as before. A click anywhere else in the
summary — the sub-label text, the marker — has no `<a>` under it, so it
falls through to the existing toggle behavior unchanged; the marker stays
the visible affordance for that.

`site.patch` was regenerated after this fix; `npx tsc --noEmit` was re-run
against both `work/` and `orig/` and still shows the same 26 pre-existing,
unrelated errors on both (see Task 4) — no new errors from this change.
