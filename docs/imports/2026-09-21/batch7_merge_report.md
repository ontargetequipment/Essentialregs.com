# Batch 7 merge report — proc, 4, 10, 15, 23, 28, 29, 31

## Verdict: MERGED AND GREEN

All six patch sets are in one tree. Every conflict is reconciled (no patch's intention
was dropped), all four test suites pass with no failures, the eight regulations reproduce
their agents' parses exactly except for cross-links that only the whole batch makes
possible, and the final no-op proof over the six baseline documents has **zero unexplained
changes**. Plumbing is done for the manifest, the admin review page, `regulation.ts` and
`docs/import.yml.new`.

**2,565 new rows · 1,555 summary-eligible · $4.67 to summarize the batch.**

Two things the brief assumed that are not true in this checkout, both reported honestly
below rather than papered over: `sources/REG_{3,6,8,22}.txt` are **not** present anywhere
in `batch7/`, so the proc anchor count for those four could not be measured here either;
and `Reg 4`/`Reg 31` do **not** set `seam_paragraph_breaks`, so that roster did not grow
the way the brief anticipated.

---

## 1. Patch application

Each patch was split per target file and applied with `patch -p0 -F0` — **zero fuzz, no
hunk was ever allowed to land by approximation.** Order: proc → 4 → 10/15/29 → 23 → 28 →
31 (importer), then the same order for summarize, then the manifests. Per the brief,
`reg10_15_29.patch` was used and the three per-key Reg 10/15/29 patches were **not**
applied.

| patch | hunks | applied cleanly | hand-inserted rejects |
|---|---|---|---|
| `regproc.patch` | 15 | 15 | — |
| `reg4.patch` | 23 | 21 | 2 (`CORPUS_REGS["4"]`, `KNOWN_LABEL_FIXES["4"]`) |
| `reg10_15_29.patch` | 9 | 7 | 2 (`REG_META["10"/"15"/"29"]`, `KNOWN_LABEL_FIXES["29"]`) |
| `reg23.patch` | 9 | 8 | 1 (`SOB_PART_CONFIG["23"]`) + 1 reconciled (see §2) |
| `reg28.patch` | 7 | 6 | 1 (`CORPUS_REGS["28"]`) |
| `reg31.patch` | 11 | 10 | 1 (`CORPUS_REGS["31"]`) |
| 6 × `*_summarize.patch` | 24 | 14 | 10 (`REG_AUDIENCE` ×6, `REG_PROMPT_HINTS` ×3, `set(REG_AUDIENCE)` assertion) |
| `manifest_10_15_29.patch`, `manifest_23.patch` | 2 | — | superseded: all 8 entries written by hand (§5) |

Every reject was a dict/list insertion at an anchor another patch had already consumed —
i.e. a pure collision, never a semantic conflict. All were re-inserted verbatim (comments
included) at the equivalent point in the merged file.

Resulting sizes: `import_ccr.py` 10,758 → 12,276 lines · `summarize.py` 1,632 → 1,918 ·
`test_import_ccr.py` 8,977 → 11,117 · `test_summarize.py` 1,169 → 1,707.

---

## 2. Every conflict and how it was resolved

### 2.1 `Batch6SmallNoOpProofTests._check` — edited by TWO patches, both intentions kept

`reg23.patch` turned byte-identity into strip-and-reconstruct with an `expect_23`
argument; `regproc.patch` held `"proc"` out of both parses so the test keeps measuring
only 16/sip/18. **Both survive.** The merged `_check` now:

- holds `"proc"` out of **both** legs (proc's own effect is proved exactly by
  `Batch7ProcNoOpProofTests`);
- drops `"23"` from the ABSENT leg alongside 16/sip/18;
- compares the PRESENT leg to the pre-Batch-7 baseline **after stripping
  `/regulations/23` anchors**, with `expect_23` pinning the count (`test_reg26_noop`
  passes `expect_23=2`, Reg 30 keeps the default 0);
- deliberately leaves 4/10/15/28/29/31 **in** the corpus for both legs — that they add
  nothing to Reg 26/30 is now itself part of what the test asserts.

### 2.2 `Batch7ProcNoOpProofTests` — newly conflicting after the merge

