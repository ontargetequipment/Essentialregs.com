# ECMC (2 CCR 404-1) — import readiness report

## Verdict: READY (updated — see "Delta" section at the end)

The `rule_series` family is implemented, parses `sources/ECMC.txt` end to end
with no crashes, produces no duplicate ids (one benign appendix re-caption
merge) and no orphans, and both baseline regulations (Reg 1, Reg 26) are
byte-identical before/after. All nine quality gates were run. One content
gap remains and is listed below (two borderless noise tables render as
plain text instead of clean tables) — small, specific, and safe to fix
later without touching the rest of the parse. The other originally-noted
gap (a defined term folded under the wrong neighbor) has since been fixed
— see the Delta section.

**This report was updated after initial review** to reflect three fixes
requested by the reviewer (heading-row `full_text`, the 1100-series label
repeat, and the COMPLETION definition). See **"Delta: three fixes
requested after initial review, and re-verification"** at the end of this
document for exactly what changed and how it was re-verified. The body of
the report below (row counts, changes list, gate results) is the
**original** submission text and is superseded where the Delta section
says so (definitions count, ten-longest list, verdict).

## Regulation identity

- Title as printed (title page, ECMC.txt lines 1-24): the department/
  commission print "PRACTICE AND PROCEDURE" and "2 CCR 404-1" as the
  document's own printed title, even though the document covers far more
  than Part 500's "Rules of Practice and Procedure". `root_title` =
  `"PRACTICE AND PROCEDURE 2 CCR 404-1"`.
