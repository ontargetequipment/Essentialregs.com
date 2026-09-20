# PHMSA Batch C — plumbing + site changes (Parts 190 / 193 / 196) — September 20, 2026

No network, no database. `freshness.py` and `test_freshness.py`'s existing tests untouched (7 tests appended). Four suites before → after: **580 passed / 9 skipped → 688 passed / 9 skipped** (108 new tests, 0 removed, 0 changed outcome).

| File | Change |
|---|---|
| `pipeline/import_ecfr.py` | `PART_META` p190/p193/p196 (printed root titles; 196 = "…From Excavation Activity"); `CFR_PART_TO_REGKEY` += 49-190/193/196; `PART_OTHERPART_REF_RE` list/range forms + per-member rendering (first member keeps the old link extent; comma runs must close with and/or/through); `PART_NUMREF_RE` bare alternative `19[12]` → `19[0-9]` gated by new `PART_BARE_LINK_PARTS` (194/195/199 excluded to keep Batch B byte-identical — one-line unlock documented in the comment); `_definition_term_text` (italic term + immediately-following `<SU>` → “m³”, slug `m3`); `_definition_slug` maps superscript digits to plain digits |
| `pipeline/test_import_ecfr.py` | 3 Batch A/B tests updated for the new corpus (`CfrPartResolverTests` ×2 — 198/1.97/7.29 are now the out-of-corpus cases, `PartCitationLinkingTests.test_out_of_corpus…` + `…in_corpus…`); new `BatchCPartMetaTests` (5), `PartListCitationTests` (11), `PartDefinitionSuperscriptTermTests` (3), `_BatchCFullParseMixin` + `P190/P193/P196FullParseTests` (36 incl. the mixin invariants; § 190.223 amounts pinned verbatim), `AllEightPartsByteIdenticalTests` (8, fixture-gated, rows + report minus `source_xml`) — **188 → 259 pass** |
| `pipeline/import_ccr.py` | `CORPUS_REGS`/`ECFR_REGS`/`REG_META` ×3 (federal, PHMSA); `CFR_TITLE_PART_TO_REGKEY` += 49-190/193/196; `--pdf`/`--xml` help + the `--pdf`-required error text |
| `pipeline/test_import_ccr.py` | `CrossRefNoOpProofTests.NEW_REGS` + tag regex widened to `p19[0-9]`; `BatchBPhmsaTouchpointTests.test_title_part_map…` now expects eight parts; three `Cfr49DottedFormsTests` that used 193/196 as the out-of-corpus stand-in switched to 198 / 49 CFR 7; new `BatchCPhmsaTouchpointTests` (8) — **225 → 233 pass / 7 skipped** |
| `pipeline/summarize.py` | hints `p190` (178 w) / `p193` (179) / `p196` (184); RMV/RCV/ASV + repair-schedule sentence added to `p192` (184) and `p195` (181) with trims elsewhere; `_REG_49_CFR_KEYS` = all eight |
| `pipeline/test_summarize.py` | parametrize list += p190/p193/p196; `test_all_five…` → `test_all_eight_pipeline_parts_are_registered_as_49_cfr_keys`; `test_reg7_prompt_has_no_p19x_specific_text` covers eight keys; 22 new tests (budgets, RMV sentence on p192/p195 + the Batch A/B anchors survive the trim, PHMSA-not-EPA for six new row ids, build_prompt, per-hint vocabulary, no cross-contamination, Reg 7/OOOOb prompts clean) — **123 → 145 pass / 2 skipped** |
| `pipeline/sources/manifest.json` | `p190`, `p193`, `p196` eCFR entries (title 49, subpart null, as_of 2026-09-17, xml_sha256 null — same shape as `p191`) |
| `pipeline/test_freshness.py` | 7 new tests (manifest shape == p191's with the part swapped, URL/label without `&subpart=`, all eight keys present and 198 absent) — **44 → 51 pass**; `freshness.py` unchanged |
| `pipeline/check_gates.py` | comment only (already key-driven); `out/gates.json` regenerated for all eight parts |
| `pipeline/prove_p19x_batchC.py` (new) | two-way proof for 191/192/194/195/199: byte-identical with the new keys out of corpus, anchors-only with them in; writes `out/p19x_batchC_prove.json`, exit 1 on any failure |
| `pipeline/out/` | new: `p190|p193|p196_parsed.json` + `_report.json`, `_db.json` (`[]`), `_diff_report.md`, `apply_p190|p193|p196/` (3/3 sanity checks PASS, `$pv$federal$pv$`/`$pv$PHMSA$pv$` on every row). Regenerated: `p191|p192|p195|p199_parsed.json` + reports + diff reports + `apply_p19x/` (new anchors only; `p194` untouched); Batch A/B versions kept in `out/prove_batchC/shipped_batchAB/`. Proof artifacts: `out/prove_batchC/*_with|without(.json|_report.json)`, `out/p19x_batchC_prove.json`, `out/ecmc|reg26|reg30|reg7_batchC.json` (+ side files), `out/26_prebatchC.json` |
| `docs/imports/…/import.yml.new` | description strings only: `reg` input description, the basename-mapping comment and error text, the pdftotext-step comment and error text now list p190/p193/p196; no logic change (regex already `^p19[0-9]$`); YAML re-parsed, all 12 `run:` blocks pass `bash -n` |
| `src/app/admin/review/page.tsx` | `REG_KEYS` + `REG_LABELS` `p190`/`p193`/`p196` → "49 CFR 190 (PHMSA)" … |
| `src/app/federal/page.tsx` | intro sentence now "49 CFR Parts 190 through 196 and 199 … gas, hazardous liquid and LNG facilities, its enforcement procedures and its excavation damage prevention rule"; `APPLIES_TO` lines for the three (who: what, one line each) |
| `src/lib/regulation.ts` | comments only — the 49 CFR group is citation-shape driven (`/^49 CFR Part \d+/`) so it already collects all eight; within the group the order is `fetchRegulationList()`'s root-id order (`sec-p190-…` < `sec-p191-…` < … < `sec-p199-…`), so Part 190 sorts first with no per-part comparator |

## Test-count summary

| Suite | Before | After |
|---|---|---|
| `test_import_ecfr.py` | 188 passed | **259 passed** |
| `test_import_ccr.py` | 225 passed, 7 skipped | **233 passed, 7 skipped** |
| `test_summarize.py` | 123 passed, 2 skipped | **145 passed, 2 skipped** |
| `test_freshness.py` | 44 passed | **51 passed** |
| all four in one run | 580 passed, 9 skipped | **688 passed, 9 skipped** |

Byte-identity, proven with `cmp` on fresh CLI parses: the six 40 CFR baselines (`ooooa/oooob/ooooc/jjjj/iiii/zzzz` parsed + report) IDENTICAL; p191/p192/p194/p195 IDENTICAL with p190/p193/p196 out of corpus (p199 differs by five `/regulations/p195` anchors — a Batch B gap closed by the list handling, strip-and-reconstruct exact); ECMC, Reg 26, Reg 30, Reg 7 IDENTICAL to their Batch B parses.

Not verified here: Next.js type-check/build (no `node_modules`); the GitHub workflow end-to-end.