Not flagged in the brief, but it failed once Reg 23 was in the corpus: its ABSENT leg
removes only `"proc"`, so Reg 26 picked up two Reg 23 anchors and no longer matched
`base_26.json`. Resolved by giving the class a `HELD_OUT = ("23",)` roster removed from
**both** legs, so the test isolates proc exactly as it was written to. Reg 23's own effect
is proved by `Batch6SmallNoOpProofTests` (§2.1) and by the step-4 table below.

### 2.3 `test_summarize.py::test_only_reg_11_overrides_the_audience`

Every summarize patch widened `set(REG_AUDIENCE)` differently. Reconciled to the brief's
final set, verified against the live dict:

```
{11, 12, 25, 27, aqs, 16, sip, 18, 19, 20, 21, proc, 4, 10, 15, 23, 28, 29, 31}   (19 keys)
```

### 2.4 `Reg11FullParseTests` / `Reg20FullParseTests` / `Reg21FullParseTests::test_cross_references`

`regproc.patch` replaced `assertNotIn("xref-external-reg", …)` with exact proc anchor
counts of 3 / 2 / 2, measured with only proc added. **Re-measured with all eight keys
present: still 3 / 2 / 2, and `set(externals) == {"proc"}` in all three.** Reg 11, 20 and
21 cite none of 4/10/15/23/28/29/31, so no number needed changing.

### 2.5 `Reg11MetaTests.test_new_config_dicts_are_reg_11_scoped` / `RegAqsMetaTests.test_new_config_keys_name_only_aqs`

`reg4.patch` widened all three exact key sets; nothing else touched them, so its values
are already the final ones. Verified against the merged module:

| dict | final key set |
|---|---|
| `APPENDIX_LADDERS` | `{"11", "4"}` |
| `LAYOUT_TEXT_TABLES` | `{"11", "19", "4"}` |
| `COLUMN_LAYOUT_TABLES` | `{"aqs", "4"}` |
| `CAPTIONED_LAYOUT_TABLES` | `{"28"}` |
| `UNCAPTIONED_TABLES` | `{"8", "20", "23", "25", "27", "30", "aqs"}` |
| `TABLE_CAPTION_SPANS` | `{"21"}` |

The tests still assert Reg 11 is in neither `APPENDIX_LADDER_DECIMAL_DEPTH` nor
`APPENDIX_LADDER_XREF_REGS`, so Reg 11's baselined appendix output is untouched.

### 2.6 `Batch6SmallConfigTests::test_seam_paragraph_breaks_and_preamble_flags_are_reg_gated`

The brief expected the roster to grow with `10, 15, 29` **and** "4/31/29 wherever they set
`seam_paragraph_breaks`". Measured in the merged tree, the real set is exactly:

```
seam_paragraph_breaks = {16, sip, 18, 10, 15, 29}
```

**Reg 4 and Reg 31 do not set the flag** (their reports never claimed they did — they set
`appendix_title_after_blank` and `part_headings_are_body` respectively). So small7's
literal `("16","sip","18","10","15","29")` is already the final roster and was left alone;
no hard-coding from `REG_META` was needed. `preamble_heading` is still `sip`-only.

### 2.7 `Batch6SmallConfigTests::test_sob_scopes` — `top_indent_ok`

Now `{18, 10}` and the test's literal matches. Reg 10's four Section VI entries print at
indent 6 under a flush-left "VI." heading, the same failure shape Reg 18 hit.

### 2.8 New config keys — every one kept, none collides

`reg4`: `appendix_title_after_blank`, `APPENDIX_LADDER_DECIMAL_DEPTH` (`{"4": 5}`),
`APPENDIX_LADDER_XREF_REGS` (`{"4"}`), `skip_rows` on `COLUMN_LAYOUT_TABLES`,
`caption_line_prefix` on `LAYOUT_TEXT_TABLES`.
`reg23`: `drop_caption_row`, `printed_caption`, `compact: "align"` + `_compact_rows_aligned()`,
`cell_fixes`.
`reg28`: `CAPTIONED_LAYOUT_TABLES` + `_rebuild_captioned_layout_tables()` + its `parse_reg` call.
`reg31`: `part_headings_are_body` (`{"31"}` only), `_non_aqcc_ccr_series()`.
`regproc`: `HEADING_CHILD_CHAIN_REGS` (`{"proc"}`) + the `chained_child` term in
`scan_markers`, `KNOWN_INLINE_LABEL_SPLITS` (`{"proc"}`) + `apply_inline_label_splits()`.

