# PHMSA Batch A — 49 CFR Part 191 and Part 192 — import readiness report

## Verdict: READY WITH NOTES

Both parts parse clean: 0 orphans, 0 duplicate ids, 0 label anomalies, 0 dead
cross-reference targets, every `<TABLE>` round-trips, every `[Reserved]`
marker survives as a row. All six existing eCFR baselines (rows **and**
report JSON) are byte-identical. The notes are three deliberate, documented
choices — Appendix D to Part 192 kept as one row, Appendix E's seven figure
placeholders landing on one row, and the cross-reg link shape in the CCR
touchpoints patch — plus one thing I could not measure here (the Part 192 PDF
print never arrived, so half of gate B ran for p191 only).

---

## Regulation identity

| | `p191` | `p192` |
|---|---|---|
| Root citation | `49 CFR Part 191` | `49 CFR Part 192` |
| Root title | 49 CFR Part 191 — Transportation of Natural and Other Gas by Pipeline; Annual, Incident, and Other Reporting | 49 CFR Part 192 — Transportation of Natural and Other Gas by Pipeline: Minimum Federal Safety Standards |
| Issuing body | PHMSA (federal) | PHMSA (federal) |
| Source | `sources/P191.xml` (eCFR versioner XML, as of 2026-09-17) + `sources/P191.pdf/.txt` (12 pp, independent check) | `sources/P192.xml` (788 KB) — **no PDF print present** |
| Authority line (as printed) | 30 U.S.C. 185(w)(3), 49 U.S.C. 5121, 60101 *et seq.*, and 49 CFR 1.97 | 30 U.S.C. 185(w)(3), 49 U.S.C. 5103, 60101 *et seq.*, and 49 CFR 1.97 |
| Structure found | no subparts; 15 sections (§§ 191.1–191.29, incl. § 191.12 [Reserved]); Appendix A | Subparts **A–P** (16); **267** sections; Appendices **A–G** (7) |

Both are parsed from the government XML. Everything for OOOOa/b/c, JJJJ, IIII
and ZZZZ stays on its existing PDF path and is untouched.

---

## Row counts

| | `p191` | `p192` |
|---|---|---|
| **Total rows** | **127** | **2,612** |
| root | 1 | 1 |
| subpart (`kind: part`) | 0 | 16 |
| section | 15 | 267 |
| paragraph item | 93 | 2,243 |
| definition | 17 | 76 |
| heading-only paragraph | 0 | 2 |
| appendix | 1 | 7 |
| appendix ladder children (counted in `item`) | 1 | 52 |
| **Rows ≥ 25 visible words (summary-eligible — the cost quote comes from this)** | **68** | **1,263** |
| Longest row | `sec-p191-191.3-incident`, 200 words | `sec-p192-192.620-(d)`, 2,020 words (one paragraph + a 63×2 inline table) |

Definitions by section — p192: § 192.3 → 58, § 192.903 → 9, § 192.1001 → 6,
§ 192.803 → 3. p191: § 191.3 → 17.

**Summary-eligible total across the batch: 1,331 rows.**

### Row shape / ids (as specified)

```
sec-p192-top-REG-p192            root       "49 CFR Part 192"
sec-p192-PART-L                  part       "Subpart L"        "Subpart L — Operations"
sec-p192-192.605                 section    "§ 192.605"        "§ 192.605 Procedural manual for …"
sec-p192-192.605-(b)-(1)-(i)     item       "§ 192.605(b)(1)(i)"
sec-p192-192.3-abandoned         definition "§ 192.3 “Abandoned”"
sec-p192-APPENDIX-B              appendix   "Appendix B to Part 192"
sec-p192-APPENDIX-B-II-A-1       item       "Appendix B to Part 192 II.A.1"
sec-p192-192.117-192.119         section    "§§ 192.117-192.119"   full_text "<p>[Reserved]</p>"
```

Appendices sort after Subpart P; subpart rows' parent is the root; section
rows' parent is their subpart row (the root for p191, which has none).

---

## Changes made to `import_ecfr.py` (one line each, with the reason)

1. **`PART_META` + `SUBPART_META.update(PART_META)`** — registers `p191`/`p192`
   in the same meta dict with two new keys, `document="part"` and
   `source="xml"`, so `link_citations`, `resolve_chain_list`, the label-cycle
   helpers, `render_xml_table_html` and the row shape stay shared instead of
   forked. Both new keys are read only through `.get(...)`, so the six subpart
   entries need no new keys at all.
2. **`CFR_PART_TO_REGKEY = {"49-191": "p191", "49-192": "p192"}`** — a 49 CFR
   section number resolves to a reg by its PART prefix, not by the 40 CFR
   section-range trick.
3. **`_resolve_target_reg_49()`** — the title-49 resolver; every other 49 CFR
   part (190, 193, 195, 196, 199, 1.97) returns `None` and gets bucketed.
4. **Guard in `_resolve_target_reg()`** — skips any `document="part"` meta, so a
   stray "§ 192.605" inside a 40 CFR subpart can never link to the pipeline
   part. Belt and braces: no such cite exists in the six sources.
