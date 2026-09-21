# Reg proc — AQCC Procedural Rules — import readiness report

## Verdict: READY WITH NOTES

Ready to import. Two notes the CEO must read before merging:

1. **The brief's structural assumption for this document is wrong.** `BATCH7_BRIEF.md`
   says `no_parts: True` and "Sections I–X". The 02/14/2025 edition in
   `sources/REG_PROC.pdf` is a **two-PART document** (PART A = the procedure for
   proceedings before August 1 2025, PART B = the procedure from August 1 2025 on),
   with sections **I–XI** under Part A and **I–XII** under Part B. `no_parts` is NOT
   set; the ordinary `find_body_start` "last `PART A <title>` line" rule skips both
   printed outlines with no new config. Details under gate A.
2. **The name resolver changes other regulations' output — by design.** Nearly every
   AQCC document cites this one by name, so `PROC_RULES_MENTION_RE` adds new
   `/regulations/proc` anchors to 15 already-imported documents (62 anchors measured).
   Both no-op directions are proved exactly below, and three existing tests that
   asserted "this reg cites no other corpus regulation" were updated (they now assert
   the only external anchors are the `proc` ones).

---

## Regulation identity

| | |
|---|---|
| Printed title (title page, `REG_PROC.txt` 17-21) | `PROCEDURAL RULES` / `5 CCR 1001-1` |
| `root_title` (exact) | `PROCEDURAL RULES 5 CCR 1001-1` |
| `root_citation` (exact) | `Code of Colorado Regulations · AQCC Procedural Rules` |
| CCR cite | 5 CCR 1001-1 |
| Effective date | 02/14/2025 (Editor's Notes: "Entire rule eff. 02/14/2025"); ruleVersionId 11840, ruleId 2333 |
| Pages / source lines | 117 pages (pdfplumber) / 7,104 lines |
| Parts found | **PART A** and **PART B** (two — not part-less) |
| Issuing body / jurisdiction | CDPHE-APCD / state |
| Tables | none (0 found, 0 injected) — this document prints no tables |

**The four `PART [A-Z]` matches, resolved** (the brief asked): lines 29 and 151 are the
two front-matter *outlines* (Part A's outline, then Part B's); lines 283 and 3050 are
the two **real** part headings. None is prose ("Part 2 of Article 4" does not occur).
`find_body_start` takes the LAST `PART A <title>` line → line 283, which skips both
outlines, so the "two printed outlines before the body" trap needed no new code.

## Row counts

- **Total rows: 791** — root 1, part 2, section 23, item 765. No duplicate ids, no orphans.
- Part A: 369 rows (sections I–XI). Part B: 419 rows (sections I–XII).
- Part A Section III definitions: 18 rows (III.A–III.R). Part B Section III: 25 rows (III.A–III.Z less III.W).
- Statement of basis: 9 rows, `sec-proc-B-XII-A` … `sec-proc-B-XII-I`.
- Rows with ≥25 words (these get summaries): **520**.
- Longest row: `sec-proc-B-XII-I` — 39,158 chars / 5,290 words (see gate D).

## Changes made to import_ccr.py

| change | reason |
|---|---|
| `CORPUS_REGS["proc"] = "proc"` | so citations to and from this document resolve. |
| `REG_META["proc"]` (jurisdiction/issuing body/source_url/root_citation/root_title) | Reg 3/8/24/26 convention: printed title + CCR cite, number-less document. |
| `REG_META["proc"]["labels_without_trailing_dot"] = True` | the document's only three labels printed with no trailing dot — Part B `III.I`, `III.J`, `V.A.1.b` (lines 3194/3205/3616, confirmed in the PDF text layer with pdfplumber, page 53). Existing Reg 20 / GP mechanism (`FAMILY_REGEX_NO_TRAILING_DOT`); recovers 3 rows that were being swallowed. |
| `REG_META["proc"]["part_intro_text"] = True` | each PART heading is followed by one paragraph of real regulatory text — the sunset/savings clause that decides WHICH part governs. Part rows are heading-only everywhere else, so both paragraphs were being dropped (found by gate B). Existing Reg 2 mechanism. |
| **new** `HEADING_CHILD_CHAIN_REGS = frozenset({"proc"})` + a `chained_child` term in `scan_markers`'s accept test | Part B's heading `V.G.   How a Final Rule Becomes a Regulation` ends in the word "Regulation", one of `_label_position_plausible`'s dangling cue words, and the page break swallowed the blank line after it — so `V.G.1. Attorney General Review` was rejected before it ever reached the audit and its text fused into `V.G.`. The new term accepts a candidate only when the previous line IS the last accepted marker's own line AND the candidate is that marker's first child (`is_first_child_of_open_marker`, already computed). Opt-in per reg, exactly like `SIBLING_CHAIN_REGS` / `LIST_OR_SIBLING_REGS`. |
| **new** `KNOWN_INLINE_LABEL_SPLITS` + `apply_inline_label_splits()`, wired into `parse_reg` | a genuine label printed in the MIDDLE of a line (`V.D.5.a.(iii)`) is invisible to every family regex, which are all line-anchored. The new applier cuts the line before the inline label and joins the tail onto the following continuation line, re-indented to the siblings' column — **no text changes and the line COUNT is preserved**, so page seams and every other fix's `line_hint` are untouched. Guarded by `match_prefix` + `next_line_prefix`, hit count reported (must be 1). Empty, and never called into, for every other reg. |
| **new** `PROC_RULES_MENTION_RE` + `link_citations` step 1.9 | this document has no regulation NUMBER, so other AQCC regs cite it by name — the `aqs`/`sip` model. One alternative matches `Procedural Rules` with an OPTIONAL trailing `, 5 C.C.R. §1001-1` / `, 5 Code Colo. Reg. §1001-1` / `… section 1001-1`, so one citation yields ONE anchor; a second alternative matches the bare CCR cite. Gated on `"proc" in corpus_regs` so it is a strict no-op (no claim, no bucket entry) for any parse without the key. |
| `KNOWN_LABEL_FIXES["proc"]` (1 entry) | see below. |
| `KNOWN_LABEL_ANOMALIES["proc"]` (2 entries) | see below. |

Also changed: `sources/manifest.json` gains a `proc` entry (`kind: sos`, 5 CCR 1001-1,
ruleId 2333, ruleVersionId 11840, effective 2025-02-14) — a 9-line addition,
`test_freshness.py` still 75 passed.

## Label fixes added

| printed | corrected to | source line | why |
|---|---|---|---|
| `VI.B.3. b.` | `VI.B.3.b.` | 4822 | Stray space between the parent label and the child letter in Part B's "Contents of the Hearing Request" list. Without it `VI.B.3.` tokenized a second time, the item became a **duplicate of its own parent id** (merged into `sec-proc-B-VI-B-3`), and the sibling run read a → c. Part A prints the same item correctly at line 1876. |
| `V.D.5.a.(iii)` (inline, mid-line) | moved to its own line | 4238 | Part B's Position Statement list prints (i), (ii), (iv), (v), (vi) down the margin and runs **(iii) inside (ii)'s second line** ("…to take on the Proposal or Redlines. V.D.5.a.(iii) A list of any pending / motions."). Split back out via the new `KNOWN_INLINE_LABEL_SPLITS`. |

Both report `OK (1 hit)`.

### Documented, deliberately NOT corrected (`KNOWN_LABEL_ANOMALIES["proc"]`)

- **Part A `VI.C.14` is skipped.** Part A prints VI.C.12 Location of Hearing, VI.C.13
  Continuances, **VI.C.15** Subpoenas, VI.C.16 Filing and Service. Part B prints the
  identical list correctly numbered (…13, **14** Subpoenas, 15 Filing and Service), so
  no item is missing — it is a printed numbering slip. Part A's own text cites the
  PRINTED labels ("VI.C.6, VI.C.12-13, and VI.D.8", line 1930), so renumbering would
  break live cross-references. No `sec-proc-A-VI-C-14` row exists.
- **Part B `III.W` is skipped.** Definitions run …III.V Rulemaking Request, **III.X**
  State Implementation Plan, III.Y Working Day, III.Z Written Testimony. The terms stay
  in strict alphabetical order across the gap, so no definition is missing. No
  `sec-proc-B-III-W` row exists.

---

## Quality-gate results A–I

**A. Structure — PASS (with two printed-outline defects documented).**
Parsed tree: root → PART A (sections I…XI) → PART B (sections I…XII), in printed order,
matching the body exactly. Three outline-vs-body facts worth recording, all source
defects, none affecting the parse:
(i) Part A's outline lists a "XII. Statements of Basis, Specific Statutory Authority,
and Purpose" that the **body never prints** — the statements of basis are consolidated
as Part B Section XII. Part A really does end at Section XI.
(ii) Part A's outline prints Section VIII's five subsections as `VII.A`…`VII.E`
(lines 114-124) — they belong to Section VII; the body's own Section VIII correctly
runs VIII.A–VIII.C.
(iii) Both outlines are front matter and are skipped by `find_body_start`; neither is
parsed as structure.

**B. Coverage — PASS.** Cleaned body: 55,855 words. Parsed `full_text` across all
791 rows: 55,219 words = **98.86%**. Bag-difference analysis: of the 660 missing tokens,
**659 are citation labels** that `full_text` deliberately omits (the app re-inserts them
as badges — one per item row, 765 item rows) and **exactly one** is other text (the "b."
from the corrected `VI.B.3. b.` label). Excluding labels the coverage is 99.998%.
The first run of this gate is what found the dropped PART intro paragraphs
(`part_intro_text`, 121 words of applicability text).

**C. Repeated-text heuristic — PASS (1 hit, legitimate).** One row repeats a 50-char
paragraph prefix ≥3×: `sec-proc-B-XII-I` × 4, "The adopted revisions do not add any new
requireme…". That is boilerplate the December 2024 statement of basis genuinely prints
under four different section discussions ("Section V.F.2. Commencing the Hearing",
"Section V.C. Participation in Rulemaking", …). Not a fusion bug.

**D. Giant / fused rows — PASS.** Ten longest: 39,158 / 8,163 / 7,465 / 5,812 / 4,446 /
4,423 / 3,894 / 3,413 / 3,152 / 2,320 chars. Only one exceeds 15,000:
`sec-proc-B-XII-I` (39,158 chars, 5,290 words) — the December 18, 2024 statement of
basis, the rulemaking that **rewrote the whole document and created Part B**, so it
walks through nearly every section. It is one printed entry (XII.I; the next thing in
the document is the Editor's Notes), its internal "Section V.F.2. …" sub-headings are
narrative prose, not labels, and it contains no label-shaped line that should have
become a row (verified by grepping every line of 6010-7104). Legitimately long.
Rows 2-9 are the other eight statements of basis and the two Section I introductions.

**E. Orphans and label anomalies — PASS.** Every `parent_id` resolves (791/791); zero
duplicate ids (the one pre-fix duplicate, `sec-proc-B-VI-B-3`, is gone); every label
sequence under every parent is contiguous **except the two documented printed gaps**
(Part A `VI.C.13 → VI.C.15`, Part B `III.V → III.X`). A separate sweep for
label-shaped lines that produced no row found 8 candidates, all correctly rejected:
6 wrapped `C.R.S.` statute-citation continuations and 2 wrapped internal citations
(`V.D.6.` at 1651, `III.L.2.` at 3226). The continuation guard flagged 84 candidates,
rejected 13, kept 71 — each of the 13 hand-checked and confirmed a wrapped citation.

**F. Statement of basis — PASS.** It is **not a part**: it is Part B's **last section,
XII** ("STATEMENTS OF BASIS, SPECIFIC STATUTORY AUTHORITY, AND PURPOSE", line 6010),
with nine entries printed as ordinary compound CYCLE_AB labels `XII.A.` … `XII.I.`
(January 16 1998 → December 18 2024). That is the Reg 8 / `aqs` per-SECTION shape, so
`SOB_PART_CONFIG` does not apply. **`SOB_SECTION_CONFIG` was evaluated and deliberately
not added**: its job is to stop an entry's narrative restarting a label ladder, and
nothing inside 6010-7104 begins a line with a tokenizable label (the only line-initial
candidates are wrapped `C.R.S.` fragments, which `tokenize_by_cycle` rejects anyway
because no space follows). All nine entries parsed to their own row, in order, each
opening with its printed "Revisions to … adopted <date>" line. Part A has **no**
statement-of-basis section at all (gate A(i)).

**G. Cross-references — PASS, with source defects reported.**
Parsed output: 338 `<span class="xref">` spans + 7 `<a class="xref-external-reg">`
anchors. Spans by target: root 38, Part A 115, Part B 176, bare "Part A" 7, "Part B" 2.
External: `Regulation Number 3` ×4 and `Regulation Number 7` ×3 — both resolve (both in
corpus). Buckets:
- `other_reg`: `Regulation Number 10` ×3 — **correct**; Reg 10 is Batch 7's `agent_small7`
  assignment and is not yet in `CORPUS_REGS`. It will link automatically once merged.
- `cfr`: empty. `form`/`crs`/`other_ccr`: empty.
- `historical`: `Part C` ×1 — from "operating permits issued under Part C of Regulation
  Number 3" (`sec-proc-B-VII-D-14`). `PART_RE` resolves a bare "Part C" against the
  CURRENT document's parts, which stop at B, so it buckets. The "Regulation Number 3"
  half of the same phrase links correctly. A second instance wraps across a line
  ("…under Part\nC of Regulation Number 3") and is correctly left alone. **Generic
  tokenizer limitation for the `Part X of Regulation N` shape, not proc-specific**;
  fixing it would change every regulation's output, so it is out of scope per the brief.
- `unparseable`: 7 distinct / 9 mentions, **all of them stale references printed in the
  source**, not parser gaps — `V.F.13.` ×3, `V.F.13.a.`, `V.E.5.c.(ix)`, `V.E.5.c.(vi)`,
  `V.E.7.b.`, `V.E.4.c.(i)`, `V.E.(3)(c).` (the last is also malformed as printed).
  Verified against the source: Part A's V.F ends at **V.F.12**, and Part A's V.E.5
  ("Status Conference") and V.E.7 ("Final Economic Impact Analyses") print **no
  children at all**. These are leftovers from the pre-2025 text.
- **11 cross-part fallback resolutions — flagged, not fixed.** When a citation's target
  does not exist in the row's own part, `_default_parts_order` falls back to the other
  part. Ten Part B rows cite "Section III.J.2."/"III.J.3." (electronic filing) and get
  sent to **Part A's** III.J.2/III.J.3 — Part B renumbered that provision to III.L.2/
  III.L.3 but its Section VI text still prints the old number
  (`sec-proc-B-VI-B-2`, `-VI-C-5-a`, `-VI-C-15`, `-VI-F-1`, `-XII-E`). One Part A row
  (`sec-proc-A-V-E-14`) cites "Section V.D.6.", which exists only in Part B (Part A's
  V.D stops at 4). All eleven are printed source errors; the links go to a real
  provision with the cited number, just in the other part. Changing the fallback order
  would affect every multi-part regulation, so it is left as-is and recorded here.
- Remaining unwrapped "Section…" text: 12 — the same stale citations.

**H. Tables — N/A (PASS).** The document prints no tables. `extract_tables_from_pdf`
found 0; 0 rendered, 0 injected. Nothing to verify.

**I. Tests — PASS.** `python3 -m pytest -q test_import_ccr.py` → **545 passed, 7 skipped,
44 subtests passed** (baseline 511 passed / 7 skipped; +34 new tests, all mine).
`python3 -m pytest -q test_summarize.py` → **206 passed, 2 skipped** (baseline 196/2).
`python3 -m pytest -q test_freshness.py` → 75 passed.
New test classes in `test_import_ccr.py`: `ProcMetaTests`, `ProcMentionReTests`,
`ProcLinkCitationTests`, `InlineLabelSplitTests`, `ProcKnownFixTests`,
`ProcHeadingChildChainTests`, `ProcEndToEndTests`, `Batch7ProcNoOpProofTests`.

**Three pre-existing tests were edited** (each a one-assertion change, each because the
new anchors are real):
- `Batch6SmallNoOpProofTests._check` now holds `"proc"` out of BOTH parses, so it keeps
  measuring only what it was written to measure (that 16/sip/18 change nothing).
- `Reg11FullParseTests` / `Reg20FullParseTests` / `Reg21FullParseTests`
  `test_cross_references` asserted `assertNotIn("xref-external-reg", …)`. They now
  assert the only external anchors are `proc` ones, with an exact count (3 / 2 / 2).

---

## No-op proof (both directions)

Baselines: the centrally produced `out/base_{26,30,25,7,ecmc}.json`. Reproduced
`base_26.json` byte-for-byte with `import_ccr.ORIGINAL.py` first, to confirm this
checkout's `sources/*.txt` match the ones the baselines were built from (they do —
`cmp` clean against `../base/sources/` for all six `.txt` files).
Runner: `prove_noop_proc.py <reg> <BASENAME> with|without <out.json>` (one document per
subprocess, one at a time), outputs in `out/noop/`.

**Direction 1 — `"proc"` REMOVED from `CORPUS_REGS`: byte-identical, all five.**

| document | result |
|---|---|
| Reg 26 | `cmp` clean vs `base_26.json` |
| Reg 30 | `cmp` clean vs `base_30.json` |
| Reg 25 | `cmp` clean vs `base_25.json` |
| Reg 7 | `cmp` clean vs `base_7.json` |
| ECMC | `cmp` clean vs `base_ecmc.json` |

**Direction 2 — `"proc"` PRESENT: every difference is a new `proc` anchor.**
`strip_reconstruct.py out/base_<k>.json out/noop/with_<k>.json proc` — strip the
`<a class="xref-external-reg" data-provision-id="sec-proc-top-REG-proc"
href="/regulations/proc">X</a>` wrapper from the new file and it equals the old file,
field by field:

| document | rows | changed rows | anchors added | unexplained |
|---|---|---|---|---|
| Reg 26 | 626 | 4 | 4 | **0** |
| Reg 30 | 444 | 3 | 3 | **0** |
| Reg 25 | 993 | 3 | 3 | **0** |
| Reg 7 | 2,182 | 21 | 21 | **0** |
| ECMC | 6,754 | 0 | 0 | **0** |

**31 anchors across the five mandated baselines, zero unexplained changes.** Every
changed row is a statement-of-basis entry (`sec-26-C-I…IV`, `sec-30-C-I…III`,
`sec-25-C-I…III`, `sec-7-C-N…II`). Five examples with the source phrase:

1. `sec-26-C-I` — "…et seq., and the Air Quality Control Commission's (Commission) **Procedural Rules, 5 C.C.R. §1001-1**."
2. `sec-30-C-I` — "…(State Air Act), and the Air Quality Control Commission's (Commission) **Procedural Rules, 5 Code Colo. Reg. § 1001-1**."
3. `sec-30-C-II` — "…**Procedural Rules, 5 Code Colo. Reg. section 1001-1**." (the "section" spelling)
4. `sec-25-C-II` — "…and the Air Quality Control Commission's (Commission) **Procedural Rules, 5 C.C.R. §1001-1**."
5. `sec-7-C-N` — "…§ 25-7-110.5., and the Air Quality Control Commission's ("Commission") **Procedural Rules**." (no CCR cite printed)

**Corpus-wide anchor count** (parsed every corpus document whose source is in this
checkout; the resolver is the only thing that changes in any of them):

| doc | anchors | doc | anchors | doc | anchors |
|---|---|---|---|---|---|
| 7 | 21 | 9 | 5 | 27 | 5 |
| aqs | 5 | 26 | 4 | 25 | 3 |
| 30 | 3 | 11 | 3 | 1 | 2 |
| 2 | 2 | 20 | 2 | 21 | 2 |
| 24 | 2 | cp | 2 | 19 | 1 |
| 12 | 0 | 16 | 0 | sip | 0 |
| 18 | 0 | ecmc | 0 | | |

**62 anchors across the 20 corpus documents measurable here (15 of them carry at least one).** `sources/REG_{3,6,8,22}.txt` are not in this
checkout, so Reg 3/6/8/22 could not be measured — their statements of basis use the
same printed sentence, so expect a handful more each. Inside `proc` itself the
resolver creates **38 same-document self-links** to `sec-proc-top-REG-proc` (the
`aqs` self-mention behaviour).

---

## Things I could not resolve

1. **11 cross-part fallback links** (gate G) — printed stale references; the fix would
   have to change `_default_parts_order` for every multi-part regulation.
   Ids: `sec-proc-B-VI-B-2`, `sec-proc-B-VI-C-5-a`, `sec-proc-B-VI-C-15`,
   `sec-proc-B-VI-F-1`, `sec-proc-B-XII-E` (each ×2, "Section III.J.2."/"III.J.3.") and
   `sec-proc-A-V-E-14` ("Section V.D.6.").
2. **9 unparseable citations** (gate G) — stale references to Part A sections the
   02/14/2025 edition no longer prints (`V.F.13.`, `V.E.5.c.(ix)`, …). Source defect;
   nothing to link them to.
3. **`Part C` ×1 in the historical bucket** (`sec-proc-B-VII-D-14`) — the
   `Part X of Regulation N` tokenizer shape; out of scope per the brief.
4. **Section rows whose heading is the first body paragraph.** `sec-proc-A-I` and
   `sec-proc-B-I` carry `<p>INTRODUCTION</p>` as their first paragraph with `title`
   = "I." rather than "I. INTRODUCTION", because the heading is followed by body text
   rather than standing alone. This is the existing corpus-wide behaviour
   (`sec-26-B-I`, `sec-30-B-III`, `sec-25-C-I` all do it); `heading_line_own_paragraph`
   was considered and NOT set, because it would have changed nothing here (the heading
   already gets its own paragraph — the blank line is printed) while risking false
   splits. Flagged so nobody reads it as a proc-specific defect.
5. **Editor's Notes tail.** The document ends with a 70-underscore rule, "Editor's
   Notes" and a "History" block, which land as the last three paragraphs of
   `sec-proc-B-XII-I`. Unlike Reg 11 / aqs, the rule line here is separated by blank
   lines, so nothing fused into a sentence and no `KNOWN_TEXT_FIXES` entry was needed.
   The summarizer will see a changelog at the end of that row (warned below).

---

## What the summarizer should be warned about

1. **Two parallel procedures, one document — the Reg 21 trap.** Part A and Part B cover
   the same subject with near-identical section numbering and differ only by the
   August 1, 2025 cutover. This is exactly the shape that made Reg 21's model prepend a
   guessed scope tag to ~60% of rows. Per `START_HERE.md`, `REG_PROMPT_HINTS["proc"]`
   therefore says the opposite, verbatim and tested:
   > "The August 1, 2025 split between Part A and Part B is stated on the two PART rows
   > and nowhere else: never repeat it, name a part, or add a date window on any other row."
   `test_proc_hint_forbids_restating_the_part_a_part_b_date_split` asserts that exact
   sentence is present and that the inviting phrasings ("state which part applies", …)
   are absent.
2. **Definitions are per-part and differ.** "Alternate Proposal" is Part A III.D AND
   Part B III.E, with different wording; "Division" is Part A III.H but Part B III.J;
   "Good Cause" is Part A III.K but Part B III.M. The hint says "as Section III of this
   **same part** defines them".
3. **"Hearing Officer" is never defined** in either part's Section III, despite 267
   uses. The brief's "Hearing Officer/Presiding Officer as defined" is not achievable:
   **"Presiding Officer" does not appear in this document at all** (0 occurrences). The
   hint tells the model to describe the Hearing Officer only as the row itself does,
   and a test asserts "Presiding Officer" is NOT in the hint.
4. **Statutes: name, don't describe.** § 24-4-101 et seq., C.R.S. (the State
   Administrative Procedure Act / APA) and § 25-7-101 et seq., C.R.S. (the Act) are
   cited constantly; also § 24-4-105(4), quoted wholesale as Section IX of both parts.
