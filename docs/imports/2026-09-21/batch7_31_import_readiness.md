# Reg 31 — import readiness report

## Verdict: READY

Every gate A–I passes. Both no-op proofs are clean in both directions, and the
one corpus-wide side effect adding Reg 31 would have had — a wrong link on an
ECMC row — was found by the proof and suppressed.

## Regulation identity

| | |
|---|---|
| Title as printed (title page, REG_31.txt lines 18–24) | `REGULATION NUMBER 31` / `Control of Methane Emissions from Municipal Solid Waste Landfills` / `5 CCR 1001-35`, the name in **mixed case** |
| `root_title` (exact string) | `CONTROL OF METHANE EMISSIONS FROM MUNICIPAL SOLID WASTE LANDFILLS 5 CCR 1001-35` |
| `root_citation` | `Code of Colorado Regulations · Regulation Number 31` |
| `root_id` | `sec-31-top-REG-31` |
| CCR cite | 5 CCR 1001-35 |
| Effective date on the PDF | 02/14/2026 ("Editor's Notes / History / New rule eff. 02/14/2026", the last page). SOS ruleVersionId 12387, ruleId 3469 — added to `sources/manifest.json` as key `31` |
| Pages / lines | 117 pages, 6,060 lines of `pdftotext -layout` |
| Parts found | **11: A–K**, matching the printed outline exactly. K = Statements of Basis. |

The title page prints the name in mixed case, like Reg 30's ("Toxic Air
Contaminants" → `TOXIC AIR CONTAMINANTS`). I upper-cased it to match every
other `root_title` in `REG_META`, and the brief's own quoted value.