**`_appendix_ladder_match` signature change checked across the whole file:** the function
is defined once (`reg: str | None = None`, trailing and defaulted) and called from exactly
one site (`import_ccr.py:8807`), which passes `reg`. No other call site exists in
`import_ccr.py` or `test_import_ccr.py`.

### 2.9 Table call order in the item branch

Unchanged from Batch 6: `_swap_uncaptioned_table` → `_swap_layout_text_tables` →
`_swap_column_layout_tables`, with `_item_figures_html` appended at render.
`_rebuild_captioned_layout_tables(reg, lines, tables_by_caption)` runs in `parse_reg`
immediately after `extract_tables_from_pdf`, i.e. before all of them, exactly as Reg 28
built it. **The four mechanisms touch disjoint regs** within this batch — 23 →
`UNCAPTIONED_TABLES`, 4 → `LAYOUT_TEXT_TABLES` + `COLUMN_LAYOUT_TABLES` (different
provisions), 28 → `CAPTIONED_LAYOUT_TABLES` — and no reg outside the batch gained an entry.

### 2.10 Linker step numbers

All distinct and all corpus-gated: **1.9** = `PROC_RULES_MENTION_RE` (gated
`if "proc" in corpus_regs`), **3c** = `LADDER_SECTION_RE` (gated on
`reg in APPENDIX_LADDER_XREF_REGS and "-APPENDIX-" in own_id`), and Reg 31's
`_non_aqcc_ccr_series()` guard applied inside existing steps **2** and **5** of
`link_citations` plus step **7** of `link_citations_ecmc`. No step label is used twice.

### 2.11 `SOB_PART_CONFIG` / `SOB_SECTION_CONFIG`

Final state for the eight, verified against the merged module:

| key | config |
|---|---|
| `proc` | **no entry** — Part B Section XII is ordinary CYCLE_AB labels (as its report said) |
| `4` | `letter C`, `letter_dated`, `roman_prefix "XI"`, `^Adopted:?\s`, `inner_items False` |
| `10` | `section VI`, `letter_dated`, `roman_prefix "VI"`, `^(?:Amendments?\s+)?Adopted:?\s`, `inner_items False`, **`top_indent_ok`** |
| `15` | `section VI`, `letter_dated`, `implicit_section_prefix`, custom bare-date `top_opener_re` (accepts the `&` two-day form), `inner_items False` |
| `23` | `letter B`, `roman_seq`, `^Adopted:?\s`, `inner_items False` |
| `28` | `letter F`, `roman_seq`, `^Adopted:?\s`, `inner_items False` |
| `29` | `letter B`, `roman_seq`, `^Adopted:?\s`, `inner_items False` |
| `31` | `letter K`, `roman_seq`, `^Adopted:?\s`, `inner_items False`, **`part_headings_are_body`** |

`SOB_SECTION_CONFIG` still has only `{8, aqs}` — no Batch 7 key needed it.

### 2.12 Four tests that the *whole batch* invalidated (not patch conflicts)

These passed for their authors and had to fail here, because the cross-link only exists
once all eight keys are present. Each was re-measured and tightened, never loosened:

| test | was | now |
|---|---|---|
| `RegAqsFullParseTests::test_cross_references` | `other_reg` = `{Reg No 10 Part B, Reg No 13, Reg 13}` | `other_reg` = `{Reg No 13, Reg 13}`, **plus** new exact assertions: 5 × `/regulations/10` and 5 × `/regulations/proc`. The bare `Part B` tail moves to `historical`, the documented house behaviour for "Part X of Regulation N". |
| `ProcEndToEndTests::test_unresolved_buckets` | `other_reg` = `{"Regulation Number 10": 3}` | `other_reg` = `{}`, **plus** an exact assertion of 3 × `/regulations/10`. proc's own report predicted this ("It will link automatically once merged"). |
| `Reg4FullParseTests::test_cross_references` | `assertNotIn("xref-external-reg", …)` per row | `set(externals) == {"proc"}`, `len == 3`, on exactly `sec-4-C-XI-A/B/C`. REPORT_4 predicted this verbatim. |
| `Reg28FullParseTests::test_cross_references` | `assertNotIn("xref-external-reg", …)` per row | `set(externals) == {"proc"}`, `len == 2`, on exactly `sec-28-F-I` and `sec-28-F-II`. |

---

## 3. Test counts — all four suites

