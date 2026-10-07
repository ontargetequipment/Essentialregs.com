# Citation completeness audit (review 4, 7 Oct 2026)

How it was measured: every corpus document was parsed twice with
`pipeline/import_ccr.py parse` against the committed corpus id index
(`pipeline/out/corpus_ids.json`), once with the linker as it stood on main
before this pull request and once with the separator fix. For each
regulation the audit counts citation-shaped references (the importer's own
`II.A.4.` / `V.C.` / `I.D.3.b.(x)` shape) that follow a regulation or
section reference -- a cross-reference link or xref span, "Section(s)",
"Condition(s)", "Part X" or "Regulation Number N" -- within the same run of
text, joined by a separator or directly, and are still plain text (not inside
an `<a>` or an xref `<span>`). The script is kept with the sprint notes
(`scratchpad/tools/citation_audit.py` in the session); the counts below are
its output.

The fix: a citation list may be joined by "&" (escaped "&amp;" by the time
the linker runs), and "and" / "or" / "through" match in any case ("And"),
both in the same-regulation list rule (`_LIST_SEP`) and in the
cross-regulation clause separator (`_XREG_SEP_RE`). GP12 V.C ("Sections
II.A.1. &amp; II.A.4.") and V.I.2 ("Sections II.B. And II.C.5.") now link
both citations. GP12 V.F's "Regulation Number 7, Part D, Section V.C." stays
plain text on purpose: the corpus's Regulation 7 has Parts A, B and C only,
so the cited part does not exist (the linker records it as
`reg_root:no_such_part`); linking it to Part B would be a guess.

Rows whose markup changes on re-import: 9 (Regulation 2: 1, Regulation 3:
1, GP01: 1, GP05: 1, GP07: 1, GP08: 1, GP12: 3); visible letters and digits
identical in every row of every document.

| regulation | plain citations after a reference (before) | after |
|---|---:|---:|
| 1 | 19 | 19 |
| 2 | 5 | 4 |
| 3 | 178 | 177 |
| 4 | 2 | 2 |
| 6 | 11 | 11 |
| 7 | 493 | 493 |
| 8 | 14 | 14 |
| 9 | 0 | 0 |
| 10 | 0 | 0 |
| 11 | 27 | 27 |
| 12 | 5 | 5 |
| 15 | 0 | 0 |
| 16 | 4 | 4 |
| 18 | 0 | 0 |
| 19 | 3 | 3 |
| 20 | 7 | 7 |
| 21 | 2 | 2 |
| 22 | 19 | 19 |
| 23 | 7 | 7 |
| 24 | 22 | 22 |
| 25 | 101 | 101 |
| 26 | 29 | 29 |
| 27 | 52 | 52 |
| 28 | 3 | 3 |
| 29 | 1 | 1 |
| 30 | 5 | 5 |
| 31 | 2 | 2 |
| aqs | 4 | 4 |
| cp | 30 | 30 |
| ecmc | 24 | 24 |
| gp01 | 8 | 7 |
| gp02 | 33 | 33 |
| gp03 | 0 | 0 |
| gp05 | 9 | 8 |
| gp06 | 8 | 8 |
| gp07 | 9 | 8 |
| gp08 | 6 | 5 |
| gp09 | 10 | 10 |
| gp10 | 12 | 12 |
| gp11 | 6 | 6 |
| gp12 | 47 | 44 |
| iiii | 0 | 0 |
| jjjj | 0 | 0 |
| ooooa | 2 | 2 |
| oooob | 0 | 0 |
| ooooc | 0 | 0 |
| p190 | 0 | 0 |
| p191 | 0 | 0 |
| p192 | 0 | 0 |
| p193 | 0 | 0 |
| p194 | 0 | 0 |
| p195 | 0 | 0 |
| p196 | 0 | 0 |
| p199 | 0 | 0 |
| proc | 11 | 11 |
| sip | 2 | 2 |
| zzzz | 0 | 0 |
| **total** | **1232** | **1223** |

Twenty most common remaining forms (after):

| form | mentions | regulations |
|---|---:|---|
| `I.` | 57 | 11, 24, 25, 26, 7, ecmc |
| `II.` | 56 | 24, 25, 26, 7 |
| `XII.` | 50 | 24, 25, 3, 7 |
| `III.` | 28 | 11, 24, 25, 26, 3, 7 |
| `XVII.` | 27 | 3, 6, 7 |
| `XII.L.` | 20 | 7 |
| `X.` | 19 | 22, 24, 25, 26, 27, 7, cp |
| `IV.` | 18 | 22, 24, 25, 26, 7 |
| `V.` | 17 | 22, 24, 25, 7, cp, proc |
| `XVII.F.` | 16 | 7 |
| `IX.` | 13 | 27, 3, 4, 7, cp |
| `XVIII.` | 13 | 7 |
| `VI.` | 11 | 24, 25, 3, 7 |
| `XVI.` | 11 | 25, 7 |
| `XVI.D.` | 10 | 7 |
| `III.J.2.` | 10 | gp01, gp02, gp05, gp06, gp07, gp08, gp09, gp10… |
| `III.J.3.` | 10 | gp01, gp02, gp05, gp06, gp07, gp08, gp09, gp10… |
| `III.J.4.` | 10 | gp01, gp02, gp05, gp06, gp07, gp08, gp09, gp10… |
| `II.A.11.b.` | 9 | 7 |
| `V.C.5.b.` | 9 | gp01, gp02, gp05, gp06, gp07, gp08, gp09, gp10… |

Reading the remaining forms: the bare roman numerals (`I.`, `II.`, `XII.`,
`XVII.`, `XII.L.`, `XVII.F.`, `XVI.D.`) are Regulation 7's and Regulation
25's citations of their own former numbering, left as plain text by the
historical rule (an exact-looking link to the wrong section is worse than no
link); `III.J.2.` / `III.J.3.` / `III.J.4.` and `V.C.5.b.` are the general
permits' "Section III.J.2. of Part B" and "Section V.C.5.b." forms, where
the regulation (Regulation 3 or 7) is named earlier in the paragraph or not
at all, so no target regulation is known; `II.A.11.b.` is Regulation 7
citing a definition whose number has moved (definition_mismatch, plain on
purpose).