**The 30 `PART [A-Z]` matches, resolved.** 11 are the printed outline (lines
31–53), 11 are the real body headings (73, 479, 895, 2215, 2842, 3019, 3084,
3183, 4209, 4481, 4490) and 8 are **prose headings inside Part K's statement
of basis** (4900, 5368, 5529, 5560, 5657, 5722, 5749, 5795 — "PART C - Gas
Collection and Control System (GCCS) Requirements", "PART D, Section I -
Surface Emission Monitoring", …), where the Commission walks the rule part by
part. Seven of those eight match the parser's PART-heading regex (the "PART D,
Section I" one has a comma after the letter and never did), and before the fix
below each re-opened an already-emitted part: the first parse merged two
markers onto each of `sec-31-P-C` … `sec-31-P-I`.

**Part D exists.** The brief's "the outline skips from C to E at lines 36–41"
is a wrapped heading, not a gap: `PART D  Surface Emissions Monitoring and Gas
Collection and Control System` / `Leak Inspection Requirements` occupies lines
38–39 of the outline and 2215–2216 of the body. Both the outline and the body
carry all of A–K.

## Row counts

- **757 rows total** — root 1, part 11, section 26, item 719.
- Rows per part (the PART row itself included):
  A 79 · B 51 · C 211 · D 83 · E 31 · F 11 · G 20 · H 200 · I 65 · J 3 · K 2.
- Sections per part: A 4 (I Purpose, II Applicability, III Exemptions,
  IV Definitions) · B 2 · C 3 · D 2 · E 1 · F 2 · G 1 · H 2 · I 7 · J 1 · K 1.
  All 26 are contiguous romans starting at I.
- Part A, Section IV is one row per defined term: **52 definitions**, IV.A.
  ("Active municipal solid waste (MSW) landfill") through IV.ZZ. ("Working
  face"), contiguous A–Z then AA–ZZ.
- **Rows with ≥25 words (these get summaries): 463.**
- Longest row: `sec-31-K-I`, 106,104 characters (the single statement-of-basis
  entry). The next longest is 2,489.

## Changes made to import_ccr.py

1. `CORPUS_REGS["31"] = "31"` — so Reg 31's own citations resolve and other
   regulations can link to it.
2. `REG_META["31"]` — the standard AQCC block (state / CDPHE-APCD / aqcc
   -regulations URL) plus `root_citation` and `root_title`. No `no_parts`, no
   `REG_CYCLE_AB` entry, no letter-width override: Reg 31 runs on the default
   `CYCLE_AB` ladder (roman → upper → digit → lower) and never prints deeper
   than four levels, plus paren-lower-roman at the leaves.
3. `SOB_PART_CONFIG["31"]` — `letter: "K"`, `top_family: "roman_seq"`,
   `top_opener_re: ^Adopted:?\s`, `inner_items: False` (the entry is a 106 k
   narrative that hard-wraps citation-shaped fragments onto line starts — the
   `sec-24-C-I-26` failure shape — and restarts its `(I)`…`(XII)` and
   `(I)`…`(V)` lists, so it is kept as ONE row like Reg 2/3/6/19/20/21/24).
4. **New config key `part_headings_are_body` in `SOB_PART_CONFIG`** — once the
   statement-of-basis part has started, a later `PART X <title>` line is that
   part's own prose, not a new part. This is the fix for the seven merged
   `sec-31-P-*` ids above. It is opt-in and no other reg sets it, so the
   PART-heading branch is unchanged everywhere else (test:
   `Reg31SobPartHeadingTests.test_same_lines_still_open_parts_for_a_reg_without_the_flag`
   feeds the same lines to Reg 26 and still gets parts C and D).
5. **New guard `_non_aqcc_ccr_series()`**, applied in `link_citations` steps 2
   and 5 and in the ECMC linker's step 7. A `Regulation [Number] N` mention
   whose surrounding sentence cites that same number in a **non-1001 CCR
   series** (`5 C.C.R. § 1002-N`, the Water Quality Control Commission's) is
   bucketed as another regulation instead of linked. Without it, adding Reg 31
   to the corpus turned ECMC's "CLASSIFIED WATER SUPPLY SEGMENT" definition
   ("…by the Colorado Water Quality Control Commission, pursuant to the
   Regulation Number 31, Basic Standards and Methodologies for Surface Water
   Regulations, 5 C.C.R. § 1002-31 (\"WQCC Regulation 31\")") into a link to
   the landfill-methane rule. This is the same shape as the existing
   `_NON_AQCC_REG_PREFIX_RE` ("DOR Regulation 1") guard. `1002-` appears in
   exactly one source document corpus-wide (ECMC), so it is a strict no-op
   everywhere else — proved by re-running all five baselines.
6. `KNOWN_LABEL_FIXES["31"]` — five entries (below).

`sources/manifest.json` also gains a `31` entry (kind `sos`, 5 CCR 1001-35,
ruleId 3469, ruleVersionId 12387, effective 2026-02-14) so `freshness.py`
watches the source. `test_freshness.py` still passes (75 passed).

## Label fixes added

Every one confirmed against the PDF's own text layer with `pdfplumber` — the
glyphs really are printed that way; none is a `pdftotext -layout` artifact.
All five report `OK` (exactly 1 hit).

| printed | corrected | .txt line | PDF page | why |
|---|---|---|---|---|
| `I.D.3.a.(i)` | `II.D.3.a.(i)` | 704 | 14 | Under Part B, Section **II**.D.3.a., whose own text one line earlier says "For the purposes of this Section II.D.3.a."; Part B has no Section I.D.3. at all. One roman "I" short. |
| `I.D.3.a.(ii)` | `II.D.3.a.(ii)` | 709 | 14 | Same slip, same parent. |
| `IIl.B.9.` | `III.B.9.` | 2118 | 41 | A lower-case letter **l** for the third "I", after III.B.8. III.B.3.'s own text cites "III.B.8. or III.B.9.". Without the fix the whole of III.B.9. was inline text of III.B.8., and the regulation's own `III.B.9.` citation had nothing to resolve to. |
| `I.A.1.d` | `I.A.1.d.` | 2879 | 56 | **No trailing dot**, between I.A.1.c. and I.A.1.e. in Part E; `tokenize_by_cycle` needs the dot, so the item folded into I.A.1.c. |
| `IV.B1.b.` | `IV.B.1.b.` | 4338 | 83 | **Missing the dot after B**, between IV.B.1.a. and IV.B.1.c. in Part I. |

No `KNOWN_LABEL_ANOMALIES`, `KNOWN_TEXT_FIXES` or `KNOWN_CONTINUATION_LINES`
entries were needed; the parse reports zero anomalies.

## Quality-gate results A–I

**A. Structure — PASS.** The parsed tree reproduces the printed outline
exactly: 11 parts A–K in order, and under them 26 top-level roman sections
distributed 4/2/3/2/1/2/1/2/7/1/1, each part's sections contiguous from I.
Part B's and Part D's two-line headings are joined correctly ("PART B —
Waste-in-Place Reporting and Gas Collection and Control System Determination",
"PART D — Surface Emissions Monitoring and Gas Collection and Control System
Leak Inspection Requirements"). No phantom parts from Part K's prose.

**B. Coverage — PASS.** Source body (from the `PART A` heading, page
furniture, dividers and page numbers stripped): 49,440 word tokens. Parsed
`full_text` across all 757 rows: 47,259. The gap is 2,148 **printed label
tokens**, which the spec says never to put in item text, plus the root title's
9 tokens on the parsed side; a word-level `difflib` diff of the two streams
returns 69 `delete` runs and every one of them is a label (`II D 3 d i`,
`I A 5 c x`, `IIl B 9`, …) — **no body prose is missing**. One paragraph is
dropped: the front-matter incorporation-by-reference notice ("Pursuant to
Colorado Revised Statutes § 24-4-103 (12.5), materials incorporated by
reference are available for public inspection…", 75 words, printed between the
outline and `PART A`). That is not a Reg 31 behaviour — `find_body_start`
slices it off for every AQCC regulation, and it is absent from `base_26`,
`base_30`, `base_25` and `base_7` too. Flagged, not changed.

**C. Repeated text — PASS, 0 hits.** No 50-character paragraph prefix recurs
≥3× inside any row, including `sec-31-K-I`.

**D. Giant / fused rows — PASS.** Exactly one row exceeds 15,000 characters:
`sec-31-K-I` at 106,104 — the regulation's single statement-of-basis entry
("I. Adopted: [date]"), deliberately kept whole by `inner_items: False`. The
next nine longest are 2,489 / 2,009 / 1,806 / 1,560 / 1,479 / 1,465 / 1,305 /
1,302 / 1,270, all genuinely long single provisions (`sec-31-B-II-D-3`, the
quarterly surface-emissions-monitoring trigger; `sec-31-E-I-B-4`, remote
monitoring response; etc.). No fused siblings.

**E. Orphans and label anomalies — PASS.** 757 ids, no duplicates
(`reg31_parsed_duplicate_ids.json` is `[]`), every `parent_id` resolves, only
the root has none, and every item id is its parent's id plus one token.
**Every sibling label sequence in the document is contiguous and starts at 1**
— romans, uppers (including the A–Z/AA–ZZ definitions run), digits, lowers and
paren-lower-romans alike — after the five label fixes. Before them there were
three holes (`E-I-A-1` a,b,c,**e**; `I-IV-B-1` a,**c**,d,e; `C-III-B` stopping
at 8) and two items missing entirely. The continuation-line guard flagged 187
candidates and rejected 21; I checked all 21 by hand — 13 are duplicate
mentions of a label that exists elsewhere, and the other 8 are plainly wrapped
citations at a line start ("…Part H, Section\n`II.A.17.`", "…Sections\n
`I.C.2.c.` or I.D.2.a., must be followed if applicable.") — none is a real
item. Nothing was dropped.

**F. Statement of basis — PASS.** Part K, "Statements of Basis, Specific
Statutory Authority and Purpose", is `top_family: "roman_seq"` with an
`^Adopted:?\s` opener, exactly one top-level entry, and `inner_items: False`.
It parses to one row, `sec-31-K-I`, citation `I.`, opening "Adopted: [date]".
**The Commission's print really does carry the unfilled placeholder `[date]`**
instead of the adoption date — confirmed in the PDF text layer (page 86).
Every other AQCC statement of basis in the corpus names its date; this one
does not, and the only date anywhere in the document is the Editor's Note
"New rule eff. 02/14/2026". I left it verbatim rather than substituting the
effective date. The trailing "Editor's Notes / History / New rule eff.
02/14/2026" block sits at the end of this row, which is what every other
regulation in the corpus does with its own Editor's Notes (`base_7`,
`base_25`, `base_26`, `base_30`, `base_ecmc` each contain exactly one).

**G. Cross-references — PASS.** 975 same-regulation `<span class="xref">`
targets, **every one of which resolves to a row that exists** (0 dangling),
spread across all nine substantive parts. 8 external anchors: Regulation
Number 22 ×3, Regulation Number 6 ×2, Regulation Number 7 ×1 (all in the
statement of basis) and the Common Provisions Regulation ×2 (Part A, IV.RR
"Responsible Official", and Part K) — all resolve, all in the corpus.
`other_reg` and `historical` are empty. `cfr` holds 5 distinct / 31 mentions
(40 CFR Part 60 ×20, Part 60 Subpart Cf ×7, Part 63 Subpart AAAA ×2, Part 98
Subparts HH and A ×1 each) — correct, none of those is in the corpus.
`unparseable` holds **one** citation, and it is a source defect, not a parser
gap: Part C III.B.2.b. (line 2062) says "after the requirements of Part C,
Section **II.B.2.a.** have been met", but Part C's Section II.B.2. has no
sub-item a. From context the Commission meant III.B.2.a., the sibling
immediately above it. I did not "fix" it — correcting a citation would invent
one — so it stays plain text and counted. (The second unparseable citation in
the first run, `III.B.9.`, now resolves: the `IIl.B.9.` label fix restored the
row it names.)

**H. Tables — PASS (none).** The regulation prints no tables at all: no
"Table N" caption anywhere in the 6,060 lines, `tables found in PDF: 0`, no
row contains `doc-table`, and a scan for whitespace-aligned pseudo-tables (a
body line with two or more internal runs of 3+ spaces) returns **0 lines**.
Nothing needed `UNCAPTIONED_TABLES`, `LAYOUT_TEXT_TABLES` or
`COLUMN_LAYOUT_TABLES`.

**I. Tests — PASS.** `python3 -m pytest -q test_import_ccr.py` →
**438 passed, 144 skipped** (the skips are the end-to-end classes for
regulations whose `sources/` files are not in this agent directory; they run
on merge). `test_summarize.py` → **206 passed, 2 skipped**.
`test_freshness.py` → 75 passed. New tests: `Reg31MetaTests`,
`Reg31SobPartHeadingTests`, `Reg31LabelFixTests`, `NonAqccCcrSeriesTests`,
`Reg31FullParseTests` (20 tests) in `test_import_ccr.py`, and six Reg 31 tests
in `test_summarize.py`, one of which asserts the exact anti-applicability
sentences are present in `REG_PROMPT_HINTS["31"]`.

## No-op proof (both directions)

The five centrally-built baselines (`out/base_26.json`, `base_30.json`,
`base_25.json`, `base_7.json`, `base_ecmc.json`) were used as the "before"
side, as instructed. `import_ccr_no31.py` (kept in the directory) is this
agent's `import_ccr.py` with the single `CORPUS_REGS["31"]` line removed —
everything else, including the two new code branches, is identical. Each
document was parsed in its own subprocess, one at a time.

**Direction 1 — key removed: byte-identical, all five.**

| doc | rows | `cmp` vs baseline |
|---|---|---|
| Reg 26 | 626 | IDENTICAL |
| Reg 30 | 444 | IDENTICAL |
| Reg 25 | 993 | IDENTICAL |
| Reg 7 | 2,182 | IDENTICAL |
| ECMC | 6,754 | IDENTICAL |

So `part_headings_are_body`, `_non_aqcc_ccr_series`, `SOB_PART_CONFIG["31"]`,
`REG_META["31"]` and `KNOWN_LABEL_FIXES["31"]` are all provably inert for
every existing regulation.

**Direction 2 — key present: zero new anchors, and that is the correct
answer.** With `"31"` in `CORPUS_REGS`, all five outputs are again
byte-identical to the baselines, and `strip_reconstruct.py` confirms it
row-by-row:

```
26:   rows: 626;  changed rows: 0; anchors added: {'31': 0}; unexplained: 0
30:   rows: 444;  changed rows: 0; anchors added: {'31': 0}; unexplained: 0
25:   rows: 993;  changed rows: 0; anchors added: {'31': 0}; unexplained: 0
7:    rows: 2182; changed rows: 0; anchors added: {'31': 0}; unexplained: 0
ecmc: rows: 6754; changed rows: 0; anchors added: {'31': 0}; unexplained: 0
```

Reg 31 took effect 02/14/2026 and **nothing in the corpus cites it**: a grep
of every `sources/*.txt` for "Regulation Number 31" / "Regulation 31" /
"1001-35" returns two hits outside Reg 31 itself, both in ECMC, and both are
the *Water Quality Control Commission's* Regulation 31 (5 CCR 1002-31, "Basic
Standards and Methodologies for Surface Water").

**That false positive is the interesting part of this proof.** The first run
of direction 2 produced exactly one difference — a new
`<a class="xref-external-reg" href="/regulations/31">Regulation Number 31</a>`
on `sec-ecmc-100-DEF-CLASSIFIED-WATER-SUPPLY-SEGMENT` — which would have sent
a reader looking for surface-water standards to a landfill-methane rule. Guard
5 above suppresses it; the mention is now counted in ECMC's `other_reg` bucket
instead, exactly as it was before Reg 31 existed. Five tests cover it,
including one asserting a genuine `Regulation Number 31` mention still links.

Expect this to matter again: when a *later* batch or a future amendment makes
another AQCC regulation cite Reg 31 by number, the anchors will appear then,
and the WQCC mention will stay suppressed.

## Things I could not resolve

1. **`sec-31-K-I` opens "Adopted: [date]"** — the Commission published the
   statement of basis with an unfilled placeholder (PDF page 86, REG_31.txt
   line 4492). Verbatim is the only honest option, but the row will read
   oddly on the site and the regulation therefore has no printed adoption
   date anywhere. Worth a one-line editorial note on the page, or a re-pull
   if the SOS corrects the print.
2. **Part C III.B.2.b. cites "Part C, Section II.B.2.a.", which does not
   exist** (REG_31.txt line 2062). Almost certainly meant III.B.2.a. Left as
   printed and reported in the `unparseable` bucket — a citation is not
   something the importer should invent.
3. **69 item rows carry their own label inside `full_text`** (e.g.
   `sec-31-I-IV-B-1-b` → `IV.B.1.b. A data recorder is not required.`), 57 of
   them leaves. That is `build_provisions`'s documented corpus-wide rule — a
   row whose entire text fits on its marker's own physical line becomes a
   heading-type row, label included, no `<p>` — and Reg 25 (189 such rows),
   Reg 26 (93) and Reg 30 (66) all do the same. I did not change it, because
   changing it is a corpus-wide behaviour change, not a Reg 31 fix. Flagged
   so the app's badge rendering and the summarizer both know.
4. **The front-matter incorporation-by-reference paragraph is dropped** (gate
   B). Same corpus-wide convention, same reason for leaving it alone.
5. I had to copy `REG_26/30/25/7/ECMC/CP` `.txt` (and `REG_CP.pdf`) from
   `batch7/base/sources/` into this agent's `sources/` to run the no-op
   proof — only `REG_31.txt` was shipped here, and the parser reads the
   `.txt`, not the PDF. I verified the ones I first regenerated with
   `pdftotext -layout` are **md5-identical** to the canonical copies before
   switching to the copies. Nothing outside this directory was modified.

## Anything the summarizer should be warned about for this regulation

`REG_AUDIENCE["31"]` = "an operator of a municipal solid waste landfill in
Colorado". `REG_PROMPT_HINTS["31"]` is 199 words. Both are in
`reg31_summarize.patch`.

- **Applicability lives in exactly two rows and must stay there.** Part A,
  Section II (four paragraphs: post-11/8/1987 waste, the pre-1987 closed-
  landfill biofilter carve-out, the 3-year extension for municipal/county
  landfills under 8 million short tons, and third-party gas purchasers) and
  Part A, Section III (exemptions). The hint says, in so many words, *"do not
  repeat or infer applicability, scope or a date on any other row; if a row
  does not say whom or where it covers, say nothing about that"* — the Batch 6
  Reg 21 lesson. A test (`test_reg31_hint_forbids_restating_applicability_on_other_rows`)
  asserts both sentences are present and that the hint never tells the model
  to "state applicability".
- **Reg 31 is statewide-by-default and names no nonattainment area** — it is
  the one Colorado AQCC reg in this batch with no area scoping — so the
  `_COLORADO_AREA_SCOPE_HINT` is deliberately *not* applied. Do not let a
  future merge swap it in.
- **Units are a trap.** `ppmv` and `ppm-m` are two separately defined terms
  (IV.OO. and IV.NN.): ppm-m is the path-integrated reading an OGI/TDLAS
  instrument gives, ppmv a concentration. They are not interconvertible and
  the hint forbids converting. Likewise short tons vs megagrams vs cubic
  yards (III.A.3.b. prints all three for one threshold).
- **Never generalize a number.** Thresholds (450,000 short tons; 8 million
  short tons; 2,750,000 short tons / 3,260,000 cubic yards), readings (500
  ppm, 500 ppmv, 200 ppmv, 3,000 ppmv, 25 ppmv, 25% of the lower explosive
  limit, 30% methane), spacings (25-foot, 100-foot), and periods (15 years,
  90/180 calendar days, quarterly, 24-month rolling) are per-provision.
- **Defined terms only.** 52 of them in Part A, Section IV — "active",
  "inactive", "closed" and "controlled" MSW landfill are four different
  things; "gas collection device", "gas control device", "gas collection
  system", "gas control system" and "gas collection and control system
  (GCCS)" are five; "intermediate cover" ≠ "final cover"; "component leak",
  "root cause analysis", "corrective action analysis", "Tier 2 evaluation",
  "well raising" and "nonrepeatable, momentary readings" all carry narrow
  meanings.
- **Two agencies, two Divisions.** "Commission" = the AQCC, "Division" = the
  APCD, but the text also routes biofilter plans and closure matters to the
  **Colorado Hazardous Materials and Waste Management Division** — a different
  agency. Do not collapse them. "Responsible Official" and "Designated
  Representative" are defined terms (IV.RR. borrows the Common Provisions
  definition).
- **Duties belong to whoever is named** — usually "the owner or operator",
  but Part A II.D. puts compliance on a third-party gas purchaser/operator,
  and Part E's notifications are issued *by* the Division.
- **Adopted-by-reference federal text: name it, never describe it.** 40 CFR
  Part 60 Subparts Cf and XXX, 40 CFR Part 63 Subpart AAAA, 40 CFR Part 98
  Subparts A and HH, EPA Methods 3A, 3C, 10, 18, 21, 25, 25A and 25C, EPA
  Other Test Method 51 (OTM-51), 40 CFR § 60.18 and ASTM D6522-20 — each with
  a fixed edition date. The model must not summarize their contents. (The
  brief's WWW/XXX/Cf list: this print cites **Cf and XXX**, not WWW.)
- **Part K is rulemaking history, not requirements**, and it is one 106 k
  row containing "PART C - …" / "PART D - …" prose headings that look like
  part headings. Anything summarized from it must be framed as background.
  It also opens with the literal placeholder "[date]" — the summarizer must
  not invent an adoption date for it.
- **69 rows carry their printed label at the start of `full_text`** (see
  "Things I could not resolve" #3). The summarizer should not read that label
  as part of the sentence, and must not echo it.
- **One dangling internal citation** ("Part C, Section II.B.2.a." in
  `sec-31-C-III-B-2-b`) will render as plain text. Do not let the model
  "helpfully" resolve it.

## Files delivered

```
out/reg31_parsed.json            757 rows
out/reg31_db.json                [] (empty DB export — brand-new regulation)
out/reg31_diff_report.md         757 new, 0 only-DB, 0 truncation, 0 different
out/apply_reg31/                 plan.json, stats.md (3/3 sanity checks PASS),
                                 4 upsert SQL files, 541,754 bytes
out/noop/{off,on}_{26,30,25,7,ecmc}.json    the no-op proof, both directions
reg31.patch                      import_ccr.py + test_import_ccr.py vs the ORIGINALs
reg31_summarize.patch            summarize.py + test_summarize.py vs the ORIGINALs
gates31.py                       the gate A–I script used above
import_ccr_no31.py               the "key removed" build used for direction 1
sources/manifest.json            + the "31" freshness entry
```

Both patches were verified by applying them with `patch -p0` to pristine
copies of the four `*.ORIGINAL.py` files: they apply cleanly and reproduce
this directory's files byte-for-byte.