| suite | result |
|---|---|
| `test_import_ccr.py` | **639 passed, 7 skipped, 44 subtests passed** |
| `test_summarize.py` | **273 passed, 2 skipped** |
| `test_freshness.py` | **75 passed** |
| `test_import_ecfr.py` | **149 passed, 110 skipped** |
| all four in one run | **1,136 passed, 119 skipped, 44 subtests passed — 0 failed** (4 m 06 s) |

The 7 importer skips are the usual baseline-gated ones, all "file not in this checkout":
`sources/REG_8.txt` (1), `out/reg7_parsed.json`+`reg7_db.json` (1), `REG_1.txt`/baseline (2),
and the three `reg{1,26,cp}_prebatch_gp.json` GP-era baselines (3). The 2 summarize skips
are the pre-existing baseline pair. The 110 eCFR skips are the `P19x.xml` /
`ecfr_*.json` source files, none of which this batch touches.

For comparison the agents reported 511 (pre-Batch-7 baseline) → 545 (proc alone) →
**639** merged, i.e. **+128 tests over the pre-batch baseline** and no test lost.

---

## 4. The eight byte-identity results (step 3)

Re-parsed with the merged importer through the ordinary CLI
(`import_ccr.py parse --reg <k> --txt … --pdf …`) and compared to
`out/reg<key>_agent_parsed.json`. Evidence: `out/merge_byte_identity.log`.

| key | rows | vs agent parse | changed rows | anchors added | **unexplained** |
|---|---|---|---|---|---|
| `proc` | 791 | differs | 3 | `10` ×3 | **0** |
| `4` | 348 | differs | 3 | `proc` ×3 | **0** |
| `10` | 79 | differs | 2 | `proc` ×2 | **0** |
| `15` | 36 | **byte-identical** | 0 | — | **0** |
| `23` | 221 | differs | 2 | `proc` ×2 | **0** |
| `28` | 282 | differs | 2 | `proc` ×2 | **0** |
| `29` | 51 | differs | 1 | `proc` ×1 | **0** |
| `31` | 757 | differs | 1 | `proc` ×1 | **0** |

Every difference is a cross-link that needs the whole batch present, and every one was
predicted in the source reports:

- **`proc` → Reg 10 ×3** (`sec-proc-A-IV-N-1`, `sec-proc-B-IV-N-1`, `sec-proc-B-XII-F`) —
  "…whether a Conformity Determination is routine per the definition in **AQCC Regulation
  Number 10**, Criteria for Analysis of Conformity." REPORT_proc bucketed these in
  `other_reg`; REPORT_small7 named the same three source lines.
- **`4` → proc ×3** (`sec-4-C-XI-A/B/C`) — REPORT_4: "each of XI.A./B./C. contains 'the Air
  Quality Control Commission's ("Commission") Procedural Rules'".
- **`10`/`23`/`28`/`29`/`31` → proc** — each regulation's statement-of-basis entries, the
  same printed opener sentence as every other AQCC reg.
- **`15` → nothing.** Reg 15 predates and cites none of the batch.

`aqs` → Reg 10 ×5 and `proc` → Reg 10 ×3, the two the brief called out, are both confirmed
at exactly those counts.

Regenerated for all eight: `out/reg<key>_parsed.json` + its four sidecars,
`out/reg<key>_db.json` (`[]`), `out/reg<key>_diff_report.md`, and `out/apply_reg<key>/`.
**All 24 sanity checks PASS** (3 per key: every `parent_id` in the final state exists; no
id in both delete and upsert sets; every obsolete id resolved to a surviving ancestor).

Every `KNOWN_LABEL_FIXES` / `KNOWN_TEXT_FIXES` / `KNOWN_INLINE_LABEL_SPLITS` entry in the
batch still reports **exactly 1 hit** after the merge (proc 2 + 2 anomalies, 4 ×5, 15 ×2,
28 ×1, 29 ×3, 31 ×5; 10 and 23 have none). Both ratified CEO decisions are in the output:
`sec-29-A-I-C` (Severability) exists, `sec-4-C-APPENDIX-A-EDITOR-S-NOTES` is its own row.
The Reg 23 fusion guard holds: `sec-23-B-I-23` does not exist.

---

## 5. Final no-op proof — all eight keys in `CORPUS_REGS` (step 4)

