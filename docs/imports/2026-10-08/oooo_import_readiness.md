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

## Follow-up after the Cowork spot-check (8 Oct 2026, same branch)

The Cowork session checked the 40-row sample against `pipeline/sources/OOOO.txt`
and production: 33 summaries fine, 6 minor, 1 wrong, three faults in our copy of
the official text, and one process gap (OOOO was visible to subscribers from the
import on). OOOO stays visible; nothing is public. Spending for this follow-up
was capped at $1.

### A. Our copy of the official text

1. **Tables 1–3.** The v1 layout algorithm fused Table 3's repeated page-break
   header into a body row ("§ 60.6 General Review of plans Subject of Yes. …")
   and split the two-line headers of Tables 1 and 2. The Import workflow gained
   an `ecfr_xml` input that fetches the subpart's eCFR versioner XML at the
   manifest's `as_of` date (`pipeline/sources/OOOO.xml`, `OOOOa.xml`,
   `OOOOb.xml`, `OOOOc.xml` are committed; the API refuses uncompressed
   responses, so the step sends `Accept-Encoding`), and `oooo` now takes its
   tables from the XML like JJJJ/IIII/ZZZZ (`table_algorithm="xml"`). After the
   re-import Table 3 reads `§ 60.6 | Review of plans | Yes.` with a four-cell
   header, and Tables 1 and 2 keep their `H₂S content` / `Sulfur feed rate`
   two-row header with the exponents as superscripts.