5. **Numbers must be verbatim.** Deadlines here are the substance: "sixty (60) days",
   "ten working days", "twenty (20) days after publication", "twenty (20) megabytes",
   page limits, copy counts and time allotments. The document distinguishes **"day"
   (calendar)** from **"working day"** as separate defined terms — the hint requires
   saying which the text used.
6. **Section XII rows are rulemaking history, not requirements** — 9 rows, 1998-2024,
   about 76,000 characters between them. `sec-proc-B-XII-I` also ends with the
   Editor's Notes changelog ("Entire rule eff. 11/30/2007 … eff. 02/14/2025").
7. **Stale cross-references.** Some rows cite sections this edition no longer prints
   (`V.F.13.`, `V.E.5.c.(ix)`) and some Part B rows cite Part A numbering
   (`III.J.2.`/`III.J.3.` where Part B means III.L.2/III.L.3). The hint tells the model
   to say the row *cites* the target rather than describing it.
8. **Four rows start mid-sentence** (`sec-proc-A-V-C-6-a-(i)`, `-(ii)`, `-(iii)`,
   `sec-proc-B-VI-I-2-a-(i)`) — legitimate list fragments continuing their parent's
   lead-in. The base prompt's existing "appears to start mid-sentence" rule covers them.
9. **This is procedure, not pollution control.** No emission limits, no thresholds, no
   geography. The hint opens with "not a pollution-control rule" and the audience is
   `anyone appearing before the Colorado Air Quality Control Commission in a rulemaking
   or adjudication` — not an operator.

`REG_PROMPT_HINTS["proc"]` is **199 words** (limit 200).

---

## Deliverables

| file | |
|---|---|
| `out/regproc_parsed.json` | 791 rows (+ `_corrections` / `_duplicate_ids` / `_marker_audit` / `_unresolved` sidecars) |
| `out/regproc_db.json` | `[]` (no DB access from here — every row diffs as `new`, expected) |
| `out/regproc_diff_report.md` | parsed 791 / DB 0 / only-parsed 791 |
| `out/apply_regproc/` | `plan.json`, `stats.md`, 4 upsert SQL files (596,409 bytes), `summary_regen_ids.txt` (791 ids). **All three sanity checks PASS** |
| `regproc.patch` | `import_ccr.py` + `test_import_ccr.py` vs the ORIGINALs (781 lines) |
| `regproc_summarize.patch` | `summarize.py` + `test_summarize.py` vs the ORIGINALs (151 lines) |
| `prove_noop_proc.py` | the no-op runner used above |
| `sources/manifest.json` | + the `proc` entry (9 lines) |

Both patches were verified to apply cleanly to the pristine ORIGINALs with `patch -p0`
and to reproduce these four files byte-for-byte.