5. **`_xml_inline_html(el, emphasis=False)`** — new optional flag. With
   `emphasis=True` (whole-part path only): `<I>` → `<i>`,
   `<E T="01|03|04|7462">` → `<i>`, `<E T="52">` → `<sup>`, `<E T="54">` →
   `<sub>`, `<SU>` → `<sup>`, `<FR>` stays plain text. Default is the original
   behaviour, so JJJJ/IIII/ZZZZ table HTML is byte-for-byte unchanged.
6. **`render_xml_table_html(..., emphasis=False)` + empty-caption guard** — most
   Part 192 inline tables carry no `<CAPTION>` (their title is the first header
   row); an empty caption `<div>` would render as a stray blank line. Every
   40 CFR subpart table has a caption, so the branch is never taken on a
   baseline.
7. **`resolve_chain_list(..., token_re=None)`** — injectable tokenizer, so the
   part path can use 7-character paragraph labels (§ 192.917(b)(1) runs its
   roman list out to `(xxxv)`) while the subpart path keeps its 4-character
   regex and its baselines.
8. **`_link_citations_part()` + a dispatch line at the top of
   `link_citations()`** — the 49 CFR rule set: `§ 192.605(b)`,
   `§§ 192.243 through 192.245`, `paragraph (b)(1) of this section`,
   `subpart L of this part`, `appendix B to this part`, bare `this part` →
   root, `part 191 of this chapter` / `§ 191.15` / `49 CFR 191.5` → the other
   part, and counted buckets for everything else. `link_citations` stays the
   single entry point.
9. **`PART_*` regex set + two new buckets** (`statute`,
   `standard_not_in_corpus`) — deliberately separate from
   `NUMREF_RE`/`RELREF_RE`/`ALL_BUCKETS` precisely so the six subparts' *report*
   JSON stays byte-identical too; widening the shared regexes would change
   which mentions get counted.
10. **`parse_ecfr_part(reg, xml_path)`** — the new parser: DIV6 → subpart rows,
    DIV8 → section rows, DIV9 → appendix rows, `<P>` → the paragraph tree,
    `<DIV>/<TABLE>` inline, `<img>` → placeholder, `CITA`/`EDNOTE`/`XREF`/
    `SOURCE`/`AUTH` dropped and counted, `EXTRACT`/`FP`/`FP-1`/`FP-2`/`NOTE`
    kept as `<p>` lines inside the enclosing row.
11. **`_advance_part_label_stack()`** — rebuilds nesting from the printed label
    alone, because the XML flattens a section's paragraphs into sibling `<P>`s
    and there is no indentation to read. See below.
12. **`_split_part_paragraph()`** — splits the three printed shapes that put two
    labels on one line: `(1)(i) text` (§ 192.3 "UNGSF"),
    `(b) <i>Heading.</i> (1) text` (§ 192.121(b)),
    `(a) <i>Pipeline systems</i>—(1) …` (§ 191.15(a)), and
    `(b) This section does not apply to: (1) Manifolds;` (§ 192.150(b)).
13. **`PART_FLAT_APPENDICES`** — names the appendices whose printed ladder is
    ambiguous, so they stay one row rather than being mis-nested.
14. **`cmd_parse_part()` + `part_xml_path()` + `--xml`, `--pdf` made
    optional** — `cmd_parse` dispatches on `document == "part"`;
    `part_xml_path()` takes `--xml` when given and otherwise derives the XML
    path from `--pdf` (or `--txt`) by swapping the extension, and neither the
    .pdf nor the .txt has to exist; `_write_report()` factored out so both
    paths write the same `*_report.json`.
15. **`span()` self-link guard in `_link_citations_part()`** — a row never
    emits a `data-target` equal to its own id; the text is emitted unwrapped
    and is *not* bucketed (the target exists — it is the reader's own
    position).
16. **`_heading_only` on section/appendix rows with no body text** — those
    rows carry the printed heading as plain text and are skipped by the
    cross-reference pass entirely, matching the JJJJ/ZZZZ convention
    (`§ 60.4230 Am I subject to this subpart?` — no span, no `<p>`).

### The one genuinely ambiguous label (and how it is resolved)

In the CFR cycle `(a)→(1)→(i)→(A)`, a lone `(i)` printed after a level-1 `(h)`
that already has open children is **both** the first lower-case roman of a new
sub-level **and** the next top-level alpha sibling. The PDF path tells them
apart by indentation; the XML has none. `_advance_part_label_stack` decides
from the surrounding label stream instead: if the alpha successor `(j)` turns
up later in the section, or the very next label is not one a roman `(i)` could
have (`(ii)` or its own first child `(A)`), the shallower reading wins.

Without it, **§ 192.7(i)**, **§ 192.321(i)** and **§ 192.631(i)** each nested
themselves under `(h)` and dragged their children along — 51 label anomalies.
With it: **0**. Unit-tested in both directions
(`PartLabelStackTests.test_i_after_h_*`).

### Bug found and fixed while writing the tests

