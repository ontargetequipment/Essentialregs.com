# Batch 6 merge report — aqs, 16, sip, 18, 19, 20, 21 into one importer (September 20, 2026)

Work done entirely in `/home/claude/working/er/batch6/merge`: no network, no database. All five agent importer patches are applied to one `import_ccr.py` / `test_import_ccr.py`, the five summarize patches are in `summarize.py` / `test_summarize.py` (applied against THIS directory's current files, as the brief says — the agents' `*.ORIGINAL.py` copies were stale), the manifest patch plus the six hand-added `sos` entries are in `sources/manifest.json`, and the plumbing (freshness tests, admin review page, `regulation.ts`, `docs/import.yml.new`) is in. Every parse below was run from the merged CLI (`python3 import_ccr.py parse …` via `run_parse.sh` / `run_noop.sh`, one parse per subprocess, with a 60-s retry loop), the big ones (Reg 7, ECMC) one at a time; none needed a retry (the box was idle: ~6 GB free).

## 1. What conflicted and how it was resolved

Patch application: `regaqs.patch` applied cleanly against the ORIGINALs; the other four were applied with `patch -p0 -F0` (no fuzz — a first attempt with fuzz mis-placed Reg 19's `CORPUS_REGS` hunk inside a comment block and its `KNOWN_LABEL_FIXES` hunk inside `link_citations`, so I reset and re-applied strictly) and every rejected hunk was hand-inserted at its real anchor (they were all pure insertions whose context had shifted because an earlier patch inserted at the same spot: `CORPUS_REGS`, the end of `REG_META`, `KNOWN_LABEL_FIXES`, `KNOWN_TEXT_FIXES`, `UNCAPTIONED_TABLES`, `SOB_PART_CONFIG`, `FAMILY_REGEX`, the regex block after `GP_MENTION_RE`, the linker steps, the `paras` branch of `build_provisions`, and the appended test blocks). Verified afterwards by script: every `+` line of every agent patch is present verbatim in the merged files except the reconciled lines listed below, and no `-` line survives except where the same text legitimately occurs in another branch. No `.rej`/`.orig` remains.

| Overlap (brief's list) | Resolution |
|---|---|
| **`family_regex_for`** — Reg 21 `multi_letter_labels` / `FAMILY_REGEX_MULTI_UPPER` vs Reg 27 `triple_letter_labels` / `FAMILY_REGEX_TRIPLE_UPPER` | Both branches in one function (no-trailing-dot → triple → multi → plain). `FAMILY_REGEX_MULTI_UPPER = dict(FAMILY_REGEX, upper=…{1,7})` is built after `FAMILY_REGEX` gains all three new families, so it carries them too. Reg 27's "triple is Reg 27's alone" assertion is untouched. |
| **`FAMILY_REGEX` families** — Reg 20 `digit_or_lroman`, Reg 12 `bare_lroman`, small `paren_lower` | All three in `FAMILY_REGEX`. `FAMILY_REGEX_NO_TRAILING_DOT` had `bare_lroman` (Batch 5) and `digit_or_lroman` (Reg 20's patch); **I added `paren_lower`** to it as the brief asks (one line; harmless — only `BARE_LADDER_FAMILIES["sip"]` ever names it). |
| **`seam_*` flags** — 19 and 21 both set the existing `seam_standalone_line_breaks`; small adds `seam_paragraph_breaks` (16/sip/18) | All kept. Reg 27's `test_corpus_and_meta_entries` (widened to {27,19} by Reg 19's patch and to {27,21} by Reg 21's — a textual conflict) is now ONE assertion: `{r for r, m in REG_META.items() if m.get("seam_standalone_line_breaks")} == {"27", "19", "21"}` plus the untouched `triple_letter_labels`-is-27-only loop. Reg 19's own `Reg19MetaTests` "Only Reg 19 and Reg 27 opt in" assertion widened to `{"19", "27", "21"}`. |
| **Tables** — 19: `_swap_layout_text_tables` `to_end`/`reprinted_headers`/`wrap_continuations` + `LAYOUT_TEXT_TABLES["19"]`; 21: `TABLE_CAPTION_SPANS` + `ITEM_TABLE_SPLICE_MODE["21"]`; aqs: `COLUMN_LAYOUT_TABLES` + `ITEM_FIGURES`; 20: `FLAT_ENTRY_PART_CONFIG` `table_caption_re` / optional `sob_heading_re` + `_swap_uncaptioned_table` from the flat-entry branch | Independent mechanisms, all present. Item-branch order verified in the merged file: `_swap_uncaptioned_table` → `_swap_layout_text_tables` → `_swap_column_layout_tables`, then `_item_figures_html` appended in the second pass (heading + paras kinds). `LAYOUT_TEXT_TABLES` keys = {11, 19} (Reg 11's test widened by Reg 19's patch); `ITEM_TABLE_SPLICE_MODE` = {25: merge_continuations, 27: strict, 21: merge_continuations} (Reg 25/27 tests widened by Reg 21's patch). |
| **Label fixes** — 19 `prev_blank_line`, 11 `next_line_prefix` | Both optional keys coexist in `apply_known_label_fixes`. |
| **Appendix** — 19 `centered_appendix_headings`; `APPENDIX_HEADING_DEDUP_REGS` | `frozenset({"9", "30", "11", "25", "19"})`. |
| **Linkers** — aqs `AQS_MENTION_RE`, small `SIP_LOCAL_ELEMENTS_RE` (both numbered "1.7" by their agents), 20 `CAL_CCR_RE` 1.3 + `other_ccr` bucket, 19 `SOB_CONTEXT_PART_RE`, 19/20 in `CFR_DOTTED_REGS` | Steps are now 1.1, 1.2, **1.3 (California CCR)**, 1.5, 1.6, **1.7 (aqs)**, **1.8 (sip)** — the sip step and its regex comment renumbered to 1.8; both corpus-gated. `CFR_DOTTED_REGS` = {8, 12, 19} (Reg 20 did not in fact add to it — its "40 CFR" cites are undotted). `SOB_CONTEXT_PART_RE` wired into the `paras` branch (hand-applied hunk). |
| **SOB** — small `top_indent_ok`; aqs `SOB_SECTION_CONFIG["aqs"] = {"": "VIII"}`; 20 opener `^ADOPTED:\s`; 21 `^Adopted:?\s` | All present; `SOB_PART_CONFIG` has 16, 18, 19, 20, 21; `SOB_SECTION_CONFIG` has aqs. |
| **`test_only_reg_11_overrides_the_audience`** — five different expected sets | One assertion: `{"11", "12", "25", "27", "aqs", "16", "sip", "18", "19", "20", "21"}`. Every other `+` line of the five summarize patches is present verbatim (`REG_AUDIENCE` ×7, `REG_PROMPT_HINTS` ×7, all new tests). |
| **`regaqs_manifest.patch`** | Applied (aqs `sos` entry + one freshness test); the other six entries and the Batch 6 freshness tests were added by hand (§6). |

**Test edits the merge forced (beyond the reconciliations above), each explained in a comment at the site:**
1. `RegAqsFullParseTests.test_cross_references`: with 16 and sip in the corpus, "Regulation Number 16" (VIII.M.) is an anchor, not an `other_reg` bucket hit → bucket set is now `{"Regulation Number 10, Part B", "Regulation Number 13", "Regulation 13"}`, plus an assertion that the `/regulations/16` anchor is in `sec-aqs-VIII-M` and that there are **7** `/regulations/sip` anchors across the aqs rows (see §3 — the brief said 3).

No other agent test text was changed.

## 2. Final test counts

| Suite | Result |
|---|---|
| `test_import_ccr.py` | **511 passed, 7 skipped** (+44 subtests) — 368 base + 27 (aqs) + 29 (16/sip/18) + 31 (19) + 32 (20) + 24 (21) = 511; no duplicates to subtract |
| `test_summarize.py` | **196 passed, 2 skipped** (156 base + 40 from the five summarize patches) |
| `test_freshness.py` | **75 passed** (60 base + 1 from `regaqs_manifest.patch` + 14 new Batch 6 tests: `test_batch6_manifest_entries` ×7, `test_batch6_sos_url_and_label` ×7) |
| `test_import_ecfr.py` | **259 passed** (unchanged) |
| total | **1,041 passed, 9 skipped** |

## 3. Byte-identity of the seven new regs (merged importer vs each agent's parse)

`out/reg<k>_parsed.json` re-parsed from the merged CLI; `cmp` against `out/reg<k>_agent_parsed.json`; differences proven with `strip_reconstruct.py` (copied from Batch 5, with one regex change: it now also accepts the `data-provision-id="…"` attribute the aqs resolver emits before `href`).

| Reg | Rows | Result |
|---|---|---|
| 18 | 10 | **BYTE-IDENTICAL** |
| 19 | 731 | **BYTE-IDENTICAL** |
| 20 | 327 | **BYTE-IDENTICAL** |
| 21 | 509 | **BYTE-IDENTICAL** |
| aqs | 80 | differs in **5 rows** by **8 anchors**, all cross-links the brief predicted in kind: `/regulations/16` ×1 (`sec-aqs-VIII-M`, "Regulation Number 16") and `/regulations/sip` ×**7** — `sec-aqs-VIII-D` ×4 ("State Implementation Plan-Specific Regulations for Nonattainment Areas" + three "SIP-Specific Regulations"), `sec-aqs-VIII-L` ("State Implementation Plan Specific Regulations for Nonattainment - Attainment/Maintenance Areas"), `sec-aqs-VIII-N`, `sec-aqs-VIII-O` (the "…-Specific Regulation for Nonattainment Areas" full-title forms). Strip reproduces the agent file row-for-row (80 rows, 5 changed, {16: 1, sip: 7}, unexplained 0). **The brief/small report said ×3** — they counted only the short "SIP-Specific Regulations" form; `SIP_LOCAL_ELEMENTS_RE` also matches the four full-title forms, all of which genuinely name the SIP document. |
| 16 | 71 | differs in **2 rows** by **2 anchors** to `/regulations/aqs`: `sec-16-II-A-1` ("AQCC **Ambient Air Standards Regulation** (effective date: July 30, 1999)") and `sec-16-III-A` ("Section V.C.4 of the **Colorado Ambient Air Quality Standards Regulation**"). Strip reproduces the agent file (71 rows, 2 changed, {aqs: 2}, unexplained 0). The agent parse was made without aqs in the corpus (the brief expected "byte-identical" in step 3 but "1 anchor difference" in step 4 — see §4; the merged result is 2, because `AQS_MENTION_RE` also accepts the "Ambient Air Standards … Regulation" form the aqs agent designed it for). |
| sip | 173 | differs in **1 row** by **1 anchor** to `/regulations/aqs`: `sec-sip-VIII-F` ("the **Ambient Air Quality Standards for the State of Colorado regulation** has been revised…"). Strip reproduces the agent file (173 rows, 1 changed, {aqs: 1}, unexplained 0). The aqs report said the SIP's quoted/ellipsis forms are not matched — true — but this plain "…for the State of Colorado regulation" form is explicitly in the regex's optional clause and is a genuine mention. |

Diff reports and apply plans regenerated for all seven (`out/reg<k>_db.json` = `[]`, `out/reg<k>_diff_report.md`: 80 / 71 / 173 / 10 / 731 / 327 / 509 only-parsed, 0 DB, 0 truncation; `out/apply_reg<k>/stats.md`: all new, 0 changed / 0 obsolete, **three sanity checks PASS** for each).

## 4. No-op proof with all seven in the corpus

Fresh CLI parses through `cmd_parse` (`prove_noop_batch6.py` / `run_noop.sh`, one process each, `out/noop_batch6/*_merged.json`) vs the ORIGINAL-importer baselines `out/base_<k>.json` — first verified identical across all five agent dirs by md5 (26 `faa49e19…`, 30 `6099113f…`, 25 `3466aa1d…`, 7 `76b12985…`, ecmc `767db4a3…`, sidecars too) and copied in from `agent_aqs/out/`.

| Reg | Rows | Result | Anchors added | Changed rows |
|---|---|---|---|---|
| Reg 26 | 626 | **`cmp` BYTE-IDENTICAL** | — | — |
| Reg 30 | 444 | **`cmp` BYTE-IDENTICAL** | — | — |
| ECMC | 6,754 | **`cmp` BYTE-IDENTICAL** | — | — |
| Reg 7 | 2,182 | differs by exactly **2 anchors** to `/regulations/aqs`; strip reproduces the baseline (2 changed rows, unexplained 0) | aqs ×2 | `sec-7-C-B`, `sec-7-C-G` |
| Reg 25 | 993 | differs by exactly **1 anchor** to `/regulations/21`; strip reproduces the baseline (1 changed row, unexplained 0) | 21 ×1 | `sec-25-B-I-L-1-b-(iv)` |
| Reg 16 with vs without aqs in `CORPUS_REGS` (`prove_reg16_aqs.py`) | 71 | "without" is **byte-identical to the agent parse**; "with" differs by **2** aqs anchors (brief said 1): `sec-16-III-A` "Section V.C.4 of the Colorado Ambient Air Quality Standards Regulation" → root of aqs (the one the brief named) **and** `sec-16-II-A-1` "AQCC Ambient Air Standards Regulation" → root of aqs | aqs ×2 | `sec-16-II-A-1`, `sec-16-III-A` |

Exactly the predicted rows for Reg 7 and Reg 25; zero anchors to 16/sip/18/19/20 anywhere in the five; zero unexplained differences. Sidecars: `_corrections` / `_duplicate_ids` / `_marker_audit` byte-identical for all five; `_unresolved.json` differs only by the new, empty `"other_ccr": []` bucket Reg 20 introduced (and, for Reg 25, "Regulation Number 21" leaving `other_reg` because it is now an anchor) — exactly what the Reg 20 report predicted.

## 5. Per-reg row counts and summary-eligible counts

Eligibility = `summarize.py`'s own rule (`strip_html(full_text).split()` ≥ `MIN_WORDS` = 25). Quote at $0.30 / 100 rows.

| Reg | Rows | by kind | Eligible (≥ 25 words) | Quote |
|---|---|---|---|---|
| aqs | 80 | root 1, section 8, item 71 | 54 | $0.16 |
| 16 | 71 | root 1, section 3, item 67 | 37 | $0.11 |
| sip | 173 | root 1, section 9, item 163 | 87 | $0.26 |
| 18 | 10 | root 1, section 2, item 7 | 8 | $0.02 |
| 19 | 731 | root 1, part 3, section 16, item 710, appendix 1 | 335 | $1.00 |
| 20 | 327 | root 1, part 9, section 41, item 274, entry 2 | 171 | $0.51 |
| 21 | 509 | root 1, part 3, section 14, item 491 | 318 | $0.95 |
| **total** | **1,901** | | **1,010** | **$3.03** |

(All counts match the agents' reports exactly. `apply_reg<k>/summary_regen_ids.txt` lists every row; summarize.py skips the sub-25-word ones itself.)

## 6. Plumbing files touched

| File | Change |
|---|---|
| `import_ccr.py` | five patches merged as in §1; sip linker step renumbered 1.7 → 1.8; `paren_lower` added to `FAMILY_REGEX_NO_TRAILING_DOT` |
| `test_import_ccr.py` | five test blocks appended; seam-flag assertions reconciled (two sites); aqs cross-reference assertion widened for the 16/sip anchors |
| `summarize.py` | `REG_AUDIENCE` and `REG_PROMPT_HINTS` entries for aqs, 16, sip, 18, 19, 20, 21 (agents' patches, verbatim) |
| `test_summarize.py` | five agents' test blocks; `test_only_reg_11_overrides_the_audience` set = {11, 12, 25, 27, aqs, 16, sip, 18, 19, 20, 21} |
| `sources/manifest.json` | seven `sos` entries inserted after `"27"` (before `"ecmc"`), same key set/shape as `"30"`, deptID 16 / agencyID 7: `aqs` = 5 CCR 1001-14 / ruleId 2347 / ruleVersionId 12357 / 2026-01-14 (from the patch); `16` = 1001-18 / 2350 / 1529 / 2007-04-20; `sip` = 1001-20 / 2352 / 2721 / 2008-12-30; `18` = 1001-22 / 2354 / 4928 / 2012-12-15; `19` = 1001-23 / 2355 / 9953 / 2022-01-14; `20` = 1001-24 / 3282 / 11186 / 2023-12-15; `21` = 1001-25 / 3303 / 10677 / 2023-02-14 |
| `test_freshness.py` | the patch's `test_manifest_has_the_batch6_aqs_sos_entry` + a `BATCH6_SOS` table and `test_batch6_manifest_entries` / `test_batch6_sos_url_and_label` (parametrized ×7, the Batch 5 shape: key set equals `"30"`'s, every field pinned, ISO date; `check_sos` builds the ruleId URL and the "SOS 5 CCR 1001-nn" label). The existing uniqueness test now covers ruleIds/ccr cites across all 16 sos entries. **`freshness.py` not edited.** |
| `site/src/app/admin/review/page.tsx` | `REG_KEYS` += `"16", "18", "19", "20", "21", "aqs", "sip"` (after `"27"`); `REG_LABELS` += "Reg 16" / "Reg 18" / "Reg 19" / "Reg 20" / "Reg 21" / `aqs` → "AQ Standards & Designations (1001-14)" / `sip` → "SIP Local Elements (1001-20)" |
| `site/src/lib/regulation.ts` | numeric regs need nothing (generic `/^\d+$/` card branch + numeric sort). For the non-numeric keys: new `AQCC_NAMED_DOCS` map (`aqs` → "Air Quality Standards, Designations and Emission Budgets", `sip` → "SIP — Local Elements for Nonattainment/Attainment-Maintenance Areas", each with an `order`); `regulationCardInfo` gets a branch before the numeric one returning that title with the CCR cite pulled from the stored title (`5 CCR 1001-14` / `5 CCR 1001-20`) as subtitle (previously they would have fallen through to the federal branch and shown the raw all-caps stored title); `groupColoradoRegulations`'s AQCC comparator is now an `aqccRank()` (cp → −1, numbers → number, named docs → 1,000,000 + order) so both land in the AQCC group after every numbered reg, aqs before sip (they already qualified for the group via `issuing_body === "CDPHE-APCD"`; before, `Number("aqs") || 0` would have sorted them before Reg 1). |
| `docs/import.yml.new` | one hunk in "Map reg to source file basename": `elif [ "$REG" = "aqs" ]; then SRC_BASENAME="REG_AQS"` / `elif [ "$REG" = "sip" ]; then SRC_BASENAME="REG_SIP"` (after the `cp` branch), plus the two description/error strings listing `aqs, sip`. The `^[0-9]+$` branch already covers 16/18/19/20/21. `docs/freshness.yml.new` is manifest-driven, nothing per reg; `/federal` untouched. |
| new helper scripts | `run_parse.sh` (one CLI parse per subprocess, 60-s retry), `prove_noop_batch6.py` + `run_noop.sh` (with/without the seven keys), `prove_reg16_aqs.py` (Reg 16 without aqs), `strip_reconstruct.py` (Batch 5's, + the `data-provision-id` tolerance) |
| `out/` | regenerated `reg<k>_parsed.json` + sidecars + `.log`, `reg<k>_db.json`, `reg<k>_diff_report.md`, `apply_reg<k>/` for all seven; baselines `base_<k>.json` (+ sidecars) copied in; proof parses in `out/noop_batch6/`; `out/pytest_import_ccr.log`. Agent originals `out/reg<k>_agent_parsed.json` untouched. |

## 7. Unresolved / notes for the CEO

- **Anchor counts differ from the brief's predictions, all in the direction of more genuine links:** aqs → sip is ×7, not ×3 (four full-title mentions besides the three short forms); Reg 16 → aqs is ×2, not ×1 (`sec-16-II-A-1` "AQCC Ambient Air Standards Regulation" as well as the V.C.4 mention); sip → aqs is ×1, not ×0 (`sec-sip-VIII-F`). Each extra anchor was read in context and names the right document; nothing to fix, only the reports' prose. Reg 7 (×2) and Reg 25 (×1) are exactly as predicted; 26 / 30 / ECMC byte-identical.
- `CFR_DOTTED_REGS` is {8, 12, 19} — the brief said "Reg 19/20 add to `CFR_DOTTED_REGS`", but Reg 20's patch does not touch it (its one CFR cite, "49 CFR 571.500", is undotted and lands in the `cfr` bucket via 1.1). Nothing missing.
- The `other_ccr` bucket (Reg 20) adds one empty key to every regulation's `_unresolved.json` sidecar and one empty section to every diff report; parsed JSON unaffected. Left as the Reg 20 agent shipped it (same footprint as the ECMC `form`/`crs` buckets).
- Not verified here (no `node_modules`, no network): Next.js type-check/build of `page.tsx` / `regulation.ts`; the GitHub Import workflow end-to-end; the SOS `ruleVersionId`s supplied by the brief — `freshness.py check` will confirm them on first run. The `regulation.ts` change assumes the stored root titles end in the CCR cite (they do: "…EMISSION BUDGETS 5 CCR 1001-14", "…(LOCAL ELEMENTS) 5 CCR 1001-20").
- Agents' "could not resolve" items stand as reported (aqs `III.A.` carrying the Section III table, "Attainment/Mainte nance", the printed "V.a.1." typo; sip's "Subsection" cites and VIII.B.5. c./d.; Reg 19's "II.B.48.b" and Appendix A typos; Reg 20's California section-number typos; Reg 21's four uncorrected definition-label misprints) — none touched by the merge.
