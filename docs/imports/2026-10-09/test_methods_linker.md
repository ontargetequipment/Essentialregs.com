# Test Methods section and method citation linker — build record (9 Oct 2026)

Branch `claude/intelligent-gauss-oel2hj`, pull request "Test Methods section +
method citation linker". The content (30 entries, `src/data/test-methods.ts`,
with the review record `docs/test-methods/content_review_2026-10-08.json`) was
written by the CEO chat on 8 Oct 2026 and cherry-picked from
`claude/state-regulations` (commit 70a48c1) as the first commit of the branch;
this record covers the build on top of it.

## What was built

- **Data.** The 30 entries moved to `src/data/test-methods.json`, the one file
  the typed wrapper (`src/data/test-methods.ts`: `TestMethod`,
  `TEST_METHOD_CATEGORY_LABELS`, `TEST_METHODS`, `TEST_METHOD_BY_SLUG`) and the
  Python linker both read. `scripts/test-methods.test.ts` checks the contract
  (unique lowercase slugs that equal the short name's number, every
  `relatedSlugs` entry resolves, every `ecfrUrl` under
  `https://www.ecfr.gov/current/title-40/`, every category known, prose only).
- **Pages.** `/test-methods` (index grouped by category, static) and
  `/test-methods/<slug>` (one page per entry: title, source, the eCFR link,
  What it measures / How it works / Equipment / When a rule cites it / Notes
  for compliance staff, Related methods, Cited by, the "not the method text"
  footer). Prerendered for every slug (`generateStaticParams`,
  `dynamicParams = false` so an unknown slug is a 404) and refreshed hourly
  (ISR) so a re-link reaches the Cited by lists without a deploy. No
  `getAccessStatus()`, no subscribe panel: an anonymous visitor and a
  subscriber get the same page. In the header nav (desktop dropdown and the
  mobile drawer, after Federal), the footer, the sitemap (index and every
  entry) and one sentence on the home page.
- **Linker.** `pipeline/method_links.py`, one function
  (`link_method_citations`) called by both importers after their own
  cross-reference pass. Rules in its docstring; 28 table-driven cases plus
  the three real sentences in `pipeline/test_method_links.py`. The allowlist
  is the data file: `method-<n><letter>` / `ps-<n>` slugs only, nothing
  else links (Method 7400, CARB Method 310, Method 5G, PS 12 stay text).
  Display text kept as printed ("EPA Method 21" links as "EPA Method 21").
  Lists link each resolving number; a "through" or dash range links the
  first and last number only. Never inside an `<a>`, a `<span class="xref">`,
  a table caption or the row's own label. Idempotent (an anchor is an `<a>`).
  `--no-method-links` on `parse` (and `ER_METHOD_LINKS=0`) switch it off.
  The eCFR subparts' performance-test tables (Table 2 to JJJJ, Table 7 to
  IIII, Table 4 to ZZZZ; kind "appendix") get the method linker alone: the
  cross-reference pass still skips them, as before. The brief's third real
  sentence, "Methods 25A and 18", is in Table 2 to Subpart JJJJ (an XML
  table cell), not in Subpart OOOOb; the test uses that cell.
- **Cited by.** Option (b): a new table `provision_method_citations`
  (`supabase/migrations/20261009005000_test_method_citations.sql`, NOT
  applied by the pull request). The importers do not maintain
  `public.cross_references` -- its 4,672 `internal` rows date from the
  original upload and no code path in `pipeline/` writes it; the reader's
  popups read the xref spans in `full_text` -- so method rows there would
  have sat beside a legacy set nobody refreshes, under its `is_public`-only
  read policy. The new table is rewritten per document by every executed
  import (`import_ccr.write_method_citation_rows`, from the anchors in the
  final `full_text`, so it can never disagree with the text), indexed on
  `(method_slug, provision_id)`, readable by `anon` and `authenticated`
  (ids and the printed citation only; a staged document's rows hidden by
  `reg_is_released`), `service_role` the only writer. The page reads the
  provision labels with the service role (the same reasoning as
  `fetchRegulationRoots`: navigation, not content), drops staged documents,
  groups by regulation in index order, 50 per regulation then "+N more".