2. **The EPA e-mail address.** Checked against the eCFR versioner XML, not the
   print: the XML of OOOO and OOOOa itself prints `Oil__and__Gas__PT@EPA.GOV`
   (§ 60.5413(e)(6), § 60.5413a(d)(12), § 60.5420a(b)(10)) and
   `Oil____and____Gas____PT@EPA.GOV` (§ 60.5420(b)(8), § 60.5413a(e)(6)); OOOOb
   and OOOOc print `Oil_and_Gas_PT@EPA.GOV`. So it is not our transcription
   error, and the official text stays exactly as printed. Each of the five rows
   now carries an EssentialRegs `[sic]` marker whose tooltip says the eCFR prints
   the address with doubled underscores and names the OOOOb/OOOOc form
   (`pipeline/curated_sic.json`); the seven summaries give
   `Oil_and_Gas_PT@EPA.GOV` and say the rule prints it differently. The note is
   logged as `transcription_corrected` ("EssentialRegs note added to our copy of
   the official text: 1 [sic] marker").
3. **Equations.** The eCFR publishes every display equation of these subparts
   as a GIF; the text layer has nothing at its position. Gaps counted from the
   XML (`<img>` elements) and placed by the new
   `import_ecfr.insert_ecfr_image_notes`:

   | Subpart | Images in the XML | Equations | Figures | Inline symbols | What the reader sees now |
   |---|---|---|---|---|---|
   | OOOO | 10 | 9 | 1 (Tutwiler burette, § 60.5408) | 0 | 9 transcriptions (`pipeline/curated_equations.json`, read from OOOO.pdf pages 16, 17, 21, 33, 34, 39; § 60.5406(c)(1) checked against OOOOb's legible print of the same equation), 1 placeholder |
   | OOOOa | 30 | 20 | 1 | 9 (§ 60.5432a variables) | 30 placeholders |
   | OOOOb | 37 | 27 | 1 | 9 (§ 60.5432b variables) | 37 placeholders |
   | OOOOc | 7 | 7 | 0 | 0 | 7 placeholders |

   A transcription is the GP12 form: readable markup, a copyable plain-text
   line, a note "Equation transcribed by EssentialRegs from page N of OOOO.pdf …"
   and a link to the official paragraph. A placeholder is the visible line
   "Equation not reproduced here. See the official source: 40 CFR 60.5413b(b)(3)(ii)"
   (Figure / Symbol for the other kinds), linked to the eCFR paragraph. Every
   image of the four subparts is placed (test
   `EcfrImageNoteSourceTests.test_every_image_is_placed`); no gap is silent. The
   eight OOOO summaries that said "the equation itself is not shown" now state
   the transcribed formula. Both kinds of note are EssentialRegs notes: the
   source text check strips them, the apply step classifies the change as
   markup-only (no summary regeneration) and logs it as `transcription_corrected`.
4. **Source text check.** Three corpus-side checks, each a failure when it hits
   (`pipeline/source_text_check.py`, tests in `test_source_text_check.py`): a
   table header row repeated in the body or its words fused into a body row;
   a run of two or more underscores in an e-mail address or URL (a `[sic]`
   marker directly after it counts as acknowledged); an equation lead-in
   ("as follows:", "using Equation …:", "following equations:", "by:") followed
   directly by "Where:" with nothing between. On the re-parsed four subparts:
   0, 0, 0, 0 hits. The pre-existing extraction differences on OOOOb (1) and
   OOOOc (11) are the print's group headings and a list the diff aligns oddly,
   not gaps in the stored text.

### B. Summaries

5. **"75 percent".** The ten summaries no longer say "unavailable for at least
   75 percent": each says a deviation occurs when valid monitoring data are
   available for less than 75 percent of the operating hours in a day, quotes
   the rule's phrase and cites the paragraph that requires 75 percent
   (§ 60.5417(e), § 60.5417a(e), § 60.5417b(e)(1), § 60.5417b(i)(6)(ii),
   § 60.5417c(i)(6)(ii)). Writer rule 11 and reviewer allowance 4 (ambiguous
   negation: quote the phrase, name the requirement, never paraphrase into the
   opposite) are in `summarize.py` and `review.py`.
6. **§ 60.5371's suspension.** Every summary under § 60.5371 (18), § 60.5371a
   (18) and § 60.5371b (42) now opens with "§ 60.5371 does not apply between
   July 31, 2025, and January 22, 2027; it applies after January 22, 2027."
   (the section summaries already said so). Why the ancestor rule missed it:
   the writer's rule 5 tells the model to carry an ancestor's limit but, in the
   same breath, not to fold "an applicability date or a scope qualifier into a
   sub-paragraph it does not govern"; a section-wide suspension read as an
   applicability date and was left out, and the reviewer's context rule (a)
   named only who/when/condition limits. Both rules now say a suspension or
   applicability window an ancestor states for the whole section binds every
   provision under it and must be carried with its dates. Short rows (under
   25 words, the summarizer's headings-only rule) have no summary and need none.
7. **Smaller corrections.** § 60.5385 (a choice of (a)(1), (a)(2) or (a)(3);
   the 36 months from startup for a new compressor), § 60.5420(b)(8) (the
   e-mail route is the route for manufacturer-tested combustors),
   § 60.5417(f)(2)(i) and (g) (paragraphs (c)–(g) reach centrifugal compressor
   control devices through (a); storage vessel devices are under (h)),
   § 60.5417(h)(2) (paragraph (h)'s scope and its exemption for
   manufacturer-tested models), § 60.5420(b)(7) (the CBI procedure and the
   delegated-authority copy).
   The re-import's chained run regenerated the three table rows and the root
   ($0.07): the reviewer, reading Table 1 as flat text, moved its formula out of
   the three feed-rate columns the cell spans and dropped Table 2's exponents, so
   `summarize.strip_html` now lays a table out one row per line with its spans
   named and turns `<sup>` into `^(…)`; both table summaries were rewritten by
   hand from the table's rows and re-reviewed with the rest.
8. **Review and embedding.** 108 hand-edited rows were set to `pending`
   (`summary_original` kept, a `summary_regenerated` row with the reason on each,
   the same path as the admin "save as pending" button); the chained run reviews
   only the rows it writes, so the Review workflow was run on the four subparts
   and the Embed workflow re-embedded the changed rows.

   | Run | Rows | Result | Cost |
   |---|---:|---|---:|
   | Import `oooo` execute + chained run (37722142204) | 15 changed (12 note-only, 3 tables), 4 regenerated (3 tables + root) | 2 pass, 2 corrected, 0 pending | $0.0723 |
   | Import `ooooa` / `oooob` / `ooooc` execute (37722147794, 37722153035, 37722158421) | 20 / 28 / 7 note-only changes | nothing to summarize | $0 |
   | Review workflow (37723194309), `claude-sonnet-5-5` | 109 pending rows (oooo 36, ooooa 24, oooob 46, ooooc 3) | 90 pass, 19 corrected, 0 fail | $0.3366 |
   | Embed workflow ×4 (`voyage-3.5-lite`) | changed hashes only | re-embedded, neighbours rebuilt | < $0.01 |
   | Second review of 3 rows the reviewer had stripped (below) | 3 | see below | ≈ $0.01 |

   Every row of the four subparts is `approved`; nothing is pending. Of the
   19 corrections, 16 tightened wording the reviewer could check (an
   acronym expanded, a unit, a "may include" read as optional, § 60.5371b's
   exemptions); three struck statements the user asked for -- § 60.5417(g)'s
   "valid data for 75 percent" with its pointer to paragraph (e), and the
   paragraph (a) / paragraph (h) allocation in § 60.5417(g) and (f)(2)(i) --
   as "not in the text", because the reviewer saw only the provision, its
   descendants and its ancestors. The reviewer's input now carries the own
   text of every sibling paragraph or section a summary cites
   (`review.cited_rows`, context rule (d)), the three rows were restored by
   hand and reviewed again (run 37726960232): § 60.5417(g) and § 60.5417a(g)
   passed as restored (valid data for less than 75 percent, paragraph (e)
   cited; the (a) / (h) allocation in § 60.5417(g)); § 60.5417(f)(2)(i) was
   corrected a second time -- with paragraphs (a) and (h) in front of it the
   reviewer still holds that paragraph (f) says nothing about (a) or
   § 60.5380 and that the section's lead-in covers storage vessels and
   centrifugal compressors alike, so that summary describes the condenser
   curve rule under (f) without the allocation. That one is a judgment call
   for the Cowork session: the allocation is in (g) and the text of (a) and
   (h) is one click away in the reader. Total spent on this follow-up: about
   $0.43 of the $1 approved.

### C. The gate

9. **What `is_public` controls today, and only this:** which rows an anonymous
   visitor may read -- the four `/sample` rows (policy "public can read public
   provisions"; `provision_path()` returns their breadcrumb). It never hid a
   document from a subscriber: the "subscribers can read all provisions"
   policy, `has_full_access()` inside the SECURITY DEFINER Ask functions and
   the app's service-role reads (regulation roots, the preview teaser, the
   cached reader body) read every reg_key. That is why OOOO was in the
   reader, keyword search, Ask and the Federal index for every subscriber from
   the import on, and why 55 provisions in eleven documents could link to it.

   **The staged state** (migration `20261008040000_regulation_release_state.sql`,
   applied to the live project through the Supabase MCP in pieces):
   `regulation_releases(reg_key, status staged | released)`. No row = released;
   every existing document, OOOO included, is seeded released (OOOO stays
   visible: hiding it would break the links). `apply --execute` inserts a
   `staged` row the first time it writes a reg_key and prints
   `NEW DOCUMENT: <reg> is STAGED`. While staged: subscribers cannot read its
   rows (RLS on `provisions` and `provision_neighbors`), so the reader's live
   path, `/regs/<id>`, the provision preview API, keyword search
   (`search_provisions` is SECURITY INVOKER) and related provisions return
   nothing; `match_provisions` and `match_provisions_hybrid` skip its rows and
   embeddings unless the caller is service_role; `changelog_public` leaves it
   out; the app's service-role reads (`src/lib/release.ts`) drop it from the
   Federal / States / GP indexes, `/sample`, the sitemap, the preview and the
   cached reader -- `loadReaderPage` checks `isVisible` before the entitlement
   gate, and an admin on `ADMIN_EMAILS` still opens it; the admin review queue
   reads with the service role so staged rows can be reviewed; `dump-ids`
   leaves its ids out of `corpus_ids.json` and writes `corpus_staged.json`,
   which `parse` uses to drop it from `CORPUS_REGS` (whole-document links) for
   every document but itself. `python pipeline/import_ccr.py release --reg X
   --yes` (Actions → **Release regulation**) flips it to released; then
   `dump-ids`, the markup-only re-imports of the citing documents and the
   evals. Tests: `scripts/reader-gate.test.ts` (isVisible first; a staged
   document 404s entitled or not), `scripts/release.test.ts`
   (`filterReleased`), `pipeline/test_import_ccr.py` (dump-ids exclusion, the
   link gate, `ensure_release_row`). Checklist: `pipeline/README.md` step 4.

### D. Release

10. One pull request for the branch (import, wiring, these fixes), merged on
    green; the chained runs also opened their own sample pull requests (#77
    for the import, #78 for the 4-row re-import of the tables and the root).
