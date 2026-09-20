# Batch 5 merge report — Regs 11, 12, 25, 27 into one importer (September 20, 2026)

Work done entirely in `/home/claude/working/er/batch5/merge`: no network, no database. All four agent patches are applied to one `import_ccr.py` / `test_import_ccr.py`, the three summarize patches plus a new Reg 27 hint are in `summarize.py` / `test_summarize.py`, and the plumbing (manifest, freshness tests, admin review page) is in. Every parse below was run from the merged CLI (`python3 import_ccr.py parse ...`), the big ones (Reg 7, ECMC) one at a time in their own subprocess.

## 1. What conflicted and how it was resolved

Patch application: `reg11.patch`, `reg12.patch`, `reg25.patch`, `reg27.patch` applied against `import_ccr.ORIGINAL.py` / `test_import_ccr.ORIGINAL.py` (backups `*.orig` are `patch`'s). No `.rej` remains. Overlaps, in the order the brief lists them:

| Overlap | Resolution |
|---|---|
| **`ITEM_TABLE_SPLICE_REGS`** added by both 25 and 27 (`{"25"}` vs `{"27"}`) | One declaration: `ITEM_TABLE_SPLICE_MODE = {"25": "merge_continuations", "27": "strict"}` and `ITEM_TABLE_SPLICE_REGS = frozenset(ITEM_TABLE_SPLICE_MODE)` (import_ccr.py ~1536). The mode dict is the only new name; it records which of the two keyword paths each reg runs. |
| **`_splice_appendix_tables` keyword options** — 25 added `merge_continuations`, 27 added `strict` | Both keywords kept on one signature (`merge_continuations=False, strict=False, seam_starts=None`). The `strict` branch is a self-contained `if strict: ... continue` block at the top of the caption loop (Reg 27's end-of-table rule: first physical line of a wrapped key, stop at the first non-key non-continuation line, page seams bound a wrapped row); the `merge_continuations` logic (reprinted caption = continuation of the table just spliced, wrapped-first-column keys, a reprinted caption right under the last data row breaks the wrapped-cell loop) is the non-strict path. Reg 9's appendix call passes neither and is byte-for-byte the old code path. |
| **`seam_starts` parameter** on `build_provisions` / `_splice_appendix_tables`, passed from `parse_reg`, added by both | One parameter, one plumbing. In the item branch: `own_seams = {si - own_start for si in (seam_starts or ()) if si >= own_start}`, then `_splice_appendix_tables(..., merge_continuations=(mode == "merge_continuations"), strict=(mode == "strict"), seam_starts=own_seams)`. The default stays `None` (Reg 27's `test_build_provisions_seam_starts_defaults_to_none` pins it). |
| **`UNCAPTIONED_TABLES` optional keys** — 25: `spans`, `stop_prefix`, `header_rows`, `compact`; 27: `end_prefix` | All five survive in the renderer; Reg 25's test asserts none of its four keys appear on Reg 8/30 entries, Reg 27's asserts `end_prefix` is on its one `sec-27-E-IV` entry. |
| **`APPENDIX_HEADING_DEDUP_REGS`** — 11 adds `"11"`, 25 adds `"25"` | `frozenset({"9", "30", "11", "25"})`, both comment blocks kept. |
| **`whole_line` (Reg 12, `KNOWN_CONTINUATION_LINES`) vs `whole_line` (Reg 11, `KNOWN_TEXT_FIXES["11"]`) and `next_line_prefix` (Reg 11, `KNOWN_LABEL_FIXES`)** | Checked: they live in three different tables and do not collide. In `KNOWN_CONTINUATION_LINES` `whole_line=True` means "the stripped line must EQUAL `match_prefix`" (Reg 12's wrapped "I.B.16." citation); in `KNOWN_TEXT_FIXES` `whole_line=True` means "replace the whole line" (Reg 11's 70-underscore rule line and stray "6"); `next_line_prefix` is a label-fix guard requiring the next line to start with the given text (Reg 11's two "ADOPTED ..." date lines). Names kept as the agents wrote them; the meanings are documented at each table. |
| Independent additions (12: `PART_COMMA_CITATION_REGS`; 25: `LIST_OR_SIBLING_REGS`, `MULTI_CAPTION_PAGE_REGS`, `APPENDIX_FIGURES`, `APPENDIX_SEAM_BREAK_REGS`; 27: `TABLE_CAPTION_PINS`, `FAMILY_REGEX_TRIPLE_UPPER`, `seam_standalone_line_breaks`; 11: `BARE_DIGIT_CHILD_SECTIONS`, `LAYOUT_TEXT_TABLES`, `APPENDIX_LADDERS`, `part_heading_max_lines`) | All present, untouched. |
| **Test files** — four blocks of new classes appended; Reg 27 edited the Reg 30 corpus test | All four blocks are in `test_import_ccr.py`; every `+` line of every agent's test patch is present verbatim except the four lines below. `Reg30RegNoAbbreviationTests` now has the "27 held out" form (`set(ic.CORPUS_REGS) - {"27"}`) plus a second test that 27 links once in corpus — holds with all four keys. |

**Minimal test edits the reconciliation forced (four lines, each explained in a comment at the site):**
1. Reg 25 `test_table_configs`: `ITEM_TABLE_SPLICE_REGS == frozenset({"25"})` → `frozenset({"25", "27"})`, plus `ITEM_TABLE_SPLICE_MODE["25"] == "merge_continuations"` — the set now has both members by design.
2. Reg 27 `test_table_configs_are_reg_27_only`: `frozenset({"27"})` → `frozenset({"25", "27"})`, plus `ITEM_TABLE_SPLICE_MODE["27"] == "strict"` — same reason.
3. Reg 25 full-parse `test_cross_references`: `unresolved[other_reg]["Regulation Number 27"] == 1` → asserts the `href="/regulations/27"` anchor is in `sec-25-C-I` and "Regulation Number 27" is NOT in the bucket — with 27 in the corpus the mention is an anchor, not a bucket hit.
4. Reg 27 full-parse `test_cross_references`: `dict(unresolved["other_reg"]) == {"Regulation Number 25": 1}` → `{}` with the anchor asserted in `sec-27-E-III` — same reason in the other direction.

No other agent test text was changed.

## 2. Final test counts

| Suite | Result |
|---|---|
| `test_import_ccr.py` | **368 passed, 7 skipped** (+44 subtests) — 233 base + 35 (Reg 11) + 35 (Reg 12) + 33 (Reg 25) + 31 (Reg 27) + 1 (Reg 27's second Reg 30 corpus test) = 368 |
| `test_import_ecfr.py` | **259 passed** (unchanged) |
| `test_summarize.py` | **156 passed, 2 skipped** (145 base + 7 from the three agents' summarize patches + 4 new Reg 27 test items: 3 parametrized selection cases + 1 content test) |
| `test_freshness.py` | **60 passed** (51 base + 9 new Batch 5 manifest tests) |
| all four in one run | **843 passed, 9 skipped** |

`REG_PROMPT_HINTS["27"]` is exactly 200 words (`test_reg27_hint_covers_required_points` pins ≤ 200 and the required markers; `test_reg27_hint_selected_by_id_prefix` pins selection for `sec-27-B-I-A-3` / `sec-27-D-IV-B-1` / `sec-27-E-IV` and default audience). Content is taken from REPORT_reg27.md's warnings: tiers not names in Part B, facility numbers only in the Oct 2023 SOB entry and only verbatim, Part A II defined terms, $89/mt CO2 / 25,000 mt / 5 % EITE / Table 5 tiers / 50 % CHP cap as printed, dates as printed, SOB I/II cite pre-2023 Reg 22 numbering (history), Reg 22 Part A and Reg 7 Part B VII named not described.

## 3. Byte-identity of the four new regs (merged importer vs each agent's parse)

| Reg | `cmp out/reg<k>_parsed.json out/reg<k>_agent_parsed.json` | Rows |
|---|---|---|
| 11 | **BYTE-IDENTICAL** | 715 |
| 12 | **BYTE-IDENTICAL** | 455 |
| 25 | differs in exactly **1 row**: `sec-25-C-I` `full_text` gains one `<a class="xref-external-reg" href="/regulations/27">Regulation Number 27</a>`; stripping that anchor reproduces the agent file row-for-row (`strip_reconstruct.py`: 993 rows, 1 changed, anchors added {27: 1}, unexplained 0). `_unresolved` other_reg bucket is now only "Regulation Number 21" ×1. | 993 |
| 27 | differs in exactly **1 row**: `sec-27-E-III` (the April 20, 2023 reorganisation entry — NOT `sec-27-E-V` as the Reg 27 report and the brief said; the mention "Part C became Regulation Number 25" sits in entry III) gains one `href="/regulations/25"` anchor; strip reproduces the agent file (413 rows, 1 changed, {25: 1}, unexplained 0). other_reg bucket now empty. | 413 |

Diff reports and apply plans regenerated for all four (`out/reg<k>_diff_report.md`: 715 / 455 / 993 / 413 only-parsed, 0 DB, 0 truncation; `out/apply_reg<k>/stats.md`: all new, 0 changed/obsolete, **three sanity checks PASS** for each).

## 4. No-op proof with all four in the corpus

Fresh CLI parses (`out/noop_batch5/*_merged.json`) vs the Batch C baselines; `strip_reconstruct.py` strips only `/regulations/11|12|25|27` anchors from the new parse and requires row-for-row equality with the baseline.

| Reg | Rows | Rows changed | Anchors added | Changed rows |
|---|---|---|---|---|
| ECMC | — | **0 — `cmp` BYTE-IDENTICAL** to `out/ecmc_batchC.json` | — | — |
| Reg 26 | 626 | 5 | Reg 25 ×4, Reg 27 ×1 | `sec-26-A-I-C` (25), `sec-26-C-I` (25), `sec-26-C-I-26` (27), `sec-26-C-II-7` (25), `sec-26-C-III-7` (25) |
| Reg 7 | 2182 | 9 | Reg 25 ×2, Reg 27 ×7 | `sec-7-A-II-C` (25), `sec-7-C-AA` (25); `sec-7-B-VII-F-6`, `-6-a`, `-6-b`, `-6-d-(v)`, `-6-e`, `-6-f`, `sec-7-C-AA-26` (27) |
| Reg 30 | 444 | 1 | Reg 27 ×1 | `sec-30-C-III` (27) |
| Common Provisions (full corpus vs the four keys deleted from `CORPUS_REGS` at runtime, `prove_cp_batch5.py`) | 220 | 1 | Reg 11 ×1 | `sec-cp-V-I` (11) |

Exactly the agents' predicted counts (Reg 25: 4 + 2; Reg 27: 1 + 7 + 1; CP: one Reg 11 anchor); zero Reg 11/12 anchors anywhere else; zero unexplained differences in every file.

## 5. Per-reg row counts and summary-eligible counts

Eligibility = `summarize.py`'s own rule (`strip_html(full_text).split()` ≥ `MIN_WORDS` = 25). Quote at $0.30 / 100 rows.

| Reg | Rows | by kind | Eligible (≥ 25 words) | Quote |
|---|---|---|---|---|
| 11 | 715 | root 1, part 8, section 92, item 545, definition 61, appendix 8 | 419 | $1.26 |
| 12 | 455 | root 1, part 4, section 29, item 421 | 233 (agent report said 240) | $0.70 |
| 25 | 993 | root 1, part 3, section 10, item 976, appendix 3 | 429 (agent said 425) | $1.29 |
| 27 | 413 | root 1, part 5, section 23, item 384 | 259 (agent said 257 / 259 by plain split) | $0.78 |
| **total** | **2,576** | | **1,340** | **$4.02** |

(`apply_reg<k>/stats.md` lists all rows — 715 / 455 / 993 / 413 — as ids to feed `summarize.py --ids-file`; summarize.py skips the sub-25-word ones itself.)

## 6. Plumbing files touched

| File | Change |
|---|---|
| `import_ccr.py` | four patches merged as in §1 |
| `test_import_ccr.py` | four test blocks appended; four lines edited as in §1 |
| `summarize.py` | `REG_PROMPT_HINTS["11"]`, `["12"]`, `["25"]` (agents' patches), `REG_AUDIENCE["11"]` (Reg 11 patch), new `REG_PROMPT_HINTS["27"]` (200 words) |
| `test_summarize.py` | three agents' tests + two new Reg 27 tests |
| `sources/manifest.json` | four `sos` entries inserted after `"30"`, same key set/shape as `"30"`: `11` = 5 CCR 1001-13 / ruleId 2346 / ruleVersionId 12430 / eff 2026-03-02; `12` = 5 CCR 1001-15 / 2348 / 11881 / 2025-03-17; `25` = 5 CCR 1001-29 / 3410 / 12376 / 2026-01-14; `27` = 5 CCR 1001-31 / 3412 / 11838 / 2025-02-14; deptID 16 / agencyID 7 |
| `test_freshness.py` | 9 new tests (`test_batch5_manifest_entries` ×4: key set equals `"30"`'s, every field pinned, ISO date; `test_batch5_sos_url_and_label` ×4: `check_sos` builds the ruleId URL and the "SOS 5 CCR 1001-nn" label; uniqueness of ruleId/ccr across all sos entries); `import re` added. **`freshness.py` not edited.** |
| `site/src/app/admin/review/page.tsx` | `REG_KEYS` += `"11", "12", "25", "27"` (after `"30"`); `REG_LABELS` += "Reg 11" / "Reg 12" / "Reg 25" / "Reg 27" (same style as the other numeric regs) |
| `site/src/lib/regulation.ts` | comment only. Nothing is keyed per reg for numeric AQCC regs: `regulationCardInfo` uses the generic `/^\d+$/` branch ("Regulation Number N — title", CCR cite subtitle) and `groupColoradoRegulations` sorts the AQCC group numerically, so 11/12 land between 9 and 22, 25 between 24 and 26, 27 between 26 and 30 with no list to maintain. The Colorado index (`RegulationList.tsx`) and `sitemap.ts` are data-driven; `federal/page.tsx` is federal-only. |
| `docs/import.yml.new` | **not edited — confirmed by reading**: "Map reg to source file basename" does `if [[ "$REG" =~ ^[0-9]+$ ]]; then SRC_BASENAME="REG_${REG}"`, so `11/12/25/27` resolve to `REG_11/12/25/27.pdf/.txt` with no change; the validate step accepts any alphanumeric key. `docs/freshness.yml.new` is manifest-driven, nothing per reg. |
| new helper scripts | `strip_reconstruct.py` (anchor strip-and-compare proof, exit 1 on any unexplained diff), `prove_cp_batch5.py` (CP with/without the four keys) |
| `out/` | regenerated `reg11|12|25|27_parsed.json` + sidecars + `_parse.log`, `reg<k>_db.json` (`[]`), `reg<k>_diff_report.md`, `apply_reg<k>/`; proof parses in `out/noop_batch5/` (`reg26|reg30|reg7|ecmc_merged.json`, `cp_with4.json`, `cp_without4.json`, logs). Agent originals `out/reg<k>_agent_parsed.json` untouched. |

## 7. Unresolved / notes for the CEO

- The Reg 27 report's location of its one "Regulation Number 25" mention (`sec-27-E-V`) was wrong; it is `sec-27-E-III`. Nothing to fix — only the row id in that report's prose.
- Summary-eligible counts differ by a few rows from what the Reg 12/25/27 agents quoted (they counted with their own word split); the table in §5 uses summarize.py's actual skip rule.
- Not verified here (no `node_modules`, no network): Next.js type-check/build of `page.tsx`; the GitHub Import workflow end-to-end; the SOS `ruleVersionId`s supplied by the brief were not fetched — `freshness.py check` will confirm them on first run.
- `summarize.py` changes: `REG_AUDIENCE["11"]` (from the Reg 11 patch) is the only audience override in the system; Regs 12/25/27 use the default oil-and-gas audience as their agents left it.
