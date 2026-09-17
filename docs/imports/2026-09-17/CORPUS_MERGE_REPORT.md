# Corpus merge report — Reg 1 + Reg 2 + Reg 6 + Reg 8 into one `import_ccr.py`

Deliverables: `/home/claude/working/er/merged/import_ccr.py` (4,830 lines; md5 `18c3bf81737681e7ede53bb27ccc27ca`) and `/home/claude/working/er/merged/test_import_ccr.py` (1,604 lines; md5 `653a525f4a278bcfa4999d845997d122`). Proof artifacts (merged parse outputs, parse logs, the two checker scripts and their logs) are in `/home/claude/working/er/merged/out/`.

## Verdict

- **Tests: 88 passed, 1 skipped** (the pre-existing Reg 7 fixture skip) when run with `sources/` present; 83 passed / 6 skipped in `merged/` itself because 5 of Reg 2's and Reg 8's tests are source-backed and skip without `sources/REG_2.txt` / `REG_8.txt`. 89 test functions = 33 original + 11 (Reg 1) + 17 (Reg 2) + 14 (Reg 6) + 14 (Reg 8); zero duplicate class or test names.
- **Reg 26: byte-identical** to the ORIGINAL parser's output (`agent_reg1/out/reg26_before.json`, md5 `698a5349…`, which every agent's `reg26_after.json` also equals).
- **Reg 1 / 2 / 6 / 8: byte-identical to each agent's `reg<N>_parsed.json`** (plus all four side files) when the merged parser runs with `CORPUS_REGS` restricted to what that agent had. With the full merged corpus, the *only* bytes that differ are 33 newly-resolved cross-reg `<a href="/regulations/{1,6,8}">` links (proved mechanically, itemised below).
- All 17 Reg 1 label/text/continuation fixes, 10 Reg 2 label fixes, 39 Reg 8 label fixes and the 1 Reg 26 fix report `OK` (Reg 6 has none by design).

## How the merge was done

The git 3-way attempt in `merge/` was not salvageable in place: the intermediate merges (`08acb70 merge reg2`, `9bf2cea merge reg6`) had been committed **with their conflict markers still inside**, so the later merges nested `<<<<<<< HEAD` blocks three deep (e.g. `merge/import_ccr.py:820-833`, `2558-2577`, `test_import_ccr.py:921-1600`). I therefore started from `import_ccr.ORIGINAL.py` + `pipeline/test_import_ccr.py` and applied the four agents' own patches (`agent_reg<N>/reg<N>.patch`) in the order 1 → 2 → 6 → 8, after first verifying each patch alone reproduces its agent's two files byte-for-byte from the originals. Hunks that `patch` rejected (all pure adjacent insertions into shared dicts, or one-line additions to `scan_markers`'s local setup) were applied by hand; hunks that applied with fuzz were audited individually (one, Reg 8's `SOB_SECTION_CONFIG`, had landed inside the Part C letter helpers and was moved to its intended spot after `SOB_PART_CONFIG`).

## Conflict-by-conflict decisions

Mapped onto the 12 + 2 hunks marked in `merge/`, all resolved as **keep every side**; where the sides touch the same statement they are composed as described.