- **Reader.** `sanitizeHtml` / `sanitizeCardHtml` already let
  `a.xref-method[href^="/test-methods/"]` through (relative href, `class`
  allow-listed); `scripts/test-method-links.test.ts` proves it and that the
  reader's click delegation does not catch the anchor (plain navigation).
  `reader.css` and `globals.css` style it like `.xref` (accent, dotted
  underline) with a small superscript "M".
- **QA.** `scripts/corpus_qa.sql` checks 26 `test_method_links_resolve`
  (every `/test-methods/<slug>` href in `full_text` names a slug in the data
  file) and 27 `test_method_citations_dangle` (no row of the new table with
  a missing provision or unknown slug; 0 while the table does not exist).
  The brief numbered them 21 and 22; those numbers were already taken
  (`approved_outside_pipeline`, `math_glyphs_in_text`). The slugs reach SQL
  through the generated `scripts/test-method-slugs.sql` (Step 0d; CI loads
  it ahead of the suite; `npm test` fails while it is stale).

## Regression: the parse of every document, linker off and on

Every document in `pipeline/sources/` (58: 32 AQCC regulations, 11 general
permits, ECMC, 7 eCFR subparts, 6 PHMSA parts) was parsed three times with
the Import workflow's own commands: with the pipeline as it was on `main`
(`5fc55d7`), with this branch's pipeline and `--no-method-links`, and with
this branch's pipeline and the linker on. The corpus id and definitions
indexes committed in `pipeline/out/` were in force for all three.

- **Linker off:** the rows JSON is byte-identical to `main`'s for all 58
  documents.
- **Linker on:** every row equals the off parse once each `xref-method`
  anchor is replaced by its text, and nothing else differs.
- **rows 37208, rows changed 477, anchors 806.** 25 documents gained anchors; 33 are
  unchanged because nothing in them cites a listed method. Every one of the
  30 entries is cited somewhere in the corpus.

The in-repo test (`pipeline/test_method_links.py`,
`LinkerRegressionTests`) repeats the off/on comparison on every run for
Regulation 1, Subpart OOOOb and Subpart JJJJ (a CCR print, an eCFR print, an
eCFR XML table), and on every document with `ER_FULL_CORPUS=1`.

### Rows changed and anchors added, per document

| document | rows | rows changed | anchors | most cited |
|---|---:|---:|---:|---|
| 1 | 344 | 10 | 32 | method-9 ×11, method-5 ×8, method-1 ×6, method-4 ×6 |
| 21 | 509 | 3 | 5 | method-24 ×5 |
| 23 | 221 | 2 | 2 | method-5 ×2 |
| 24 | 415 | 6 | 6 | method-27 ×4, method-22 ×2 |
| 25 | 993 | 6 | 9 | method-24 ×3, method-18 ×3, method-25a ×3 |
| 26 | 626 | 3 | 7 | method-18 ×2, method-25a ×2, method-19 ×1, method-24 ×1 |
| 30 | 444 | 1 | 1 | method-320 ×1 |
| 31 | 757 | 20 | 43 | method-21 ×19, method-3c ×10, method-18 ×5, method-3a ×4 |
| 4 | 348 | 6 | 8 | method-5 ×4, method-301 ×2, method-3 ×1, method-10 ×1 |
| 6 | 462 | 16 | 24 | method-6 ×6, method-24 ×4, method-5 ×4, method-1 ×3 |
| 7 | 2182 | 53 | 84 | method-21 ×57, method-22 ×12, method-27 ×6, method-2d ×4 |
| 8 | 1340 | 2 | 2 | method-301 ×2 |
| cp | 220 | 2 | 5 | method-9 ×4, method-5 ×1 |
| gp06 | 174 | 1 | 1 | method-9 ×1 |
| gp09 | 251 | 3 | 3 | method-22 ×2, method-21 ×1 |
| gp10 | 254 | 3 | 3 | method-22 ×2, method-21 ×1 |
| gp12 | 541 | 4 | 4 | method-22 ×3, method-9 ×1 |
| iiii | 288 | 2 | 35 | method-1 ×4, method-7e ×4, method-3 ×4, method-3a ×4 |
| jjjj | 205 | 3 | 59 | method-320 ×11, method-18 ×7, method-1 ×6, method-1a ×6 |
| oooo | 710 | 43 | 60 | method-22 ×12, method-21 ×9, method-25a ×7, method-1 ×4 |
| ooooa | 1106 | 69 | 97 | method-21 ×35, method-22 ×14, method-25a ×11, method-1 ×4 |
| oooob | 2256 | 105 | 143 | method-21 ×72, method-22 ×14, method-25a ×8, method-2d ×5 |
| ooooc | 1932 | 97 | 138 | method-21 ×72, method-22 ×14, method-25a ×9, method-18 ×5 |
| p192 | 2612 | 12 | 12 | method-2 ×4, method-1 ×2, method-3 ×2, method-5 ×2 |
| zzzz | 360 | 5 | 23 | method-4 ×4, method-19 ×3, method-25a ×3, method-3 ×3 |

