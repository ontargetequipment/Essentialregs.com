# 40 CFR Part 60 Subpart OOOO — import record (8 Oct 2026)

The original Subpart OOOO (Standards of Performance for Crude Oil and Natural
Gas Facilities for which Construction, Modification or Reconstruction
Commenced After August 23, 2011, and on or Before September 18, 2015), asked
for by the fourth outside review to complete the federal storage-vessel
timeline (OOOO → OOOOa → OOOOb → OOOOc). Reg key `oooo`. The first regulation
through the built-in review (`pipeline/run_chain.py`). Not public yet: the
Cowork session spot-checks the 40-row sample in pull request #77 against the
eCFR text, then says "make OOOO public".

## Source

| | |
|---|---|
| eCFR page | https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-OOOO |
| Print | eCFR "enhanced display" PDF, header `40 CFR Part 60 Subpart OOOO (up to date as of 10/06/2026)`, 72 pages, 651,244 bytes; `pipeline/sources/OOOO.pdf`, `OOOO.txt` (pdftotext -layout, poppler 24.02 on the runner) |
| Version in the manifest | `as_of` 2026-10-06 (the print's date, the same convention as OOOOa/b/c); the versioner's latest amendment date for the subpart is 2025-07-31 (90 FR 36531), recorded beside it |
| How the print was fetched | The Import workflow's new "Fetch the eCFR print" step (run 37712067602): the page's own Print/PDF generator (POST `<page>.pdf`, poll `/pdfs/<uuid>.json`, download `/pdfs/<uuid>.pdf`), committed to the branch by the run |
| source_versions row | `eCFR as of 2026-10-06` / 2026-10-06, written by the execute run |

## Parse (`pipeline/import_ccr.py parse --reg oooo`, same bytes on the runner and locally)

| | |
|---|---|
| Rows | **710**: 1 root, 18 sections with a chapeau, 23 heading rows (11 sections whose text is only their paragraphs, 12 label-only paragraphs such as § 60.5365(d)), 665 items, 3 tables (`sec-oooo-TABLE-1`, `-2`, `-3`) |
| Sections | 29 in the table of contents, 29 in the body (§ 60.5360 to § 60.5430); no missing or extra section, no duplicate id, no label fix needed |
| Longest row | `sec-oooo-60.5430` (definitions, 23,336 characters, 3,499 words) |
| Rows with 25 words or more | 437 (the summarizer wrote 511: it also summarizes shorter rows that have descendants) |
| Unresolved mentions | 80: 66 CFR citations outside the corpus (§ 60.482, § 60.17, § 60.8, part 270 …), 11 other subparts (part 266 subpart H, part 60 subpart Kb …), 3 unparseable paragraph references |
| Source text check | `python pipeline/source_text_check.py --regs oooo --parsed-dir pipeline/out` (eCFR support added for this import): 34,618 words on both sides, 34,033 equal, **0 extraction differences**, 1 table-layout difference (Table 1, cells read in a different order), 0 spacing differences. Report: `pipeline/out/oooo_source_text_check.md` |

## Import and chained run (Import regulation workflow, execute, run 37712496175)

| | |
|---|---|
| Written | 710 new rows (0 shared with the database before), every parent resolves |
| Summaries | 511 written as pending (199 heading-only rows skipped) |
| Review | 385 passed as written, 125 corrected, 1 failed (`sec-oooo-60.5411-(a)`, the correction was a rewrite) → regenerated once and corrected on the second review. **0 rows still pending.** |
| Embedded | 511 provisions (672 chunks) in the chained run, then 199 heading-only rows by the embed step |
| Budget | $10.00 per regulation (standing rule). Estimate before the first paid call: $5.77 (summarize + review). The report printed $0.0136 spent, which is wrong: the one-row regenerate and second-review passes overwrote the first passes' figures (fixed in `summarize.record_spend` / `review.record_spend` after this run). The first review alone recorded **$1.3801**; the first summarize pass's actual figure was overwritten before it was printed and is not recoverable from the log (its estimate was about $4.2 at batch rates). The run stayed well inside $10 either way. |
| Guards | `summary_pending_over_24h` 0, `approved_outside_pipeline` 0, `approved_without_review_date` 0 |
| Sample | `docs/imports/2026-10-08/import-regoooo_chain_sample_40.md` (20 passed, 20 corrected, seed 20261008), pull request #77 from branch `chain-sample/import-regoooo-37712496175` (the workflow opened it itself) |
| Reader | jurisdiction `federal`, issuing body EPA, `is_public` false on every row; /federal lists it under 40 CFR Part 60 between JJJJ and OOOOa (root ids sort bytewise: OOOO, OOOOa, OOOOb, OOOOc) |

## Citation links to the new document (markup-only re-imports, text identical)

Every citing document was dry-run first (0 rows with a letters-or-digits
change in all 14), then executed; the chained run selected 0 rows and the
embed step embedded 0 rows for each. Counts are the new `/regulations/oooo`
anchors per document (old parse on main → new parse on this branch; the
`links_updated` change rows the trigger wrote agree).

| document | rows changed | document links | section links | forms linked |
|---|---:|---:|---:|---|
| Regulation 7 | 28 | 111 | 1 (40 CFR 60.5365) | NSPS OOOO ×89, 40 CFR Part 60, Subpart OOOO ×16, the OOOO code in Subpart lists |
| Regulation 6 | 8 | 56 | 3 (§§ 60.5360, 60.5430) | NSPS OOOO ×43, bare OOOO in NSPS lists ×9, 40 C.F.R. Part 60, Subpart OOOO ×4 |
| Regulation 3 | 1 | 7 | 0 | NSPS OOOO ×6, 40 C.F.R. Part 60, Subpart OOOO ×1 |
| GP01 | 3 | 3 | 0 | NSPS Subpart OOOO ×2, Subpart OOOO (beside OOOOa, OOOOb) ×1 |
| GP05 | 3 | 3 | 0 | the same three forms |
| GP08 | 1 | 1 | 0 | 40 CFR Part 60, Subpart OOOO |
| GP09, GP10 | 1 each | 2 each | 0 | NSPS OOOO, the OOOO code in a list |
| GP12 | 2 | 2 | 0 | NSPS Subparts OOOO, NSPS Subpart OOOO |
| OOOOa | 3 | 7 | 0 | "§ 60.5365(a) (in subpart OOOO of this part)" and the like |
| OOOOb | 4 | 4 | 0 | § 60.5371(b) of subpart OOOO, § 60.5377(g), § 60.5400(h) |
| Regulation 8 | 0 | 0 | 0 | its "40 C.F.R. Part 63, Subpart OOOO" (fabric coating NESHAP) stays plain text — the guard the part-aware map exists for |
| Regulation 21 | 0 | 0 | 0 | its only "OOOO" is a definition label (VI.OOOO.), not a citation |
| Regulation 30 | 0 | 0 | 0 | "40 CFR 60, Subparts Kb, VV and VVa, GGGa, OOOO and portions of OOOOa and OOOOb" (no "Part") is not a form the importer links, for any subpart |

Bare "Subpart OOOO" with no part and no program word links only when the
paragraph shows the Part 60 context (NSPS, Part 60, a § 60.53xx section or
OOOOa/b/c beside it) and no Part 63 / NESHAP / MACT context; "OOOO" never
captures "OOOOa/b/c" (every pattern ends in a word boundary; tested in
`pipeline/test_import_ccr.py`).

## Search

- Keyword eval (workflow run 37713848832 on this branch): 7 of 8 rows pass,
  0 unexpected failures ("fugitive emissions" is the known failure). New rows:
  **OOOO** → `sec-oooo-top-REG-oooo` first (0.4764), Regulation 6's adoption
  stub second, the OOOO tables below; **OOOOb** → `sec-oooob-top-REG-oooob`
  first (0.4913), its tables below. The OOOO row needed migration
  `20261008013528_keyword_search_named_document_first`: a query that is
  exactly a document's key multiplies that document's root row by 2.0
  (before it, Regulation 6's two-word "Subpart OOOO" stub out-ranked the
  document, 0.2729 to 0.2382).
- Ask eval (run 37713850846): 37 of 37 questions pass, 26 question-map checks,
  0 unexpected failures.

## App

- Storage-tank map: the introduction no longer says the original OOOO is
  outside the corpus; OOOO's storage vessel applicability (§ 60.5365(e)),
  standard (§ 60.5395) and definitions (§ 60.5430) rows added. Pneumatic
  controllers: the August 23, 2011 – September 18, 2015 window and
  § 60.5365(d) / § 60.5390. Combustion devices: § 60.5412 / § 60.5413. LDAR:
  a note that the original OOOO has no fugitive emissions components standard
  (its leak rules reach only onshore natural gas processing plants). The
  engine maps had no OOOO gap (OOOO does not regulate engines); the dehydrator
  map's "40 CFR 63 Subpart HH not yet in this corpus" is a different, true,
  gap and was left.
- The OOOOb premise note names OOOOa's and OOOO's own date windows (one
  sentence, cited to § 60.5365a and § 60.5365).
- `FEDERAL_NSPS_REG_KEYS`, the admin review queue, the reader's dates
  (`source-dates.generated.ts`), the corpus id index and the question-map id
  list carry `oooo`.

## What in the checklist did not work as written

1. **"Commit the official PDF to pipeline/sources/ first."** www.ecfr.gov is
   not reachable from a Claude Code cloud session (the egress proxy refuses
   the host for curl and for the web fetch tool alike), and neither are the
   Actions artifact store and the job-log download URLs (Azure blob storage).
   A separate fetch workflow could not be dispatched either: a workflow file
   that exists only on a branch is not registered for `workflow_dispatch`.
   The Import workflow (on the default branch) was extended instead, with a
   step that fetches the print on the runner when a 40 CFR subpart's source
   is missing and commits it to the branch; it took four runs to find the
   eCFR's PDF protocol (the page carries no PDF link; its "Generate PDF"
   control posts to `<page>.pdf` and polls `/pdfs/<uuid>.json`).
2. **The source text check** (`source_text_check.py`) only knew the general
   permits' page layout; eCFR prints were added (the moved-out section
   heading and paragraph label are put back on the corpus side, a label-only
   paragraph contributes its label).
3. **The chained run's cost table** understated the spend (see Budget above);
   fixed after the run, so the next report is right.
4. **Keyword ranking**: the bare code "OOOO" did not open the new document
   first without the named-document rule (migration above).
5. Everything else ran as written: dry run → execute → chained run →
   sample pull request (the repository setting that lets Actions open pull
   requests is on now: #77 was opened by the run itself), markup-only
   re-imports with 0 rows regenerated and 0 rows embedded.