Each document re-parsed one at a time in its own subprocess against the centrally built
`out/base_*.json` (`base_24.json` copied in from `../agent_23/out/`). Proved with
`strip_reconstruct.py <base> <with> proc,4,10,15,23,28,29,31`. Full log:
`out/noop/merge_noop_proof.log`.

| document | rows | changed rows | → proc | → 23 | → 4/10/15/28/29/31 | **unexplained** |
|---|---|---|---|---|---|---|
| Reg 26 | 626 | 6 | 4 | 2 | 0 | **0** |
| Reg 30 | 444 | 3 | 3 | 0 | 0 | **0** |
| Reg 25 | 993 | 3 | 3 | 0 | 0 | **0** |
| Reg 7 | 2,182 | 21 | 21 | 0 | 0 | **0** |
| Reg 24 | 415 | 2 | 2 | 1 | 0 | **0** |
| ECMC | 6,754 | **0** | 0 | 0 | 0 | **0** |
| **total** | | **35** | **33** | **3** | **0** | **0** |

Every changed row is a statement-of-basis entry except the two Reg 23 mentions in Reg 26's
body/tracking table and Reg 24's tracking table. **ECMC is `cmp`-clean byte-identical to
`base_ecmc.json` with `31` present** — the key verification the brief asked for.

Five with their source phrase:

1. `sec-26-C-I` → proc — "…§ 25-7-101, C.R.S., et seq., and the Air Quality Control
   Commission's (Commission) **Procedural Rules, 5 C.C.R. §1001-1**."
2. `sec-30-C-II` → proc — "…(the State Air Act), and the Air Quality Control Commission's
   (Commission) **Procedural Rules, 5 Code Colo. Reg. section 1001-1**." (the "section" spelling)
3. `sec-7-C-N` → proc — "…C.R.S. §§ 25-7-110 and 25-7-110.5., and the Air Quality Control
   Commission's ("Commission") **Procedural Rules**." (no CCR cite printed)
4. `sec-26-B-II-A-2-f` → 23 — "…contained in this Regulation Number 26, Part B, Sections
   III.A. through III.C. or **Regulation 23**."
5. `sec-24-C-I` → 23 — Reg 24's Part C entry I tracking table: "…Part C, Section X.;
   … **Regulation 23** (fkna Part F)". (This row gains a proc anchor too.)

### Corpus-wide effect (`out/merge_corpus_anchor_table.md`)

Every pre-Batch-7 document whose source is in this checkout was re-parsed with the merged
importer. **70 new anchors across 31 documents; 16 of them carry at least one.**

| document | → proc | → 23 | → 10 |
|---|---|---|---|
| 7 | 21 | | |
| 9 | 5 | | |
| 27 | 5 | | |
| aqs | 5 | | 5 |
| 26 | 4 | 2 | |
| 25 / 30 / 11 | 3 each | | |
| 1 / 2 / 20 / 21 / cp | 2 each | | |
| 24 | 2 | 1 | |
| 19 | 1 | | |
| 12, 16, 18, sip, ecmc, gp01–gp12 | 0 | 0 | 0 |
| **total** | **62** | **3** | **5** |

The 62 proc anchors reproduce REPORT_proc's measured 62 exactly, document for document.
Inside the batch itself a further **11 proc anchors** appear (4 ×3, 10 ×2, 23 ×2, 28 ×2,
29 ×1, 31 ×1) and **3 more Reg 10 anchors** (in proc), so the batch creates **73 proc
anchors, 8 Reg 10 anchors and 3 Reg 23 anchors** corpus-wide. Reg 4, 15, 28, 29 and 31 are
cited by nothing and add **zero** anchors anywhere — as their reports predicted.

**Reg 3 / 6 / 8 / 22 could NOT be measured.** The brief says to measure them "here, where
all sources are present", but `REG_3.txt`, `REG_6.txt`, `REG_8.txt` and `REG_22.txt` are
absent from `sources/` **and from every other directory under `batch7/`**, including
`batch7/base/sources/`. Their statements of basis print the same sentence as Reg 25/26/30,
so expect roughly 2–4 more proc anchors each (≈10 corpus-wide) when they are next parsed.
No code change will be needed for them.

### The `_non_aqcc_ccr_series()` guard (the load-bearing one)