unchanged documents (no citation of a listed method): 10, 11, 12, 15, 16, 18, 19, 2, 20, 22, 27, 28, 29, 3, 9, aqs, ecmc, gp01, gp02, gp03, gp05, gp07, gp08, gp11, p190, p191, p193, p194, p195, p196, p199, proc, sip

### Anchors per method

| slug | anchors |
|---|---:|
| method-21 | 266 |
| method-22 | 75 |
| method-25a | 50 |
| method-1 | 37 |
| method-4 | 34 |
| method-18 | 27 |
| method-3c | 26 |
| method-2 | 24 |
| method-5 | 23 |
| method-320 | 21 |
| method-3b | 20 |
| method-9 | 18 |
| method-6 | 18 |
| method-3a | 18 |
| method-3 | 16 |
| method-2d | 16 |
| method-1a | 16 |
| method-24 | 13 |
| method-2a | 12 |
| method-19 | 11 |
| method-301 | 11 |
| method-27 | 10 |
| method-10 | 9 |
| method-7e | 8 |
| ps-8 | 6 |
| ps-9 | 6 |
| method-15 | 5 |
| method-16 | 4 |
| method-16a | 3 |
| ps-2 | 3 |

The source-text mention counts (`grep` over `pipeline/sources/*.txt`:
Method 21 ×268, Method 22 ×75, Method 25A ×41 ...) agree with the anchor
counts to within the citations in table cells the CCR parser renders from
the PDF (never passed through a linker) and the list forms ("Methods 1–4",
"Method 3, 3A, or 3B") that the grep counts once and the linker links per
number.

## Not verified here, by design

- **The migration is not applied** and the table does not exist in
  production yet; `write_method_citation_rows` warns and continues until it
  does, and the page shows "No provision ... is recorded as citing this
  method yet". Sequence after merge: apply
  `20261009005000_test_method_citations.sql` through the connector and
  record its version; then the re-link (the Import workflow, every document
  that gained anchors above, execute, markup-only: 477 rows change, 0
  letters or digits, so `links_updated`, no summary regeneration); then
  `scripts/corpus_qa.sql` with `scripts/test-method-slugs.sql` loaded.
- **`npm run build`** compiles and type-checks, and every `/test-methods`
  page prerenders (the Cited by read fails without the service-role key and
  degrades to its one-line note), but the build as a whole stops at
  `/states` and `/federal`, which prerender from the database: the same
  failure on an unmodified `main` in this container, and the reason
  `.github/workflows/ci.yml` leaves `next build` to Vercel.
- **The pages and the superscript "M"** were not viewed in a browser (no
  deployment from this session); the Vercel preview of the pull request is
  where to look.
