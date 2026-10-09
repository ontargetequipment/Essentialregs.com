# GPO `E T="52"` is a subscript — importer fix and PHMSA re-import (9 Oct 2026)

Pull request "Importer: GPO E T=52 is subscript, not superscript".

## The bug

The whole-part path of `pipeline/import_ecfr.py` (49 CFR Parts 190–199, read
from the eCFR versioner XML with `emphasis=True`) mapped the GPO typeface code
`<E T="52">` to `<sup>` and had no entry for 51. In the eCFR XML 51 is a
superscript ("10<E T="51">−3</E>") and 52 a subscript ("CO<E T="52">2</E>",
"H<E T="52">2</E>S"); 53 and 54 are their italic forms. So the corpus printed
CO<sup>2</sup>. Found while writing `scripts/fetch_method_sections.py`
(PR #83), which worked around it locally.

## The fix

`_XML_E_TYPE_TO_TAG`: 51 and 53 → `<sup>`, 52 and 54 → `<sub>`. The local
workaround in `scripts/fetch_method_sections.py` is gone; it uses the importer's
table. The reader's sanitizer (`src/lib/regulation-pure.ts`, sanitize-html
defaults) already allowed both `<sub>` and `<sup>`.

Every `E T=` code in `pipeline/sources/*.xml`, and how it renders after the fix:

| code | GPO meaning | used in | whole-part path (49 CFR) | 40 CFR subpart path |
|---|---|---|---|---|
| 01 | bold | P190, P192, OOOOa/b/c, ZZZZ | `<i>` (unchanged) | tag dropped, text kept |
| 03 | italic | P192, IIII, JJJJ, OOOO–OOOOc, ZZZZ | `<i>` | tag dropped, text kept |
| 04 | italic ("Federal Register") | P190, P192, P193, P195, P199, OOOO–OOOOc | `<i>` | tag dropped, text kept |
| 7462 | italic (variables) | P192 | `<i>` | — |
| 51 | superscript | IIII, JJJJ, OOOO–OOOOc (none in 49 CFR) | `<sup>` (was: tag dropped) | tag dropped, text kept |
| 52 | subscript | P192 (4), P193 (1), P195 (1), all 40 CFR XML | **`<sub>` (was `<sup>`)** | tag dropped, text kept |
| 54 | subscript italic | P191, OOOO–OOOOc | `<sub>` (unchanged) | tag dropped, text kept |
| 0362, 8153 | (OOOOa / OOOOb only) | OOOOa, OOOOb | — | tag dropped, text kept |

The 40 CFR subparts (OOOO, OOOOa/b/c, JJJJ, IIII, ZZZZ) read the XML only for
tables and equation-image positions and call the helper with `emphasis=False`,
which drops every `<E>` tag and keeps its text: they never emitted the wrong
tag and are unchanged. `import_ccr.py` has no GPO-code handling at all (CCR
documents come from PDFs). There was one copy of the table.

01 is bold in GPO's convention; the importer renders it italic. Not changed
here (out of scope; 10 spans in P190/P192); noted for later.

## Proof

- `test_gpo_51_is_superscript_and_52_is_subscript_in_one_paragraph`.
- `GpoSubscriptRegressionTests`: every document in `pipeline/sources/` parsed
  with the old table and the new one; rows must be equal once `<sub>` is read
  as `<sup>`, and the swapped spans must be exactly the source's `E T="52"`
  spans. Full corpus (`ER_FULL_CORPUS=1`): only p192 (3 rows, 4 spans), p193
  (1 row) and p195 (1 row) change; every other document is byte-identical.
- `scripts/fetch_method_sections.py --date 2026-10-07` without the workaround:
  "no change" for all 30 methods (run 37953753680), i.e. byte-identical to the
  committed `src/data/test-methods.json`.

## Production scope (before any write)

Rows whose stored `full_text` differs from the fixed parse only by sub/sup
tags (md5 of stored text vs the old and the fixed parse, every p19x row that
holds `<sup>` or `<sub>`):

| part | rows | rows with `<sup>` / `<sub>` | sub/sup-only diff | ids |
|---|---:|---:|---:|---|
| p190 | 517 | 0 / 0 | 0 | |
| p191 | 127 | 0 / 1 | 0 | |
| p192 | 2,612 | 17 / 6 | **3** | 192.3 "hard spot", 192.611(a)(4)(ii)(A), 192.927(a) |
| p193 | 436 | 5 / 0 | **1** | 193.2007 "liquefied natural gas" |
| p194 | 155 | 0 / 0 | 0 | |
| p195 | 1,394 | 10 / 2 | **1** | 195.2 "production facility" |
| p196 | 27 | 0 / 0 | 0 | |
| p199 | 243 | 0 / 0 | 0 | |

No 40 CFR subpart or CCR regulation is affected.

## Re-import

Dry run, then execute, one part at a time; `skip_summaries` on, no
`regenerate_summaries`, no paid call.

| part | dry run | plan | execute |
|---|---|---|---|
| p192 | 37953670212 | 3 changed, all markup-only; 0 new, 0 obsolete, 0 to summarize | EXEC_P192 |
| p193 | 37953782208 | 1 changed, markup-only; 0 new, 0 obsolete | EXEC_P193 |
| p195 | 37953915145 | 1 changed, markup-only; 0 new, 0 obsolete | EXEC_P195 |

AFTER_EXECUTE