The importer's own figure-placeholder URL contains a section number
(`…/title-49/section-192.121`), and the bare-number alternative of the
cross-reference scanner was turning that into a live link *inside the
placeholder*. Fixed with a `(?<![-/\w])` lookbehind on that alternative;
regression test
`PartStructureFromXmlTests.test_image_becomes_a_figure_placeholder_with_the_section_url`.

### Fixes made after coordinator review

1. **Self-links removed.** 187 p192 rows (184 section, 3 item) and 11 p191
   rows contained a `data-target` pointing at their own id. Two causes, both
   fixed: (a) a section row whose body lives entirely in its children was
   being link-scanned, so its own section number inside the printed heading
   became a span — those rows are now `_heading_only`, carry the plain
   heading text (`full_text == title`, no `<p>`, no markup) and are skipped by
   the cross-reference pass, exactly like JJJJ/ZZZZ heading rows; (b) three
   item rows (`192.167(c)(2)(ii)`, `192.620(d)`, `192.624(c)(5)(ii)`) cite
   "paragraph (…) of this section" where the target resolves back to the
   citing row — the new `span()` guard emits those unwrapped, without
   bucketing them. **Now 0 self-links in both parts.** Same-document link
   counts fall accordingly (p192 1,773 → 1,568; p191 69 → 58); row counts,
   ids, parents and every other gate are unchanged.
2. **CLI XML derivation.** `part_xml_path()`: the Import workflow always
   passes `--pdf pipeline/sources/P192.pdf --txt pipeline/sources/P192.txt`,
   so for a `document="part"` reg the XML path is derived from `--pdf` (or
   `--txt`) when `--xml` is absent, and **neither the .pdf nor the .txt has to
   exist** — a whole-part reg reads only the XML, and `P192.pdf` is not in the
   repo. `--xml` remains an explicit override. Both parses in this report
   were regenerated through the workflow-style invocation
   (`--reg p192 --pdf sources/P192.pdf --txt sources/P192.txt`, with no
   `P192.pdf` on disk) and produced identical output.

---

## Label fixes added

**None.** No `KNOWN_LABEL_FIXES` or `KNOWN_LINE_DELETIONS` entry was needed.
The eCFR XML's label stream for both parts is internally consistent once the
`(h)`/`(i)` ambiguity above is resolved — those 51 anomalies were one bug, not
51 misprints. Both parts now report `label_anomalies: []`.

---

## Quality-gate results A–I

Evidence: `out/gates.json`, regenerable with `python3 check_gates.py`.

**A — Structure. PASS (both).**
p192's parsed top level is exactly `Subpart A … Subpart P`, then
`Appendix A … Appendix G` — 16 + 7 = 23 rows, in order. For every one of the
16 subparts the parsed section list is *identical* to that `DIV6`'s
`<DIV8 N="…">` list, asserted element-for-element in
`P192FullParseTests.test_267_sections_and_every_subpart_section_list_matches_the_xml`;
267 sections total. p191 has no subparts: 15 section rows + 1 appendix row
hang directly off the root, matching the XML's 15 `DIV8`s and 1 `DIV9`.
**0 mismatches.**

**B — Coverage. PASS (both); one half unmeasurable for p192.**
*XML vs rows, word level* (editorial elements excluded, leading labels
stripped on both sides): p191 4,286 source words → **7** unaccounted
(0.16 %); p192 93,915 → **24** (0.03 %). All 31 are the checker's own
artifact, not a loss: the importer renders `100 ft<sup>3</sup>` and
`T<sub>r</sub>` while the plain-text side reads them as `ft 3` and `T r`, so
the tokens `″`, `ft`, `6.9/m`, `milligrams/m`, `t`, `p`, `cpi`, `r` differ in
spacing only.
*XML vs rows, paragraph level*: every one of p191's 117 and p192's 2,472 `<P>`
elements is findable in the parsed rows. **0 not found.**
*pdftotext body vs rows (p191)*: 4,816 body words after the importer's own
furniture stripper; **2** not found in the rows — `safety-` and `related`, the
two halves of one hyphen-wrapped "safety-related" in the print. The reverse
direction is 356 words, all of it citation/label text the app re-inserts as
badges (`§ 191.23`, `(a)`, `(b)` …).
**p192's PDF print never arrived**, so its pdftotext half of this gate could
not be run. The XML half covers it; `check_gates.py` picks the print up
automatically once it lands.

**C — Repeated text. PASS (p191); 1 explained flag (p192).**
p191: 0 flags. p192: one row, `sec-p192-APPENDIX-E-II-c`, carries the same
50-character prefix 7 times — it is the figure placeholder, once per image.
Appendix E's guidance tables E.II.1/2/3 are published as seven GIFs that the
XML emits *after* paragraphs (a)–(c), so all seven attach to the last open
row, (c). Legitimately repeated; see "things I could not resolve".

