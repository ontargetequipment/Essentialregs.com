# JJJJ / IIII / ZZZZ — federal engine rules import readiness report

## Verdict: READY (all three)

*(Updated again after the coordinator supplied the eCFR full-text XML —
see the revised Gate H section below for the full per-table proof.)*

All three subparts parse cleanly end to end (structure, ids, cross-references,
diff/apply) with no missing sections, no duplicate ids, no orphaned parents,
and no page-furniture leaks. The previous verdict on this report
(JJJJ/IIII READY WITH NOTES, **ZZZZ NOT READY**) was because five tables —
`sec-zzzz-TABLE-1a/2c/2d/4` and `sec-jjjj-TABLE-2` — still rendered as word
soup after the pdfplumber-based reconstruction, whose column geometry could
not be made to hold reliably across tables that reflow over many PDF pages.
The coordinator then supplied the eCFR XML for the same as-of-date, which
carries every table as real `<TABLE>`/`<THEAD>`/`<TBODY>`/`<TFOOT>` markup —
no reconstruction needed at all. All 24 numbered tables across the three
subparts (4 in JJJJ, 8 in IIII, 12 in ZZZZ) now match their XML source
exactly and render with correct row/column separation, preserved
colspan/rowspan and sup/sub, and footnotes as trailing paragraphs rather
than fused into cells. `sec-zzzz-TABLE-1a`'s first cell is now the literal
string "1. 4SRB stationary RICE", nothing else. See Gate H for the full
per-table proof.

## What was built

`import_ecfr.py` was generalized from its OOOOa/b/c-only hard-wiring into a
`SUBPART_META`-driven module covering all six eCFR subparts (`ooooa`,
`oooob`, `ooooc`, `jjjj`, `iiii`, `zzzz`), while proving the three original
outputs are **byte-identical** to their baselines (`cmp out/ooooX_check.json
out/ooooX_baseline.json` — all three pass — and the same check is now a unit
test, `OoooByteIdenticalBaselineTests`). New capabilities (suffix-less
section numbers, Part 63, alphanumeric table numbers, a single-row Appendix,
"Table N to this subpart" linking, a second table-reconstruction algorithm)
are all gated per-reg in `SUBPART_META` so they are a no-op for OOOOa/b/c.

## Regulation identity

| Key | Citation | Title (as printed) | Pages | Sections | Tables |
|---|---|---|---|---|---|
| `jjjj` | 40 CFR Part 60 Subpart JJJJ | Standards of Performance for Stationary Spark Ignition Internal Combustion Engines | 40 | § 60.4230–60.4248 (19) | 1–4 |
| `iiii` | 40 CFR Part 60 Subpart IIII | Standards of Performance for Stationary Compression Ignition Internal Combustion Engines | 43 | § 60.4200–60.4219 (20) | 1–8 |
| `zzzz` | 40 CFR Part 63 Subpart ZZZZ | National Emission Standards for Hazardous Air Pollutants for Stationary Reciprocating Internal Combustion Engines | 103 | § 63.6580–63.6675 (26 present; 63.6620 has no printed paragraph (e) — see Gate E) | 1a,1b,2a,2b,2c,2d,3,4,5,6,7,8 + Appendix A |

All three PDFs are eCFR "enhanced display" prints "up to date as of
9/17/2026", same format family as OOOOa/b/c.

## Row counts

| Key | Total rows | root | heading | section | item | table/appendix (`kind: appendix`) | rows ≥25 words | longest row |
|---|---|---|---|---|---|---|---|---|
| `jjjj` | 205 | 1 | 20 | 9 | 171 | 4 | 134 | `sec-jjjj-60.4248` (definitions, 12,983 chars) |
| `iiii` | 288 | 1 | 23 | 7 | 249 | 8 | 186 | `sec-iiii-60.4219` (definitions, 9,424 chars) |
| `zzzz` | 360 | 1 | 28 | 13 | 305 | 13 | 228 | `sec-zzzz-APPENDIX-A` (22,977 chars) |

Every id is unique, every `parent_id` resolves, and `sections: TOC == body`
for all three (no missing/extra sections, no `toc_title_mismatches`).

## Changes made to `import_ecfr.py` (see `ecfr.patch` for the full diff)

1. Replaced `SUBPART_LETTER`/`SUBPART_CODE`/`ECFR_URL`/`CORPUS_REGS`/
   `LETTER_TO_REG` with a single `SUBPART_META` table (`part`, `code`,
   `suffix`, `sections` range, `url`, `enable_table_ref_links`,
   `table_algorithm`); the four old dicts are now derived views of it so
   nothing downstream had to change names.
