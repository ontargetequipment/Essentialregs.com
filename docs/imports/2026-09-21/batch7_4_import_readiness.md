# Reg 4 — import readiness report

## Verdict: READY WITH NOTES

Reg 4 parses cleanly to the corpus standard: 348 rows, every gate A–I passing,
all three tables recovered, and the no-op proof exact in both directions on
every baseline document. The notes are (1) three deliberate judgement calls
documented below (the outline's printed numbering error, the "Editor's Notes"
trailer row, and Appendix A's 12 k-character definitions row), and (2) one
source typo that cannot be fixed without inventing text (`Section I.A.8.5`),
plus one cross-agent hazard I found while proving the no-op and that the merge
needs to look at (ECMC's "Regulation Number 31" — see the last section).

## Regulation identity

| | |
|---|---|
| Printed title | `SALE AND INSTALLATION OF WOOD-BURNING APPLIANCES AND THE USE OF CERTAIN WOOD` / `BURNING APPLIANCES DURING HIGH POLLUTION DAYS` (two lines, REG_4.txt 21–22) |
| `root_title` | `SALE AND INSTALLATION OF WOOD-BURNING APPLIANCES AND THE USE OF CERTAIN WOOD BURNING APPLIANCES DURING HIGH POLLUTION DAYS 5 CCR 1001-6` |
| `root_citation` | `Code of Colorado Regulations · Regulation Number 4` |
| CCR cite | 5 CCR 1001-6 |
| Effective | 10/15/2024 (ruleVersionId 11649, ruleId 2338 — added to `sources/manifest.json`) |
| Pages / lines | 51 pages, 2,980 lines |
| Parts found | PART A (Applicability), PART B (Sale, Installation and Use of Wood-Burning Appliances), PART C (Statements of Basis…), plus APPENDIX A hanging off the root |

The title-page break falls inside "WOOD BURNING", which is printed there
unhyphenated (the body writes "wood-burning" with the hyphen); the two lines
are joined with a space exactly as printed, per the Reg 3/21/24/25/26
convention.

## Row counts

- **Total rows: 348** — root 1, part 3, section 19, item 324, appendix 1.
- Per part: Part A 1 · Part B 112 · Part C 4 · Appendix A 227 · part headings 3 · root 1.
- **Rows with ≥25 words (these get summaries): 214.**
- Longest row: `sec-4-C-XI-A` (statement of basis, Nov 19 2015), 12,920 chars.
- `sort_order` is document order × 10 with no gaps (0 … 3470).

## Changes made to import_ccr.py (each one, one line, with the reason)

1. `CORPUS_REGS["4"] = "4"` — so Reg 4's own "Regulation Number 4" mentions self-link and other regs could link to it.
2. `REG_META["4"]` — jurisdiction/issuing body/source URL/root citation/root title, per the Reg 3/26 convention.
3. `REG_META["4"]["appendix_title_after_blank"]` (NEW flag) — "APPENDIX A" is printed flush-left at indent 0 with its title one BLANK line below it (lines 1036/1038); the existing one-blank skip was gated to part-less regs and `centered_appendix_headings`, neither of which fits. No-op for every other reg (asserted by a test over all of `REG_META`).
4. `APPENDIX_HEADING_DEDUP_REGS += "4"` — without it the recovered title reappears as the appendix row's first body paragraph.
5. `SOB_PART_CONFIG["4"]` — Part C: `letter "C"`, `letter_dated`, `roman_prefix "XI"`, `top_opener_re ^Adopted:?\s`, `inner_items: False`. Exactly the Reg 3 Part F shape.
6. `APPENDIX_LADDERS["4"] = {"A"}` — Appendix A (1,945 lines, ~95 k chars, 34 of 51 pages) is an outlined test protocol, not one blob.
7. `_LADDER_DECIMAL_RE` generalized from 2-or-3 components to N, **capped per reg** by the new `APPENDIX_LADDER_DECIMAL_DEPTH` (default `_LADDER_DECIMAL_DEPTH_DEFAULT = 3`, Reg 4 = 5) — Reg 4 prints five-component labels ("5.5.5.2.1", "5.5.12.1.4"). The generalized sequence rule is provably identical to the old one at depth ≤ 3 (tested both directions against Reg 11's shape), so Reg 11 sees the same candidate set.
8. `_appendix_ladder_match(..., reg)` — the function now takes `reg` so it can read that depth cap; the one call site passes it.
9. `KNOWN_LABEL_FIXES["4"]` — five entries, see next section.
10. `COLUMN_LAYOUT_TABLES["4"]` + a new optional `skip_rows` key on that dict (default 0) — Section IX's jurisdiction/ordinance table; `skip_rows: 1` drops its own three-physical-line header run in favour of the explicit `header`.
11. `LAYOUT_TEXT_TABLES["4"]` + a new optional `caption_line_prefix` key (default absent) — the two Appendix A tables, whose PRINTED caption line is swallowed into the replaced block instead of surviving as a duplicate paragraph.
12. `LADDER_SECTION_RE` + `APPENDIX_LADDER_XREF_REGS = {"4"}` (NEW) — a new `link_citations` step 3c that resolves Appendix A's self-references ("as specified in Section 5.7.3.", "see Sections 5.8.8.1 and 5.8.12.1") to the ladder rows. Gated to reg 4 AND to rows whose id contains `-APPENDIX-`, so it is a strict no-op everywhere, **including Reg 11**, whose appendix has the same shape but whose output this batch must leave byte-identical.

Also: `sources/manifest.json` gains a `"4"` entry (kind `sos`, 5 CCR 1001-6,
ruleId 2338, ruleVersionId 11649, effective 2024-10-15) so `freshness.py` watches
it. `test_freshness.py` still passes unchanged (75 passed).

**Nothing existing was restructured.** The only edits to shared code are the
decimal-ladder generalization (item 7, behaviour-preserving at depth ≤ 3), the
two new optional table-config keys (items 10/11, default-off), the extra
`reg` parameter on `_appendix_ladder_match`, and the new reg-gated step 3c.

## Label fixes added

| printed (wrong) | corrected to | source line | why |
|---|---|---|---|
| `VIII.A 1.` | `VIII.A.1.` | 555 | Section VIII.A. lists the five fireplace types that may still be installed. All five labels are printed with the dot after the section letter missing — `VIII.A 1.` instead of `VIII.A.1.` — while every other compound label in the document prints its full dotted path. Without the fix none of the five tokenizes and all five stayed inside VIII.A.'s own row as inline paragraphs still carrying their printed labels. |
| `VIII.A 2.` | `VIII.A.2.` | 557 | same |
| `VIII.A 3.` | `VIII.A.3.` | 559 | same |
| `VIII.A 4.` | `VIII.A.4.` | 561 | same |
| `VIII.A 5.` | `VIII.A.5.` | 564 | same |

All five report `OK (1 hit)`. No `KNOWN_TEXT_FIXES`, `KNOWN_CONTINUATION_LINES`
or `KNOWN_LABEL_ANOMALIES` entries were needed.

**Not fixed, by policy — the front-matter outline's numbering error.** The
"Outline of Regulation" (lines 30–58) prints `VI.` twice — "List of approved
wood-burning appliances" (line 46) and "High pollution days" (line 48) — then
jumps to `VIII.`. The BODY is numbered correctly (VI. List of Approved
Wood-Burning Appliances at 491, **VII. High Pollution Days** at 497, VIII. at
550), and `find_body_start` skips the outline entirely, so the misprint never
reaches the parse. Parsed Part B sections are I…X, contiguous. Documented here
rather than "fixed", because only labels on BODY lines get `KNOWN_LABEL_FIXES`
entries.

## Quality-gate results A–I

**A. Structure — PASS.** Parts A/B/C in order, exactly as printed. Part A has
one section (I.); Part B has I.–X. contiguous and in order, matching the body's
own numbering (see the outline note above); Part C has the synthesized `XI.`
section over entries XI.A./B./C. Appendix A hangs off the root (`sec-4-C-APPENDIX-A`,
owner part C — the corpus id convention). Inside the appendix I reconciled every
printed decimal label against the parse: **221 distinct printed labels, 221
parsed rows, zero missing, zero invented.** The only three decimal-looking lines
not parsed as labels are two equation legends ("0.69 inches (1.74 cm) = Factor
for forcing…", lines 1985/2004) and one more ("19.3 = Sum of dry stoichiometric
combustion products…", line 2733) — correct. Two printed labels appear twice
(`3.2.2.1` at 1176 and `5.6.8.1` at 2174); both extra occurrences are
mid-paragraph wrapped citations and were correctly rejected by the
paragraph-initial guard.

**B. Coverage — PASS.** Source body 23,218 words; parsed `full_text` + `title`
23,806 words; ratio **1.025**. Zero source words uncovered (the counter
`source − parsed` is empty). The 2.5 % excess is expected: section/appendix
headings appear both as `title` and as the row's plain-text lead, and the three
table headers are synthesized column names.

**C. Repeated-text heuristic — PASS.** Zero rows have a 50-character paragraph
prefix recurring ≥ 3× (checked over all 348 rows). No fused-row signature.

**D. Giant / fused rows — PASS.** Ten longest: `sec-4-C-XI-A` 12,920 ·
`sec-4-C-APPENDIX-A-2.0` 12,146 · `sec-4-C-XI-C` 5,389 · `sec-4-C-XI-B` 4,375 ·
`sec-4-B-IX` 2,745 · `sec-4-C-APPENDIX-A-3.2.2.1` 2,225 · `sec-4-B-X` 1,419 ·
`…-6.3.1` 1,285 · `…-5.8.3` 1,280 · `…-3.2.2` 1,224. Nothing is over 15,000
chars. Four need a word: `sec-4-C-XI-A` is one statement-of-basis entry kept
undivided on purpose (`inner_items: False`); `sec-4-B-IX` and
`sec-4-C-APPENDIX-A-3.2.2.1` are large because they now carry a rendered
table. `sec-4-C-APPENDIX-A-2.0` is Appendix A's "DEFINITIONS" — 43 paragraphs,
1,881 words, ~50 defined terms printed with **no labels of any kind** (indented
"Term - meaning" paragraphs). It is one legitimate row, not a fused set of
siblings; splitting it would need a term-definition splitter for ladder rows
that the corpus does not have. Flagged for the summarizer below.

**E. Orphans and label anomalies — PASS.** 348 ids, all unique; every
`parent_id` resolves; zero gaps in any sibling label sequence (checked per
parent, per family, on the id suffix rather than the citation so that Part B's
`II.C.`/`II.D.` are not misread as roman 100/500). The five `VIII.A.N.` rows are
contiguous 1–5 after the label fix. The continuation-line guard flagged 16
candidates (all column deviations caused by the 17-space indent Sections
IV.C/V/VII/VIII use); all 16 were accepted as real labels, none rejected —
verified line by line.

**F. Statement-of-basis part — PASS.** Part C is the SOB part. `top_family`
`letter_dated` with `roman_prefix "XI"`: every entry is printed with a constant,
meaningless leading "XI." (the section number these statements used to sit
under), so `sec-4-C-XI-A/B/C` hang under a synthesized `sec-4-C-XI`, exactly as
Reg 3's Part F produces `sec-3-F-I-<letter>`. Three entries, in order, each
opening with the expected date: XI.A. "Adopted: November 19, 2015" (line 675),
XI.B. "Adopted: March 16, 2017" (865), XI.C. "Adopted: August 15, 2024" (928).
`inner_items: False` like Reg 3/Reg 2: entry XI.A. runs a 1.–3. findings list
and XI.C. a (I)–(V) one, both restarting narrative lists, and the
Basis/Specific Statutory Authority/Purpose/Findings of Fact sub-headings are
unlabeled — so each entry is one undivided row and no child rows exist under
them. Note the *rulemaking history* ("Regulation Number 4 - Adoption
Chronology", ten dated revision lines) is printed in **Part B Section X
References**, not in Part C; it parses into `sec-4-B-X`.

**G. Cross-references — PASS with one source typo.** 69 same-reg spans and 57
appendix-internal spans, every `data-target` resolving to a row that exists; no
dangling targets. Reg 4 cites **no other AQCC regulation by number anywhere**,
so there are zero `xref-external-reg` anchors and the `other_reg` and
`historical` buckets are both empty — correct, not a gap. The `cfr` bucket holds
"40 CFR Part 60" ×10 and "40 CFR Part 60, Subpart AAA" ×6, correct (Subpart AAA
is not in the corpus). The `unparseable` bucket holds exactly one entry:
**`I.A.8.5` ×1** — Part B II.C.1. reads "Exempt Devices, as defined in Section
I.A.8.5 of this regulation", but the definitions list has no I.A.8.5 (I.A.8 *is*
"Exempt device"; there is no fifth level under it anywhere in Section I). This
is a source error, left unlinked rather than silently redirected to I.A.8.
Two smaller gaps, both deliberate: CFR section citations inside the appendix
("40 CFR Part 60, Section 60.532(b)(1)", "Section 60.535") stay plain text, as
intended; and the nine "Appendix A" mentions outside the appendix itself are
not linked to the appendix row, because the corpus has no "Appendix X" resolver
for any regulation — a corpus-wide improvement, not a Reg 4 regression.

**H. Tables — PASS, 3 of 3 recovered.** `pdfplumber` finds **no** ruled tables in
REG_4.pdf (the parse prints "tables found in PDF: 0" before these configs), so
all three are rebuilt from the `-layout` text.
 - `sec-4-B-IX` — "High pollution day and construction ordinances by local
   jurisdiction (Section IX.)": 19 jurisdictions × 5 columns, via
   `COLUMN_LAYOUT_TABLES` (explicit character offsets, because the header's
   first physical line carries only four of the five column names). Empty cells
   are real and preserved (Arvada/Federal Heights/Longmont/Mountain View have no
   construction ordinance; Douglas County no HPD ordinance; Lafayette's
   construction-ordinance *number* is blank with only its date printed).
   Broomfield's lone "." in the last column is printed in the source and kept
   verbatim rather than cleaned.
 - `sec-4-C-APPENDIX-A-3.2.2.1` — "Table 3.2.2.1.1 Critical Masonry Heater
   Dimensions": 11 dimensions × 2 columns, caption exactly as printed, and its
   "Note 1:" footnote kept as prose after the table.
 - `sec-4-C-APPENDIX-A-5.4.1` — "Table 5.4.1.1 Nominal Calibration Gas
   Concentrations 1": 3 ranges × 4 columns (High/Mid/Low × O₂/CO₂/CO), same
   treatment.
No other row contains a `<table>`, and neither printed caption survives as a
duplicate paragraph.

**I. Tests — PASS.** 24 new importer tests in three new classes
(`Reg4ConfigTests`, `Reg4AppendixLadderDecimalTests`, `Reg4FullParseTests`),
plus two existing scoping tests updated (`Reg11MetaTests.test_new_config_dicts_
are_reg_11_scoped` and `RegAqsMetaTests.test_new_config_keys_name_only_aqs`,
which assert the exact key set of `APPENDIX_LADDERS`, `LAYOUT_TEXT_TABLES` and
`COLUMN_LAYOUT_TABLES` — those now read `{"11","4"}`, `{"11","19","4"}` and
`{"aqs","4"}`, and I added assertions that Reg 11 is in neither of the two new
reg-gated sets). `test_import_ccr.py` now collects **542 tests** (518 in the
ORIGINAL + 24); the run in this directory is **442 passed, 144 skipped, 0
failed**. Every skip is an end-to-end class whose source file this agent
directory does not ship: only REG_4 plus REG_7/25/26/30/CP/ECMC (for the no-op
proof) are in `sources/`, so the Reg 1/2/3/9/11/12/19/20/21/24/27/AQS/SIP/GP01-12
classes self-skip. Nothing fails. `test_summarize.py`: **202 passed, 2 skipped**
(6 new Reg 4 tests). `test_freshness.py`: **75 passed**.

## No-op proof (both directions)

Baselines used: the pre-built `out/base_26.json`, `out/base_30.json`,
`out/base_25.json`, `out/base_7.json`, `out/base_ecmc.json` (produced centrally
with `import_ccr.ORIGINAL.py`). Each document re-parsed one at a time in its own
subprocess with the final `import_ccr.py`.

**Direction 1 — with `"4"` removed from `CORPUS_REGS`:** byte-identical for all
five (`cmp` clean on the whole JSON file, not just the rows).

| doc | result |
|---|---|
| Reg 26 | IDENTICAL |
| Reg 30 | IDENTICAL |
| Reg 25 | IDENTICAL |
| Reg 7 | IDENTICAL |
| ECMC | IDENTICAL |

**Direction 2 — with `"4"` present in `CORPUS_REGS`:** also byte-identical for
all five. **Zero new anchors.** `strip_reconstruct.py` is therefore trivially
exact (zero changed rows, zero anchors added, zero unexplained), and there are
no five examples to list, because there is nothing to list.

That is the honest, verified result rather than a missing step: **no document in
the no-op corpus cites AQCC Regulation Number 4.** `grep -nE
"Regulation[s]? +(Number[s]?|No\.?|)[ ]*4\b|1001-6|wood-burning appliance"` over
REG_7/25/26/30/CP/ECMC returns exactly one line in the whole set —
`ECMC.txt:846`, "Public Utilities Commission, **Regulation No. 4**, 4 C.C.R.
723-4901, Part 4" — which is the *Public Utilities Commission's* own Regulation
No. 4 under 4 CCR 723, a different agency's rule entirely. It is **not** linked,
and cannot be: ECMC is parsed by `link_citations_ecmc`, whose reg-mention
pattern `_ECMC_OTHER_REG_RE` requires the literal words "Regulation Number" and
never matches the "No." form. A regression test pins both halves of that
(`test_the_one_non_aqcc_regulation_4_mention_in_the_corpus_stays_plain`).

Reg 4 for its part cites no other AQCC regulation by number, so nothing flows the
other way either. If a later batch imports the **Procedural Rules** (`proc`),
Reg 4's Part C entries will pick up anchors — each of XI.A./B./C. contains "the
Air Quality Control Commission's ("Commission") Procedural Rules" — via that
agent's name resolver, not through any change of mine.

## Files delivered

`out/reg4_parsed.json` (348 rows) · `out/reg4_db.json` (`[]`, per the brief —
no DB access) · `out/reg4_diff_report.md` (348 `only_parsed`, 0 `only_db`, as
expected for a brand-new regulation) · `out/apply_reg4/` (plan.json, stats.md
with all three sanity checks PASS, and two upsert SQL files totalling 241,856
bytes — no `--execute`) · `reg4.patch` (import_ccr + test_import_ccr vs the
ORIGINALs) · `reg4_summarize.patch` (summarize + test_summarize vs the
ORIGINALs) · `REPORT.md`. Both patches were verified by applying them to fresh
copies of the four `*.ORIGINAL.py` files and `cmp`-ing the result against my
working copies — byte-identical, zero fuzz.

One housekeeping note: this agent directory shipped only `sources/REG_4.txt`
and the no-op PDFs, but the no-op proof needs the matching `.txt` files (and
`REG_CP.txt`, without which every "Common Provisions Regulation" mention in Reg
26 silently stops resolving and the baseline can never match). I copied
`REG_7/25/26/30/CP.txt`, `ECMC.txt` and `REG_CP.pdf` verbatim from
`batch7/base/sources/` rather than regenerating them — confirmed byte-identical
to the canonical copies. Nothing in `sources/` was regenerated with different
`pdftotext` flags. `sources/manifest.json` is the only source file I changed,
by a clean nine-line insertion.

## Things I could not resolve

- **`Section I.A.8.5` (Part B II.C.1., source line 305).** The regulation cites a
  provision that does not exist: Section I.A. runs I.A.1.–I.A.24. and I.A.8 is
  "Exempt device" with no sub-items. Almost certainly meant to be I.A.8, but
  "almost certainly" is not good enough to rewrite a citation, so it stays plain
  text and is reported in the `unparseable` bucket (1 mention). Worth a note to
  the APCD.
- **Appendix A's "2.0 DEFINITIONS" is one 12,146-character row** (43 paragraphs,
  ~50 terms). The terms carry no labels at all, so there is nothing for the
  ladder to hang child rows on. Under the 15,000-char gate-D threshold and not a
  fused-sibling bug, but it is the one row a reader will want split, and doing it
  properly needs a term-definition splitter for appendix-ladder rows (the
  existing `TERM_DEFINITIONS_SECTION` / `_match_term_heading_line` machinery only
  works on the ordinary marker path). Left as-is deliberately.
- **The "Editor's Notes" trailer is its own row** (`sec-4-C-APPENDIX-A-EDITOR-S-NOTES`,
  145 chars: "History / Entire rule eff. 01/14/2016. Rules I.A.17, II.A, VIII.A,
  X, XI.B eff. 04/30/2017. Entire rule, XI.C eff. 10/15/2024."). Elsewhere in the
  corpus this CCR editorial trailer just runs on into the last row's text (Reg 30's
  `sec-30-C-III`, Reg 25's `sec-25-C-III`). Here the appendix ladder's
  unlabeled-heading rule picked it up, which I kept on purpose: the alternative
  is gluing a changelog onto bibliography entry 7.6.8.4. It does mean the id sits
  "inside" Appendix A, which is wrong semantically. **Merge decision for the
  CEO**, not a parse bug — say the word and I will suppress it.
- **Appendix-A references from outside the appendix are not linked.** Nine rows
  outside Appendix A say "Appendix A" (e.g. IV.A.2., IV.A.6.) and stay plain
  text; there is no "Appendix X" resolver anywhere in the corpus. Corpus-wide
  improvement, out of scope here.
- **Reg 11's Appendix A has the same self-reference shape and is still unlinked.**
  My new step 3c is gated to `APPENDIX_LADDER_XREF_REGS = {"4"}` precisely so
  Reg 11's baselined output does not change. Adding `"11"` to that set is the
  one-line follow-up whenever Reg 11 is next re-baselined.

### ⚠ Cross-agent hazard found while proving the no-op — for the merge, not for me

ECMC's `sec-ecmc-100-DEF-CLASSIFIED-WATER-SUPPLY-SEGMENT` reads "…pursuant to
the **Regulation Number 31**, Basic Standards and Methodologies for Surface
Water Regulations, 5 C.C.R. § 1002-31…". That is the **Water Quality Control
Commission's** Regulation 31, not the AQCC's Regulation Number 31 (5 CCR
1001-35, Batch 7's `agent_31`). Unlike the PUC citation above, this one **does**
match `_ECMC_OTHER_REG_RE` — today it lands in ECMC's `other_reg` bucket, but
the moment `"31"` enters `CORPUS_REGS` it will become a wrong
`<a class="xref-external-reg" href="/regulations/31">` in ECMC, pointing at the
landfill methane rule. It needs an agency-qualifier guard in
`link_citations_ecmc` step 7 (the same idea as the existing
`_NON_AQCC_REG_PREFIX_RE` "DOR" guard in `link_citations` step 5) — or an
explicit skip for that one definition. I did not touch it because it is
`agent_31`'s key and their patch has to own the fix; flagging it here so the
merge does not ship the wrong link. (ECMC also mentions "Regulation Number 41"
×2, which is not a Batch 7 key — worth the same check whenever 41 is imported.)

## Anything the summarizer should be warned about for this regulation

`REG_PROMPT_HINTS["4"]` is 190 words and `REG_AUDIENCE["4"]` is
"a stove and fireplace retailer, installer or homeowner in a Colorado
high-pollution area" (`reg4_summarize.patch`, 6 new tests).

1. **Applicability lives in exactly one place and must not be sprinkled.** This
   is the Batch-6 Reg 21 trap, and it is live here: Part A Section I makes the
   regulation state-only for carbon monoxide as of 10/15/2024; Section IV and all
   of its children are "(State Only)" masonry-heater provisions; Sections VII and
   IX are scoped to the high-pollution-day areas and to a named list of
   jurisdictions. Three different scopes a model would happily average into one.
   The hint therefore says "Part A, Section I states the applicability" and then
   explicitly forbids repeating or inferring applicability, scope, geography or an
   effective date on any other row — with a dedicated test asserting that exact
   wording is present and that no "state applicability per part"-style
   instruction is.
2. **"(State Only)" prefixes are printed and must be kept** (I.A.2., I.A.12.,
   II.A.3., III.G.2., Section IV's heading).
3. **40 CFR Part 60 Subpart AAA and Methods 5G / 5H / 28 / 28A are adopted by
   reference with edition dates** ((1988), (2015)) — name them, never describe
   what they require. The hint says so.
4. **Phase III certification**: "Phase III Certified wood-burning stove" is a
   defined term (I.A.19.) — never expanded from general knowledge.
5. **Numbers to quote, never paraphrase**: 4.1 grams per hour (pellet stoves),
   6.0 grams/kg (masonry heaters), the three-hour burn down time, and the dated
   thresholds (July 1 1988, May 15 2015, May 15 2020, December 31 2015, January 1
   1993).
6. **Exemptions are listed, not general**: VII.E.1–3 and IV.C.5.a–b (sole/primary
   source of heat, certified appliances, approved pellet stoves). The hint says
   "Give exemptions only as listed".
7. **Duplicated text is intentional.** Sections V (Enforcement) and VII (High
   Pollution Days) are duplicated as IV.B and IV.C for masonry heaters on a
   State-Only basis — the 2015 statement of basis says so explicitly. A summarizer
   comparing the two must not "correct" one against the other.
8. **Section IX is a table** of local ordinances by jurisdiction; point at it
   rather than restating 19 rows. **Section X and Part C are rulemaking history**,
   not current requirements.
9. **Appendix A is a laboratory test protocol** (Colorado APCD masonry-heater
   accreditation, ~227 rows, decimal-numbered), written for a test lab, not a
   requirement on retailers or homeowners — the hint says so. Its internal
   "Section 5.8.4"-style references now resolve to appendix rows. Its "2.0
   DEFINITIONS" row is ~50 unlabeled term definitions in one row: summarize it as
   a glossary, not as a single requirement.
10. **Acronym traps**: "AIR program area" (II.D.) is the Automobile Inspection and
    Readjustment program area defined in § 42-4-304(20)(a), C.R.S., not "air"; ESS
    is the Emissions Sampling System (Appendix A 5.3.11), PHhd/SHhd/Fbh/Hua/Fv/FCl
    are Appendix A's own hearth/firebox variables; "NSPS AAA" appears only in Part C.
    "Commission" is the AQCC and "Division" the APCD throughout.
11. **One bad citation to leave alone**: II.C.1. cites "Section I.A.8.5", which
    does not exist. Do not let the model silently resolve it to I.A.8.