**D — Giant / fused rows. PASS (both). 0 rows over 6,000 visible words.**
Longest p192 rows: `192.620-(d)` 2,020, `192.112` 1,638, `APPENDIX-D` 784,
`192.903-high-consequence-area` 419, `192.328` 407. The first two are a single
paragraph plus a large inline table (63×2 and 44×2), not fused siblings —
verified by inspection. **Appendix F is not a giant row**: its printed ladder
parsed into 22 children, longest 174 words. **§ 192.3's definitions are not a
giant row**: its 58 terms became 58 definition rows. Longest p191 row: 200
words.

**E — Orphans and labels. PASS (both).**
p191: 127 rows, 0 duplicate ids, 0 orphans, 0 label anomalies. p192: 2,612
rows, 0 duplicate ids, 0 orphans, 0 label anomalies. Every child id extends
its parent's id (`ids_not_extending_parent: []`) — the structural form of
"every child's label-cycle position is consistent with its parent".

**Reserved. PASS.** All **17** `[Reserved]` markers in Part 192 are rows, none
dropped:
*8 reserved section headings covering 10 section numbers* — `§ 192.57`,
`§ 192.61`, `§§ 192.117-192.119` (one row, three numbers), `§ 192.123`,
`§ 192.191`, `§ 192.478`, `§ 192.949`, `§ 192.1009`;
*1 reserved appendix* — `Appendix A to Part 192`;
*8 reserved paragraphs* — `192.7(d)(2)`, `192.7(f)(10)`, `192.7(g)`,
`192.7(h)(2)`, `192.7(j)(2)`, `192.451(b)`, `192.620(a)(1)(ii)`,
`192.727(g)(2)`.
Each carries `full_text = "<p>[Reserved]</p>"`; sections keep `kind: section`,
paragraphs `kind: item`. p191: `§ 191.12 [Reserved]`, 1 row.

**F — Statement of basis.** Not applicable: a CFR part has no AQCC
statement-of-basis part. The nearest equivalents — `<CITA>` amendment
citations and `<EDNOTE>` editorial notes — are dropped and counted (below),
which is what the OOOO PDF path already does with the same material
(`AMEND_NOTE_RE` strips `[NN FR NNNNN …]` lines there). Confirmed, and the
two paths are now consistent.

**G — Cross-references. PASS (both). 0 dead targets.**

| | `p191` | `p192` |
|---|---|---|
| Same-document `data-target` spans | **58** | **1,568** |
| → to a section | 24 | 748 |
| → to a paragraph | 25 | 615 |
| → to a subpart row | — | 60 |
| → to an appendix row | 0 | 37 |
| → to the root (`this part`, `part 192`) | 9 | 108 |
| **Rows linking to themselves** | **0** | **0** |
| Cross-part `xref-external-reg` links | **13** (all → `p192`) | **15** (all → `p191`) |
| **Dead targets** | **0** | **0** |
| bucket `cfr_not_in_corpus` | 4 distinct / 4 mentions | 7 / 9 |
| bucket `statute` | 2 / 2 | 6 / 8 |
| bucket `standard_not_in_corpus` | 0 / 0 | 105 / 319 |
| bucket `unparseable` | 0 / 0 | 12 / 15 |
| bucket `other_subpart` | 0 / 0 | 0 / 0 |

Bucket contents are honest, not gaps.
`cfr_not_in_corpus` — p192: `§ 190.9` ×3, `49 CFR 190.9`, `49 CFR 190.206`,
`§ 198.37`, `§ 198.39`, `1 CFR part 51`, `33 CFR part 64`; p191:
`49 CFR 190.9`, `§ 193.2007`, `part 193 of this chapter`, `part 193`.
`statute` — `49 U.S.C. 60101/60105/60118`, `43 U.S.C. 1301/1331`,
`5 U.S.C. 552`.
`standard_not_in_corpus` — the incorporated standards; top five
`ASME B31.8S` ×31, `NACE SP0502` ×16, `API Spec 5L` ×12, `NACE SP0204` ×12,
`NACE SP0206` ×11. **The standard's name never links; the "(incorporated by
reference, *see* § 192.7)" that accompanies it always does** — § 192.7 is a
real row (unit-tested).
`unparseable` (15 mentions) are relative references whose target genuinely has
no row: 6 × "paragraph (b)(1) of this section" where the cited paragraph lives
inside an inline table (e.g. § 192.112, whose whole requirement list is a
44-row table), and 9 × "paragraph (N) of this paragraph" inside Appendix C/D,
where the appendix is one row by design. Never a dead link — every one is
re-emitted verbatim.

**H — Tables. PASS (both). 31/31 and 1/1 rendered inline; 0 cell round-trip
failures.** Every `<TABLE>` renders in the row where it occurs
(`<table class="doc-table">` via `render_xml_table_html`), **not** as a
separate `-TABLE-` row — asserted (no row id contains `-TABLE-`). Every XML
cell's text is present in the rendered row HTML (compared
whitespace-insensitively, to absorb `<br/>`). Inventory:

*p191*

| Row | Caption | Shape |
|---|---|---|
| `sec-p191-191.21` | OMB Control Number 2137-0522 | 8 × 2 |

*p192*