| # | Location (merge/ line) | Sides | Resolution in merged file |
|---|---|---|---|
| 1 | `import_ccr.py:282-351` `SOB_PART_CONFIG` tail | reg1 `"1"` (section-scoped, `"section": "X"`), reg2 `"2"`, reg6 `"6"` | All three entries kept, in order 26 → 2 → 1 → 6 (dict; order immaterial). |
| 2 | `import_ccr.py:357-520` after `SOB_PART_CONFIG` | HEAD = reg1's `_sob_scope()` + reg6's `FLAT_ENTRY_PART_CONFIG` block/helpers; reg8 = `SOB_SECTION_CONFIG` | Both kept: `SOB_SECTION_CONFIG` (line 391) → `FLAT_ENTRY_PART_CONFIG` + `_flat_entry_match`/`_flat_entry_title` (439-478) → `_sob_scope` (481) → `_sob_top_label`. |
| 3 | `import_ccr.py:820-833` `CORPUS_REGS` | each side adds its own key | `"1": "1", "2": "2", "3": "3", "6": "6", "7": "7", "8": "8", "22": "22", "26": "26", …` |
| 4 | `import_ccr.py:862-906` `REG_META` | reg1 `"1"` (`no_parts: True`) vs reg2 `"2"` (`part_intro_text: True`) | Both kept (reg6 `"6"` and reg8 `"8"` had auto-merged further down). |
| 5 | `import_ccr.py:1473-1623` `KNOWN_LABEL_FIXES` | reg1 `"1"` (5 entries) vs reg2 `"2"` (10 entries) | Both kept; reg8 `"8"` (39) auto-merged; reg6 has none. |
| 6 | `import_ccr.py:2558-2577` `scan_markers` local setup | reg1 `sob_letter, sob_section = _sob_scope(reg)` / `no_parts`; reg2 `cycle_ab = cycle_ab_for(reg)`; reg6 `flat_cfg/flat_letter/bare_part_ok/flat_active/skip_until`; reg8 `sob_sections = SOB_SECTION_CONFIG.get(...)` | All kept (merged lines 2538-2551). Each is consulted only by its own reg's gate. |
| 7 | `import_ccr.py:3311-3317` `parse_reg` body start | reg1 `apply_known_text_fixes` + `find_body_start_no_parts(lines) if reg_has_no_parts(reg) else find_body_start(lines)`; reg6 `find_body_start(lines, reg)` | Composed: `start = find_body_start_no_parts(lines) if reg_has_no_parts(reg) else find_body_start(lines, reg)` — Reg 1 takes the no-parts path, Reg 6 gets its `bare_part_headings` gate, every other reg hits the unchanged default. |
| 8-12 | the nested duplicates of 1/3/6 produced by the committed-markers problem | — | Subsumed by the above (no additional content). |
| T1 | `test_import_ccr.py:921-1600` | reg1 / reg2 / reg6 test classes appended at the same point | All classes kept (reg8's had auto-merged earlier in the file). |
| T2 | `test_import_ccr.py:1414` (inside T1) `Reg2FullParseTests.test_no_page_furniture_and_no_external_links` | asserted `other_reg == {"Regulation Number 6", "Regulation Number 61"}` | **Only deliberate semantic edit in the merge**: changed to `{"Regulation Number 61"}` plus an assertion that a `/regulations/6` link now exists, because Reg 6 joined the corpus (see cross-reg deltas). Commented in the test. |

Interacting pieces in `scan_markers` / `build_provisions`, and how they compose (merged `import_ccr.py` lines):

- **PART heading** (2631-2672): the ORIGINAL `PART X <title>` regex first; reg6's bare `PART X` form is attempted only when `bare_part_ok` (Reg 6); reg6's `flat_active` flips on only for `flat_letter`. Reg 1 never sees a PART line (`current_part = NO_PART` from reg1, 2554).
- **Appendix** (2701-2736): reg1's blank-line title recovery is gated on `no_parts`; reg1's "next SOB entry closes an open appendix" is gated on `sob_active` (section-scoped SOB only).
- **SOB branch** (2738-2799): entered for a part-scoped SOB (`current_part == sob_letter`: Reg 2 Part C, Reg 6 Part A after its `sob_heading_re`) **or** reg1's `sob_active` (Reg 1 after "X."). reg1's `_match_sob_top()` factoring is verbatim ORIGINAL logic; the synthetic roman-prefix row is suppressed only when `sob_section is not None` (Reg 1).
- **Ordinary CYCLE_AB branch** (2801-2910): reg2's `cycle_ab` (Reg 2 override, identity elsewhere) → reg1's `skip_candidates` → reg8's `SOB_SECTION_CONFIG` guard (Reg 8 only) → reg8's `sibling_chain=(reg in SIBLING_CHAIN_REGS)` and `chained_sibling` override (Reg 8 only) → reg1's `sob_active = True` flip on the configured section (Reg 1 only).
- **build_provisions**: reg1's `provision_id()` (part segment omitted only for `no_parts`), reg2's `part_intro_text` lead-in collection (Reg 2 only), reg6's `type == "entry"` branch (only emitted for Reg 6), reg8's `UNCAPTIONED_TABLES` in-place rendering (Reg 8 only) — all disjoint.
- **link_citations**: reg6's step 1 subpart self-link and step 6 bare-"Subpart Xx" linking gated on `FLAT_ENTRY_PART_CONFIG.get(reg)`; reg8's `CFR_RE_DOTTED` gated on `CFR_DOTTED_REGS`.

Structural cross-check: for each agent file, `diff agent_reg<N>/import_ccr.py merged/import_ccr.py | grep '^<'` lists only ORIGINAL lines that a *different* agent rewrote (reg2's footer regex line in `clean_pages`, reg8's `extract_tables_from_pdf(pdf_path, reg)` / `CFR_RE` / `sibling_chain` signatures, reg6's `_heading_continuation_lines` refactor, reg1's `_match_sob_top`/`provision_id`/diff-report sampling) — no agent-authored line is missing.

## Step 1 — tests

```
$ cd merged && python3 -m pytest -q test_import_ccr.py
83 passed, 6 skipped        # 5 skips = Reg2/Reg8 source-backed tests, no sources/ here

$ cd <scratch with sources/> && python3 -m pytest -q test_import_ccr.py -rs
SKIPPED [1] test_import_ccr.py:345: pipeline/out/reg7_parsed.json and reg7_db.json not present in this checkout
88 passed, 1 skipped in 0.24s
```

Per-agent baselines for comparison: reg1 43+1s, reg2 49+1s, reg6 46+1s, reg8 46+1s, original 32+1s.

## Step 2 — parses and byte comparisons

Scratch dir: `sources/` = copy of `agent_reg8/sources/` (REG_1/2/6/8 .pdf+.txt, REG_26.txt); `python3 import_ccr.py parse --reg N --pdf sources/REG_N.pdf --out out/regN_merged.json` for N ∈ {1, 2, 6, 8, 26}.

```
reg26 vs ORIGINAL output (reg26_before.json, md5 698a…): IDENTICAL
reg1: differ: char 18515, line 368     (22 diff lines)
reg2: differ: char 112845, line 2159   ( 2 diff lines)
reg6: differ: char 16163, line 89      (18 diff lines)
reg8: differ: char 772718, line 11411  ( 2 diff lines)
```

**Proof A — every differing byte is a new cross-reg link** (`out/xreg_check.py`: for each differing row, unwrap `<a class="xref-external-reg" href="/regulations/N">TEXT</a>` → `TEXT` for N in the newly-merged regs on the merged side only, then require equality with the agent's row; any other field or residual text difference fails):

```
  row sec-1-II-C-2-c-(i): 1x [Regulation Number 8] -> /regulations/8
  row sec-1-III-B-4:      1x [Regulation Number 6] -> /regulations/6
  row sec-1-III-B-4-a:    1x [Regulation Number 6]
  row sec-1-III-B-4-b:    1x [Regulation Number 6]
  row sec-1-III-D-2-h-(v):1x [Regulation Number 8]
  row sec-1-VI-B-4-f:     1x [Regulation Number 6]
  row sec-1-X:            1x [Regulation Number 8]
  row sec-1-X-H:          1x [Regulation Number 6]
  row sec-1-X-N:          3x [Regulation Number 6]
  row sec-1-X-O:          1x [Regulation Number 6]
  row sec-1-X-P:          1x [Regulation Number 8]
reg 1: 344 rows, 11 rows differ — totals {Reg 8: 4, Reg 6: 9}
  OK: every changed byte is a newly resolved cross-reg link

  row sec-2-B-IX-A-5-a:   1x [Regulation Number 6] -> /regulations/6
reg 2: 310 rows, 1 row differs — totals {Reg 6: 1}   OK

  row sec-6-A-SUBPART-Da: 1x [Regulation Number 8]
  row sec-6-A-XXI:        1x [Regulation Number 8]
  row sec-6-B-VIII-B-10:  1x [Regulation Number 8]
  row sec-6-B-VIII-D-5-b: 1x [Regulation Number 8]
  row sec-6-B-VIII-E-1-a: 1x [Regulation Number 8]
  row sec-6-B-VIII-E-2:   1x [Regulation Number 8]
  row sec-6-B-VIII-E-3:   1x [Regulation Number 8]
  row sec-6-B-IX-C:       5x [Regulation Number 1] -> /regulations/1
  row sec-6-B-IX-D:       5x [Regulation Number 1]
reg 6: 462 rows, 9 rows differ — totals {Reg 8: 7, Reg 1: 10}   OK

  row sec-8-E-III:        1x [Regulation Number 6] -> /regulations/6
reg 8: 1340 rows, 1 row differs — totals {Reg 6: 1}   OK
```

These counts match exactly what each REPORT.md listed in its `other_reg` bucket before the merge: Reg 1 "Reg 6 (9 incl. Part/Section forms), Reg 8 (4)"; Reg 2 "Regulation Number 6" (1); Reg 6 "Regulation Number 1 (10), Regulation Number 8, Part E (7)"; Reg 8 "Regulation Number 6, Part A" (1). 33 new anchors in total; no id, parent, kind, title, citation or sort_order changed anywhere.

**Proof B — the merged code paths are exactly each agent's** (`out/isolated_corpus.py`: import the merged module, set `CORPUS_REGS` to ORIGINAL's set + that one reg, run `cmd_parse`):

```
reg1: cmp vs agent_reg1/out/reg1_parsed.json: IDENTICAL   (+ _unresolved, _duplicate_ids, _corrections, _marker_audit: IDENTICAL)
reg2: IDENTICAL (+ 4 side files IDENTICAL)
reg6: IDENTICAL (+ 4 side files IDENTICAL)
reg8: IDENTICAL (+ 4 side files IDENTICAL)
```

## Parse-time label-fix / text-fix hit reports (merged parser, full corpus)

### Reg 1
```
Parsed 344 provisions for Reg 1 -> out/reg1_merged.json
  by kind: {'root': 1, 'section': 10, 'item': 331, 'appendix': 2}
  tables found in PDF: 1; tables rendered/injected: 0
  known label fixes applied:
    II.A.6.a -> II.A.6.a. (line ~185): OK
    III.D.2.(iv) -> III.D.2.d.(iv) (line ~906): OK
    IV.B.4.d. -> VI.B.4.d. (line ~1596): OK
    III.D.2.j.(iv)(C) -> III.D.2.i.(iv)(C) (line ~1159): OK
    VI.F.1.a. -> VI.F.2.a. (line ~1737): OK
    0.5 lbs. per 106 BTU heat input -> 0.5 lbs. per 10^6 BTU heat input (line ~395): OK
    equal to 1x106 BTU/hr -> equal to 1x10^6 BTU/hr (line ~396): OK
    heat inputs greater than 1x10 6 -> heat inputs greater than 1x10^6 (line ~398): OK
    equal to 500x106 BTU per hour -> equal to 500x10^6 BTU per hour (line ~399): OK
    PE=0.5(FI)-0.26 -> PE = 0.5(FI)^-0.26 (line ~402): OK
    0.1 lbs. per 106 BTU heat input -> 0.1 lbs. per 10^6 BTU heat input (line ~410): OK
    500x10 BTU per hour or more. -> 500x10^6 BTU per hour or more. (line ~411): OK
    6 -> (line removed) (line ~412): OK
    PE = 3.59(P)0.62 -> PE = 3.59(P)^0.62 (line ~508): OK
    PE = 17.31(P)0.16 -> PE = 17.31(P)^0.16 (line ~519): OK
    pounds per 10 6 British thermal units -> pounds per 10^6 British thermal units (line ~3916): OK
    IV.D.2. -> (continuation line — kept as body text, not a label) (line ~1288): OK
```

### Reg 2
```
Parsed 310 provisions for Reg 2 -> out/reg2_merged.json
  by kind: {'root': 1, 'part': 3, 'section': 23, 'item': 283}
  tables found in PDF: 0; tables rendered/injected: 0
  known label fixes applied:
    l.A. -> I.A. (line ~35): OK
    l.B. -> I.B. (line ~39): OK
    l.C.2. -> I.C.2. (line ~54): OK
    ll. -> II. (line ~59): OK
    lll. -> III. (line ~64): OK
    lV. -> IV. (line ~73): OK
    VI.E.1.e -> VI.E.1.e. (line ~788): OK
    VII.B.2.b. -> VIII.B.2.b. (line ~1008): OK
    X.A.1.a. -> X.A.2.a. (line ~1408): OK
    X.B.2.f. -> X.B.1.f. (line ~1431): OK
```
`other_reg` bucket is now `Regulation Number 61` only (Reg 6 resolved).

### Reg 6
```
Parsed 462 provisions for Reg 6 -> out/reg6_merged.json
  by kind: {'root': 1, 'part': 2, 'entry': 118, 'section': 41, 'item': 300}
  tables found in PDF: 2; tables rendered/injected: 2
  injected: ['TABLE 1', 'TABLE 2']
  (no KNOWN_LABEL_FIXES / KNOWN_TEXT_FIXES entries for this reg — by design, see its REPORT)
```
`other_reg` bucket is now empty (Reg 1 and Reg 8 resolved).

### Reg 8
```
Parsed 1340 provisions for Reg 8 -> out/reg8_merged.json
  by kind: {'root': 1, 'part': 5, 'section': 29, 'item': 1301, 'appendix': 4}
  tables found in PDF: 8; tables rendered/injected: 8
  injected: ['General Abatement Contractor certification fees', 'Worker, Supervisor, Building Inspector, Management Planner and Project Designer certification fees', 'Length of annual refresher courses', 'Combined certificate fees', 'Air Monitoring Specialist certification fees', 'Permit Fee for Projects', 'Minimum number of clearance air samples', 'Table 1. LIST OF HIGH-RISK POLLUTANTS']
  known label fixes applied:
    II.H -> II.H. (line ~445): OK
    II.I -> II.I. (line ~473): OK
    II.J -> II.J. (line ~512): OK
    I.B. 72. -> I.B.72. (line ~1494): OK
    I.B. 75. -> I.B.75. (line ~1511): OK
    I.B. 76. -> I.B.76. (line ~1517): OK
    I.B. 77. -> I.B.77. (line ~1523): OK
    I.B. 78. -> I.B.78. (line ~1527): OK
    I.B. 79. -> I.B.79. (line ~1532): OK
    I.B. 80. -> I.B.80. (line ~1535): OK
    I.B. 81. -> I.B.81. (line ~1541): OK
    I.B. 82. -> I.B.82. (line ~1544): OK
    I.B. 83. -> I.B.83. (line ~1547): OK
    I.B. 84. -> I.B.84. (line ~1550): OK
    I.B. 84.a. -> I.B.84.a. (line ~1552): OK
    I.B. 84.b. -> I.B.84.b. (line ~1555): OK
    I.B. 85. -> I.B.85. (line ~1568): OK
    I.B. 85.a. -> I.B.85.a. (line ~1570): OK
    I.B. 85.b. -> I.B.85.b. (line ~1573): OK
    I.B. 85.c. -> I.B.85.c. (line ~1579): OK
    I.B. 86. -> I.B.86. (line ~1583): OK
    I.B. 87. -> I.B.87. (line ~1586): OK
    II.F. 7. -> II.F.7. (line ~2425): OK
    II.G.3 -> II.G.3. (line ~2475): OK
    III.A.3.c.(iii). -> III.A.3.c.(iii) (line ~2693): OK
    III.A.4.c.(iii)(A) -> III.A.3.c.(iii)(A) (line ~2695): OK
    III.A.3.e.(v). -> III.A.3.e.(v) (line ~2748): OK
    III.E.2 -> III.E.2. (line ~3104): OK
    III.P.3.c.(i). -> III.P.3.c.(i) (line ~4028): OK
    III.P.3.c.(ii). -> III.P.3.c.(ii) (line ~4036): OK
    III.S.1.c -> III.S.1.c. (line ~4163): OK
    III.T.2.d (ii) -> III.T.2.d.(ii) (line ~4372): OK
    II.W.2.i. -> III.W.2.i. (line ~4661): OK
    IV J.4. -> IV.J.4. (line ~5617): OK
    IV J.5.i. -> IV.J.5.i. (line ~5717): OK
    V.B.2.C. -> V.B.2.c. (line ~6032): OK
    Vl.C.1.d. -> VI.C.1.d. (line ~6371): OK
    VI.E.1. STANDARD FOR FABRICATING -> VI.E. STANDARD FOR FABRICATING (line ~6435): OK
    V.B.I. -> V.B.1. (line ~8989): OK
```
`other_reg` bucket is now empty (Reg 6 resolved).

### Reg 26 (regression control)
```
warning: table extraction failed: [Errno 2] No such file or directory: 'sources/REG_26.pdf'
Parsed 625 provisions for Reg 26 -> out/reg26_merged.json
  by kind: {'root': 1, 'part': 3, 'section': 14, 'item': 606, 'appendix': 1}
  WARNING: 1 id(s) were produced by more than one marker and merged (see report): ['sec-26-B-IV-A-5-c-(ii)']
  tables found in PDF: 0; tables rendered/injected: 0
  known label fixes applied:
    II.D.6.f.(i)(B) -> I.D.6.f.(i)(B) (line ~2107): OK
```
Both the missing-PDF warning and the `sec-26-B-IV-A-5-c-(ii)` merged-id warning are pre-existing ORIGINAL behaviour (output byte-identical to `reg26_before.json`).

## Cross-reg link deltas (summary)

| Parsed reg | New links | Target | Rows |
|---|---|---|---|
| 1 | 9 | `/regulations/6` | III.B.4, III.B.4.a, III.B.4.b, VI.B.4.f, X.H, X.N (×3), X.O |
| 1 | 4 | `/regulations/8` | II.C.2.c.(i), III.D.2.h.(v), X, X.P |
| 2 | 1 | `/regulations/6` | B.IX.A.5.a |
| 6 | 10 | `/regulations/1` | B.IX.C (×5), B.IX.D (×5) |
| 6 | 7 | `/regulations/8` | A.SUBPART-Da, A.XXI, B.VIII.B.10, B.VIII.D.5.b, B.VIII.E.1.a, B.VIII.E.2, B.VIII.E.3 |
| 8 | 1 | `/regulations/6` | E.III |

Reg 2 is cited by none of the others, so no `/regulations/2` links appeared. The linked text is always the bare "Regulation Number N" span; the "Part A"/"Part B"/"Part E" that sometimes follows stays plain text (a pre-existing tokenizer limitation all four reports already note).

## Things I am not fully certain about / for the CEO to know

1. **Test T2 edit.** `Reg2FullParseTests.test_no_page_furniture_and_no_external_links` was rewritten to expect `{"Regulation Number 61"}` and a `/regulations/6` link. This is the correct post-merge truth, but it is the one place I changed an agent's intent rather than composing.
2. **Reg 8's `KNOWN_LABEL_FIXES` and Reg 6's `SOB_PART_CONFIG` entries were auto-merged by `patch`** (no rejects), and every fuzz-applied hunk was audited; the byte-identical isolated parses are the definitive check that nothing landed in the wrong function, but I did not re-read every auto-merged comment paragraph for prose coherence.
3. **`merge/` is untouched** — it still holds the nested-conflict git state. Nothing in `merged/` derives from it; the report's conflict table maps onto its hunk locations only so they can be cross-checked.
4. `merged/out/reg<N>_merged.json` are the *full-corpus* outputs (with the 33 new links). If the CEO wants the DB import to reflect the agents' baselined `reg<N>_db.json`/`apply_reg<N>` plans exactly, those were generated pre-merge and will show these 33 rows as `changed` on the next diff; that is expected and desirable.
5. Per-agent "things I could not resolve" (Reg 1's `III.D.1.e.(ii)` anomaly, Reg 2's un-printed effective date, Reg 6's uncaptioned MWC timeline table, Reg 8's page-seam joins, the Editor's-Notes tails in every reg's last SOB entry) are unchanged by this merge and still open.