2. `_norm_reg` validates against `SUBPART_META` keys instead of three
   hard-coded strings.
3. Added `_resolve_target_reg(part, num, suf)`: OOOOa/b/c are still told
   apart by letter suffix inside the 5300-5499 range (the exact original
   rule, unchanged); JJJJ/IIII/ZZZZ (no suffix) are told apart by their own
   section-number range within their CFR part (`SUBPART_META[...]["sections"]`).
4. `SECTION_LINE_RE`/`RANGE_RESERVED_RE` widened from a hard-coded `60\.` to
   `(?:60|63)\.` and the letter suffix made optional (`[a-c]?`); group
   numbering is unchanged so every existing `.group(N)` call still works.
5. `find_body_start` takes an optional `heading_re` (defaults to the
   original OOOO-only regex); `parse_ecfr` builds a per-subpart heading/
   table/appendix caption regex from `SUBPART_META` (`code`, `part`).
6. Table numbers are kept as printed strings, not cast to `int` (ZZZZ's
   "Table 1a"/"2c"/etc.).
7. New `appendix` block type + caption regex: ZZZZ's Appendix A becomes ONE
   row, `sec-zzzz-APPENDIX-A`, kind `appendix` — its own numbering (1.0 /
   3.1.5 / 6.2.12 …) is not the CFR `(a)(1)(i)(A)` cycle, so per the brief it
   is not parsed into a tree of children.
8. `link_citations`: the OOOO-only in-range check was refactored into
   `_resolve_target_reg` (identical behavior for OOOOa/b/c, generalized for
   the rest); `PART_REF_RE`'s part-number group widened 3→4 digits (counts
   bare "40 CFR part 1048/1039/1042/1054/1065" mentions — this only changes
   what's *counted* in the unresolved-reference report, never the emitted
   row text, so it doesn't touch OOOO's row-JSON bytes); added a
   `"part NN, subpart Xxxx"` branch (the reversed order from
   `SUBPART_REF_RE`'s `"subpart X of this part"`) that resolves to a
   cross-reg link when the part+code match a corpus reg — needed because
   JJJJ cites "40 CFR part 63, subpart ZZZZ, Table 2a" in exactly that word
   order; added `TABLE_REF_RE` ("Table N to this subpart") gated by
   `SUBPART_META[...]["enable_table_ref_links"]` (`True` for jjjj/iiii/zzzz,
   `False` for ooooa/b/c specifically so their baselines stay byte-identical
   — OOOO's own text also contains this phrase, so turning it on for them
   too would change their output).
9. New `rows_from_layout_block_v2` + `_dedupe_repeated_runs` (see Gate H).
   `SUBPART_META[...]["table_algorithm"]` picks `"v1"` (untouched, OOOO) or
   `"v2"` (jjjj/iiii/zzzz) per table.
10. All hard-coded `"60."`/`Part 60`/`OOOO{suffix}` string formatting in the
    block-to-row conversion (range-reserved id/citation, table citation,
    root citation/title) now uses the reg's own `part`/`code` from `meta`.

None of the above changes OOOOa/b/c's behavior: proven with
`cmp out/ooooX_check.json out/ooooX_baseline.json` (all three exact) and
codified as `OoooByteIdenticalBaselineTests` in the test suite.

## Label fixes / line deletions added

None needed. `KNOWN_LABEL_FIXES`/`KNOWN_LINE_DELETIONS` are untouched (no
new entries) — no misprinted labels or garbled overprint lines were found in
JJJJ/IIII/ZZZZ during the review below.

## Quality-gate results (A–I)

**A. Structure.** Each subpart's group headings ("What This Subpart Covers",
"Emission Standards for Manufacturers", …) and section order match the
PDF's own table of contents exactly — `n_sections_toc == n_sections_body`
and `toc_title_mismatches == []` for all three. **PASS.**

**B. Coverage.** Parsed `full_text` word count vs. the furniture-stripped,
TOC-excluded body: JJJJ 15,476/16,930 = 91.4%; IIII 15,728/16,172 = 97.3%;
ZZZZ 31,256/38,385 = 81.4%. ZZZZ's lower ratio is concentrated in its
longest multi-page tables (Table 6 spans ~10 printed pages, Table 8 spans
~15): `_dedupe_repeated_runs` intentionally removes the running header (and,
in a few tables, a reprinted footnote block) that the eCFR print repeats at
every page break — a spot check of Table 6 and Table 8 against the source
PDF confirmed every data row/column is present and nothing substantive was
dropped, only the mechanical repeats. **PASS, with the ZZZZ ratio explained**
rather than fully reconciled line-by-line — flagging this so it can be
independently re-checked.