| Row | Caption | Shape |
|---|---|---|
| `sec-p192-192.8-(c)-(2)` | Table 1 to Paragraph (c)(2) | 7 × 4 |
| `sec-p192-192.9-(g)-(2)` | *(no printed caption — title is the header row)* | 7 × 2 |
| `sec-p192-192.13-(a)-(3)` | *(none)* | 5 × 2 |
| `sec-p192-192.13-(b)` | *(none)* | 5 × 2 |
| `sec-p192-192.111-(a)` | *(none)* — class-location design factors | 5 × 2 |
| `sec-p192-192.112` | *(none)* — alternative-MAOP requirements | 44 × 2 |
| `sec-p192-192.113-(a)` | Table 1 to Paragraph (a) | 18 × 3 |
| `sec-p192-192.115` | *(none)* — temperature derating factor | 6 × 2 |
| `sec-p192-192.121-(c)-(2)-(iv)` | Table 1 to Paragraph (c)(2)(iv) | 23 × 3 |
| `sec-p192-192.121-(d)-(2)-(iv)` | Table 2 to Paragraph (d)(2)(iv) | 15 × 3 |
| `sec-p192-192.121-(e)-(4)` | Table 3 to Paragraph (e)(4) | 15 × 3 |
| `sec-p192-192.121-(f)-(2)` | *(none)* | 5 × 2 |
| `sec-p192-192.125-(b)` | *(none)* | 8 × 4 |
| `sec-p192-192.177-(a)-(1)` | *(none)* | 3 × 2 |
| `sec-p192-192.327-(a)` | *(none)* | 5 × 3 |
| `sec-p192-192.328` | *(none)* | 10 × 2 |
| `sec-p192-192.481-(a)` | *(none)* | 4 × 2 |
| `sec-p192-192.490` | *(none)* | 4 × 2 |
| `sec-p192-192.503-(c)` | *(none)* | 6 × 3 |
| `sec-p192-192.557-(d)-(3)` | *(none)* | 9 × 4 |
| `sec-p192-192.619-(a)-(2)-(ii)` | Table 1 to Paragraph (a)(2)(ii) | 6 × 5 |
| `sec-p192-192.619-(a)-(3)` | *(none)* | 6 × 3 |
| `sec-p192-192.620-(a)-(1)` | *(none)* | 4 × 2 |
| `sec-p192-192.620-(a)-(2)-(ii)` | *(none)* | 4 × 2 |
| `sec-p192-192.620-(d)` | *(none)* | 63 × 2 |
| `sec-p192-192.624-(c)-(5)-(ii)` | Table 1 to § 192.624(c)(5)(ii) | 3 × 3 |
| `sec-p192-192.705-(b)` | *(none)* | 5 × 3 |
| `sec-p192-192.739-(b)` | *(none)* | 3 × 2 |
| `sec-p192-192.939-(b)-(6)` | Maximum Reassessment Interval | 4 × 4 |
| `sec-p192-APPENDIX-B-II-D` | Number of Tensile Tests—All Sizes | 3 × 2 |
| `sec-p192-APPENDIX-F-XIX` | Table 1 to Appendix F—Required Response to GWUT Indications | 2 × 4 |

