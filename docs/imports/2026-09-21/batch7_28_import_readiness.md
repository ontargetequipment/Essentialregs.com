# Reg 28 — import readiness report

## Verdict: READY WITH NOTES

All nine gates pass. The notes are (1) three citations in the source point at
subsections the source never prints, (2) five printed sub-headings stay as the
row's first paragraph instead of becoming its `title` — established corpus
behaviour, not a Reg 28 defect — and (3) the effective date in the brief
(06/17/2026) is not printed anywhere in the PDF, whose own Editor's Notes stop
at 11/14/2025. Details below.

## Regulation identity

- Printed title page (`sources/REG_28.txt` lines 17-21, confirmed against the
  PDF text layer): `REGULATION NUMBER 28 BUILDING BENCHMARKING AND PERFORMANCE`
  / `STANDARDS` (the name wraps onto two lines) / `5 CCR 1001-32`.
- `root_citation` = `Code of Colorado Regulations · Regulation Number 28`
- **`root_title` = `BUILDING BENCHMARKING AND PERFORMANCE STANDARDS 5 CCR 1001-32`**
  — the two printed title lines joined, with the `REGULATION NUMBER 28 ` prefix
  stripped, plus the cite: the same convention as Reg 3/12/19/26/27/30.
- CCR cite: 5 CCR 1001-32. Issuing body CDPHE-APCD, jurisdiction `state`,
  source_url `https://cdphe.colorado.gov/aqcc-regulations`.
- Effective date: the brief gives 06/17/2026 (ruleVersionId 12565, ruleId 3408)
  and that is what I recorded in `sources/manifest.json`. **The PDF itself never
  prints that date**: its Editor's Notes (last page) read "New rule eff.
  10/15/2023." and "Rules Part A, III O.2, III O.4, IV A, Part C, I B.1.d,
  I B.1.d(i), 1 B.1.d(ii), II F, Part F II eff. 11/14/2025.", and the last
  statement of basis is "Adopted: September 17-19, 2025". The PDF's own
  CreationDate is 2026-06-20, which is consistent with it being the print of the
  06/17/2026 version, so this is most likely an un-noted re-publication —
  worth one check before the freshness job treats 12565 as authoritative.
