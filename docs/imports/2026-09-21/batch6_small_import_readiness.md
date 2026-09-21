# Batch 6 (agent_small) — import readiness report: Reg 16, SIP Local Elements (`sip`), Reg 18

Deliverables in `/home/claude/working/er/batch6/agent_small/`:

- `reg16_sip_18.patch` — `import_ccr.py` + `test_import_ccr.py` against the ORIGINALs (applies cleanly with `patch -p0`, verified on fresh copies).
- `reg16_sip_18_summarize.patch` — `summarize.py` + `test_summarize.py` against `summarize.ORIGINAL.py` / `test_summarize.ORIGINAL.py` (copied first, as instructed).
- Per key: `out/reg<key>_parsed.json`, `out/reg<key>_db.json` (`[]`), `out/reg<key>_diff_report.md`, `out/apply_reg<key>/` (all three sanity checks PASS for every key).
- No-op proof: `out/base_{26,30,25,7,ecmc}.json` (ORIGINAL importer, one parse per subprocess, sequential), `out/noop_batch6/<key>_{with,without}.json` (merged importer via `prove_noop_batch6.py`), all byte-identical (`cmp` + md5 below).
- Tests: `python3 -m pytest -q test_import_ccr.py` -> **397 passed, 7 skipped** (368 + 29 new; one run had the pre-existing Reg 7 subprocess test SIGKILLed while my ECMC/Reg 7 no-op parses ran concurrently on the shared box — re-run alone: passes). `python3 -m pytest -q test_summarize.py` -> **173 passed, 2 skipped** (163 + 10 new).

## Changes made to import_ccr.py (shared by all three keys — each one line, with the reason)

New config keys / mechanisms (every one a no-op for a reg that does not set it):

