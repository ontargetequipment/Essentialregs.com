# PHMSA Batch B — plumbing + site changes (Parts 194 / 195 / 199) — September 19, 2026

Also in this delivery (found during the batch-4 close-out, same commit): the **duplicate-marker fix** in `import_ccr.py` — when two printed items compute the same id, the first occurrence's row is kept and the second's text is folded in as trailing paragraphs (previously the second overwrote the first and the de-dup pass appended the survivor to itself). Affects Reg 7 `sec-7-B-VI-D-3-a-(iii)` (now both paragraphs) and exposed Reg 26 `IV.A.5.c.(ii)` printed twice → new `KNOWN_LABEL_FIXES["26"]` entry (second → `(iii)`, adds row `sec-26-B-IV-A-5-c-(iii)`, restores the fill-level-detector text on `(ii)`). `pipeline/out/reg26_baseline.json` regenerated (previous copy kept in the sandbox); `DuplicateMarkerKeepsBothParagraphsTests` added.

| File | Change |
|---|---|
| `pipeline/import_ecfr.py` | `DIV7 SUBJGRP` walk, label-stack tie-break, `PART_INLINE_DEFINITION_SECTIONS`, `<FTNT>` kept, `PART_FLAT_APPENDICES`, `PART_META`/`CFR_PART_TO_REGKEY` for p194/p195/p199, report fields |
| `pipeline/test_import_ecfr.py` | 4 Batch A tests updated (corpus membership; P192.pdf-present test now uses a temp dir), 47 new — 188 pass |
| `pipeline/import_ccr.py` | duplicate-marker fix; Reg 26 label fix; `CORPUS_REGS`/`ECFR_REGS`/`REG_META` ×3; `CFR_TITLE_PART_TO_REGKEY` ×3; bare part+subpart deep link |
| `pipeline/test_import_ccr.py` | 8 tests updated for 195 in corpus; `BatchBPhmsaTouchpointTests`; `DuplicateMarkerKeepsBothParagraphsTests`; `NEW_REGS` widened — 225 pass / 7 skipped |
| `pipeline/summarize.py`, `test_summarize.py` | hints p194/p195/p199; `_REG_49_CFR_KEYS` all five — 123 pass |
| `pipeline/sources/manifest.json`, `test_freshness.py` | p194/p195/p199 eCFR entries (subpart null); 7 tests — 43 pass; `freshness.py` unchanged |
| `pipeline/sources/P194.xml`, `P195.xml`, `P199.xml` | eCFR versioner XML as of 2026-09-17 (no PDF prints yet) |
| `pipeline/out/reg26_baseline.json` | regenerated after the Reg 26 label fix |
| `docs/imports/2026-09-19/import.yml.new` | basename regex `^p19[0-9]$` → `P19x`; pdftotext skipped for all p19x (XML presence checked) |
| `src/app/admin/review/page.tsx` | `REG_KEYS`/`REG_LABELS` p194/p195/p199 |
| `src/app/federal/page.tsx` | intro sentence; `APPLIES_TO` for the three |
| `src/lib/regulation.ts` | comments only (49 CFR group already collects every part) |

Not verified here: Next.js type-check/build (no npm); the GitHub workflow end-to-end (YAML parsed, every `run:` block passed `bash -n`).
