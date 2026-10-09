# Test Methods

The free, public reference section for the EPA test methods and performance
specifications the corpus cites: `/test-methods` (index) and
`/test-methods/<slug>` (one page per entry, with a "Cited by" list of the
provisions whose text links the method).

- **Content.** `src/data/test-methods.json` (30 entries), typed by
  `src/data/test-methods.ts`. Review record of the content:
  `content_review_2026-10-08.json` in this folder.
- **Linker.** `pipeline/method_links.py`, run by both importers
  (`pipeline/import_ccr.py`, `pipeline/import_ecfr.py`). Every citation of a
  method in the data file becomes
  `<a class="xref-method" href="/test-methods/<slug>">Method 21</a>` in
  `provisions.full_text`; the reader marks it with a superscript "M".
- **Cited by.** `public.provision_method_citations` (migration
  `20261009005000`), one row per (provision, method), rewritten per document on
  every executed import. The page reads it with the service role and shows up to
  50 provisions per regulation, then "+N more".
- **Checks.** `scripts/corpus_qa.sql` checks 26 (`test_method_links_resolve`)
  and 27 (`test_method_citations_dangle`), fed by the generated
  `scripts/test-method-slugs.sql`.
- **Build record.** `docs/imports/2026-10-09/test_methods_linker.md` (PR #80),
  and PR #81 for the embedder change that lets a re-link re-embed nothing.

## Official text: sections 1.0–2.0

Each page opens with "From the method — official text": sections 1.0 and 2.0
of the method (the "1." and "2." sections for the older Methods 3C and 9),
verbatim from the eCFR versioner XML, above the editorial copy, which sits
under "EssentialRegs notes".

- **Fields.** `officialText` (HTML in the importer's conventions),
  `officialTextSource`, `officialTextRetrieved` on every entry. Written only
  by `scripts/fetch_method_sections.py`; never edit them by hand.
- **Refresh.** Run the "Test Methods official sections" workflow
  (`.github/workflows/method-sections.yml`, `workflow_dispatch`) on a branch.
  It fetches every appendix for one eCFR date (today, or Title 40's
  `up_to_date_as_of` when the versioner has not published today yet),
  rewrites the JSON, proves a second run on the saved XML changes nothing,
  commits the JSON to that branch and uploads the JSON, report and XML as
  an artifact. Any method whose heading, 1.0 or 2.0 is missing, whose span
  holds a 3.x-numbered block, or whose text is outside 200–20,000
  characters fails the run, and nothing is written.
- **Titles.** The script corrects `officialTitle` to the heading the eCFR
  prints and sets `titleVerified: true`.
- **First run.** eCFR date 2026-10-07 (PR "Test Methods: official sections
  1.0–2.0 on every page").

## Re-link executed (9 Oct 2026)

Owner-approved re-link of the 25 regulations whose text cites a method, run
through the Import workflow (`.github/workflows/import.yml`) on `main` at
`45aa14c`, strictly one regulation at a time, in this order:
1, 4, 6, 7, 8, 21, 23, 24, 25, 26, 30, 31, cp, gp06, gp09, gp10, gp12, jjjj,
iiii, zzzz, oooo, ooooa, oooob, ooooc, p192. Approved spend: none. Every run
used `skip_summaries=true`; no summary was regenerated. The embed step ran as
the workflow always does on execute and was a content-hash no-op for every row
except the five placeholder rows below.

Each regulation was first rehearsed (`execute=false`), then executed
(`execute=true`), with the rehearsal's plan compared against the regression
table in PR #80 before the execute was started. After each execute, the
regulation's review state (`summary_status`, `reviewed_by`, `reviewed_at`,
`summary_original`, hashed over every row in id order) was compared with the
hash taken before the first execute: all 25 hashes are identical to their
baseline. 0 rows were inserted, 0 deleted, in every regulation.

### Per regulation

Changed rows are rows whose `full_text` was replaced. "Citation rows" are the
`provision_method_citations` rows written for the regulation.

| reg | rehearsal run | execute run | changed rows | rows with method anchors | citation rows |
|---|---|---|---|---|---|
| 1 | 37873719655 | 37876953327 | 10 | 10 | 21 |
| 4 | 37874047802 | 37877183295 | 6 | 6 | 7 |
| 6 | 37874218075 | 37877382898 | 16 | 16 | 21 |
| 7 | 37874315522 | 37877569956 | 53 | 53 | 54 |
| 8 | 37874434555 | 37877993917 | 2 | 2 | 2 |
| 21 | 37874532354 | 37878217024 | 3 | 3 | 3 |
| 23 | 37874626154 | 37878393866 | 2 | 2 | 2 |
| 24 | 37874679536 | 37878530507 | 6 | 6 | 6 |
| 25 | 37874752990 | 37878682245 | 6 | 6 | 9 |
| 26 | 37874825204 | 37878816568 | 3 | 3 | 7 |
| 30 | 37874929855 | 37878974099 | 1 | 1 | 1 |
| 31 | 37875027828 | 37879106981 | 20 | 20 | 23 |
| cp | 37875124373 | 37879305991 | 2 | 2 | 3 |
| gp06 | 37875220894 | 37879416833 | 1 | 1 | 1 |
| gp09 | 37875297861 | 37879547965 | 3 | 3 | 3 |
| gp10 | 37875393017 | 37879699472 | 3 | 3 | 3 |
| gp12 | 37875468769 | 37879852928 | 4 | 4 | 4 |
| jjjj | 37875540252 | 37880033084 | 3 | 3 | 18 |
| iiii | 37875590837 | 37880152851 | 3 | 2 | 10 |
| zzzz | 37875665255 | 37880288804 | 8 | 5 | 12 |
| oooo | 37875740811 | 37880456721 | 43 | 43 | 53 |
| ooooa | 37875834788 | 37880687611 | 69 | 69 | 82 |
| oooob | 37875907369 | 37880911851 | 105 | 105 | 117 |
| ooooc | 37875980266 | 37881243790 | 97 | 97 | 112 |
| p192 | 37876078766 | 37881599827 | 12 | 12 | 12 |
| **total** | | | **481** | **477** | **586** |

Across the corpus: 806 `xref-method` anchors in 477 provisions, 586 distinct
(provision, method) pairs, 586 citation rows; every pair has its row and every
row has its anchor. The anchor counts are identical to PR #80's regression
table (806 anchors, 477 rows, and the same count for every slug below).
Changelog: 481 `provision_changes` rows were logged, 476 `links_updated` and
the 5 `transcription_corrected` below. Corpus size unchanged at 37,208
provisions.

### Five rows changed beyond method anchors

Every other changed row differs from its previous text only by `xref-method`
anchors. These five, in Subparts IIII and ZZZZ, also gained an equation
placeholder:

- `sec-iiii-60.4212-(c)`
- `sec-zzzz-63.6620-(e)-(1)`
- `sec-zzzz-63.6620-(e)-(2)-(i)` (this row also gained three Method 19 anchors)
- `sec-zzzz-63.6620-(e)-(2)-(ii)`
- `sec-zzzz-63.6620-(e)-(2)-(iii)`

Why: the importer change of 8 Oct 2026 (commit `1cd0ad7`, "equation images
transcribed or marked") places an EssentialRegs note at every equation-image
position in the eCFR XML. Each of these provisions ends its lead-in with
"...the following equation:" and continues with "Where:", because the equation
is an image in the eCFR and had been silently dropped. IIII and ZZZZ had not
been re-imported since that change, so their database copies predate it; the
re-link was the first import to carry it onto them. The parser now inserts

```html
<p class="figure-omitted">Equation not reproduced here. See the official source:
<a href="https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-IIII#p-60.4212(c)">40 CFR 60.4212(c)</a>.</p>
```

between the lead-in and "Where:". The rehearsal reported them as 1 (IIII) and
4 (ZZZZ) rows with "an EssentialRegs note added or changed"; the owner
accepted them as a transcription correction (the 8 October equation-note fix
catching up on two regulations that predate it) before the execute. The
importer classifies a note as markup-only, so these rows kept their review
state like every other row, and each was logged as `transcription_corrected`
("EssentialRegs note added to our copy of the official text: 1 not-reproduced
placeholder"). Because the placeholder is visible text, the embed step
re-embedded these five provisions (6 chunks, 1,794 tokens, reported as
$0.0000) and rewrote their related-provision neighbours; every other provision
in the 25 regulations was skipped as unchanged.

### Anchors and citation rows per method

Anchors are counted in `provisions.full_text`; "citing provisions" is the
number of distinct provisions, which equals the citation-row count for every
slug.

| slug | anchors | citing provisions | PR #80 anchors |
|---|---|---|---|
| method-21 | 266 | 200 | 266 |
| method-22 | 75 | 64 | 75 |
| method-25a | 50 | 41 | 50 |
| method-1 | 37 | 24 | 37 |
| method-4 | 34 | 22 | 34 |
| method-18 | 27 | 19 | 27 |
| method-3c | 26 | 21 | 26 |
| method-2 | 24 | 22 | 24 |
| method-5 | 23 | 18 | 23 |
| method-320 | 21 | 8 | 21 |
| method-3b | 20 | 11 | 20 |
| method-3a | 18 | 9 | 18 |
| method-6 | 18 | 14 | 18 |
| method-9 | 18 | 11 | 18 |
| method-1a | 16 | 6 | 16 |
| method-2d | 16 | 10 | 16 |
| method-3 | 16 | 9 | 16 |
| method-24 | 13 | 8 | 13 |
| method-2a | 12 | 12 | 12 |
| method-19 | 11 | 5 | 11 |
| method-301 | 11 | 10 | 11 |
| method-27 | 10 | 6 | 10 |
| method-10 | 9 | 9 | 9 |
| method-7e | 8 | 2 | 8 |
| ps-8 | 6 | 4 | 6 |
| ps-9 | 6 | 6 | 6 |
| method-15 | 5 | 5 | 5 |
| method-16 | 4 | 4 | 4 |
| method-16a | 3 | 3 | 3 |
| ps-2 | 3 | 3 | 3 |

### Checks after the run

- `scripts/corpus_qa.sql` (CI run 37882129574, job `qa`): all 27 checks
  returned; every ERROR and GUARD check on its baseline, checks 26 and 27 both
  0. The REVIEW/INFO rows that read "moved" (`real_review_backlog` 3160 to 0,
  `provisions_without_neighbours` 106 to 110, `summary_longer_than_long_text`
  202 to 714) are drift since the 22 Sep 2026 baseline, not failures.
- Production, logged out: `/test-methods` (200, 30 entries),
  `/test-methods/method-21` (200; Cited by lists Regulation 7, Regulation 31,
  GP09, GP10, OOOO, OOOOa, OOOOb, OOOOc; 184 provisions shown plus "+8 more" on
  OOOOb and OOOOc, 200 in all) and `/test-methods/method-5` (200; Common
  Provisions, Regulations 1, 4, 6, 23, IIII, Part 192). No page asks for a
  login; the only "Log in" and "Sign up" on them are the site header. The
  deployed stylesheets carry the `a.xref-method::after` "M" mark (reader and
  card text). `/regulations/1` is the gated reader and returns 404 logged out
  by design; its III.A.2 row was verified at the data level (anchors to
  method-1, method-4 and two to method-5).