Kept intact through the merge and confirmed working: ECMC's
`sec-ecmc-100-DEF-CLASSIFIED-WATER-SUPPLY-SEGMENT` still reports "Regulation Number 31" in
the `other_reg` bucket rather than linking to the landfill-methane rule, and ECMC's whole
parse is byte-identical to its baseline with `31` in the corpus.

**The brief's Regulation Number 41 question, answered: yes, the guard's shape already
covers it.** ECMC prints "…Water Quality Control Commission ("WQCC"), **Regulation Number
41**, The Basic Standards for Ground Water, **5 C.C.R. § 1002-41**, et seq." — the same
`1002-<num>` shape inside the guard's 140-character window. Tested empirically by adding a
hypothetical `CORPUS_REGS["41"]`/`REG_META["41"]` and re-parsing ECMC: **0 anchors, both
"Regulation Number 41" mentions still bucketed in `other_reg`.** Nothing will need doing
when a real AQCC Regulation 41 is imported.

---

## 6. Row counts, summary-eligible counts and cost

Summary eligibility computed with `summarize.py`'s own `strip_html` + `MIN_WORDS = 25`.

| key | rows | summary-eligible | cost @ $0.30/100 |
|---|---|---|---|
| `proc` | 791 | 520 | $1.56 |
| `4` | 348 | 214 | $0.64 |
| `10` | 79 | 63 | $0.19 |
| `15` | 36 | 20 | $0.06 |
| `23` | 221 | 108 | $0.32 |
| `28` | 282 | 152 | $0.46 |
| `29` | 51 | 18 | $0.05 |
| `31` | 757 | 460 | $1.38 |
| **TOTAL** | **2,565** | **1,555** | **$4.67** |

Two agent reports quote a slightly different eligible count (Reg 23 "107", Reg 31 "463")
because their own gate scripts counted visible text differently. **The merge changed
nothing**: running the same counter over the agents' own `reg23/reg31_agent_parsed.json`
gives 108 and 460 too, identical to the merged parses.

---

## 7. Plumbing

| file | change |
|---|---|
| `sources/manifest.json` | **8 new `kind: "sos"` entries**, written by hand (the two shipped manifest patches were superseded so all eight land in one contiguous Batch 7 block, matching the file's existing per-batch grouping — inserted after `21`, before `ecmc`). 39 → 47 sources. Values from each report's "Regulation identity" table: `proc` 5 CCR 1001-1 / rule 2333 / ver 11840 / 2025-02-14 · `4` 1001-6 / 2338 / 11649 / 2024-10-15 · `10` 1001-12 / 2345 / 6679 / 2016-03-30 · `15` 1001-19 / 2351 / 2600 / 2008-10-30 · `23` 1001-27 / 3344 / 9985 / 2022-01-30 · `28` 1001-32 / 3408 / 12565 / 2026-06-17 · `29` 1001-33 / 3435 / 11408 / 2024-04-15 · `31` 1001-35 / 3469 / 12387 / 2026-02-14. All carry `deptID 16` / `agencyID 7`. `freshness.py` is manifest-driven and picks all eight up with no code change; `test_freshness.py` still 75 passed. |
| `site/src/app/admin/review/page.tsx` | `REG_KEYS` gains `"proc", "4", "10", "15", "23", "28", "29", "31"` (after `sip`, before the GPs); `REG_LABELS` gains `proc: "Procedural Rules (1001-1)"` and `"Reg 4"`/`"Reg 10"`/`"Reg 15"`/`"Reg 23"`/`"Reg 28"`/`"Reg 29"`/`"Reg 31"` — labelled like the other numeric regs. 49 → 57 keys, verified 1:1 against labels with no key missing and none orphaned. |
| `site/src/lib/regulation.ts` | `proc` added to `AQCC_NAMED_DOCS` (the `aqs`/`sip` mechanism) as `{ title: "Procedural Rules", rank: -2 }`. Its `order` field was renamed to **`rank`** and is now the AQCC sort key directly, so a named doc can sort before the numbered regs as well as after; `aqs`/`sip` keep their exact Batch 6 position as `1_000_001`/`1_000_002`. Doc comments updated. The seven numeric keys need nothing — they fall through the existing `/^\d+$/` branch. |
| `docs/import.yml.new` | new `elif [ "$REG" = "proc" ]; then SRC_BASENAME="REG_PROC"` beside the `aqs`/`sip` branches; the workflow `description` and the unknown-reg error string both now list `proc`; the comment block notes that the numeric branch already covers 4/10/15/23/28/29/31. YAML re-parsed clean. |
| `docs/freshness.yml.new` | **no change needed** — it enumerates no reg keys. |

### The `proc` sort position — decided and stated

**`proc` sorts FIRST in the AQCC group, ahead of the Common Provisions Regulation and
every numbered regulation.** That is what the brief directed, and it is independently
correct twice over: the Procedural Rules are the Commission's rules of procedure rather
than a substantive regulation, and 5 CCR 1001-1 is literally the first document of the
printed CCR series (Common Provisions is 1001-2). Verified by compiling the module with
`tsc` and running it:

```
AQCC group order:  proc , cp , 1 , 4 , 10 , 15 , 23 , 28 , 29 , 31 , aqs , sip
proc card:         { title: "Procedural Rules", subtitle: "5 CCR 1001-1" }
```

and every other card checked for regression — `cp` → "Common Provisions Regulation"/null,
`aqs`/`sip` unchanged, `gp02` → "GP02 — Storage Tanks"/"Issuance 4 · July 23, 2025", and
all seven numeric keys → "Regulation Number N — TITLE" with the CCR cite as subtitle.

---

## 8. Unresolved / for the CEO

Nothing blocks the import. Carried forward from the six reports, plus what the merge added:

1. **`sources/REG_{3,6,8,22}.txt` are missing from the entire `batch7/` tree**, so their
   proc anchor counts are still unmeasured (§5). Worth measuring on the next full
   re-parse; no code change is implied.
2. **Reg 28's effective date 06/17/2026 is not printed in its PDF** (its Editor's Notes
   stop at 11/14/2025). The brief's ruleVersionId 12565 is recorded in the manifest as
   given — someone should confirm it against the Secretary of State before the freshness
   job treats it as authoritative.