1. `CORPUS_REGS`: `"16"`, `"sip"`, `"18"` added.
2. `REG_META["16"]`, `["sip"]`, `["18"]`: `no_parts: True`, state/CDPHE-APCD, root citation/title (exact titles below), plus the new flag `seam_paragraph_breaks: True` on all three, and `preamble_heading: "INTRODUCTION"` on `sip`.
3. `REG_META` flag **`seam_paragraph_breaks`** (new, `clean_pages`): every page seam is a paragraph break. Reason: these short SOS prints never wrap a paragraph across a page (checked all 8 / 21 / 5 seams of REG_16/REG_SIP/REG_18.txt); the default seam splice fused page-opening headings onto the previous page's last sentence ("...Adopted: November 15, 2001 The November 15, 2001 amendments...", "...federal act. Statutory Authority", "c. Alternative Sanding Materials Experimentation with..."). Strictly wider than Reg 27's `seam_standalone_line_breaks`; `clean_pages` is byte-identical for every other reg.
4. `REG_META` flag **`preamble_heading`** (new, part-less regs only) + marker type `"preamble"` in `scan_markers` / `build_provisions`: the SIP document's unlabeled "INTRODUCTION" (with its "A."/"B." paragraphs) printed before Section I becomes one row `sec-sip-INTRODUCTION` (kind `section`, citation "Introduction", parent root, appendix-shaped full_text). Reason: text before the first marker is otherwise dropped, and the bare ladder's chain only opens on "I." so "A."/"B." can hang nowhere. Decision on the brief's question: **a preamble row, not root-row text**; the two lettered paragraphs stay inline in it (label text included).
5. `BARE_LADDER_REGS` += `"sip"`; new **`BARE_LADDER_FAMILIES`** `{"sip": [roman, upper, digit, lower, bare_lroman, paren_lower]}` and `_bare_ladder_family(depth, reg)` (default list reproduces Reg 9's hard-coded roman/upper/digit/lower-forever exactly). Reason: SIP prints six bare levels ("I.", "A.", "1.", "a.", "i.", "(a)"); Reg 9's ladder stops at "lower".
6. `FAMILY_REGEX["paren_lower"]` (new, `^\(([a-z]{1,2})\)`): only ever named by `BARE_LADDER_FAMILIES["sip"]`; no CYCLE_AB/REG_CYCLE_AB/SOB cycle uses it.
7. New **`BARE_LADDER_LEAF_CHAINS`** `{"sip": {("VIII","F")}}` + `_bare_ladder_is_leaf_chain`: no child list opens under VIII.F. Reason: the Steamboat statement of basis has three unlabeled dated revision headings with three RESTARTING "1." lists; without this the first list became rows `-F-1..-4` and the rest folded into `-4`. Siblings "G." / next section "IX." still close it normally.
8. `_bare_ladder_tokens(stripped, chain, reg=None)`: new optional `reg` argument (passed from `scan_markers`); with `None`/unlisted reg the function is unchanged.
9. `SOB_PART_CONFIG["16"]`: `section "III"`, `letter_dated`, `roman_prefix "III"` (Reg 1/cp shape), opener `^[A-Z]` (III.A. is a bare date, III.B. is a topic line with "Adopted:" on the next paragraph — the compound "III.<next letter>." label is the whole signature), `inner_items False`.
10. `SOB_PART_CONFIG["18"]`: `section "II"`, `letter_dated`, `implicit_section_prefix` (bare "A." .. "G." like Reg 9), opener `REG9_SOB_OPENER_RE` (accepts "May 15, 1997", "Adopted: February 21, 2002" and "Adopted February 6, 2007"), `inner_items False`, plus new flag **`top_indent_ok`**.
11. `SOB_PART_CONFIG` flag **`top_indent_ok`** (new, in `_match_sob_top`): accept a top-level SOB entry at non-zero indent. Reason: Reg 18's entry "A. May 15, 1997" sits on page one inside the 4-space margin every CCR print's first page carries; the indent-0 rule rejected it and, since letter_dated only accepts the exact next letter, entries B–G went with it (the whole SOB fused into `sec-18-II`). Only Reg 18 sets it (test asserts that).
12. `KNOWN_LABEL_FIXES["16"]` (7 fixes) and `["sip"]` (3 fixes) — listed per key below; every fix reports `OK` (1 hit).
13. `KNOWN_LABEL_ANOMALIES["sip"]` (2 entries) — below.
14. **`SIP_LOCAL_ELEMENTS_RE`** + `link_citations` step 1.7: the SIP document is cited by NAME, never by number. Matches the printed title forms ("State Implementation Plan[,][-]Specific Regulation[s] for Nonattainment[ - ][Attainment/Maintenance] Areas [(Local Elements)] [Regulation]") and the SOB short form "SIP-Specific Regulations". Self-mention inside `sip` -> span to its root; another reg with `sip` in the corpus -> `<a href="/regulations/sip">`; otherwise `other_reg` bucket. Confirmed a no-op for every other source (`grep` of sources/*.txt: only REG_SIP and REG_AQS print either phrase; the Common Provisions' "local elements of the State Implementation Plan" does not match).

## No-op proofs (once, all three keys together)

Baselines built BEFORE any edit with `import_ccr.ORIGINAL.py`, one parse per subprocess, sequentially (`run_baselines.sh`; ECMC was OOM-killed once on the shared box and succeeded on the retry after 60 s): `out/base_26.json` (626 rows), `base_30.json` (444), `base_25.json` (993), `base_7.json` (2182), `base_ecmc.json` (6754).

After the edits, `prove_noop_batch6.py <key> with|without` (merged importer; `without` deletes 16/sip/18 from `CORPUS_REGS` at runtime), one parse per process:

| key | base md5 | with | without |
|---|---|---|---|
| 26 | faa49e19... | byte-identical | byte-identical |
| 30 | 6099113f... | byte-identical | byte-identical |
| 25 | 3466aa1d... | byte-identical | byte-identical |
| 7 | 76b12985... | byte-identical | byte-identical |
| ecmc | 767db4a3... | byte-identical | byte-identical |

`strip_reconstruct.py base with 16,sip,18` for all five: `changed rows: 0; anchors added: {'16': 0, 'sip': 0, '18': 0}; unexplained: 0`. So with the keys PRESENT there are **zero** new anchors in these five regs — correct, because none of them ever prints "Regulation Number 16/18", "Street Sanding", "Acid Deposition" or the SIP title (grep of sources/). The only other-reg mentions that WILL become links after the merge are in the AQS document (agent_aqs's key): REG_AQS.txt line 2048 "Regulation Number 16" (1 mention) and lines 1238/1261/1316 "SIP-Specific Regulations..." (3 mentions) — those resolve through the ordinary `REG_NUM_RE` path and the new step 1.7 once both agents' patches are merged. `test_import_ccr.py::Batch6SmallNoOpProofTests` re-checks Reg 26/30 against `out/base_26.json`/`base_30.json` in the suite.

---

# Reg 16 — import readiness report

## Verdict: READY

## Regulation identity
- Title as printed (REG_16.txt line 20): "REGULATION NUMBER 16 STREET SANDING EMISSIONS", cite line "5 CCR 1001-18".
- `root_citation`: `Code of Colorado Regulations · Regulation Number 16`
- `root_title`: **`STREET SANDING EMISSIONS 5 CCR 1001-18`**
- Effective 04/20/2007 (SOS ruleVersionId 1529, ruleId 2350); 9 pages, 503 lines. No PART headings (`no_parts`); three top-level sections.

## Row counts
- 71 rows: 1 root, 3 sections, 67 items. Rows with >=25 words: 37. Longest row `sec-16-III-A` 6,567 chars (the May 1999 statement of basis).
- Per section: I (Street Sanding Materials Specifications) 39 rows; II (Denver PM10 requirements) 26 rows; III (Statements of Basis) 3 rows (III, III.A, III.B).

## Changes made (Reg 16 specific)
`REG_META["16"]`, `CORPUS_REGS["16"]`, `SOB_PART_CONFIG["16"]`, `KNOWN_LABEL_FIXES["16"]`, `seam_paragraph_breaks` — see the shared list above (items 1–3, 9, 12).

## Label fixes added (printed -> corrected, source line, why)
All seven are in the PDF's own text layer (pdfplumber extracts the same glyphs; the page image confirms "II.C.6" without a dot) — a capital I for the digit 1, a capital C for the letter c, a comma / nothing for the trailing dot. None tokenized, so each item was folded into its previous sibling.
- `I.B.7,` -> `I.B.7.` (line 68)
- `I.C.I.` -> `I.C.1.` (line 78) and `I.C.I.b.` -> `I.C.1.b.` (line 85)
- `I.D.2.C.` -> `I.D.2.c.` (line 111)
- `I.E.I.` -> `I.E.1.` (line 134)
- `I.E.2.C.` -> `I.E.2.c.` (line 158)
- `II.C.6` -> `II.C.6.` (line 331; II.C.2. itself cites "II.C.6")
The regulation's own cross-references confirm the intended labels ("Section I.C.1.b.", "sections II.C.4, II.C.5 and II.C.6").

## Quality gates
- **A. Structure — PASS.** Printed outline: I (A Applicability, B Definitions 1–8, C Standards (1, 1.a, 1.b), D Testing (1–4), E Reporting (1–3), F, G); II (A.1, B.1–4, C.1–6, D.1–4 with D.1.a–f, E.1); III (A May 20, 1999; B April 19, 2001). Parsed tree matches exactly, in order.
- **B. Coverage — PASS.** Source body 3,625 words vs parsed 3,577 (98.7%); the difference is the 67 stripped label tokens (re-inserted as badges by the app).
- **C. Repeated text — PASS.** 0 rows with a 50-char paragraph prefix repeated >=3x.
- **D. Giant/fused rows — PASS.** Longest 6,567 (III.A), 3,575 (III.B), 1,680 (II.B.3 — the 19-paragraph Foothills boundary description, legitimately one row), then <600.
- **E. Orphans/labels — PASS.** 0 duplicate ids, 0 orphans, 0 sequence gaps after the seven fixes; sort_orders unique. Marker audit: 14 column-deviation flags (page-one 4-space margin), 0 rejected.
- **F. Statement of basis — PASS.** Section III, `letter_dated` with `roman_prefix "III"` — entries `sec-16-III-A` ("May 20, 1999") and `sec-16-III-B` ("Denver metropolitan area, redesignation..." / "Adopted: April 19, 2001"), one row each, inner "Basis/Authority/Purpose/Findings/Federal Requirements" headings kept as paragraphs.
- **G. Cross-references — PASS.** 11 same-reg spans (Section I.D.2.a., I.C.1.b., II.D.1., II.C.4/II.C.5, "Regulation 16"/"Regulation No. 16" -> root). 0 external anchors (Reg 16 cites no other corpus reg). Buckets: historical 1 ("V.C.4" — "Section V.C.4 of the Colorado Ambient Air Quality Standards Regulation", i.e. the AQS document, not this reg; correctly unlinked); unparseable 3, all printed typos or relative cites in the source ("Section C.I.b.", "Section I.D.2.C.", "Section D.3.") — left as text.
- **H. Tables — PASS (none).** pdfplumber finds 0 tables; the "fines/durability standards" are the two list items I.C.1.a/b, plain text, intact.
- **I. Tests — PASS.** `Batch6SmallConfigTests`, `Reg16LabelFixTests`, `Batch6SmallFullParseTests.test_reg16`.

## Things I could not resolve
- Printed text glitches kept as printed (they are in the PDF image, not extraction errors): II.D.1.d "typically sand ;d during c :h full deployment", I.D.4 "meets - e applicable standards", II.D.2 "the.information", II.D.4 "andincluding" / "June 30,2002". No KNOWN_TEXT_FIXES added (that convention is for extraction errors only).
- Items whose label line is a heading followed by body ("I.A. Applicability" + paragraph) take the corpus convention: title = citation, heading as first `<p>`.
- The Editor's Notes / History tail ("____", "Editor's Notes", "History") is folded into the last row (III.B), exactly as the Reg 26/30 baselines do.

## Summarizer warnings
Section I applies to governmental entities/contractors/suppliers in the AIR program area; Section II only in the Denver PM10 attainment/maintenance area; reductions are relative to uncontrolled 1989 levels; "Percent Fines"/"Durability Index"/"Base Sanding Amount"/"Foothills Area" per I.B/II.B; RAQC, CDOT, CBD; read through the print typos; III.A/III.B are history. `REG_AUDIENCE["16"]` = "a municipal public-works or street-maintenance manager in a Colorado PM10 area"; hint 189 words.

---

# SIP Local Elements (`sip`) — import readiness report

## Verdict: READY WITH NOTES

## Regulation identity
- Title as printed (REG_SIP.txt lines 20–21, two lines joined with a space): "STATE IMPLEMENTATION PLAN, SPECIFIC REGULATIONS FOR NONATTAINMENT-ATTAINMENT/MAINTENANCE AREAS (LOCAL ELEMENTS)", cite "5 CCR 1001-20". No "REGULATION NUMBER" line — hence the name key `sip`.
- `root_citation`: `Code of Colorado Regulations · SIP Local Elements`
- `root_title`: **`STATE IMPLEMENTATION PLAN, SPECIFIC REGULATIONS FOR NONATTAINMENT-ATTAINMENT/MAINTENANCE AREAS (LOCAL ELEMENTS) 5 CCR 1001-20`**
- Effective 12/30/2008 (ruleVersionId 2721, ruleId 2352); 22 pages, 1,296 lines. Source basename `REG_SIP`. No PART headings; bare labels at every level (BARE_LADDER_REGS).

## Row counts
- 173 rows: 1 root, 9 sections (INTRODUCTION + I–VIII), 163 items. Rows with >=25 words: 87. Longest row `sec-sip-VIII-F` 10,952 chars (Steamboat statement of basis, three dated revisions).
- Per section: INTRODUCTION 1; I Pagosa Springs 41; II Telluride 32; III Aspen/Pitkin 53; IV Lamar 1; V Canon City 1; VI Fort Collins (Repealed) 2; VII Colorado Springs 2; VIII Steamboat Springs 40.

## Changes made (sip specific)
Shared list items 1–8, 12–14 (`REG_META["sip"]` with `preamble_heading` + `seam_paragraph_breaks`, `BARE_LADDER_REGS/FAMILIES/LEAF_CHAINS`, `paren_lower`, `KNOWN_LABEL_FIXES["sip"]`, `KNOWN_LABEL_ANOMALIES["sip"]`, `SIP_LOCAL_ELEMENTS_RE`). No SOB config: each area carries its own statement of basis as an ordinary lettered subsection (I.D, II.C, III.D, VI.A, VII.A, VIII.F) or as the section's own body (IV, V); their inner dated entries become child rows where they follow a family (`sec-sip-I-D-1` "March 16, 2000"; `sec-sip-II-C-1` "August 17, 1995 revisions", `-2` "March 16, 2000"), else one row each (III.D, VI.A, VII.A, VIII.F) — exactly the brief's design, no new SOB mechanism.

## Label fixes added
- VIII.A. definitions: printed `3.`, `4.`, `5.` a second time (lines 947, 951, 956 — "Independent Laboratory", "Percent Fines", "Reserved") -> `6.`, `7.`, `8.`; VIII.B.2.a itself cites "VIII.A.7." for Percent Fines. Each match_prefix is unique in the document; all three report OK (1 hit).

## Label anomalies (kept as printed, `KNOWN_LABEL_ANOMALIES["sip"]`)
- `VIII.B.5.` prints its two items as `c.` and `d.` with no a./b. (lines 1006/1009 — the 2001 repeal of the reporting items evidently removed a./b. without relettering). Kept inline in `sec-sip-VIII-B-5` with the label text, not relabeled (that would invent citations).
- `I.C.2.c.` ends mid-sentence and `I.C.2.d.` continues it (lines 174–179) — a printed split; both rows kept as printed.

## Quality gates
- **A. Structure — PASS.** Printed outline: INTRODUCTION (A, B); I Pagosa (A Definitions 1–10, B 1–5, C 1–3, D SOB -> 1); II Telluride (A 1–3, B 1–2, C SOB -> 1–2); III Aspen/Pitkin (A, B 1–14 incl. 7/13 Reserved, C 1–4, D SOB); IV Lamar (body only); V Canon City (body only); VI Fort Collins Repealed (A SOB); VII Colorado Springs (A SOB); VIII Steamboat (A 1–8, B 1–6, C Reserved, D 1–4, E 1–3, F SOB). Parsed tree matches, in order; deepest chains `sec-sip-II-B-2-d-iii-(b)` and `sec-sip-III-C-1-e-i-(e)` (six levels).
- **B. Coverage — PASS.** 9,135 source body words vs 9,029 parsed (98.8%; the 163 stripped label tokens).
- **C. Repeated text — PASS.** 0 hits.
- **D. Giant/fused rows — PASS.** 10,952 (VIII.F — one deliberate leaf row: three dated revision blocks with restarting lists; see item 7), 3,559 (I.D.1), 3,559 (II.C.2 — the identical March 16, 2000 statement printed under both Pagosa and Telluride), 3,156 (III.D), 2,824 (VII.A), then <2,300.
- **E. Orphans/labels — PASS.** 0 duplicates, 0 orphans, 0 sequence gaps (checker treats the roman i./ii./... and (a)–(e) runs correctly); audit 17 column flags, 0 rejected.
- **F. Statement of basis — PASS (per-area, see above).** No trailing SOB section exists in this document; `_sob_scope("sip") == (None, None)` by design.
- **G. Cross-references — PASS with a note.** 12 same-doc spans: 11 name-mentions of the document's own title (SOB prose quoting "State Implementation Plan Specific Regulations for Nonattainment - Attainment/Maintenance Areas", "...-Specific Regulation for Nonattainment Areas", "SIP-Specific Regulations") -> root, plus `Sections I.C.2.a.`. 0 external anchors (nothing here names another corpus reg). Buckets: cfr 1 ("40 CFR Part 58"), unparseable 2 (relative "Section C.2." / "Section D.2." — correct). **Note:** 9 citations are written "Subsection B.4." / "Subsection I.B.2." / "Subsection C.1.b." / "VIII.A.7. above" — the tokenizer only knows "Section(s)", so these stay plain text (not counted in any bucket). Adding "Subsection" to `SECTION_RE` would touch every regulation's linker, so it is out of scope here; flagged for a corpus-wide pass.
- **H. Tables — PASS (none).** 0 tables in the PDF; none printed.
- **I. Tests — PASS.** `Batch6BareLadderExtensionTests`, `SipMiniParseTests` (a faithful cut-down fixture with page-one margin, footers, seams), `SeamParagraphBreaksTests`, `SipNameResolverTests`, `Batch6SmallFullParseTests.test_sip`.

## Things I could not resolve
- Sections IV (Lamar) and V (Canon City) have their heading and their SOB text with no lettered subsection; by the corpus convention they are `section` rows titled by citation ("IV.", "V.") with "Lamar Attainment/Maintenance Area" as the first `<p>` — same as any item whose heading line is followed by body. The sidebar will show "IV." / "V." for these two (and "III.D.", "VI.A.", "VII.A.", "VIII.F." for the SOB subsections).
- Definitions are ordinary item rows (kind `item`, not `definition`): the bare ladder has no term-extraction hook and the brief did not ask for one; titles show the citation or the one-line definition.
- Editor's Notes / History tail folded into the last row (VIII.F), as elsewhere in the corpus.

## Summarizer warnings
Every row is scoped to ONE area (named highways/streets/boundaries) — never "statewide"; standards differ by area (1% vs 2% fines, 30% durability, #200 sieve — unlike Reg 16's #100 sieve); "Division" is "Colorado Department of Health, APCD" in older text and "CDPHE, APCD" in newer text — as printed; ordinances/resolutions are incorporated local law with as-of dates; Reserved/Repealed rows have no requirements; SOB subsections and IV/V are history; the identical March 2000 statement appears twice (I.D.1, II.C.2). `REG_AUDIENCE["sip"]` = same public-works reader as Reg 16; hint 183 words.

---

# Reg 18 — import readiness report

## Verdict: READY

## Regulation identity
- Title as printed (REG_18.txt line 20): "REGULATION NUMBER 18 CONTROL OF EMISSIONS OF ACID DEPOSITION PRECURSORS", cite "5 CCR 1001-22".
- `root_citation`: `Code of Colorado Regulations · Regulation Number 18`
- `root_title`: **`CONTROL OF EMISSIONS OF ACID DEPOSITION PRECURSORS 5 CCR 1001-22`**
- Effective 12/15/2012 (ruleVersionId 4928, ruleId 2354); 6 pages, 354 lines. No PART headings; two top-level sections.

## Row counts
- 10 rows: 1 root, 2 sections, 7 items. Rows with >=25 words: 8. Longest `sec-18-II-C` 2,246 chars.
- Section I: 1 row (the whole operative rule, 5 paragraphs); Section II: 1 + 7 entries A–G.

## Changes made (Reg 18 specific)
Shared items 1–3, 10, 11 (`REG_META["18"]`, `SOB_PART_CONFIG["18"]` with the new `top_indent_ok`, `seam_paragraph_breaks`).

## Label fixes added
None needed.

## Quality gates
- **A. Structure — PASS.** The "heading the regex missed": Section I has NO heading at all — line 25 prints a bare "I." alone (4-space page-one margin), followed by five unlabeled paragraphs (incorporation by reference of 40 CFR Parts 72/76 as of July 1, 2011; the "permitting authority" and "Administrator" definitions; the Reg 3 precedence clause; the Commission's commitment on CAA sections 407/410). There are no A/B subsections. Parsed as `sec-18-I` (title "I.", kind section, 5 `<p>`). "II. Statement of Basis, Specific Statutory Authority and Purpose" -> `sec-18-II` with `sec-18-II-A` ... `-G`, in order.
- **B. Coverage — PASS.** 2,194 vs 2,185 words (99.6%).
- **C. Repeated text — PASS.** 0 hits.
- **D. Giant/fused rows — PASS.** All <=2,246 chars.
- **E. Orphans/labels — PASS.** 0 duplicates/orphans/gaps; audit 0 flags.
- **F. Statement of basis — PASS.** Section II, `letter_dated` with `implicit_section_prefix` (Reg 9 model, as the brief anticipated) and `REG9_SOB_OPENER_RE`: A "May 15, 1997", B "May 21, 1998", C "February 15, 2001" (bare dates), D "Adopted: February 21, 2002", E "April 17, 2003", F "Adopted February 6, 2007", G "Adopted October 18, 2012" — all seven openers verified in the parsed rows; each entry one row (`inner_items False`; entry B's indented "Exemptions"/"Other permitting" bullets are paragraphs).
- **G. Cross-references — PASS.** 1 external anchor: "Regulation No. 3" -> `/regulations/3` (Section I's precedence clause). 2 self spans ("Regulation No. 18" -> root, in II.C/II.D). Bucket cfr 1: "40 CFR Part 72" (Parts 72/76 are not in the corpus — correct). "40 C.F.R. parts 72 and 76" dotted forms in the SOB are plain text (`CFR_DOTTED_REGS` is Reg 8/12-only; nothing to link to anyway).
- **H. Tables — PASS (none).**
- **I. Tests — PASS.** `Reg18MiniParseTests` (incl. a test proving `top_indent_ok` is what admits entry A), `Batch6SmallFullParseTests.test_reg18`.

## Things I could not resolve
- `sec-18-I` has no heading text to title it; its title is the bare citation "I." (the print gives nothing else). Editor's Notes tail ("Regulations I, II.G eff. 12/15/2012.") folded into `sec-18-II-G`.

## Summarizer warnings
Section I is an incorporation by reference of 40 CFR Parts 72 and 76 (July 1, 2011 editions) — do not describe the federal Acid Rain Program's contents; the edition date is not a compliance date; "permitting authority" = APCD, "Administrator" = EPA Administrator; Title IV is delegated, not a SIP revision; Parts 72/76 take precedence over Reg 3 on conflict; II.A–G are history (which federal amendments each adoption picked up). `REG_AUDIENCE["18"]` = "an environmental manager at a Colorado electric utility or large combustion source"; hint 171 words.

---

## Summarizer patch summary (`reg16_sip_18_summarize.patch`)
- `REG_AUDIENCE["16"]`, `["sip"]` (public-works / street-maintenance manager in a Colorado PM10 area), `["18"]` (electric utility / large combustion source environmental manager).
- `REG_PROMPT_HINTS["16"]` (189 words), `["sip"]` (183), `["18"]` (171) — all <= 200.
- Tests: 10 new (`test_batch6_small_*`, `test_reg16_hint_covers_required_points`, `test_sip_hint_...`, `test_reg18_hint_...`), plus the existing `test_only_reg_11_overrides_the_audience` key-set assertion extended with the three keys (the same way Batch 5 added 12/25/27). No other reg's system prompt changes (leak test covers Reg 7/1/9/cp/25/27/ecmc/gp01).