**I — Tests. PASS. 143 passed, 0 failed, 0 skipped**
(`python3 -m pytest -q test_import_ecfr.py`). 67 pre-existing + 76 new:
`PartMetaTests` (7), `CfrPartResolverTests` (4, incl. "the 40 CFR resolver
never returns a part document"), `PartLabelStackTests` (7),
`PartParagraphSplitTests` (7 — heading+item on one line in all three printed
shapes, fused labels, and a negative test that an ordinary parenthetical does
not split a paragraph), `PartInlineHtmlTests` (4, incl. "the subpart path's
inline HTML is unchanged"), `PartStructureFromXmlTests` (8 — subpart/section/
paragraph rows, reserved sections, definitions, CITA/EDNOTE/XREF stripping,
image placeholder, inline tables, appendix ladder, ambiguous ladder stays one
row), `PartCitationLinkingTests` (14 — same-part, ranges, relative,
subpart-of-this-part, appendix-to-this-part, this-part→root, 191↔192 both
directions, out-of-corpus CFR/statute/standard buckets, "a row never links to
itself", "a sibling reference still links", and "the part linker is only used
for part documents"), `PartCliXmlPathTests` (5),
`_PartRowInvariantsMixin` (2, run over both full parses),
`P191FullParseTests` (4 + 2), `P192FullParseTests` (7 + 2),
`AllSixByteIdenticalBaselineTests` (4).

**Byte-identical baselines — PASS, all six, rows and report.**
`ooooa`, `oooob`, `ooooc`, `jjjj`, `iiii`, `zzzz`: parsed rows identical to
`out/<key>_baseline.json` **and** report JSON identical to
`out/<key>_baseline_report.json`. The report check is the stricter of the two
and is why the new cross-reference regexes and buckets are a separate set
rather than a widening of the shared ones.

---

## Appendices — what was done to each, and why

| Appendix | Treatment |
|---|---|
| **191 A** — Procedure for Determining Reporting Threshold | **1 child row** from its printed `I.` heading; holds the formula image placeholder and the `Where: T_r … CPI_p` variable list. |
| **192 A** | Reserved — one row, `full_text = "<p>[Reserved]</p>"`. |
| **192 B** — Qualification of Pipe and Components | **16 child rows.** Ladder `I.` / `A.`–`D.` / `(1)`–`(2)` is contiguous and unambiguous; the `<FP-1>` specification lists attach to their `A.`/`B.` parent; `sec-p192-APPENDIX-B-II-D` carries the tensile-test table. |
| **192 C** — Qualification of Welders for Low Stress Level Pipe | **5 child rows** (`I.`–`III.`, then `(1)`–`(2)` under `III.`). The ladder skips the letter level; the appendix parser keys on label *shape*, not depth, so this parses cleanly. |
| **192 D** — Criteria for Cathodic Protection | **ONE row (784 words).** Its first line fuses up to three ladder levels — "I. Criteria for cathodic protection— A. Steel, cast iron, and ductile iron structures. (1) A negative …" — so the following `(2)`–`(5)` cannot be attached to the right parent without guessing. Kept whole rather than mis-nested; listed in `PART_FLAT_APPENDICES`. |
| **192 E** — Guidance on HCAs and on carrying out IM requirements | **5 child rows** (`I.`, `II.`, and `II.(a)`–`(c)`). Holds 8 of the 9 figure placeholders. |
| **192 F** — GWUT criteria | **22 child rows** (`I.`–`XIX.`, plus `A.`–`C.` under `XIII.`); the GWUT response table lands on `sec-p192-APPENDIX-F-XIX`. At 14 KB this was the giant-row candidate; it is not one (longest child 174 words). |
| **192 G** — Guidance on Moderate Consequence Areas | **4 child rows** (`I.`, `A.`–`C.`). |

---

## Editorial elements dropped (counted, never silently lost)

| | `p191` | `p192` |
|---|---|---|
| `<CITA>` amendment citations | 15 | **206** |
| `<EDNOTE>` editorial notes | 0 | 5 |
| `<SOURCE>` | 0 | 5 |
| `<XREF>` "Link to an amendment published at 91 FR …" | 0 | 16 |
| `<AUTH>` authority line | 1 | 1 |

Consistent with the PDF path, which strips the same `[NN FR NNNNN, …]`
material via `AMEND_NOTE_RE`. **Kept**: `<EXTRACT>` (4 formula variable
lists), `<FP>`/`<FP-1>`/`<FP-2>` (52 flush paragraphs), `<NOTE>` (1), and every
amendment-date lead-in printed inside a `<P>` ("Effective October 1, 2026, …"),
which is text and stays verbatim.

**Images: 9 of 9 in p192, 1 of 1 in p191** replaced with
`<p class="figure-omitted">[Figure/equation not reproduced — see the eCFR:
&lt;url&gt;]</p>`. Section images use the section URL
(`https://www.ecfr.gov/current/title-49/section-192.121`); appendix images use
`…/part-192/appendix-Appendix%20E%20to%20Part%20192`. No `.gif` path ever
reaches a row.

---

## CCR importer touchpoints (`import_ccr_touchpoints.patch`)

Built against `import_ccr_for_reference.py`, which was **not** edited in
place. The patch is labelled for `import_ccr.py` and applies with
`patch -p0`; verified to apply clean and reproduce the patched file exactly.

1. `CORPUS_REGS` += `"p191"`, `"p192"`.
2. `ECFR_REGS` += `"p191"`, `"p192"` — so `cmd_parse` dispatches them to
   `import_ecfr.cmd_parse`, which dispatches on to the whole-part path.
3. `REG_META["p191"]` / `["p192"]` — `jurisdiction_level: "federal"`,
   `issuing_body: "PHMSA"`,
   `source_url: https://www.ecfr.gov/current/title-49/part-19{1,2}`, root
   citation and title as above.
4. **New** `CFR_TITLE_PART_TO_REGKEY = {("49","191"): "p191",
   ("49","192"): "p192"}` + `CFR_TITLE_PART_RE`, consulted by a **new step
   1.1** in `link_citations` that only ever fires on a `49 CFR …` citation.
   **Every 40 CFR mapping and every 40 CFR citation path is untouched** —
   step 1 matches `40 CFR Part …` only, so the two never compete. The step is
   additionally gated on corpus membership, so it is a strict no-op until
   p191/p192 are actually imported (verified both ways).
   `49 CFR Part 192` → `<a class="xref-external-reg" href="/regulations/p192">`;
   `49 CFR 192.605` → the same anchor **plus**
   `data-provision-id="sec-p192-192.605"`, so the app can deep-link while the
   plain href keeps behaving like every other cross-reg link (the CCR
   importer has no precedent for a cross-reg deep link, so the deep target is
   carried as an extra attribute rather than replacing the href).
   `49 CFR Part 195` and friends still fall through to the `cfr` bucket.
5. CLI: `--xml` added to the `parse` subparser and `--pdf` made optional
   (with an explicit error if a CCR reg is parsed without it), because
   `import_ecfr.cmd_parse` now reads `args.xml` for the whole-part regs.

**Does the CCR corpus actually cite 49 CFR 192?** Not measurable from here —
this directory holds only the eCFR sources; there is no Colorado source text
to grep (`grep -l "49 CFR" sources/*` matches only `P191.txt`, `P191.xml`,
`P192.xml`). The ECMC 1100-series flowline rules are the likely mentioner.
**Measured at merge**: run
`grep -oiE "49 C\.?\s?F\.?\s?R\.?[^,;)]{0,30}" sources/*.txt` in the pipeline
directory once the ECMC/AQCC sources are alongside, and confirm the hits land
in step 1.1 rather than in the `cfr` bucket.

---

## Deliverables produced

| File | What |
|---|---|
| `out/p191_parsed.json`, `out/p192_parsed.json` | 127 / 2,612 provision rows |
| `out/p191_parsed_report.json`, `out/p192_parsed_report.json` | per-parse report (structure, reserved, tables, images, buckets, dead targets) |
| `out/p191_db.json`, `out/p192_db.json` | `[]` — empty DB export, so every row diffs as `new` (expected for a new reg; no database was contacted) |
| `out/p191_diff_report.md`, `out/p192_diff_report.md` | `import_ccr_for_reference.py diff` — `only_parsed=127` / `only_parsed=2612`, `only_db=0`, `different=0` |
| `out/apply_p191/`, `out/apply_p192/` | `apply` plan + SQL (1 and 11 upsert files). **All three `stats.md` sanity checks PASS** for both. |
| `ecfr.patch` | `import_ecfr.py` + `test_import_ecfr.py` vs ORIGINAL; applies clean with `patch -p0` and reproduces both files exactly |
| `import_ccr_touchpoints.patch` | the five touchpoints above |
| `check_gates.py`, `out/gates.json` | the gate A–I harness and its output |
| `REPORT.md` | this file |

`diff` and `apply` ran against the **unmodified** reference CCR importer —
they needed only the parsed JSON and did not insist on a known reg.
**One consequence to note:** until the touchpoints patch lands, `apply` writes
the *default* metadata into its SQL (`jurisdiction_level 'state'`,
`issuing_body 'CDPHE-APCD'`, the Colorado `source_url`). That is exactly what
`REG_META["p191"]/["p192"]` fixes — re-run `apply` after merging the patch and
before executing any SQL.

Reproduce everything with:

```
# workflow-style (the .xml path is derived; no P192.pdf/.txt need exist)
python3 import_ecfr.py parse --reg p191 --pdf sources/P191.pdf --txt sources/P191.txt --out out/p191_parsed.json
python3 import_ecfr.py parse --reg p192 --pdf sources/P192.pdf --txt sources/P192.txt --out out/p192_parsed.json
# or with an explicit override
python3 import_ecfr.py parse --reg p192 --xml sources/P192.xml --out out/p192_parsed.json
python3 check_gates.py
python3 -m pytest -q test_import_ecfr.py
```

---

## Things I could not resolve

1. **No Part 192 PDF print.** `sources/P192.pdf` was never delivered, so gate
   B's independent pdftotext cross-check ran for p191 only. The XML-side
   coverage check covers p192 (0 paragraphs unaccounted for), but a second,
   independent rendering has not confirmed it. Re-run `check_gates.py` when
   the print arrives — it picks it up automatically.
2. **Appendix D to Part 192 is one 784-word row** (`sec-p192-APPENDIX-D`).
   Deliberate: its roman/letter/number ladder is fused onto single printed
   lines. Splitting it needs either a hand-written rule for that one appendix
   or the PDF's indentation. It is well under the giant-row threshold and
   reads correctly; it simply has no children. Its internal "paragraphs (3)
   and (4) of this paragraph" references are consequently bucketed as
   `unparseable` (9 mentions), not left as dead links.
3. **Appendix E's seven figure placeholders all land on
   `sec-p192-APPENDIX-E-II-c`.** The XML emits the seven GIFs after paragraphs
   (a)–(c) with nothing tying figure *n* to paragraph *n*, so they attach to
   the last open row. A reader sees seven identical "figure not reproduced"
   lines under (c) instead of one under each of (a)/(b)/(c). Cosmetic, and the
   eCFR link in each placeholder is correct. Fixing it needs a hand-wired
   mapping from `<img src>` to the Table E.II.n it depicts.
4. **Two intentionally text-less paragraph rows** in p192:
   `sec-p192-192.711-(b)-(1)` and `sec-p192-192.905-(b)`. Both are printed as
   `(b)(1) …` / `(1)(i) …`, where the outer label has no text of its own. They
   are `kind: "heading"` with `full_text` = their citation, exactly as the PDF
   path handles the same shape.
5. **Relative references into an inline table** (6 mentions, e.g. § 192.112's
   "paragraph (h)(2) of this section"). § 192.112's entire requirement list is
   a 44-row table, so `(h)(2)` has no row to point at. Bucketed as
   `unparseable`, re-emitted verbatim. Fixing it would mean parsing that
   table's first column into paragraph rows, which contradicts the
   render-tables-inline decision.
6. **Multi-target ranges link their endpoints, not the span.**
   `§§ 192.243 through 192.245` links 192.243 and 192.245; 192.244 in between
   is not linked (there is no text to wrap). Same behaviour as the existing
   subpart path.
7. **§ 192.3 has 58 defined terms, not the ~150 the brief estimated.** Counted
   from the XML (`<P><I>Term</I> means …</P>`); the whole part has 76
   definition rows across §§ 192.3, 192.803, 192.903 and 192.1001. Flagging it
   because the estimate feeds the summary cost quote.

---

## Summarizer warnings for `summarize.py` hints

These two documents sit next to six EPA air-rule subparts in the same corpus,
and almost every term they share with those subparts means something
different. Scope the hints below to `p191`/`p192` only.

- **"Administrator" is never the EPA Administrator.** Here it is the **PHMSA
  Administrator** (or the Associate Administrator for Pipeline Safety, or a
  delegate) — both § 192.3 and § 191.3 define it as "the Administrator,
  Pipeline and Hazardous Materials Safety Administration or his or her
  delegate". Never say EPA; never say "Regional Administrator".
- **"Operator" is the pipeline operator** — "a person who engages in the
  transportation of gas" (§ 191.3). Not an equipment operator, not a well-site
  operator, not a facility owner.
- **"This part" means 49 CFR Part 192** (or Part 191 for p191 rows) — never
  40 CFR anything. The rows carry it as a live link to the document root, so
  read it as a self-reference to the whole part.
- **The pipeline taxonomy is legally defined; do not paraphrase across it.**
  *Gathering* (Type A, Type B, Type C and Type R — §§ 192.8/192.9; Type R is
  reporting-only), *transmission line*, and *distribution* are distinct and
  carry different obligations. A requirement written for transmission does not
  apply to distribution, and vice versa.
- **Class locations 1, 2, 3 and 4** (§ 192.5) are population-density design
  classes — not hazard classes, not the area classifications from the EPA
  rules.
- **Expand these acronyms only as the text itself defines them, and only where
  the text uses them**: **MAOP** (maximum allowable operating pressure),
  **SMYS** (specified minimum yield strength), **HCA** (high consequence area,
  § 192.903), **MCA** (moderate consequence area, § 192.3 + Appendix G),
  **IM** (integrity management — Subpart O for transmission, Subpart P for
  distribution; **DIMP** is the distribution one), **OQ** (operator
  qualification, Subpart N), **ILI** (in-line inspection), **ECDA** (external
  corrosion direct assessment), **GWUT** (guided wave ultrasonic testing,
  Appendix F), **PIR** (potential impact radius), **UNGSF** (underground
  natural gas storage facility), **LNG**, **HDB/HDS/DF** (plastic-pipe design,
  § 192.121), **CIS**, **CP**, **SCADA**, **AOC**. Do not invent expansions,
  and do not expand an acronym in a row that does not use it.
- **Incorporated standards are named, never described.** API Spec 5L, API 1104,
  ASME B31.8, ASME B31.8S, NACE/AMPP SP0169 and SP0502, PPI TR-3/TR-4, the
  ASTM D/F series, the GPTC guide and the rest are incorporated by reference
  under § 192.7. A summary may say *which* standard applies; it must not
  summarise what that standard requires — we do not have that text. The
  pointer phrase "(incorporated by reference, *see* § 192.7)" should survive.
- **Reserved rows must say so.** All 17 `[Reserved]` rows should summarise as
  "[Reserved] — no requirements" and nothing more. Do not infer content from
  the neighbouring sections.
- **Definition rows are definitions.** The 93 `kind: "definition"` rows across
  both parts should read "defines X as …", not as obligations. Several terms
  are defined *differently* in different sections — "high consequence area"
  (§ 192.903, Subpart O) vs "moderate consequence area" (§ 192.3 + Appendix G)
  vs the Subpart P definitions (§ 192.1001) — so a definition summary must
  stay inside its own section.
- **Nothing about Colorado.** These are federal minimum standards with no
  Colorado, AQCC, CDPHE or ECMC content. A state may be certified to enforce
  them under 49 U.S.C. 60105; that is the only state-related thread in the
  text and it should not be generalised.
- **Equations and figures are not shown.** Nine rows in p192 and one in p191
  carry `<p class="figure-omitted">`. The existing "equation not shown"
  handling applies; a summary must not attempt to state the formula. This
  covers § 192.121(a)'s plastic-pipe design formula and the whole of
  Appendix E's guidance tables.
- **Tables are inline, not separate rows.** 31 rows in p192 and 1 in p191
  contain a full `<table>`; two of them (`192.112`, `192.620(d)`) are mostly
  table. Describe what the table is *for* rather than enumerating its cells.
- **Amendment dates inside the text are real requirements** ("Effective
  October 1, 2026, …", "For PE pipe produced on or after January 22, 2019,
  …"). They are kept verbatim and must survive into the summary. The
  *bracketed* `[Amdt. 192-27, 41 FR 34606, …]` citations were dropped and were
  never requirements.