3. **Reg 31's statement of basis opens with the literal placeholder `"Adopted: [date]"`**
   as the Commission printed it. Left verbatim; the regulation has no printed adoption
   date anywhere. Worth a one-line editorial note on the page or a re-pull.
4. **Source citation defects left as printed, never silently repaired** — Reg 4's
   `Section I.A.8.5`; Reg 15's `sec-15-IV-C` pointing at V.A.1./V.A.2. where IV.A.1./IV.A.2.
   were meant (it links, faithfully, to the wrong provisions); Reg 23's `Section VII.` and
   `Section V.E.`; Reg 28's `II.C.4.`/`II.C.5.`/`II.B.3.b.`; Reg 31's `Part C, Section
   II.B.2.a.`; proc's nine stale Part A references and eleven cross-part fallback links.
   All bucketed and reported; none may be "helpfully" resolved by the summarizer.
5. **Corpus-wide gaps flagged but out of scope**, unchanged by this merge: rendered table
   HTML is never passed through `link_citations` (so the sixth `aqs` mention of Reg 10
   does not anchor); there is no "Appendix X" resolver (Reg 4's nine external "Appendix A"
   mentions stay plain); no generic non-AQCC Colorado CCR bucket (Reg 28's "1 CCR 212-3"
   is silently plain text); the `Part X of Regulation N` tokenizer shape buckets the bare
   part name (proc's `Part C`, aqs's `Part B`).
6. **Reg 11's Appendix A self-references are still unlinked** by design —
   `APPENDIX_LADDER_XREF_REGS` is `{"4"}` so Reg 11's baselined output does not move.
   Adding `"11"` is a one-line follow-up whenever Reg 11 is next re-baselined.
7. **Reg 10's `sec-10-II`** carries all fifteen definitions in one 6,347-char row, and
   **Reg 4's `sec-4-C-APPENDIX-A-2.0`** all ~50 appendix terms in one 12,146-char row.
   Both are under the gate-D threshold and neither is a fusion bug — splitting either
   needs a new unlabelled-term-definition marker family, a plumbing change rather than a
   reg import.

### Files added by the merge

`MERGE_REPORT.md` (this file) · `_merge_probe.py` (the single-document parse/anchor probe
used throughout) · `out/merge_byte_identity.log` · `out/merge_corpus_anchor_table.md` ·
`out/noop/with_{26,30,25,7,24,ecmc}.json` + `probe_*.json` + `merge_noop_proof.log` ·
`out/base_24.json` (copied from `../agent_23/out/`). Nothing outside this directory was
modified.
