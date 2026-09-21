# Reg aqs import diff report

- Parsed rows: **80**
- DB rows: **0**
- Ids in both: **0**
- Ids only in DB (parser gap or DB junk): **0**
- Ids only in parsed (parser found something DB doesn't have): **80**
- Text identical: **0**
- Text where DB is a suffix of parsed (truncation confirmed): **0**
- Text different (neither identical nor a clean truncation): **0**
  - of which text also found verbatim on a nearby sibling id (amendment-driven renumbering, not a parser bug): **0**
- parent_id mismatches among shared ids: **0**
- DB rows with page-furniture leaked into full_text: **0**
- Parsed rows whose full_text starts with a lowercase letter: **1**

## Ids only in DB

_none_

## Ids only in parsed

(80 total)

- `sec-aqs-I`
- `sec-aqs-I-A`
- `sec-aqs-I-B`
- `sec-aqs-I-B-1`
- `sec-aqs-II`
- `sec-aqs-III`
- `sec-aqs-III-A`
- `sec-aqs-III-F`
- `sec-aqs-III-G`
- `sec-aqs-III-H`
- `sec-aqs-III-I`
- `sec-aqs-III-J`
- `sec-aqs-III-K`
- `sec-aqs-III-L`
- `sec-aqs-III-M`
- `sec-aqs-III-N`
- `sec-aqs-IV`
- `sec-aqs-V`
- `sec-aqs-V-A`
- `sec-aqs-V-A-1`
- `sec-aqs-V-A-2`
- `sec-aqs-V-A-3`
- `sec-aqs-V-A-4`
- `sec-aqs-V-A-4-a`
- `sec-aqs-V-A-4-b`
- `sec-aqs-V-A-4-c`
- `sec-aqs-V-A-4-d`
- `sec-aqs-V-A-4-e`
- `sec-aqs-V-A-4-f`
- `sec-aqs-V-A-4-g`
- `sec-aqs-V-A-4-h`
- `sec-aqs-V-A-4-i`
- `sec-aqs-V-A-4-j`
- `sec-aqs-V-B`
- `sec-aqs-V-C`
- `sec-aqs-V-C-1`
- `sec-aqs-V-C-2`
- `sec-aqs-V-D`
- `sec-aqs-VI`
- `sec-aqs-VII`
- `sec-aqs-VII-A`
- `sec-aqs-VII-B`
- `sec-aqs-VII-C`
- `sec-aqs-VIII`
- `sec-aqs-VIII-A`
- `sec-aqs-VIII-AA`
- `sec-aqs-VIII-B`
- `sec-aqs-VIII-BB`
- `sec-aqs-VIII-C`
- `sec-aqs-VIII-CC`
- `sec-aqs-VIII-D`
- `sec-aqs-VIII-DD`
- `sec-aqs-VIII-E`
- `sec-aqs-VIII-EE`
- `sec-aqs-VIII-F`
- `sec-aqs-VIII-FF`
- `sec-aqs-VIII-G`
- `sec-aqs-VIII-GG`
- `sec-aqs-VIII-H`
- `sec-aqs-VIII-HH`
- `sec-aqs-VIII-I`
- `sec-aqs-VIII-II`
- `sec-aqs-VIII-J`
- `sec-aqs-VIII-K`
- `sec-aqs-VIII-L`
- `sec-aqs-VIII-M`
- `sec-aqs-VIII-N`
- `sec-aqs-VIII-O`
- `sec-aqs-VIII-P`
- `sec-aqs-VIII-Q`
- `sec-aqs-VIII-R`
- `sec-aqs-VIII-S`
- `sec-aqs-VIII-T`
- `sec-aqs-VIII-U`
- `sec-aqs-VIII-V`
- `sec-aqs-VIII-W`
- `sec-aqs-VIII-X`
- `sec-aqs-VIII-Y`
- `sec-aqs-VIII-Z`
- `sec-aqs-top-REG-aqs`

## Duplicate ids in the parsed output (two markers, one id — merged)

Every id below was produced by more than one marker during parsing. This script keeps the first occurrence's citation/parent/title and appends the later occurrence's text as trailing paragraphs so no content is silently dropped. As of this run, the only expected entry is `sec-7-B-VI-D-3-a-(iii)` — the source PDF really does print that exact label twice in a row for two different paragraphs (see "Source-text corrections and anomalies" below). The two other duplicates seen in earlier runs (`sec-7-B-II-J-1-c`, `sec-7-B-III-C-5-b-(iv)-(A)-(2)`, both citation-shaped continuation-line false positives) and the label-typo collision (`sec-7-B-VII-A-20`) are fixed — see the same section and the marker audit below. Anything else appearing here is new and should be reviewed by hand.

_none_

## Source-text corrections and anomalies

Confirmed by reading the actual printed PDF (not a pdftotext artifact). Fixes are applied to the raw lines before marker scanning, matched by (old label + enough of the following words to be unique in the document) so they can't misfire.

### Label typos corrected

| line ~ | printed (wrong) | corrected to | hits | note |
|---|---|---|---|---|
| 2288 | `VIII.Q` | `VIII.Q.` | OK (1) | Printed "VIII.Q" with no trailing period (entries Q-Y all lack it). |
| 2319 | `VIII.R` | `VIII.R.` | OK (1) | Printed "VIII.R" with no trailing period. |
| 2355 | `VIII.S` | `VIII.S.` | OK (1) | Printed "VIII.S" with no trailing period. |
| 2389 | `VIII.T` | `VIII.T.` | OK (1) | Printed "VIII.T" with no trailing period (same topic line as VIII.S — both fixes match their own line only, since each old_label is distinct). |
| 2402 | `VIII.U` | `VIII.U.` | OK (1) | Printed "VIII.U" with no trailing period. |
| 2438 | `VIII.V` | `VIII.V.` | OK (1) | Printed "VIII.V" with no trailing period. |
| 2473 | `VIII.W` | `VIII.W.` | OK (1) | Printed "VIII.W" with no trailing period. |
| 2497 | `VIII.X` | `VIII.X.` | OK (1) | Printed "VIII.X" with no trailing period. |
| 2532 | `VIII.Y` | `VIII.Y.` | OK (1) | Printed "VIII.Y" with no trailing period. |
| 46 | `Sulfur Dioxide (SO2)1` | `Sulfur Dioxide (SO2) [1]` | OK (1) | I.B.1.: superscript footnote 1 on "(SO2)". |
| 72 | `Sulfur Dioxide: Revised: 3/10/83` | `[1] Sulfur Dioxide: Revised: 3/10/83` | OK (1) | I.B.1.: footnote 1 (the standard's revision history) — its own digit is on the next line. |
| 73 | `1` | `(line removed)` | OK (1) | I.B.1.: the orphaned superscript "1" line (restored as "[1]" above). |
| 273 | `of.076/km 1, equivalent` | `of .076/km [1], equivalent` | OK (1) | IV: "of.076/km 1," is the printed ".076/km" with superscript footnote 1 (pdftotext also dropped the space after "of"). |
| 273 | `visual range of 32 miles2` | `visual range of 32 miles [2]` | OK (1) | IV: superscript footnote 2 on "miles". |
| 276 | `in violation of the standard.3` | `in violation of the standard. [3]` | OK (1) | IV: superscript footnote 3 after "standard." |
| 278 | `applicable in the AIR program area.4` | `applicable in the AIR program area. [4]` | OK (1) | IV: superscript footnote 4 after "area." |
| 281 | `is less than 70 percent.5` | `is less than 70 percent. [5]` | OK (1) | IV: superscript footnote 5 after "percent." |
| 282 | `1` | `(line removed)` | OK (1) | IV: the orphaned superscript "1" line printed before footnote 1's text. |
| 283 | `Extinction is a measure of the ability` | `[1] Extinction is a measure of the ability` | OK (1) | IV: footnote 1's text. |
| 287 | `Extinction (Bext) can be converted` | `[2] Extinction (Bext) can be converted` | OK (1) | IV: footnote 2's text (its digit is printed on the line after). |
| 288 | `2` | `(line removed)` | OK (1) | IV: the orphaned superscript "2" line. |
| 296 | `scattering coefficient of.01/km` | `scattering coefficient of .01/km` | OK (1) | IV: footnote 2 — pdftotext dropped the space in "of .01/km". |
| 297 | `3` | `(line removed)` | OK (1) | IV: the orphaned superscript "3" line printed before footnote 3's text. |
| 298 | `There are five possible contiguous` | `[3] There are five possible contiguous` | OK (1) | IV: footnote 3's text. |
| 302 | `The AIR program area is defined in C.R.S.` | `[4] The AIR program area is defined in C.R.S.` | OK (1) | IV: footnote 4's text (its digit is printed on the line after). |
| 303 | `4` | `(line removed)` | OK (1) | IV: the orphaned superscript "4" line. |
| 307 | `Any hour with a relative humidity of 70 percent` | `[5] Any hour with a relative humidity of 70 percent` | OK (1) | IV: footnote 5's text (its digit is printed on the line after). |
| 308 | `5` | `(line removed)` | OK (1) | IV: the orphaned superscript "5" line. |
| 3401 | `______________________________________________________________________` | `(line removed)` | OK (1) | VIII.II.: the Editor's Notes rule line, otherwise joined onto the entry's last sentence. |

## Marker column / continuation-line audit

Every Part A/B label candidate flagged by the continuation-line guard (its column deviates by more than 2 characters from the learned column for its depth, and/or its previous non-blank line lacks terminal punctuation), whether ultimately accepted as a real label or rejected as a continuation. See IMPORTER_SPEC.md and `_marker_column_signals` for the rule.

- Flagged candidates: **22** (column-deviating: **22**, prev-line-lacks-terminal-punctuation: **6**)
- Rejected as continuations: **6**
- Kept as real labels despite the flag: **16**

| line | citation | part | indent | learned col | col dev | lacks term. | page seam | accepted |
|---|---|---|---|---|---|---|---|---|
| 67 | `II.` |  | 0 | 4 | True | False | False | True |
| 68 | `III.` |  | 0 | 4 | True | False | False | True |
| 70 | `III.A.` |  | 0 | 4 | True | False | False | True |
| 147 | `III.F.` |  | 0 | 4 | True | False | False | True |
| 148 | `III.G.` |  | 0 | 4 | True | False | True | True |
| 205 | `V.` |  | 7 | 0 | True | False | True | True |
| 207 | `V.A.` |  | 7 | 0 | True | False | False | True |
| 208 | `V.A.1.` |  | 7 | 11 | True | False | False | True |
| 382 | `V.A.2.` |  | 2 | 11 | True | False | False | True |
| 388 | `V.A.3.` |  | 2 | 11 | True | False | False | True |
| 406 | `V.A.1.` |  | 15 | 2 | True | True | False | False |
| 415 | `V.A.1.` |  | 15 | 2 | True | True | False | False |
| 421 | `V.A.4.g.` |  | 4 | 8 | True | False | True | True |
| 424 | `V.A.1.` |  | 11 | 2 | True | True | False | False |
| 431 | `V.A.4.h.` |  | 4 | 8 | True | False | False | True |
| 434 | `V.A.1.` |  | 11 | 2 | True | True | False | False |
| 440 | `V.A.4.i.` |  | 4 | 8 | True | False | False | True |
| 442 | `V.A.1.` |  | 11 | 2 | True | True | False | False |
| 449 | `V.A.4.j.` |  | 4 | 8 | True | False | False | True |
| 460 | `V.C.1.` |  | 9 | 2 | True | False | False | True |
| 467 | `V.C.2.` |  | 9 | 2 | True | False | False | True |
| 493 | `C.` |  | 32 | 0 | True | True | False | False |

## parent_id mismatches

_none_

## DB rows with page-furniture leaks (first 30)

_none_

## Truncation-confirmed rows (DB text is a suffix of parsed text) — first 30


## Different (not identical, not a clean truncation) — first 40


## Likely amendment-driven renumbering (DB text found on a nearby sibling id)

The current source PDF has clearly been amended since the DB was last populated (dates change, e.g. Reg 7 II.A.2's EPA Method 21 citation goes from `(August 3, 2017)` in the source PDF to no date at all in some DB rows; definitions get inserted alphabetically, shifting every subsequent sequentially-numbered definition — e.g. DB's `sec-7-B-I-B-24` is `"New"` but the current PDF's `I.B.24` is `"Natural gas transmission and storage segment"`, a term inserted earlier in the list, pushing `"New"` down to `I.B.25`). The rows below are where the DB's stored text for id X is not what's at X in the new parse, but IS found (word salad aside) on a nearby sibling id — i.e. content that moved, not content that's wrong.

_none detected_

## Cross-reference linking

- `<span class="xref">` spans — parsed: **56**, DB: **0**
- `<a class="xref-external-reg">` anchors — parsed: **21**, DB: **0**

### Spans by target part

| target | parsed | DB |
|---|---|---|
| Section I. (no parts in this regulation) | 3 | 0 |
| Section II. (no parts in this regulation) | 4 | 0 |
| Section III. (no parts in this regulation) | 2 | 0 |
| Section V. (no parts in this regulation) | 20 | 0 |
| Section VIII. (no parts in this regulation) | 2 | 0 |
| top (Regulation root) | 25 | 0 |

### Unresolved references, by bucket (top 15 each)

**Historical (former structure — this regulation was renumbered/reorganized; these no longer exist in the current Parts)** — 2 distinct, 2 mentions

| citation text | count |
|---|---|
| Part B | 1 |
| IV.D.2.(d)(i) | 1 |

**Other regulation not in corpus** — 3 distinct, 8 mentions

| citation text | count |
|---|---|
| Regulation Number 10, Part B | 5 |
| Regulation Number 13 | 2 |
| Regulation 13 | 1 |

**CFR part/subpart not in corpus** — 2 distinct, 9 mentions

| citation text | count |
|---|---|
| 40 CFR Part 93 | 8 |
| 40 CFR Part 58 | 1 |

**Unparseable / genuine parser gap** — 2 distinct, 2 mentions

| citation text | count |
|---|---|
| V.a.1. | 1 |
| III.E. | 1 |

**Form N (ECMC) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

**C.R.S. statute citation (ECMC) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

**California Code of Regulations, Title 13 (Reg 20) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

### Remaining unwrapped "Section..." text

- Total: **9**
- Excluding ones whose roman numeral doesn't exist in any current roman-numbered part at all (historical, expected to stay unlinked): **6**

### 10 random linked paragraphs from the body (no parts in this regulation)

- `sec-aqs-VIII-HH`: <p>Repeal of Carbon Monoxide Attainment/Maintenance Area Descriptions and Emission Budgets</p><p>Adopted: August 15, 2024</p><p>This Statement of Basis, Specific Statutory Authority and Purpose complies with the requirements of the State Administrative Procedure Act § 24-4-101, C.R.S. et seq., the Colorado Air Pollution Prevention and Control Act § 25-7-101, C.R.S. et seq. (the Act), and the Air Q
- `sec-aqs-VIII-C`: <p>Redesignation of the Greeley Carbon Monoxide Nonattainment Area to Attainment/Maintenance Adopted September 19,1996</p><p>This Statement of Basis, Specific Statutory Authority and Purpose complies with the requirements of the Administrative Procedures Act, § 24-4-103, C.R.S., and the Colorado Air Pollution Prevention and Control Act, § 25-7-110.5, C.R.S.</p><p>Basis</p><p>Greeley carbon monoxid
- `sec-aqs-VIII-GG`: <p>Revision to Emission Budgets for Nonattainment Areas in the State of Colorado</p><p>Adopted: December 15, 2023</p><p>This Statement of Basis, Specific Statutory Authority and Purpose complies with the requirements of the State Administrative Procedure Act § 24-4-101, C.R.S. et seq., the Colorado Air Pollution Prevention and Control Act § 25-7-101, C.R.S. et seq. (the Act), and the Air Quality C
- `sec-aqs-VIII-O`: <p>Fort Collins</p><p>Adopted: July 18, 2002 The amendments to the “Ambient Air Quality Standards for the State of Colorado” Regulation adopted by the Commission change the air quality classification of the Fort Collins area to attainment/maintenance for carbon monoxide and establish a mobile source emissions budget for the area. The Commission adopted simultaneous revisions to <a class="xref-exte
- `sec-aqs-VIII-DD`: <p>Revision to Emission Budgets for Nonattainment Areas in the State of Colorado</p><p>Adopted: November 17, 2016</p><p>This Statement of Basis, Specific Statutory Authority and Purpose complies with the requirements of the Colorado Administrative Procedure Act § 24-4-103, C.R.S. and the Colorado Air Pollution Prevention and Control Act §§ 25-7-110 and 25-7-110.5, C.R.S. (“the Act”).</p><p>Basis</
- `sec-aqs-V-A-4-e`: <p>Aspen PM10</p><p>The 16,244 pounds-per-day PM10 emission budget established in <span class="xref" data-target="sec-aqs-V-A-1">Section V.A.1.</span> shall take effect as a matter of state law when such budget takes effect as a matter of federal law pursuant to 40 CFR Section 93.118. Until such time as the 16,244 pounds-per-day budget takes effect pursuant to this section and 40 CFR Section 93.11
- `sec-aqs-VIII-N`: <p>Lamar and Steamboat Springs, Redesignation to Attainment for PM10</p><p>Adopted: November 15, 2001 The amendments to the “Ambient Air Quality Standards for the State of Colorado” Regulation adopted by the Commission change the air quality classifications of the Steamboat Springs and Lamar areas to attainment/maintenance for particulate matter, and revise the mobile source emissions budgets for 
- `sec-aqs-VIII-E`: <p>Redesignating Cañon City/Fremont County PM10 Nonattainment Area to Attainment and Establishing a New Emissions Budget for the area for 1997 through 2015.</p><p>Adopted October 17, 1996</p><p>This statement of Basis, Specific Statutory Authority and Purpose complies with the requirements of the Administrative Procedures Act, C.R.S. 1973, Section 24-4-103(4) for adopted or modified regulations. B
- `sec-aqs-V-A-4-h`: <p>Lamar PM10</p><p>The 764 pounds-per-day PM10 emission budget established in <span class="xref" data-target="sec-aqs-V-A-1">Section V.A.1.</span> shall take effect as a matter of state law when such budget takes effect as a matter of federal law pursuant to 40 CFR Section 93.118. Until such time as the 764 pounds-per-day budget takes effect pursuant to this section and 40 CFR Section 93.118, the
- `sec-aqs-VIII-M`: <p>Denver Metropolitan Area, Redesignation to Attainment for PM10</p><p>Adopted: April 19, 2001 The amendments to the “Ambient Air Quality Standards for the State of Colorado” Regulation adopted by the Commission change the air quality classification of the Denver metropolitan area for particulate matter. The purpose of this rule change is to implement the direction in § 25-7-107 (2.5), C.R.S. (19

### 5 random linked paragraphs from the statement-of-basis section (None.)


### DB xref target vs parsed xref target, same provision & citation text

(0 such (provision, citation text) pairs found)

_none found_

_(the hand-reviewed DB-vs-parsed xref-target writeup below is Reg 7-specific and only applies when diffing Reg 7 against a pre-existing DB export)_

## Lowercase-start rows in parsed output (first 30)

- `sec-aqs-III-A`: 'through III.E. RepealedClassification of Nonattainment and Attainment/Maintenanc'

## 15 random side-by-side samples