**C. Repeated-text heuristic.** One hit across all three subparts:
`sec-jjjj-60.4244-(g)` has "Where:" repeated 3× — a standalone equation
variable-definitions lead-in, legitimately repeated once per formula in that
paragraph, not a bug. **PASS.**

**D. Giant/fused rows.** Longest rows are `sec-jjjj-60.4248` (12,983 chars,
definitions), `sec-iiii-60.4219` (9,424 chars, definitions), and
`sec-zzzz-APPENDIX-A` (22,977 chars, the entire single-row Appendix A, by
design — see item 7 above). All three are legitimately long content (a
definitions section, or a deliberately single-row appendix), not fused
siblings. **PASS.**

**E. Orphans and label anomalies.** No duplicate ids, no orphaned
`parent_id` in any of the three (`report["duplicate_ids"] == []` for all
three; every `parent_id` resolves — asserted by
`FullFileSmokeTest_{jjjj,iiii,zzzz}`). One apparent label gap was
investigated and confirmed correct-to-source: `§ 63.6620` in ZZZZ jumps
`(a)(b)(c)(d)` straight to `(f)` — the PDF itself has no printed paragraph
`(e)` (verified directly against the source text; this is the real
regulation's own numbering, not a misprint), so no `KNOWN_LABEL_FIXES`
entry was needed. **PASS.**

**F. Statement of basis.** Not applicable — federal eCFR subparts don't
carry a Colorado-style "Statement of Basis" part.

**G. Cross-references.** All three resolve same-subpart absolute/relative
references, other-subpart-in-corpus links (including the reversed
`"40 CFR part 63, subpart ZZZZ, Table 2a"` phrasing JJJJ uses to cite ZZZZ —
now a cross-reg link), and correctly bucket General-Provisions and
engine-certification-part references as `cfr_not_in_corpus`:

| Key | unresolved mentions | `cfr_not_in_corpus` (top) | `other_subpart` (top) | `unparseable` |
|---|---|---|---|---|
| `jjjj` | 82 | 71 (33 part 1054, 17 part 1048, 4 part 1060, …) | 11 (part 1060/1048/1068/1065 subpart C, subpart A of this part) | 0 |
| `iiii` | 61 | 55 (25 part 1039, 14 part 1042, 2 part 1068, …) | 6 (part 1068/1039/1042 subpart C/F) | 0 |
| `zzzz` | 96 | 85 (§ 63.9(k), § 63.2, part 60, part 70, 40 CFR 89.112, …) | 10 (subpart HHH/A/E of this part) | 1 (`paragraph (2) of this section`) |

The single ZZZZ `unparseable` hit is one relative reference whose target
paragraph didn't survive as its own row (a wording variant not covered by
`RELREF_RE`'s pattern set) — low-impact, noted for a future tokenizer pass,
not a no-op-for-OOOO candidate since fixing the general pattern could touch
OOOO's own relative-reference output. **PASS.**

Reg 26 / Reg 30 / GP02 / GP06 / GP12 aren't in this working directory, so
their new-link counts can't be measured here; as a proxy, JJJJ/IIII/ZZZZ's
*own* source text mentions each other 63/75/158 times (`subpart jjjj` /
`subpart iiii` / `subpart zzzz`, case-insensitive) — the actual cross-corpus
link counts against Reg 26/30/GP02/GP06/GP12 need to be measured at merge
time against those regs' real source text.

**H. Tables — critical, especially for ZZZZ (fixed with the eCFR XML source).**
The pdfplumber word-coordinate approach in the previous round of this
report fixed some of what the coordinator flagged but honestly could not
reconstruct column geometry reliably across a table that reflows over many
PDF pages — five tables (`sec-zzzz-TABLE-1a/2c/2d/4`, `sec-jjjj-TABLE-2`)
still rendered as word soup. The coordinator then supplied the eCFR
"full text" XML for the same as-of-date as the PDFs
(`sources/{JJJJ,IIII,ZZZZ}.xml`), which sidesteps the whole PDF-layout
reconstruction problem: every table is real `<TABLE class="gpo_table">`
markup with `<THEAD>`/`<TBODY>`/`<TFOOT>` rows and `<TD>`/`<TH>` cells,
already correctly segmented by the government's own typesetting.

*What was implemented.* A fourth algorithm, `"xml"`, is now
`SUBPART_META[...]["table_algorithm"]` for jjjj/iiii/zzzz (OOOO stays on
`"v1"` and never reads any XML — re-verified byte-identical via `cmp` after
this change). Per table:
1. `load_xml_tables` parses the XML with `xml.etree.ElementTree` (it is
   well-formed; the only entities used are numeric character references,
   e.g. `&#xA7;`, `&#x2014;`) and indexes every `<DIV9 N="Table ... to
   Subpart ... of Part ...">` block by the SAME normalized-caption key the
   PDF-derived caption text produces, so a table block found while parsing
   the PDF/txt (ids, structure, cross-references, everything else stays on
   the existing PDF/txt pipeline) is matched to its real XML markup purely
   by caption text.
2. `<E T="...">` typographic wrapper tags (e.g. around the "a"/"b" in
   "Table 1<E T="01">a</E>") are dropped but their text is kept, so the
   caption reads "Table 1a", not "Table 1"; `<sup>`, `<sub>`, and `<br/>`
   are kept as real inline HTML in the rendered cells.
3. `render_xml_table_html` builds the `<table>` straight from the XML
   elements: `<thead>`/`<tbody>` rows verbatim, `colspan`/`rowspan`
   preserved from the source attributes, `<TFOOT>` rows rendered as a
   trailing `<p class="table-footnote">` after the table (not inside a
   cell), and the caption's lead-in `<P>` (e.g. "As stated in §§ 63.6600
   and 63.6640, you must comply with the following…") as a
   `<p class="doc-table-lead-in">` before the table. Where a caption has
   multiple `<TABLE>` elements, their `<TBODY>` rows are concatenated in
   document order (implemented and tested; not needed by any of the 24
   real tables here — see below — but present for a future subpart that
   does split one caption across multiple `<TABLE>`s).
4. `sanitize-html` on the app side allows `table/thead/tbody/tr/td/th` plus
   `colspan`/`rowspan`/`class` attributes and has `sup`/`sub` in its
   defaults per the coordinator; nothing this renderer emits falls outside
   that set (`<br/>` is also a standard sanitize-html default).

*Proof — every table, in full.* All 24 numbered tables across the three
subparts were checked: caption → XML match, rows×cols, first data row's
first two cells. **All 24 matched; none fell back to `v2`.**

| Reg | Tables | XML matches | Notes |
|---|---|---|---|
| jjjj | 4 | 4/4 | Table 1: 17×9, Table 2: 16×5, Table 3: 20×4, Table 4: 29×4 |
| iiii | 8 | 8/8 | Tables 1–8: 12×6, 5×5, 5×2, 22×5, 4×2, 4×4, 17×5, 20×4 |
| zzzz | 12 | 12/12 | Tables 1a–8: 3×3, 4×2, 6×3, 7×2, 24×3, 31×3, 6×3, 15×5, 29×3, 44×3, 8×4, 95×4 |

Root cause of the earlier JJJJ/IIII table count vs. the JJJJ/ZZZZ raw
`<TABLE>` element count (5 in JJJJ's XML, 15 in ZZZZ's) traced and
explained rather than left as a mismatch: JJJJ has one extra `<TABLE>`
embedded directly in ordinary section body text (a small-engine emission-
standards table inline in a section, not a "Table N to Subpart" appendix
caption — out of scope, never matched by the PDF/txt parser as a table
block either), and ZZZZ has three such orphan in-body tables. All of them
are unrelated to the 24 numbered appendix tables this gate covers.

Per-table check for the specific tables the coordinator asked to be
eyeballed (all now clean):

- `sec-zzzz-TABLE-1a`: first data row is `["1. 4SRB stationary RICE",
  "a. Reduce formaldehyde emissions by 76 percent or more...", "Minimize
  the engine's time spent at idle..."]` — **the label cell is now exactly
  "1. 4SRB stationary RICE", nothing else fused in.** This is the literal
  string the coordinator asked to verify.
- `sec-zzzz-TABLE-2c` (24 rows), `-2d` (31 rows), `-4` (15 rows), `-6`
  (44 rows): each numbered item ("1.", "2.", "3.", …) is its own clean
  row/cell; footnotes render as trailing `<p class="table-footnote">`
  paragraphs after `</table>`, not fused into a data cell.
- `sec-jjjj-TABLE-1` (17×9) and `sec-jjjj-TABLE-2` (16×5, the one that was
  still word soup after the pdfplumber round): both now match the XML
  exactly, one row per engine class/requirement.
- `sec-iiii-TABLE-1` (12×6) and `sec-iiii-TABLE-2` (5×5): both matched and
  clean (these were already clean under `v2`; now also XML-verified).

Not done (explicitly out of scope for this pass, flagged rather than
silently skipped): ZZZZ Appendix A was **not** re-sourced from the XML —
the coordinator marked this optional ("keep the row" as the minimum bar),
and the existing PDF/txt-derived single Appendix A row already meets that
bar; revisiting it from the XML is a good small follow-up but wasn't
required to close this gate.

**Gate H verdict: READY. All 24 tables across JJJJ, IIII, and ZZZZ render
correctly with real column separation, preserved `colspan`/`rowspan` and
`sup`/`sub`, and footnotes as trailing paragraphs, not fused into cells.**
The earlier pdfplumber algorithm (`rows_from_pdfplumber_table`) is left in
the file, tested, and now unused by any `SUBPART_META` entry — dead but
documented code, not deleted, in case a future subpart has no matching XML
and needs it as a fallback.

**I. Tests.** `python3 -m pytest -q test_import_ecfr.py` — **67 passed**
(26 original + 35 from the earlier rounds: `SubpartMetaTests`,
`SectionRangeResolverTests`, `TableAndAppendixIdTests` incl.
`_dedupe_repeated_runs`/`_ROW_ANCHOR_RE` unit tests, one full-parse
structure test per new subpart (`FullFileSmokeTest_jjjj/iiii/zzzz`),
`ZzzzAppendixTests`, `ZzzzTableIdTests`, `OoooByteIdenticalBaselineTests`
gated on the baseline files + 6 new `XmlTableFixtureTests`: an inline XML
fixture covering `<E>` wrapper drop, `<sup>`/`<sub>`/`<br/>` preservation,
colspan, and TFOOT-as-trailing-paragraph, plus live checks that ZZZZ Table
1a's first cell is exactly "1. 4SRB stationary RICE" and that every real
JJJJ/IIII table matches its XML). **PASS.**

## Things I could not fully resolve

- (Resolved.) The five tables previously flagged as word soup
  (`sec-zzzz-TABLE-1a/2c/2d/4`, `sec-jjjj-TABLE-2`) are fixed now that
  table content comes from the eCFR XML rather than being reconstructed
  from the PDF — see Gate H. Left in place for the record: `v1`/`v2`/the
  pdfplumber algorithm remain in the file (untouched, tested, unused) as a
  fallback path for a future subpart that has PDF/txt sources but no
  matching XML.
- ZZZZ Appendix A was not re-sourced from the XML (optional per the
  coordinator — "at least keep the row" was the bar, and the existing
  PDF/txt-derived single row already meets it). A good small follow-up,
  not required to close Gate H.
- ZZZZ Appendix A's Figure 1 (a blank data-recording form, referenced but
  not populated in the CFR text itself — see lines describing "record all
  data on Figure 1") renders as its literal wrapped ASCII/ditto-mark text
  inside the single Appendix A row; it's a blank form in the source, not a
  data table, so nothing is actually lost, but it reads oddly as prose.
- One ZZZZ relative reference (`"paragraph (2) of this section"`) landed in
  the `unparseable` bucket (Gate G) — a single low-impact miss.
- Reg 26 / Reg 30 / GP02 / GP06 / GP12 cross-link counts are not measurable
  from this directory (their source files aren't here); only same-corpus
  mention counts were reported (Gate G) as a proxy.

## Summarizer warnings

- **Administrator** = the EPA Administrator (not a state official) in all
  three; **"you"** = the owner/operator (2nd person imperative throughout,
  same convention as OOOOa/b/c).
- **SI vs. CI**: JJJJ = Spark Ignition engines; IIII = Compression Ignition
  engines; ZZZZ (NESHAP) covers both. Do not conflate "SI" and "CI" — they
  have different emission standards and different sections.
- **Emergency vs. non-emergency engines** are separately regulated
  throughout all three subparts, often in adjacent sections with very
  similarly worded titles (e.g. IIII § 60.4201 "non-emergency" vs. § 60.4202
  "emergency" manufacturer standards) — do not merge their requirements in a
  summary.
- **Model-year and hp/kW thresholds must be kept verbatim** — these subparts
  are built entirely around numeric tiers (model year cutoffs, HP/KW
  breakpoints, ppmvd/g/HP-hr limits) that live in the Table rows; a
  paraphrased number is very likely wrong.
- **RICE** (Reciprocating Internal Combustion Engine, ZZZZ's term of art),
  **HAP** (Hazardous Air Pollutant), **CO as a surrogate for formaldehyde**
  (ZZZZ explicitly allows CO monitoring/limits to stand in for formaldehyde
  compliance in several tables — do not describe CO and formaldehyde limits
  as independent), **2SLB/4SLB/4SRB/NSCR/oxidation catalyst** are all
  defined terms of art used precisely and consistently — expand on first
  use, don't reword afterward.
- **JJJJ/IIII certify to Part 1048/1039 standards** — these are named,
  specific mobile/nonroad-engine-certification cross-references (40 CFR
  Part 1048 for JJJJ/SI, Part 1039/1042 for IIII/CI, plus Parts 1054, 1060,
  1065, 1068) that the summarizer should **name, not describe** (they are
  out-of-corpus CFR parts — see Gate G's `cfr_not_in_corpus` bucket).
- **ZZZZ's Tables carry the actual limits** (1a/1b/2a/2b/2c/2d for
  limitations, 3/4 for testing, 5/6 for compliance, 7 for reporting, 8 for
  General Provisions) — a summary of a ZZZZ section should point to the
  applicable table by number rather than restate numeric limits that live
  only in the table.
- **Area source vs. major source of HAP** is a load-bearing distinction in
  ZZZZ — many requirements differ entirely between the two source types
  (see Tables 2c vs. 2d); don't summarize "existing stationary RICE
  requirements" without specifying which source type.
- **"this subpart"** always means the subpart in question (JJJJ, IIII, or
  ZZZZ respectively) — never the Part's General Provisions (Subpart A),
  which is always cited by its own number (§ 60.1–60.19 / § 63.1–63.15).

## Deliverables produced

- `import_ecfr.py` (generalized) / `test_import_ecfr.py` (extended, 61
  tests) — diff vs. `*.ORIGINAL.py` in `ecfr.patch` (applies cleanly to both
  ORIGINAL files, verified with `patch --dry-run`).
- `import_ccr_touchpoints.patch` — proposed, NOT applied to
  `import_ccr_for_reference.py` in place, per the brief. Verified in an
  isolated copy: applies cleanly, compiles, and `cmd_parse`/`diff`/`apply`
  all produce identical output to calling `import_ecfr.py` directly, with
  `jurisdiction_level=federal`/`issuing_body=EPA`/correct `source_url` now
  populated in the generated SQL (previously would have silently fallen
  back to the Reg-7-style state/CDPHE-APCD defaults). Contents: `CORPUS_REGS`
  gets `jjjj`/`iiii`/`zzzz`; new `ECFR_REGS` set replaces the
  `args.reg.lower().startswith("ooo")` dispatch check (which never matched
  the new keys) in `cmd_parse`; `CFR_SUBPART_TO_REGKEY` gets `JJJJ`/`IIII`/
  `ZZZZ` (documented as safe without part-number gating since none of the
  six corpus codes collide across Part 60/63); `REG_META` gets all three
  entries (federal/EPA/eCFR URL/root citation+title).
- `out/jjjj_parsed.json`, `out/iiii_parsed.json`, `out/zzzz_parsed.json` +
  their `_report.json` files.
- `out/jjjj_db.json`, `out/iiii_db.json`, `out/zzzz_db.json` (`[]`).
- `out/jjjj_diff_report.md`, `out/iiii_diff_report.md`,
  `out/zzzz_diff_report.md` (each: 100% `only_parsed`, 0 `only_db`, as
  expected for a brand-new import against an empty DB export).
- `out/apply_jjjj/`, `out/apply_iiii/`, `out/apply_zzzz/` (`plan.json`,
  `stats.md` — all sanity checks PASS — `01_upsert_*.sql`,
  `summary_regen_ids.txt`).
- `out/ooooa_baseline.json` / `oooob_baseline.json` / `ooooc_baseline.json`
  reproduced byte-for-byte by the generalized module (confirmed with `cmp`;
  codified as `OoooByteIdenticalBaselineTests`).