- CCR cite: **2 CCR 404-1**.
- Effective date on the PDF: **05/30/2026** (per ECMC_BRIEF.md; the History
  tail's last dated entries are "Appendix VII eff. 05/30/2026").
- Page count: **675** (ECMC.pdf).
- Structure found: **14 series** (100, 200, 300, 400, 500, 600, 700, 800,
  900, 1000, 1100, 1200, 1300, 1400 — the 1300 and 1400 headings are printed
  differently, "1300 Series – Deep Geothermal Operations" / "1400 Series -
  Class VI UIC", both still caught by the case-insensitive series regex),
  **225 rules**, **4 appendices** (III, VI, VII, IX), and an Editor's
  Notes/History tail.

## Row counts

- **Total rows: 6,753** (1 root + 14 series + 315 definitions + 225 rules
  ("section" kind) + 6,194 ladder items + 4 appendices).
- Rows per series (direct-child rule count, matching the printed rule-number
  ranges exactly):

  | Series | Rules |
  |---|---|
  | 100 (definitions) | 315 defined terms (no numbered rules) |
  | 200 | 24 (201-224) |
  | 300 | 16 (301-316) |
  | 400 | 37 (401-437) |
  | 500 | 30 (501-530) |
  | 600 | 16 (601-616) |
  | 700 | 7 (701-707) |
  | 800 | 11 (801-811) |
  | 900 | 15 (901-915) |
  | 1000 | 4 (1001-1004) |
  | 1100 | 5 (1101-1105) |
  | 1200 | 3 (1201-1203) |
  | 1300 | 20 (1301-1320) |
  | 1400 | 37 (1401-1437) |

  225 + 315 + 14 series + 4 appendices + 1 root = 6,753 (matches the
  parser's own count).
- Rows with >=25 words: **3,298**.
- Longest row: **`sec-ecmc-APPENDIX-VI`, 15,106 chars** — the Public Water
  Systems list (a long PWSID/name/date table flattened to text; justified,
  not a fused-row bug — see gate D). Next is `sec-ecmc-APPENDIX-IX` (Form
  41, 8,048 chars — a full legal form, one row by design) and
  `sec-ecmc-100-DEF-FLOWLINE` (3,857 chars — the FLOWLINE definition's own
  nested sub-definitions for Wellhead Line/Production Piping/etc., all
  correctly folded into one row per the definitions design in gate E).

## Changes made to import_ccr.py (each one, one line, with the reason)

1. `"ecmc": "ecmc"` in `CORPUS_REGS` and an `"ecmc"` entry in `REG_META`
   with `family: "rule_series"` — already present at hand-off; confirmed
   correct against the brief, not re-authored.
2. `TABLE_CAPTION_EXTRA_RE["ecmc"]` for ECMC's `Table <rule>-<n>` caption
   shapes — already present at hand-off.
3. Added `_ECMC_SERIES_RE` / `_ECMC_RULE_RE` / `_ECMC_APPENDIX_RE` — the
   three heading regexes, each guarded by a "preceded by a blank line"
   check, since that is the one signal that reliably tells a real heading
   apart from a wrapped mid-sentence numeral (confirmed: the only bare
   `\d{3,4}\.` NOT preceded by a blank line in the whole document is the
   wrapped citation "...pursuant to Rule\n701." at ECMC.txt:670).
4. Added `ECMC_LADDER_CYCLE` and `_ecmc_is_ladder_label` for the ladder's
   4 label shapes (lower-letter, paren-digit, upper-letter, and a bare
   lower-case roman numeral — see "Changes from the brief's assumptions"
   below).
5. Added `find_body_start_ecmc` (first "100 SERIES DEFINITIONS" line).
6. Added `_ecmc_scan_markers` — the flat, document-order marker scanner for
   series/rule/appendix/ladder-item markers, using an indentation stack
   (not a fixed depth-by-family cycle) to resolve ladder depth/parent — see
   below for why.
7. Added `_ecmc_def_term` / `_ecmc_def_slug` / `_ECMC_DEF_START_RE` — the
   100-Series definition-paragraph recognizer (opener list: `means`, `shall
   mean`, `shall be`, `shall include`, `is defined`, `when used`, `for
   purposes of`, `used to`, `includes`, `refers to`, `has the meaning`).
8. Added `_ecmc_rule_title` / `_ecmc_title_word_ok` — the rule-title
   assembler (word-by-word ALL-CAPS scan, not a period-position heuristic —
   see below).
9. Added `_ecmc_rule_sub_id`, `link_citations_ecmc`, and the `_ECMC_*_RE`
   cross-reference regexes (`Rule N[.compound]`, `Rules N through M`, `N
   Series`, `Table N-N`, `Appendix N`, `Form N`, `§ ..., C.R.S.`,
   `Regulation Number N`).
10. Added `parse_reg_rule_series` — the ECMC counterpart to
    `build_provisions`, producing the same 4-tuple shape.
11. Added `BUCKET_FORM` / `BUCKET_CRS` to `ALL_BUCKETS` (additive: every
    other regulation's `unresolved` dict just carries two permanently-empty
    counters).
12. Added `bucket_titles` labels for the two new buckets in the diff
    report's "Cross-reference linking" section.
13. In `parse_reg`, branched `find_body_start`/`scan_markers`+
    `build_provisions` to `find_body_start_ecmc`/`parse_reg_rule_series`
    when `REG_META[reg]["family"] == "rule_series"`; every other
    regulation (`family` absent) takes the unchanged original path.
14. In `extract_tables_from_pdf`, added `page.flush_cache()` after a page
    is used or found to have no caption/no table — a memory fix, not a
    behavior change (see "Infrastructure fix" below); confirmed
    byte-identical on Reg 1/Reg 26 either way.
15. In `_cut_table` (inside `parse_reg_rule_series`), only cut the raw text
    at a table caption line when a rendered table was actually recovered
    for it — otherwise leave the raw text in place so a captioned-but-
    unrenderable table's data isn't silently dropped (see Table 423-1/2
    below).
16. Added `KNOWN_LABEL_FIXES["ecmc"]` (two entries — see below).

### Infrastructure fix (not ECMC-specific, but found while building this)

`extract_tables_from_pdf` iterates `pdf.pages` and calls
`page.extract_text()` / `page.extract_tables()` per page but never released
each page's cached objects. On a 100-300 page AQCC regulation this is
invisible; on ECMC's 675-page PDF it grows unbounded (roughly 3 GB+ RSS) and
the first few full-pipeline runs were OOM-killed (`Killed`, exit 137) before
any output was written. Added `page.flush_cache()` calls; confirmed this
changes peak memory only, not output — Reg 1 and Reg 26
(`out/reg1_baseline.json`, `out/reg26_baseline.json`, produced by parsing
`sources/REG_1.pdf` / `sources/REG_26.pdf` with `--reg 1` / `--reg 26`
before any of today's edits) are byte-identical (`cmp` clean) to the same
command re-run after every edit in this session, including this one.

## Changes from the brief's assumptions (found while reading the full text)

The brief was explicit that these should be "confirmed and corrected" —
here is what changed:

1. **225 rules found, not 232.** Verified by a blank-line-preceded
   `^\d{3,4}\.\s` scan (225 real headings; the document's rule numbering is
   perfectly contiguous within every series — 201-224, 301-316, 401-437,
   501-530, 601-616, 701-707, 801-811, 901-915, 1001-1004, 1101-1105,
   1201-1203, 1301-1320, 1401-1437 — summing to exactly 225). No lettered
   rule numbers (`205A`, `317B`, `201A`, etc., mentioned only in cross-
   references and the History tail as historical/repealed rules) are
   printed as standalone current headings anywhere in the document. 232
   does not match the current in-force text; I could not find a
   self-consistent way to reach 232 real current rules and did not try to
   force the count to match.
2. **The 4th ladder level is a BARE lower-case roman numeral (`i.`,
   `ii.`, ...) in ~1,347 lines, not the brief's parenthesized `(i)` (only
   4 lines total, all elsewhere).** This matters because a bare roman
   numeral is lexically identical to a 9th sequential plain letter (`h.`,
   `i.` is a perfectly legal plain letter too) — text alone can't tell them
   apart. The parser resolves ladder depth by an indentation stack instead
   (pop every open level whose indent is >= the new candidate's, push the
   new one; depth = stack size), which handles both cases correctly
   regardless of which family fired, and also handles a confirmed 5th
   level in a few rules (e.g. `205.c.(3).A.i`) without a hard-coded depth
   cap.
3. **Rules 1101-1105 (Flowline series) print their own top level
   re-prefixed with the full rule number** — `1101.a.`, `1105.g.` —
   instead of Rule 604's bare `a.`. Confirmed by grep: this is the ONLY
   range that does this (`^\d{3,4}\.[a-z]{1,3}\.\s` matches only rules
   1101-1105). Without recognizing this shape, every one of these rules'
   `(1)`/`(2)`/... items opened at depth 1 instead of nesting under
   `a.`/`b.`, colliding across sections (`sec-ecmc-1101-(1)` printed once
   under `a.` and again, unrelated, under `b.`) — this was the single
   largest source of the duplicate-id warnings during development (956 ->
   102 -> 0 after this fix plus the indentation-stack fix, see gate E).
4. **Rule title assembly needed a word-by-word ALL-CAPS scan, not a
   period-position heuristic.** My first attempt split a title from its
   inline body lead at "the first `. ` before a lower-case letter" —
   wrong, because Rule 409's own body text starts with "Where"
   (capitalized, like any normal English sentence). The final version
   walks `rest` word by word and stops at the first word that isn't
   ALL-CAPS, punctuation/digits, or a short connector (`and`, `of`, `the`,
   ...) — correctly splits Rule 409's "REPORT OF RESERVOIR PRESSURE TEST."
   from "Where the Director believes..." and correctly keeps Rule 437's
   ordinary-Title-Case "Hydraulic Fracturing Chemical Additives." intact
   (that one rule's title isn't ALL-CAPS at all — recognized structurally
   as a single sentence fragment ending in exactly one period, not
   hard-coded to rule 437).

## Label fixes added

1. `(4)` -> `(7)`, ECMC.txt:16352, Rule 525.b: printed numbering restarts
   at `(4)` for two items ("A penalty will be assessed for each day...",
   "The number of days of violation does not include...") that plainly
   continue the SAME list as the preceding `(1)-(6)` (mid-sentence topic
   continuity with `(6)` "With respect to violations..." immediately
   above; nothing about the following items suggests a fresh sub-topic).
   Corrected to continue the sequence.
2. `(5)` -> `(8)`, ECMC.txt:16355, same rule/list, same reasoning.

Both fixes report `hits: 1` (confirmed OK by the parse step's own output).

## Quality-gate results A-I

**A. Structure check — PASS.** 14 series, 225 rules, 4 appendices found,
matching the printed headings in document order (see Row counts table
above). One documented departure from the brief's own structural sketch:
225 rules, not 232 (see "Changes from the brief's assumptions" #1).

**B. Coverage check — PASS.** Source body word count (after `clean_pages`
and `find_body_start_ecmc`, i.e. excluding the title page and page
headers/footers): 225,229 words. Parsed `full_text` word count (HTML tags
stripped, entities unescaped): 220,609 words. Ratio: 97.9% — within a few
percent, no dropped-text pattern found.

**C. Repeated-text heuristic — PASS.** Checked every row's paragraphs'
first 50 characters for a >=3x recurrence within one row: 0 hits.

**D. Giant/fused rows — PASS, one justified.** Ten longest rows listed
above under Row counts; only `sec-ecmc-APPENDIX-VI` (15,106 chars) is over
~15,000, and it's justified — a long, legitimate list (Public Water
Systems subject to Rule 317B, PWSID/name/date columns) flattened to text
by `pdftotext -layout`, not a fused set of sibling paragraphs. No row
shows the Reg-3-Part-F-style runaway-concatenation pattern.

**E. Orphans and label anomalies — PASS.** 0 duplicate ids, 0 orphans
(every `parent_id` resolves) in the final 6,753-row output. One benign,
expected duplicate-MARKER merge remains and is left as a merge (not a
label fix): `sec-ecmc-APPENDIX-VI` is produced twice — once by the
"APPENDIX VI PUBLIC WATER SYSTEMS" heading line, once by its own body's
"Appendix VI: List of Public Water Systems..." sub-caption a page later,
which matches the same appendix-heading pattern for the SAME appendix.
`parse_reg`'s existing dedup logic (used by every other regulation)
concatenates the two matches' text under the first occurrence's id —
correct behavior here, not a bug. Two genuine source-text label anomalies
were found and fixed (Rule 525.b's renumbered `(4)`/`(5)`, see above); no
other gaps or jumps were found in a spot-check of ~15 rules' full ladders
plus the automated "every ladder item resolves to a real parent, no id
collisions" check across all 6,753 rows.

**F. Statement-of-basis part — N/A, confirmed.** No
`SOB_PART_CONFIG["ecmc"]` entry was added, per the brief (ECMC keeps
statements of basis in a separate document, never printed in ECMC.pdf) —
confirmed by reading the tail of the document: after Appendix IX (Form 41)
the text goes directly into "Editor's Notes / History" (a plain
rulemaking-date changelog, not a statement of basis), which lands,
unmodified, inside the last row `sec-ecmc-APPENDIX-IX` (the same "unless
it lands somewhere absurd" default behavior every other regulation's
trailing matter gets) — not absurd here, since it's genuinely the last
thing in the printed document.

**G. Cross-references — READY WITH NOTES.** `link_citations_ecmc`
resolves same-reg `Rule N`/`Rule N.compound`, `Rules N through M`, `N
Series`, `Table N-N` (to the row the table is actually rendered in), and
`Appendix N`; routes `Form N` and `§ ..., C.R.S.` citations to their own
dedicated buckets (`form`: 57 distinct/951 mentions; `crs`: 41 distinct/53
mentions) — recognized, deliberately left as plain text per the brief, not
a gap; and resolves `Regulation Number N` against the corpus (none of
ECMC's two distinct out-of-corpus references, "Regulation Number 41" and
"Regulation Number 31", are AQCC regulations in `CORPUS_REGS`, so both
correctly land in `other_reg`). Genuine unresolved citations, all
reviewed:
  - `historical` (7 distinct/32 mentions): all inside the Editor's
    Notes/History tail's rulemaking-date changelog ("Rule 100, 205, 205.A,
    305.e.(1)A, 316C, 523.c, Appendix IX eff. 01/30/2012.", etc.) —
    genuinely historical/renumbered-away rule citations (`318A`, `316C`,
    `337`, and "Rule 100" used loosely to mean the whole 100-Series
    definitions), correctly unlinked.
  - `unparseable` (3 distinct/15 mentions): `Table 423-1` (10x) and
    `Table 423-2` (2x) — see gate H; `Table 910-1` (3x) — a genuine
    SOURCE-TEXT reference to a table number from a prior rule numbering,
    kept deliberately alongside a correct `Table 915-1` reference in the
    same sentence ("...comply with the version of Table 910-1 that was
    previously in effect... comply with the current version of Table
    915-1.") — this is the document's own text preserving a historical
    table number, not a parser gap.
  - The self-referential dangling citation `Rule 604.b.(3).A` (printed
    inside `sec-ecmc-604-a-(3)-B`'s own text) does not resolve — the real
    target, per the current printed ladder, is `604.a.(3).A`, not
    `604.b.(3).A`; this reads as a genuine cross-reference typo in the
    CCR document itself (not corrected, since — unlike the two Rule 525.b
    label fixes — this is a citation pointing at the wrong place, not a
    mislabeled item in need of renumbering).

**H. Tables — READY WITH NOTES.** 4 captioned tables found by
`extract_tables_from_pdf`; 3 rendered cleanly as HTML tables and injected
into their owning rows: `TABLE 437-1` (Chemical Additives Prohibited in
Hydraulic Fracturing Fluid, `sec-ecmc-437-c`), `Table 915-1` (soil/
groundwater concentration standards, 20 `<tr>` rows, `sec-ecmc-915-f`), and
`Table 1203-1` (Direct Impact Habitat Mitigation Fee, `sec-ecmc-1203-c`).
**Table 423-1 (Maximum Permissible Noise Levels) and Table 423-2 (Maximum
Cumulative Noise Levels) are NOT rendered as clean tables** — confirmed by
direct pdfplumber inspection of ECMC.pdf page 228: `extract_tables()`
returns zero tables there because both are printed with no ruling/border
lines at all (a whitespace-aligned matrix, not a bordered table
pdfplumber's default line-based detector can see). Rather than silently
drop this content (the bug the `_cut_table` fix above addresses), the raw
`pdftotext -layout` text is left in place as plain paragraph text inside
`sec-ecmc-423-b-(1)` and `sec-ecmc-423-b-(2)` — the noise-level numbers are
all present, just not in a clean HTML table. This is a genuine remaining
gap, fixable with a per-page `table_settings` override (an
`UNCAPTIONED_TABLES`-style reg-scoped addition, same mechanism Reg 8
already uses) but not attempted here given the time budget.

**I. Tests — PASS.** `python3 -m pytest -q test_import_ccr.py`: 95
passed, 6 skipped (skips are the other regulations' real-source tests
whose `sources/REG_*.txt` are not in this checkout — pre-existing,
unrelated to this change). Added `RuleSeriesFamilyTests` (11 tests on a
small synthetic fixture: series/rule/appendix ids, wrapped-title joining,
the full ladder including a bare-roman 4th level disambiguated purely by
indentation, one-row-per-definition including a "used to" opener, same-reg
cross-reference linking, no-duplicate-ids/all-parents-resolve, and an
unresolved-not-dropped table-citation check), `EcmcFullParseTests` (4
tests against the real source: exact row-kind counts including 225 rules,
the one expected/documented duplicate-id merge, all label fixes hitting
exactly once, key ids present, no page-furniture leaks), and
`EcmcMetaTests` (the `CORPUS_REGS`/`REG_META` entries). Every pre-existing
test still passes unchanged.

## Things I could not resolve

- **Table 423-1 / Table 423-2 render as plain (garbled-column) text, not
  clean HTML tables** — pdfplumber finds no bordered table on ECMC.pdf
  page 228 (see gate H). Fixable with a
  `table_settings={"vertical_strategy": "text", ...}` fallback scoped to
  this caption, but that fallback (tested during this session) pulls in
  unrelated surrounding page text rather than isolating just the matrix,
  so I left the safe fallback (raw text, nothing dropped) rather than ship
  a worse-than-nothing "table."
- ~~One defined term's text lands under the wrong neighboring term
  title.~~ **FIXED — see the Delta section.** `sec-ecmc-100-DEF-COMPLETED-
  WELL` no longer absorbs the following COMPLETION paragraph; it is now
  its own row, `sec-ecmc-100-DEF-COMPLETION`. Definitions count is now
  **316** (was 315).
- **`_target_bucket_label`'s cosmetic labeling** (used only in the diff
  report's cross-reference summary table, not in any id or full_text)
  shows ECMC's series rows as "under Part S" rather than something
  ECMC-specific — harmless (it's report prose only) but worth a follow-up
  label if this family gets more reviewers.
- I did not attempt to verify every one of the ~1,347 bare-roman-numeral
  ladder items against the source by hand (infeasible at this scale); the
  indentation-stack algorithm was verified against every rule flagged by
  the duplicate-id/orphan checks (which would have caught depth-resolution
  errors) and spot-checked against Rule 205's known example from the brief
  reading, but a residual small number of subtly-misattributed parents in
  rules I didn't specifically look at cannot be ruled out.

## Anything the summarizer should be warned about for this regulation

- **"Commission" = ECMC** (Energy and Carbon Management Commission) in
  this document, not the AQCC — do not resolve bare "the Commission"
  against AQCC conventions from other regulations.
- **"Division" is NOT the APCD here** — ECMC has no "Division"; watch for
  a summarizer trained on AQCC regs defaulting to that expansion.
- **"Director"** and **"LGD"** (Local Governmental Designee) are
  ECMC-specific roles, distinct from any AQCC "Division Director."
- Acronyms/terms likely to be mis-expanded or mis-summarized: **Relevant
  Local Government** / **Proximate Local Government** (two distinct,
  precisely-defined roles — do not conflate), **Disproportionately
  Impacted Community**, **Cumulative Impacts**, **Working Pad Surface**,
  **Oil and Gas Location**, **High Priority Habitat**, and the many
  **Form N** numbers (Form 2, 2A, 4, 5, 6, 7, 9, 19, 27, 42, 44, etc. — 57
  distinct form numbers, 951 mentions total; these are real, load-bearing
  procedural references, not filler).
- **Setback distances** (Rule 604 and others) are precise numeric
  thresholds (200 ft, 500 ft, 2,000 ft, etc.) with narrowly-scoped
  exceptions — a summary that rounds or generalizes these will misstate
  the rule.
- **Tables**: Table 423-1/423-2 (noise limits) currently render as plain
  text, not a table — a summarizer reading `sec-ecmc-423-b-(1)` /
  `sec-ecmc-423-b-(2)` should not assume the numbers are laid out in a
  parseable grid.
- **Adopted-by-reference / cross-series applicability**: the 1300 Series
  (Deep Geothermal) and 1400 Series (Class VI UIC / Geologic Storage) each
  incorporate large blocks of the 200-1200 Series rules by cross-reference
  rather than restating them (e.g. Rule 1301.a: "Deep Geothermal Operators
  are subject to the provisions of Rules 201-204, 205.a.-c.(1)...") — a
  summary of a 1300/1400 Series rule that doesn't follow those
  cross-references will read as far shorter/simpler than the rule
  actually is.
- The **Editor's Notes/History tail** (inside `sec-ecmc-APPENDIX-IX`'s
  `full_text`, appended after the real Form 41 content) is a decades-long
  rulemaking changelog, not part of Form 41 itself — a summarizer should
  not describe it as part of the trade-secret-claim form.

## Delta: three fixes requested after initial review, and re-verification

Three fixes were requested before acceptance. All three are implemented,
and the full pipeline (parse, both baselines, tests, diff, apply, patch)
has been re-run end to end.

### 1. Heading rows now carry their heading text in `full_text`

Previously all 14 series rows and 225 rule ("section") rows had
`full_text = ""`, which rendered as blank rows in the app. Fixed to match
the existing AQCC convention:

- **Series rows** (`sec-ecmc-S-<n>`): `full_text = title` (plain, escaped —
  e.g. `sec-ecmc-S-600` full_text is now `"600 Series — SAFETY AND
  FACILITY OPERATIONS REGULATIONS"`, same as its title).
- **Rule rows** (`sec-ecmc-<num>`, kind `section`): a new `"heading_body"`
  pending kind was added. A rule with no lead-in body text before its
  first ladder item/table gets `full_text = <linked heading>` alone
  (e.g. `sec-ecmc-604` → `"Rule 604. — SETBACKS and SITING
  REQUIREMENTS"`, cross-reference-linked). A rule that DOES have lead-in
  prose gets the heading as the first `<p>` paragraph, followed by the
  body paragraphs as further `<p>` tags — the same layout an AQCC section
  with printed lead-in text already uses.
- The same `"heading_body"` handling was reused for the 1100-series
  "rule_prefixed" ladder items (see fix 2 below), since those are
  structurally the same case (a printed heading with or without a
  lead-in body before their first sub-item).

This required adding the second-pass renderer for `"heading_body"` in
`parse_reg_rule_series()`'s cross-reference-linking loop (the piece that
had not yet been written when the initial report was delivered).

### 2. `sec-ecmc-1101-a` through `1105-*` — label no longer repeated

The 1100 (Flowline) Series prints its own top-level letter re-prefixed
with the full rule number (e.g. `"1101.a.     Flowline and Crude Oil
Transfer Line Statuses."`) instead of a bare letter like every other
rule's ladder. This was previously being treated as ordinary inline body
text, so both `title` and `full_text` repeated the full label plus
heading verbatim.

Fixed: the marker scanner already tags these five rules' top-level items
as `rule_prefixed` (unchanged from the initial submission). What changed
is what happens to that text: it is now treated as a genuine heading —
same `"heading_body"` kind as a rule row — so:
- `citation` stays `"1101.a."` (unchanged),
- `title` is now the heading words alone, with no label prefix —
  `sec-ecmc-1101-a` → `"Flowline and Crude Oil Transfer Line Statuses."`,
- `full_text` is the linked heading (plus any body paragraphs under that
  letter, before its first `(1)` child, if present) — the label is not
  repeated a second time.

This same "1101.a." print format turned out to apply to **every top-level
letter across all five rules** (1101.a-e, 1102.a-o, 1103.a-e, 1104.a-k,
1105.a-g — ~50 rows), not just the letter "a", and inspecting all of them
found the rows split into two genuinely different shapes:

- **~35 rows print a real short heading** (a noun-phrase label ending in
  its own period — `"Material."`, `"Isolation valve repair and
  maintenance."`, occasionally wrapping onto one continuation line before
  that period — `"Crude Oil Transfer Line and Produced Water Transfer
  System"` / `"Registration."`). These get the `"heading_body"` treatment:
  `title` = heading words alone, `full_text` = heading (+ body paragraphs
  if any lead-in text follows before the first `(1)` child).
- **~15 rows have NO heading at all** — they start directly with ordinary
  body prose (confirmed: `sec-ecmc-1103-b/-c/-d`, `sec-ecmc-1105-a/-b/-g`,
  e.g. `"Any valve, flange, fitting or other component that is
  connected..."`). Treating these the same as the heading rows would have
  produced a title that was just a sentence fragment truncated at the
  PDF's line-wrap point — clearly wrong. A new helper,
  `_ecmc_item_heading_split()`, tells the two shapes apart structurally: a
  real heading always reaches its own terminating period within a
  handful of words (on the marker's own line, or the single following
  continuation line); ordinary body prose does not reach a period at all
  within that same short span (word-by-word ALL-CAPS scanning, used for
  rule titles, does not work here since these headings are Title-Case or
  even sentence-case, indistinguishable from an ordinary capitalized
  sentence start by case alone). Rows with no heading fall back to the
  same convention as any other body-only ladder item: `title` = the bare
  citation (`"1103.b."`), `full_text` = the body paragraphs, starting from
  the first word — not a truncated fragment.

Verified across representative examples of both shapes: `sec-ecmc-1101-a`
→ title `"Flowline and Crude Oil Transfer Line Statuses."`; `sec-ecmc-1102-a`
→ title `"Material."`, full_text = heading paragraph + `"Materials for pipe
and pipe components must be:"`; `sec-ecmc-1104-d` → wrapped heading
`"Integrity Management for Active Status Above-ground On-location
Flowlines."` reassembled correctly across its line break; `sec-ecmc-1105-a`
→ title `"1105.a."` (no heading in source), full_text starts `"A flowline
or crude oil transfer line remains subject to all of the requirements in
Rules 1101 through 1104..."` (cross-reference-linked, not truncated).

### 3. `COMPLETION` definition — root cause found and fixed at the root

The originally-added `_ECMC_DEF_NOVERB_RE` fallback regex was correct on
its own (verified standalone against `"COMPLETION An oil well shall be
considered..."`), but it was never reached: `_ecmc_def_term()`'s primary
path uses a **lazy** regex (`_ECMC_DEF_START_RE`) that hunts for the
first definition-opener verb anywhere in the line. On the COMPLETION
paragraph, that lazy match skipped past "COMPLETION An oil well" and
grabbed the LATER "shall be" inside "shall be considered completed",
producing a bogus candidate term of `"COMPLETION An oil well"`. That
candidate correctly failed the ALL-CAPS-ratio sanity check — but the
function then `return`ed `None` immediately instead of falling through
to try the no-opener fallback, so the fallback regex was never actually
consulted for this paragraph.

Fixed by restructuring `_ecmc_def_term()` so a failed primary-path ratio
check falls through to the `_ECMC_DEF_NOVERB_RE` fallback rather than
returning `None` outright. Re-verified: exactly one new row is produced
(`sec-ecmc-100-DEF-COMPLETION`), `sec-ecmc-100-DEF-COMPLETED-WELL` no
longer swallows it, and a full scan of all 316 resulting definition
titles found no new false positives (the pre-existing "suspect-looking"
titles — e.g. `"DEEP GEOTHERMAL OPERATION or DEEP GEOTHERMAL
OPERATIONS"`, `"a. SELLING OPERATOR"` — are unchanged from before this
fix and are genuine source-text terms, not fallback artifacts).

**Definitions: confirmed 316** (up from 315).

### Updated row counts

- **Total rows: 6,754** (1 root + 14 series + **316** definitions + 225
  rules + 6,194 ladder items + 4 appendices) — up by exactly 1 from the
  new COMPLETION definition; no other row counts changed.
- **Ten longest rows — unchanged** from the initial report (adding
  heading text to previously-empty rows did not push any new row into
  the top 10; every one of the ten was already a large item/definition/
  appendix body):

  | Rank | Row | Chars |
  |---|---|---|
  | 1 | `sec-ecmc-APPENDIX-VI` | 15,106 |
  | 2 | `sec-ecmc-APPENDIX-IX` | 8,048 |
  | 3 | `sec-ecmc-100-DEF-FLOWLINE` | 3,857 |
  | 4 | `sec-ecmc-915-f` | 2,681 |
  | 5 | `sec-ecmc-434-a-(1)` | 2,367 |
  | 6 | `sec-ecmc-437-c` | 2,013 |
  | 7 | `sec-ecmc-100-DEF-PROXIMATE-LOCAL-GOVERNMENT` | 1,839 |
  | 8 | `sec-ecmc-308-b-(6)` | 1,838 |
  | 9 | `sec-ecmc-100-DEF-SINGLE-WELL-FINANCIAL-ASSURANCE` | 1,819 |
  | 10 | `sec-ecmc-702-a` | 1,803 |

### Re-verification results

- **Reg 1 baseline**: re-parsed `sources/REG_1.txt` / `sources/REG_1.pdf`
  and `cmp`'d against `out/reg1_baseline.json` — **byte-identical**.
- **Reg 26 baseline**: re-parsed `sources/REG_26.txt` and `cmp`'d against
  `out/reg26_baseline.json` — **byte-identical**.
- **Tests**: `python3 -m pytest -q test_import_ccr.py` → **95 passed, 6
  skipped** (the 6 skips are pre-existing and unrelated to ECMC — missing
  `pipeline/out/reg7_*`, `sources/REG_8.txt`, `sources/REG_2.txt` in this
  checkout). No test changes were needed; the existing assertions about
  citation format, ladder depth, and cross-reference ids were unaffected
  by the full_text/title rendering changes.
- **Duplicate ids**: still exactly **1**, the same benign
  `sec-ecmc-APPENDIX-VI` re-caption merge documented in gate D of the
  original report — no new duplicates introduced.
- **Diff report / apply plan**: regenerated
  (`out/ecmc_diff_report.md`, `out/apply_ecmc/`) against the updated
  parse — `only_parsed=6754` (up from 6753), everything else unchanged in
  shape (24 upsert SQL batches + stats.md).
- **Patch**: `ecmc.patch` regenerated from `import_ccr.ORIGINAL.py` /
  `merged/test_import_ccr.py` against the current files; re-verified it
  applies cleanly with `patch -p0` in an isolated directory and
  reproduces both files byte-for-byte.

**Updated verdict: READY.** All three requested fixes are in place,
verified individually and via the full gate/test/baseline re-run, with
no regressions.

## Delta 2: ladder mis-nesting from indentation drift, fixed and re-verified

### Root cause

`_ecmc_scan_markers`'s indentation stack decided depth PURELY from column
position: pop every open level whose indent is >= the new candidate's,
otherwise treat it as a new child. That assumption silently breaks
whenever the source's own printed column drifts within a single,
unbroken list — a page break reflowing the next line a few columns to the
right (`Rule 406.e.(4)`'s "D." at column 11, then "E." at column 14 after
a page break), or a heading that wraps onto extra lines before its first
child shifting everything under it. A drifted label that's printed
*deeper* than its true sibling's column never got popped, so it was
recorded as that sibling's CHILD instead — `sec-ecmc-406-e-(4)-D-E`
instead of the correct `sec-ecmc-406-e-(4)-D` / `-E` as siblings. The same
pattern showed up at every ladder depth: `(4)` → `(5)` (paren-digit),
`b` → `c` (plain letter), and `ii` → `iii` (bare roman).

### The fix

1. **Same-family "immediate next sibling" override** (`_ecmc_sibling_match_index`,
   `_ecmc_label_ordinal_variants`): before consulting indentation at all,
   a candidate is checked against the DEEPEST open level only. If it's the
   same family and its ordinal is exactly that level's ordinal + 1 (under
   some shared numbering scheme — see point 3), it's accepted as that
   level's sibling and the level is replaced, *regardless of how far its
   column drifted*. This is the same "immediate next sibling" idea Reg 8's
   `SIBLING_CHAIN_REGS` already uses for a different symptom (a
   continuation-line guard swallowing a whole list), applied here to
   indentation instead.
2. **Indentation tolerance** (`_ECMC_INDENT_TOL = 4`): when no sibling
   match applies (the candidate is the first item of a list — ordinal
   1/A/i/(1)/a can never be anyone's "+1" — or its true predecessor isn't
   open), the ordinary indentation stack is still the tie-breaker, but a
   candidate has to be printed **more than 4 columns deeper** than the
   open top to be accepted as a new nested child; drift within that band
   no longer opens a level by itself.
3. **Numbering-scheme locking, to resolve the roman/doubled-letter
   collision** (`_ecmc_lower_scheme_from_raw`): ECMC's "lower" family
   already deliberately covers both plain letters and bare roman numerals
   with no separate tag (documented at hand-off). This document also has
   a confirmed 5th/6th ladder tier that doubles or triples a single
   letter once a roman list runs out of single-character items (`aa.`,
   `bb.`, ... — read the same way `PART_C_LETTERS` reads a statement-of-
   basis's own overflow tier), and a token like `"ii."` is *simultaneously*
   a valid roman "2" and a valid doubled-letter "9th letter, doubled" —
   real numeric collisions, not just a theoretical concern (both
   interpretations arise in real content). Two sub-bugs came from this
   before it was locked down:
   - An **unrestricted stack search** (my first attempt, searching every
     open level rather than just the top) matched a deeply-nested roman
     `"ii."` against an unrelated top-level letter `"a."` several levels
     down the stack, purely because both are "lower" family and the roman
     value of `"ii"` (2) equals the alphabetic ordinal of `"a"` (1) plus
     one. Fixed by restricting the sibling check to the top of the stack
     only (point 1 above) — the mis-nested predecessor is always sitting
     there at the moment its rightful sibling arrives, so nothing is lost
     by not searching deeper, and the coincidence can't arise between
     labels that aren't actually adjacent in the document.
   - Even with the top-only restriction, a doubled-letter tier's own
     item that happens to *look* like a roman value (`"ii."`, the tier's
     9th entry) could wrongly "continue" under the roman interpretation
     into `"iii."` — when `"iii."` is really the OUTER roman list's true
     next sibling, one level up, past the whole doubled-letter tier (real
     example: Rule 315.a.B's `...gg. hh. ii.` doubled-letter list
     followed by the real `iii.`/`iv.`/`v.` continuing roman items one
     level up — before this fix, `iii`/`iv`/`v` were wrongly captured as
     `-ii-iii`, `-ii-iv`, `-ii-v`, nested one level too deep under the
     doubled-letter list instead of siblings of the roman `ii` two levels
     up). Fixed by locking each ladder level's numbering scheme (`alpha`
     for a level that opens with a repeated-letter token like `"aa."`,
     which never opens anything else in this document; `roman` for an
     unrepeated multi-character opener like `"iv."`; left `ambiguous` for
     a single-character opener until its own second item settles which
     scheme fits) and carrying that lock forward onto every later sibling
     replacement at that same depth, so a scheme, once established, can't
     drift into the other interpretation mid-list.

### Verification: the same-family-nested count

Computed as specified — for every item row, family-classify the last two
`-`-separated id tokens (paren-digit / paren-roman / upper / lower;
excluding the leading rule number) and flag same-family pairs, excluding
a lower-letter immediately followed by the correct next letter:

| | Count |
|---|---|
| Before this fix | **502** |
| After this fix | **317** |

**All 317 remaining pairs are the same single, legitimate, well-documented
pattern**, not bugs: a bare-roman 4th ladder level correctly opening a
fresh doubled-letter 5th level (`iii` → `aa`, `ii` → `aa`, etc.) — the
family-based check above can't tell "the 4th level's own next roman
sibling" apart from "a brand-new 5th-level list opening under it" purely
from the family label, since both are "lower." This is confirmed correct,
not a parser gap: the source text ITSELF prints the compound citation
`"Rules 604.b.(4).A.i-vii and 604.b.(4).B.i.aa-dd"` (ECMC.txt:17674),
proving `i.aa` (roman level 4 directly containing doubled-letter level 5)
is the document's own intended structure. Filtering the 317 for exactly
this pattern (family last token is a fresh doubled-letter opener AND the
previous token is a valid roman value) accounts for all 317 with **zero
left over** — confirmed by an independent script pass, not just the
count matching by coincidence.

### Rules whose ids changed

Reconstructed the pre-fix parse from the previous `ecmc.patch` (applied
against `import_ccr.ORIGINAL.py`) to diff id sets exactly: **392 item ids
were replaced by 392 new ids** (pure re-nesting — no rows were added or
removed by this fix; total row count is unchanged at 6,754). **54 rules**
had at least one id change:

205, 206, 208, 218, 301, 303, 304, 305, 306, 308, 309, 314, 315, 316, 406,
408, 411, 412, 414, 417, 419, 424, 429, 434, 506, 509, 604, 605, 609, 614,
615, 702, 703, 803, 901, 903, 905, 907, 909, 910, 913, 1002, 1101, 1102,
1104, 1202, 1203, 1303, 1304, 1305, 1404, 1406, 1420, 1423

### New row / definition counts

**Unchanged: 6,754 total rows** (1 root + 14 series + 316 definitions +
225 rules + 6,194 ladder items + 4 appendices), **316 definitions**. This
fix only corrects ladder-item depth/parentage; it doesn't create, delete,
merge, or split any row.

### Re-verification results

- **Duplicate ids**: still exactly **1** (`sec-ecmc-APPENDIX-VI`, the same
  benign re-caption merge documented in gate D) — the sibling-matching fix
  introduced, and then eliminated, additional duplicates during
  development (peaked at 5 with an intermediate, incomplete version of
  this fix — `sec-ecmc-431-E`, `-431-E-i`, `-431-E-ii`, `-1104-i`, plus
  the pre-existing appendix one — all traced to the unrestricted-stack-
  search and roman/doubled-letter collision bugs described above, both
  now fixed).
- **Orphans**: **0** (every `parent_id` resolves).
- **Reg 1 baseline**: re-parsed and `cmp`'d against `out/reg1_baseline.json`
  — **byte-identical**.
- **Reg 26 baseline**: re-parsed and `cmp`'d against `out/reg26_baseline.json`
  — **byte-identical**.
- **Tests**: `python3 -m pytest -q test_import_ccr.py` → **97 passed, 6
  skipped** (95 previous + 2 new fixture tests for this fix:
  `test_drifted_indent_sibling_not_nested_one_level_deep` — an upper-
  letter "A." → "B." pair with "B." printed several columns deeper,
  simulating a page-break reflow, asserting they land as siblings, not
  parent/child — and `test_drifted_paren_digit_sibling_not_nested_one_level_deep`
  — the same drift pattern for a paren-digit "(4)." → "(5)." pair; the 6
  skips are the same pre-existing, unrelated ones from the original
  report).
- **Diff report / apply plan**: regenerated (`out/ecmc_diff_report.md`,
  `out/apply_ecmc/`) — `only_parsed=6754`, unchanged in shape (24 upsert
  SQL batches + stats.md); the 392 changed item ids show up as ordinary
  upserts (old ids simply don't reappear in the new parse; nothing needs
  an explicit delete since `only_db=0` — this is a from-scratch load, not
  a live diff against previously-loaded old ids).
- **Patch**: `ecmc.patch` regenerated from `import_ccr.ORIGINAL.py` /
  `merged/test_import_ccr.py` against the current files; re-verified it
  applies cleanly with `patch -p0` in an isolated directory and
  reproduces both files byte-for-byte.

**Verdict: READY.** The ladder mis-nesting is fixed at its root cause (an
indentation-only depth model), verified to bring the same-family-nested
count down to a fully-explained, non-zero-but-justified residue (a real,
source-confirmed 5th ladder tier, not a bug), with no regressions against
either baseline or the existing test suite.
