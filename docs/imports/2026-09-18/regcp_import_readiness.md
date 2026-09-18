# Reg cp (Common Provisions Regulation) — import readiness report

## Verdict: READY

## Regulation identity
- Title as printed (title page): **COMMON PROVISIONS REGULATION**
- CCR cite: **5 CCR 1001-2**
- `root_title` set: `COMMON PROVISIONS REGULATION 5 CCR 1001-2`
- `root_citation` set: `Code of Colorado Regulations · Common Provisions Regulation`
- Effective date: 12/15/2025 (per BATCH3_BRIEF.md; the PDF's own front matter carries no
  single "Effective Date:" line — the latest Statement-of-Basis entry, V.V., is "Adopted
  October 17, 2025", consistent with a Dec 2025 effective print)
- Page count: **73** (confirmed via `pdfplumber.open(...).pages`)
- `sources/REG_CP.txt`: **4,425 lines** (confirmed via `wc -l`)
- Structure: **no parts** (`grep -n "^\s*PART [A-Z]" sources/REG_CP.txt` is empty) — five
  top-level roman sections: I. Definitions, Statement of Intent, and General Provisions;
  II. General; III. (State Only) Civil Penalties; IV. Reserved; V. Statements of Basis,
  Specific Statutory Authority, and Purpose.

## Row counts
- **Total rows: 220**
- By kind: `root` 1, `section` 5, `item` 91, `definition` 123
- Rows per top-level section (excluding the root):
  - I. (Definitions/Intent/General Provisions): **136** (includes the 123 term-definition rows under I.G.)
  - II. (General): **53**
  - III. ((State Only) Civil Penalties): **6**
  - IV. (Reserved): **1** (heading-only)
  - V. (Statements of Basis): **23** (the V. heading row + 22 dated entries V.A.–V.V.)
- Rows with ≥25 words (get AI summaries): **131**
- Longest row: `sec-cp-V-D` (V.D. — "Adopted March 10, 1983 - Prevention of Significant
  Deterioration"), **64,690 characters** — a single long narrative Statement-of-Basis
  entry (PSD rationale/history), consistent with `inner_items: False` (see below); not a
  fused-row bug (gate C found zero repeated-paragraph hits inside it or anywhere else).
  Next longest: V.B. (13,424), V.G. (12,714), V.I. (11,008), V.Q. (10,830), V.S. (10,208),
  V.H. (7,117), V.K. (5,183), V.L. (4,766), V.P. (4,286) — all Statement-of-Basis entries.

## Changes made to import_ccr.py (each one, one line, with the reason)
1. `CORPUS_REGS["cp"] = "cp"` — registers Common Provisions in the corpus so other
   regulations' references to it can resolve.
2. `REG_META["cp"]` added (`no_parts: True`, state/CDPHE-APCD metadata, root
   citation/title) — reuses Reg 1's part-less mechanism verbatim; no new capability
   needed for the part-less body itself.
3. `SOB_PART_CONFIG["cp"] = {"section": "V", "top_family": "letter_dated",
   "roman_prefix": "V", "top_opener_re": Adopted(:)?, "inner_items": False}` — Section V
   is a section-scoped statement of basis exactly like Reg 1's Section X, with the
   section's own "V." carried as a constant roman prefix on each dated entry (V.A.–V.V.).
4. `TERM_DEFINITIONS_SECTION = {"cp": [("roman","I"), ("upper","G")]}` (new config dict)
   — names the one section (I.G.) whose defined terms are printed as unlabeled all-caps
   headings with no printed number at all (every other AQCC definitions list seen so far
   prints an ordinary numbered/lettered label).
5. `_TERM_HEADING_RE` + `_match_term_heading_line()` (new) — recognizes one term heading
   line: all-caps, alone on its own paragraph (blank line or page seam before, blank line
   after).
6. New `elif TERM_DEFINITIONS_SECTION.get(reg or ""):` branch inside `scan_markers`'s
   ordinary-item loop (reached only when `tokenize_by_cycle` found no compound label at
   all on the line — a real "II." marker, or a compound "I.G.4." label, always tokenizes
   first and never reaches this branch) — synthesizes a sequential digit sub-label
   (`I.G.1.`, `I.G.2.`, ...) for each recognized term, in printed order, so each defined
   term becomes its own row instead of the whole ~2,600-line block being fused into one
   `sec-cp-I-G` row.
7. `build_provisions`: `kind = "definition"` and `title = f"{citation} {term}"` when a
   marker carries `mk["term"]` — a synthesized term row is titled with the actual defined
   term ("I.G.1. ABSOLUTE VAPOR PRESSURE"), not the uninformative bare citation.
8. `COMMON_PROVISIONS_RE` (new regex) — recognizes "Common Provisions[ Regulation]"
   (with or without the word "Regulation", case-insensitive on "regulation" itself, since
   every AQCC regulation's text names it this way and never by number), optionally
   followed by a "[,] Section(s) <list>" clause naming one of its sections.
9. `_cp_known_ids()` (new, module-level cache) — lazily parses Common Provisions' own
   source text once per process so a cross-reference to it from another regulation can be
   verified against ids that actually exist, the same "IF AND ONLY IF the target exists"
   rule every same-reg citation already follows. Gated on `"cp" in corpus_regs`; never
   invoked for reg=="cp" itself (a self-mention resolves against the current parse's own
   `known_ids`, like any other same-reg citation).
10. `_emit_cp_section_list()` (new) — cross-regulation twin of `_emit_section_list`; wraps
    a resolved Common Provisions section as `<a class="xref-external-reg"
    data-provision-id="sec-cp-...">` (carrying both the resolved id and a page link),
    instead of the same-reg `<span data-target>` shape.
11. New "1.5)" step in `link_citations` (before steps 2-4, so it claims a trailing
    "Section(s) <list>" before the bare `SECTION_RE` step could wrongly try to resolve it
    against the *citing* regulation's own ids) — routes a bare mention to the cp root
    (`sec-cp-top-REG-cp`) and a section-qualified mention to that section, as a same-reg
    `<span>` when `reg == "cp"` (self-mention) or a cross-reg `<a>` otherwise.

Everything above is additive and gated by regulation key (`REG_META.get("cp")`,
`TERM_DEFINITIONS_SECTION.get(reg)`, `"cp" in corpus_regs`) — no existing branch's
behavior changed for any other regulation. See the no-op proof in gate G below.

## Label fixes added
**None.** No source-text label typos were found in Common Provisions (no
`KNOWN_LABEL_FIXES`/`KNOWN_TEXT_FIXES` entries were needed). One cosmetic oddity in the
source itself is worth flagging but was deliberately left as printed, not "fixed": the
definition term at I.G. is printed **"SOURCE DEFINTIONS"** (missing the "i" in
"DEFINITIONS") — this is the government's own typo in the term's *name*, not a structural
label our tokenizer depends on, so per this project's convention of parsing (not
rewriting) the source, it is carried through verbatim as `sec-cp-I-G-108`'s title.

## Quality-gate results A–I

**A. Structure check — PASS.** The parsed tree's top level (I, II, III, IV, V) matches
the PDF's own "Outline of Regulation" front matter exactly, in order, with 0 orphans and
0 duplicate ids (verified programmatically over all 220 rows).

**B. Coverage check — PASS.** Source body word count (post `find_body_start_no_parts`,
via the same `clean_pages` the parser uses): 36,335 words. Parsed `full_text` total (tags
stripped): 36,126 words. Ratio 99.4% — well within a few percent; the small gap is
expected HTML-tag/table-cell tokenization noise, not dropped prose.

**C. Repeated-text heuristic — PASS.** Checked every row's paragraphs (first 50 chars of
each `<p>`) for a ≥3× recurrence inside the same row: **0 hits**, including inside the
64,690-character `sec-cp-V-D` row.

**D. Giant/fused rows — PASS, with one justified exception.** `sec-cp-V-D` at 64,690
chars is the only row over 15,000 chars; it is one Statement-of-Basis entry ("Adopted
March 10, 1983 - Prevention of Significant Deterioration") kept undivided by design
(`inner_items: False` — see gate F), the same convention already established for Reg 1's
Section X and Reg 3's Part F. Gate C found no internal repetition, so this is a long
narrative document, not a fused set of siblings. The next 9 longest rows (13,424 down to
4,098 chars) are all other Statement-of-Basis entries for the same reason.

**E. Orphans and label anomalies — PASS.** Every `parent_id` resolves (checked
programmatically); 0 duplicate ids; every label sequence is contiguous, including the
synthesized `I.G.1.`–`I.G.123.` run and the `V.A.`–`V.V.` run (22 consecutive letters, no
gaps). `scan_markers`'s column-drift audit flagged 5 candidates — all `accepted: True`,
all attributable to the same known page-layout quirk: `I.A.`/`I.B.` are printed 4 spaces
indented (a page-one column-layout artifact) while `I.C.` onward, and every other section
heading, sit at indent 0; the audit's "learned column" locked onto 4 from those first two
examples and then correctly flagged every later indent-0 heading as a deviation without
rejecting any of them (indent only feeds this audit, never marker acceptance). No
`KNOWN_LABEL_FIXES` entry was needed.

**F. Statement-of-basis part — PASS.** Section V is the statement-of-basis section
(section-scoped, not a part — same mechanism as Reg 1's Section X). Family:
`letter_dated` with `roman_prefix: "V"` (every entry is printed "V.<letter>.  Adopted
<date>[ - <topic>]"). 22 top-level entries, V.A. (Adopted December 14, 1978) through V.V.
(Adopted October 17, 2025), each its own row, in order, ids `sec-cp-V-A`..`sec-cp-V-V`.
Inner numbered lists restart inside individual entries (confirmed: V.D.'s Class I area
findings restart their "1." list three times), so `inner_items: False`, matching Reg 1
and Reg 3's Part F convention — every entry is one undivided row.

**G. Cross-references — PASS, this is the headline result.**
- *Within cp's own text*: 146 same-reg `<span class="xref">` spans link successfully
  (69 to the root, 17/43/13/1/3 to Sections I/II/III/IV/V respectively).
- *Unresolved, cp's own parse*: historical bucket 15 distinct/28 mentions (references to
  the pre-renumbering structure — old "Part A"/"Part D", old sections VII, VIII.B.,
  IX., X., XI.A.4, XIII.B.2., XIV.A.–F — all confirmed by reading the surrounding SOB
  narrative describing superseded structure); other-reg bucket 4 distinct/9 mentions
  (Regulation Numbers 5/9/11 — not in the corpus); cfr bucket 2 distinct/2 mentions (40
  CFR Part 60 / Part 98 Subpart A — not in the corpus); unparseable bucket 11
  distinct/12 mentions — every one checked by hand against the source: `V.A.3.` (x2,
  line 3613/3642 — explicitly "The Commission deleted Section V.A.3."), `IV.C.`/`IV.C.3.`/
  `IV.C.4.e(iii)` (line 1885/1893/2460 — pre-2020 Civil Penalties structure, before Part
  IV became "Reserved"), `IV.D.2.a.(iv)` (line 1722 — this one is actually a *Regulation
  Number 3* citation whose "of revised Regulation Number 3" qualifier comes AFTER the
  section reference, a phrase order this parser's `REG_NUM_RE`/`PART_RE` don't handle in
  either direction — a pre-existing, reg-agnostic limitation, not cp-specific), `IV.D.3.`/
  `IV.D.3.a.(i)(C)`/`IV.D.3.a.(vi)` (same pre-Reserved Part IV history), `II.E.6.`/`II.J.7.`
  (line 3989-3990 — superseded sub-items of the current II.E./II.J., since renumbered). No
  systemic tokenizer gap found; every unparseable hit is either a genuinely stale
  historical citation or the one pre-existing cross-reg phrase-order limitation noted
  above.
- **Cross-references TO cp from Reg 1/2/26 (the "big prize")**: with `cp` **removed**
  from `CORPUS_REGS`, `python3 import_ccr.py parse` for Reg 1/2/26 against
  `sources/REG_{1,2,26}.pdf` is **byte-identical** to `out/reg{1,2,26}_baseline.json`
  (verified programmatically: `json.dumps(parse_reg(...)[0], ...) == baseline file`).
  With `cp` **present**, diffing against the same baselines: **15 rows differ across the
  three regulations** (Reg 1: 6, Reg 2: 5, Reg 26: 4), and — verified programmatically by
  stripping every new `<a class="xref-external-reg" data-provision-id="sec-cp-...">` tag
  back out of the new text and confirming it reconstructs the baseline text exactly,
  row by row — **every single difference is exactly one or more new links, nothing
  else changed**. **24 new links total** (Reg 1: 9, Reg 2: 7, Reg 26: 8). Five examples
  with the source phrase:
  1. Reg 1, `sec-1-VI-B-3`: *"The term 'modification' is as defined in the Common
     Provisions Regulation, Section I.G. except that..."* → bare mention links to
     `sec-cp-top-REG-cp`, and `Section I.G.` gets its own deep link to `sec-cp-I-G`.
  2. Reg 1, `sec-1-X-K`: *"...refer to Common Provisions Regulation, section II.I.)."*
     → bare mention links to `sec-cp-top-REG-cp` (the lowercase "section" that follows is
     left as plain text, matching this codebase's existing case-sensitive "Section(s)"
     keyword convention used everywhere else).
  3. Reg 2, `sec-2-B-II`: *"...the Commission's Common Provisions (5 C.C.R. 1001-2) shall
     apply."* → the bare informal name (no "Regulation" word at all) links to
     `sec-cp-top-REG-cp`.
  4. Reg 26, `sec-26-B-I-D-5-d-(ii)`: *"...in accordance with AQCC Common Provisions
     Regulation Section II.C."* (no comma before "Section") → bare mention links to the
     root, and `Section II.C.` deep-links to `sec-cp-II-C`.
  5. Reg 1, `sec-1-X-O`: *"...the Commission's Common Provisions regulation defines air
     curtain destructors..."* (lower-case "regulation") → links to `sec-cp-top-REG-cp`.

**H. Tables — PASS.** One captioned table, "Table 1 – Maximum civil penalty" (III.B.3,
row `sec-cp-III-B-3`), recovered via the existing pdfplumber table pipeline with no new
config needed — it rendered as a clean 6-row/5-column `<table class="doc-table">` (Date,
CPI, Change in CPI, Maximum Civil Penalty, Penalty Effective Date), spot-checked against
the source and matches exactly.

**I. Tests — PASS.** `python3 -m pytest -q test_import_ccr.py`: **124 passed, 6 skipped**
(all 6 skips are pre-existing, file-existence-gated skips unrelated to this change —
`reg7_parsed.json`/`reg7_db.json` and `ECMC.txt` not present in this checkout; confirmed
by running the untouched `test_import_ccr.ORIGINAL.py` from this same checkout, which
also shows 97 passed/6 skipped — the "93 pass/10 skip" figure in
`AGENT_BRIEF_batch2_reference.md` reflects a checkout that was missing
`sources/REG_2.txt`/`ECMC.txt`, not a baseline this checkout matches). 27 new tests added,
covering: `REG_META`/`SOB_PART_CONFIG`/`TERM_DEFINITIONS_SECTION` config; that CP's
full-dotted-path labels need no new tokenizing capability (`RegCpConfigTests`); the term
heading matcher in isolation; a full synthetic mini-document parse (ids, definitions
becoming rows, the "(State Only)" title, the Reserved heading, section-scoped SOB with
`inner_items: False`, self-references); `COMMON_PROVISIONS_RE` against every confirmed
printed form; `link_citations`'s new cross-reg branch (bare, with-section, no-comma,
unresolvable-section, no-op-when-absent, self-reference); a real end-to-end parse of
`sources/REG_CP.txt` (skipped if absent); and the full no-op + "only new links" proof
against the real Reg 1/2/26 baselines (skipped if the baseline files are absent).

## Things I could not resolve
- The 11 distinct "unparseable" citations listed under gate G — all traced by hand to
  either genuinely stale historical section numbers (pre-dating the current Part
  IV "Reserved"/Section II renumbering) or the one pre-existing, reg-agnostic
  phrase-order limitation ("Section X of Regulation N" — target-then-source order — isn't
  recognized in either direction by `REG_NUM_RE`/`PART_RE`, which only handle
  source-then-target order). None indicate a Common-Provisions-specific parser gap.
- Lowercase "Common Provisions regulation, section X." (lowercase "section") does not
  deep-link its trailing section — only the bare name links. This matches the existing
  codebase-wide convention that `Sections?` is matched case-sensitively (capital S)
  everywhere, not something introduced for cp; flagging it here since it's the one
  instance (Reg 1, `sec-1-X-K`) in the batch.
- "Common Provisions" mentioned *before* its section number in running prose (e.g. Reg 2
  `sec-2-C-III`: "...defined in Section I.G. of the Commission's Common Provisions...")
  is not deep-linked — `COMMON_PROVISIONS_RE` only recognizes the name-then-section order
  actually used in the two "big prize" phrasings the brief called out. The bare name
  still links.

## Anything the summarizer should be warned about for this regulation
- **Common Provisions defines terms for ALL AQCC regulations.** Its 123 I.G. definitions
  (e.g. "AIR POLLUTANT", "STATIONARY SOURCE", "VOLATILE ORGANIC COMPOUND") are the
  controlling definitions Reg 1/2/3/6/7/8/9/22/24/26/30 all incorporate by reference —
  a summarizer should not treat these as narrow to this regulation's own scope.
- **"Division" IS the Air Pollution Control Division (APCD) here** — Common Provisions is
  the regulation that establishes this usage; other regulations' own "Division" mentions
  inherit this meaning from here.
- **III. "(State Only) Civil Penalties"** — the "(State Only)" qualifier is part of the
  printed section title and was kept verbatim in `sec-cp-III`'s title, per the batch
  brief's instruction to preserve such parentheticals as printed.
- **IV. "Reserved"** is a genuine heading-only row with no body text at all — not a
  parsing gap.
- **One table** (III.B.3, civil-penalty CPI adjustment schedule) — dollar figures and CPI
  percentages should be quoted/rounded exactly as printed, not paraphrased.
- **The Statement-of-Basis (Section V) rows are long narrative history**, several
  exceeding 10,000 characters (up to 64,690 for V.D.) — a summarizer should expect to
  compress substantially, and should not treat their length as a parsing defect.
- **"SOURCE DEFINTIONS"** (I.G.108, `sec-cp-I-G-108`) is a verbatim source typo (missing the
  "i" in "DEFINITIONS") — left as printed; a summarizer or downstream display should not
  "fix" it away without knowing it's intentional-verbatim, not a parser artifact.
- A handful of I.G. definitions carry their own internal lettered sub-lists (e.g. I.G.108
  "SOURCE DEFINTIONS" has a./b./c./d. sub-definitions for "Air Pollution Source",
  "Indirect Source", "Mobile Source", "Stationary Source"; I.G. "RESPONSIBLE OFFICIAL"
  and "PROCESS WEIGHT RATE" similarly) — these are kept as paragraphs inside the single
  term row rather than split into further child rows (there is no printed compound label
  to hang a child id on), so a summarizer reading `full_text` should expect to see
  a./b./c. sub-items as plain paragraph text within one term's definition.