- 57 PDF pages; 2,961 lines in the `pdftotext -layout` dump.
- Parts found: **A–F**, exactly the printed outline —
  A Applicability and General Provisions, B Benchmarking and Reporting
  Requirements, C Building Performance Standards and Compliance Pathways,
  D Recordkeeping, E Penalties, F Statements of Basis, Specific Statutory
  Authority and Purpose.
  (The front-matter outline spells Part F "Statement of Basis, Specific
  Statutory Authority, and Purpose"; the body heading — which is what the row
  carries — spells it "Statements of Basis, Specific Statutory Authority and
  Purpose". Left exactly as the body prints it.)

## Row counts

- **282 rows total**: 1 root, 6 parts, 17 sections, 258 items.
- Rows per part (the `PART x` row included in its own part's count):
  A 81, B 73, C 108, D 12, E 4, F 3, plus the root.
- Top-level sections per part, in order:
  A `I.`–`V.` (Purpose, Applicability, Definitions, Annual fee, Severability),
  B `I.`–`II.`, C `I.`–`III.`, D `I.`–`II.`, E `I.`–`III.`, F `I.`–`II.`
- Part A Section III is the definitions list: **51 rows**, `III.A.` … `III.YY.`
  (A–Z then AA–YY), one row per defined term.
- Rows with ≥25 words of visible text (these get summaries): **152**
  (A 46, B 39, C 59, D 4, E 2, F 2).
- Longest row: `sec-28-F-I`, 54,541 chars / 7,533 words — the August 17 2023
  statement of basis, one undivided entry (see gate D and gate F).

## Changes made to import_ccr.py (each one, one line, with the reason)

1. `CORPUS_REGS["28"] = "28"` — so a "Regulation Number 28" citation resolves to
   this regulation instead of landing in the `other_reg` bucket.
2. `REG_META["28"]` — root row citation/title and the apply-time
   jurisdiction/issuing-body/source-url columns; no layout flags are set,
   because Reg 28 is an ordinary dotted-path Part A–F document.
3. `SOB_PART_CONFIG["28"] = {letter: "F", top_family: "roman_seq",
   top_opener_re: ^Adopted:?\s, inner_items: False}` — Part F is a two-entry
   roman sequence with the "Adopted:" keyword opener; `inner_items: False`
   because the entries' narrative hard-wraps citation-shaped fragments onto
   line starts ("2030." at REG_28.txt line 2295, "EUI." at 2332) that
   CYCLE_C_INNER would otherwise take for digit markers, the failure shape that
   produced the Reg 2/24/25 swallowed-entry rows.
4. `KNOWN_TEXT_FIXES["28"]` — one entry, `"Section IlI.O." -> "Section III.O."`
   (see "Label fixes added").
5. **New reg-gated capability `CAPTIONED_LAYOUT_TABLES` + the helper
   `_rebuild_captioned_layout_tables()` and `_CAPTIONED_LAYOUT_NUM_RE`, plus one
   call to it in `parse_reg` right after `extract_tables_from_pdf`** — rebuilds
   a captioned, borderless, multi-page table with stacked (multi-line) name
   cells from the layout text and writes it into `tables_by_caption` under its
   caption, replacing whatever the pdfplumber walk assembled, so the existing
   caption path in `build_provisions` renders it with no other change. Needed
   for Reg 28's Part C Table 1 (see gate H). It returns `[]` and touches nothing
   for any reg without an entry, and `CAPTIONED_LAYOUT_TABLES` has exactly one
   key ("28") — asserted by a test.

Nothing else in import_ccr.py was touched; no existing dict entry, function or
branch was modified.

Outside the patches: `sources/manifest.json` gained a `"28"` entry
(`kind: sos`, `ccr: 5 CCR 1001-32`, `ruleId: 3408`, `deptID: 16`,
`agencyID: 7`, `ruleVersionId: 12565`, `effective_date: 2026-06-17`) so
`freshness.py` tracks the document. `test_freshness.py` still passes (75).

## Label fixes added

| printed | corrected | source line | why |
|---|---|---|---|
| `Section IlI.O.` | `Section III.O.` | `REG_28.txt` line 62 (Part A, II.A.) | The roman numeral is printed capital-I / lower-case-L / capital-I — confirmed in the PDF's own text layer, page 1, not a pdftotext artifact. No roman token matches "IlI", so the citation was not even recognised as a citation and the one pointer telling a reader where "covered building" is defined went unlinked. It now links to `sec-28-A-III-O`. Applied through `KNOWN_TEXT_FIXES` rather than `KNOWN_LABEL_FIXES` because it is a citation inside body text, not a label at a line start — the same call the Reg 20 `V.b.2.q.` fix makes. Reported **OK (1 hit)**. |

No `KNOWN_LABEL_FIXES`, `KNOWN_CONTINUATION_LINES` or `KNOWN_LABEL_ANOMALIES`
entries were needed: every label sequence in the document is already contiguous
(gate E).

## Quality-gate results A–I

**A. Structure — PASS (with one cosmetic note).** The parsed tree has exactly the
printed Parts A–F in order, and exactly the printed top-level sections under
each (A I–V, B I–II, C I–III, D I–II, E I–III, F I–II), matching both the
front-matter outline and the body headings. The four front-matter `PART x` lines
are correctly skipped (`find_body_start` takes the last "PART A …" match, at
line 50). *Note:* 5 non-SOB rows print a short heading above their body text
with a blank line between, so the heading becomes the row's first paragraph and
`title` stays the bare citation — `sec-28-A-V` ("Severability"), `sec-28-C-I`
("Compliance pathways"), `sec-28-C-II-A` ("Adjusted Timeline"), `sec-28-C-II-B`
("Standard Performance Target Adjustments"), `sec-28-C-II-C` ("Adjusted
Performance Target for Under-Resourced Buildings"). No text is lost. This is
exactly what the live corpus already does (`sec-30-B-III` reads "Emission
Control Measures" the same way in `out/base_30.json`), so it is left alone —
changing it would break Reg 30's required byte-identical baseline.

**B. Coverage — PASS.** Body words after the cover page and page furniture:
19,345. Words across all parsed `full_text`: 19,011 (ratio 0.983). A token-level
bag diff accounts for **every** one of the 351 missing tokens: 239 are citation
labels, which IMPORTER_SPEC says to keep out of `full_text` (the app re-inserts
them as a badge), and 112 are the Table 1 caption + header block reprinted on
the three continuation pages and rendered once. **Zero words of prose are
missing.** Separately, the 85-word "materials incorporated by reference"
front-matter paragraph (lines 41-48) sits before `PART A` and is not imported —
Reg 25 and Reg 26 print the identical paragraph and it is likewise absent from
their baselines, so this matches the corpus.

**C. Repeated-text heuristic — PASS.** First-50-characters of every paragraph in
every row: **0 rows** have any prefix recurring ≥3×. (Run over all 282 rows;
also asserted by a test.)

**D. Giant / fused rows — PASS.** Ten longest: `sec-28-F-I` 54,541;
`sec-28-C-I-B-2-a-(iv)` 7,530; `sec-28-F-II` 5,525; `sec-28-C-I-B-1` 1,597;
`sec-28-B-II-A-1` 1,126; `sec-28-B-I` 1,021; `sec-28-B-I-A-5` 1,007;
`sec-28-A-III-BB` 941; `sec-28-A-III-QQ` 928; `sec-28-B-I-A-4` 889. Only one row
is over 15,000 chars: `sec-28-F-I`, the August 17 2023 statement of basis, which
is 892 printed lines of narrative kept deliberately as one entry
(`inner_items: False`) — it starts "Adopted: August 17, 2023" and ends with its
own "(V) The rule will maximize the air quality benefits…" finding, i.e. it does
not run into entry II. `sec-28-C-I-B-2-a-(iv)` is 7,530 chars because it carries
the 79-row Table 1; its own prose is one sentence.

**E. Orphans and label anomalies — PASS.** 282 ids, **0 duplicates**, **0
orphans** (every `parent_id` resolves), and every item id is its parent's id
plus one token. All **62** sibling groups are contiguous with no gap or jump
(romans I…, uppers A…Z then AA…, digits 1…, lowers a…, paren-lowers (i)…) —
checked mechanically, 62 checked / 0 unchecked / 0 mismatches, so no
`KNOWN_LABEL_FIXES` entry was needed. The continuation-line guard flagged 62
marker candidates and rejected 4; all four are wrapped citation fragments, not
labels, and I confirmed each against its source line: line 635 and 673
("I.C. or I.D., must demonstrate…" — the tail of "…in Part C, Sections I.B. …"),
line 916 ("II.C.1. through II.C.4. CEO may request…"), line 1454 ("II.C. and
demonstrate that the building owner has achieved compliance"). A test pins that
exact list. One printed singleton is genuine, not a parser gap:
`sec-28-C-II-C-3-b-(i)` is the only "(i)" under II.C.3.b. in the source.

**F. Statement-of-basis part — PASS.** Part F. `top_family: "roman_seq"` with
the `^Adopted:?\s` keyword opener (the Reg 2/6/21/27/30 shape), `inner_items:
False`. Both top-level entries parsed to their own row in order:
`sec-28-F-I` opening "Adopted: August 17, 2023" and `sec-28-F-II` opening
"Adopted: September 17-19, 2025", with nothing hanging below either (asserted
by a test). Their "Basis" / "Specific Statutory Authority" / "Purpose" /
"Applicability" / "Findings of Fact" sub-headings are unlabelled prose and stay
paragraphs; their "(I)"–"(V)" findings lists are upper paren-roman, which
CYCLE_C_INNER never starts with. `sec-28-F-II` also carries the trailing
Editor's Notes, exactly as `sec-30-C-III` / `sec-26-C-IV` / `sec-25-C-III` do in
the live corpus.

**G. Cross-references — PASS, with 3 dangling source citations.** 222
`<span class="xref">` spans, every `data-target` resolving to a row that exists
(asserted by a test). Bare-part references: Part A 10, B 14, C 64, D 1, E 2,
F 1; deep targets: under A 17, B 14, C 89, D 1, E 1; 8 self-references to
`sec-28-top-REG-28`. **Reg 28 cites no other corpus regulation at all**, so the
`other_reg`, `cfr` and `historical` buckets are empty and there are zero
`xref-external-reg` anchors — correct, not a gap. The `unparseable` bucket holds
**3 citations, 1 mention each, and all three are drafting errors in the source,
not parser gaps**: Part C `I.B.1.c.(iii)` cites "Sections II.C.1. through
II.C.4." and `I.B.1.d.(i)` cites "Part B. Sections II.C.1. through II.C.5.", but
Part B's II.C. prints only II.C.1–II.C.2 and Part C's II.C. only II.C.1–II.C.3,
so II.C.4. and II.C.5. exist nowhere; and the 2023 statement of basis cites
"Section II.B.3.b.", but Part C's II.B.3. has no lettered children (the
paragraph it quotes, "covered buildings with significant variations in
operations…", is actually at II.C.3.). The range endpoints that *do* exist all
linked. One further gap worth recording, deliberately not fixed: "1 CCR 212-3"
(Colorado Marijuana Enforcement Division, in III.E. and III.EE.) is a non-AQCC
Colorado CCR cite that no bucket recognises — `other_ccr` is scoped to Reg 20's
California Title 13 — so it is silently left as plain text rather than reported.
Adding a generic Colorado-CCR bucket would change other regulations' unresolved
reports, so it is out of scope here.

**H. Tables — PASS.** One table: Part C **"Table 1 – Property Type Site EUI and
GHG Intensity Targets"**, printed across PDF pages 25–28 with its caption and a
seven-line header block reprinted on each page. Neither existing mechanism fit
it. pdfplumber *does* find a table on each page, but splits the four numeric
columns across twelve detected columns and scatters the header over six
near-empty rows (`['Adult Education', None, '53.1', '', '42.6', '', '3.3', None,
None, '1.9', None, None]`), so the generic caption walk produced a 12-column
mess with the caption as a header row and only one page's data —
`TABLE_CAPTION_SPANS` would only have concatenated more of the same.
`LAYOUT_TEXT_TABLES` rebuilds from layout text but assigns one physical line to
one row by column centre, and this table has no header line carrying all five
column centres ("Property Type" is printed alone, vertically centred, three
lines down) and 8 of its 78 data rows print a name cell stacked over two or
three physical lines ("Hospital (General Medical &" / "Surgical)  217.6 …", and
"Convenience Store with Gas" / "  205.9 …" / "Station" — the numbers vertically
centred *inside* a three-line name). The new `CAPTIONED_LAYOUT_TABLES` path
classifies each line by its cells and reassembles those stacked names. Result:
**one 5-column table, 78 data rows + header, every row exactly 5 cells**, header
`Property Type | 2026-2029 Site EUI (kBtu/SF) | 2030-2050 Site EUI (kBtu/SF) |
2026-2029 GHG Intensity (kg CO2e/SF) | 2030-2050 GHG Intensity (kg CO2e/SF)`,
first row `Adult Education | 53.1 | 42.6 | 3.3 | 1.9`, last `Zoo | 98.3 | 78.8 |
6.1 | 3.5`, and the wrapped names come out whole ("Convenience Store with Gas
Station", "Hospital (General Medical & Surgical)", "Personal Services
(Health/Beauty, Dry Cleaning, etc.)"). 78 matches the 78 property types I
counted by hand across the four pages (19 + 20 + 19 + 20). It renders in
`sec-28-C-I-B-2-a-(iv)`, whose own prose sentence survives above it; no other
row carries a `<table>` or a stray caption line.

**I. Tests — PASS.** `python3 -m pytest -q test_import_ccr.py` →
**436 passed, 144 skipped** (144 skip because this working directory only
carries the six source documents it needs; the pristine
`test_import_ccr.ORIGINAL.py` run against my edited `import_ccr.py` gives
418 passed / 144 skipped, i.e. **no regressions**, and my 18 new tests bring it
to 436). `python3 -m pytest -q test_summarize.py` → **205 passed, 2 skipped**
(196 + my 9 new). `python3 -m pytest -q test_freshness.py` → 75 passed.
All three together: **716 passed, 146 skipped**. New
tests: `Reg28MetaTests` (corpus/meta/SOB config, the text fix and its no-op for
other regs, self-reference and external linking with and without 28 in the
corpus), `CaptionedLayoutTablesTests` (config shape, stacked-name reassembly,
replacement of a pdfplumber table of the same caption, and no-op for other regs
and for a missing caption), `Reg28FullParseTests` (row counts, structure, no
duplicates/orphans, the 51 definitions, the text fix hitting once and linking,
the two SOB entries, the rebuilt Table 1, cross-references including the exact
unparseable set, furniture/repeat checks, and the exact list of rejected marker
candidates). Reg 7's full-parse test was OOM-killed once on the shared box and
passed on retry after 60 s, as the brief warns.

## No-op proof (both directions)

Baselines used as given: `out/base_26.json`, `out/base_30.json`,
`out/base_25.json`, `out/base_7.json`, `out/base_ecmc.json`.

Environment note: `sources/` shipped with PDFs but no `.txt` for the baseline
documents, so I regenerated them with `pdftotext -layout` and verified each is
**byte-identical** to `../base/sources/<name>.txt`. I also had to copy
`REG_CP.txt` (and `REG_CP.pdf`) in from `../base/sources/`: without it
`_cp_known_ids()` returns an empty set and Reg 26's `sec-26-B-IV-A-1` loses its
two Common-Provisions anchors, so `import_ccr.ORIGINAL.py` could not reproduce
`base_26.json` at all. With it, `import_ccr.ORIGINAL.py` reproduces
`base_26.json` byte-for-byte — the environment is sound.

1. **With `"28"` removed from `CORPUS_REGS`** (everything else in my edited
   `import_ccr.py` left in place): Reg 26, Reg 30, Reg 25, Reg 7 and ECMC all
   parse **byte-identical** to their `out/base_*.json` (`cmp` clean, 5/5).
2. **With `"28"` present**: Reg 26, Reg 30, Reg 25, Reg 7 and ECMC *also* parse
   **byte-identical** to their baselines (`cmp` clean, 5/5).
   `strip_reconstruct.py <base> <with28> 28` on all five:
   `rows: 626 / 444 / 993 / 2182 / 6754; changed rows: 0; anchors added:
   {'28': 0}; unexplained: 0`.

**Anchors created: 0 — and that is correct, not a miss.** A grep of every
source document in `../base/sources/` for "Regulation Number 28", "Regulation
No. 28", "Regulation 28" and "5 CCR 1001-32" returns hits in `REG_28.txt` and
nowhere else. Reg 28 is a 2023 programme that no other AQCC regulation, the
Common Provisions, ECMC, the general permits or the CFR subparts cite. The
`CORPUS_REGS` entry is still required so that Reg 28's **own** eight
"Regulation Number 28" self-mentions resolve to `sec-28-top-REG-28` (they do)
and so a future regulation that cites it links rather than bucketing; the
linking behaviour in both directions is covered by
`Reg28MetaTests.test_regulation_number_28_links_from_other_regs`, which asserts
the anchor appears with 28 in the corpus and the `other_reg` bucket hit appears
without it.

Five printed differences with the source phrase, as the brief asks for, cannot
be listed: there are none. The five listed above are the five documents, each
with a zero-difference `cmp`.

## Deliverables

- `out/reg28_parsed.json` (282 rows), plus the sidecars
  `reg28_parsed_corrections.json` (1 text fix, OK/1 hit),
  `reg28_parsed_duplicate_ids.json` (`[]`), `reg28_parsed_unresolved.json`,
  `reg28_parsed_marker_audit.json` (62 candidates, 4 rejected).
- `out/reg28_db.json` = `[]` (brand-new regulation, no DB access from here).
- `out/reg28_diff_report.md` — 282 parsed / 0 DB / 282 only-parsed / 0 only-DB /
  0 page-furniture leaks / 0 lowercase-start rows.
- `out/apply_reg28/` — plan.json, stats.md and two SQL files (217,401 bytes,
  one statement each). **All three sanity checks PASS**: every parent_id in the
  final state exists, no id in both the delete and upsert sets, every obsolete
  id resolved to a surviving ancestor. 282 ids to feed
  `summarize.py --ids-file`.
- `reg28.patch` (import_ccr.py + test_import_ccr.py vs the ORIGINALs) and
  `reg28_summarize.patch` (summarize.py + test_summarize.py vs the ORIGINALs).
  Both verified: applied with `patch -p0` to fresh copies of the four ORIGINAL
  files, the results are byte-identical to my working files.

## Things I could not resolve (be specific)

1. **Three citations to subsections the source never prints** —
   `sec-28-C-I-B-1-c-(iii)` cites "Sections II.C.1. through II.C.4."
   (REG_28.txt line 1152), `sec-28-C-I-B-1-d-(i)` cites "Part B. Sections
   II.C.1. through II.C.5." (line 1187), and `sec-28-F-I` cites "Section
   II.B.3.b." (line 2665). II.C.4., II.C.5. and II.B.3.b. do not exist in either
   part. They stay plain text and are reported in the `unparseable` bucket.
   This is a defect in the regulation, not in the parser; nothing to fix here,
   but the summarizer must not invent what those subsections say.
2. **"1 CCR 212-3"** (III.E., III.EE.) is recognised by no unresolved-reference
   bucket, so it is left as plain text without being reported. Fixing that needs
   a generic non-AQCC Colorado CCR bucket, which would change other
   regulations' reports — out of scope for a reg-scoped change.
3. **Five printed sub-headings stay as the row's first paragraph** rather than
   becoming the row's `title` (listed in gate A). Established behaviour across
   the corpus; changing it would break Reg 30's byte-identical baseline.
4. **The 06/17/2026 effective date is not printed in the PDF** (gate:
   "Regulation identity"). I recorded the brief's value in the manifest; someone
   should confirm ruleVersionId 12565 against the Secretary of State before the
   freshness job relies on it.
5. `sources/manifest.json` and the two regenerated baseline `.txt` files (plus
   the copied `REG_CP.txt`/`REG_CP.pdf`) are **not** in either patch — the
   manifest snippet is quoted above so it can be merged by hand.

## Anything the summarizer should be warned about for this regulation

`REG_AUDIENCE["28"]` = *"an owner or property manager of a large commercial or
multifamily building in Colorado"* — the reader is a building owner, not an oil
and gas EHS person.

`REG_PROMPT_HINTS["28"]` (186 words) covers:

- **"CEO" means the Colorado Energy Office** (Part A, III.N.), *never* a chief
  executive officer. This is the single highest-risk acronym in the document:
  it appears in almost every operative sentence ("submit to the CEO", "a CEO
  approved form", "the CEO executive director"), and a mis-expansion would make
  the rule read as if a company officer, not a state agency, approves
  compliance. The hint says so explicitly.
- **"Division" is the Air Pollution Control Division and "Commission" the
  AQCC** — but note the division of labour the statement of basis spells out:
  CEO administers benchmarking and the performance standards, the Division
  enforces. A summary should not attribute a CEO duty to the Division.
- **Applicability and definitions are confined to their own sections.** Per the
  Batch 6 Reg 21 lesson, the hint states that Part A, Section II states
  applicability and Part A, Section III defines every term, and then forbids
  repeating or inferring applicability, coverage, an exemption or a definition
  on any other row: *"describe only what the row in front of you says."* Reg 28
  has no area/nonattainment scoping at all, so there is nothing for a geographic
  tag to latch onto — the risk here is instead a guessed 50,000 sq ft or
  "public building" qualifier being pasted onto rows that carry none.
- **Defined terms**: "covered building", "public building", "under-resourced
  building", "building owner", "gross floor area", "benchmarking tool", "site
  EUI" and "weather-normalized" mean only what Section III says. Watch
  "covered building" in particular: III.O. carries four exclusions
  (III.O.1–III.O.4: storage/parking/unconditioned hangar, majority
  manufacturing or industrial, single-family/duplex/triplex, agricultural) that
  live on their own rows.
- **Numbers verbatim**: 50,000 sq ft; the $500,000 / 25% renovation trigger for
  public buildings (II.B.); the $100 annual fee, due June 1 and, from calendar
  2026, November 1 (IV.A.) with public buildings exempt (IV.B.); civil penalties
  of up to $500 then $2,000 (Part E I.) and up to $2,000 then $5,000 (Part E
  II.), with public building owners exempt (Part E III.); and every reporting
  deadline (June 1, 2024; the June 1, 2028 pathway election; December 31, 2025 /
  December 31, 2029 adjustment applications; January 31, 2027 / January 31,
  2031). Never round or convert.
- **Table 1 is per-property-type.** The hint tells the model to point at the
  table rather than restate a value and *never to apply one property type's
  target to another* — 78 property types share one table, and a "Restaurant"
  number pasted onto "Retail Store" would be a factual error.
- **ENERGY STAR Portfolio Manager and the ENERGY STAR Portfolio Manager Building
  Emissions Calculator are named tools** — name them, do not describe what they
  compute.
- **Part F is rulemaking history**, not current requirements; its two entries
  are the longest rows in the regulation and both are narrative.

Two further things the hint does not spell out but a reviewer should know:
the three dangling citations in item 1 of "could not resolve" (the model must
not invent II.C.4./II.C.5./II.B.3.b. content), and the acronyms the document
actually uses — EUI (energy-use intensity, III.SS./III.TT.), BPS (building
performance standards, III.L.), GFA (gross floor area, III.Z.), GHG, and PUE
(power usage effectiveness, Part C I.C.). Expand each only the way this
document does.
