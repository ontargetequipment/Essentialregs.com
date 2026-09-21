# Reg 16 import diff report

- Parsed rows: **71**
- DB rows: **0**
- Ids in both: **0**
- Ids only in DB (parser gap or DB junk): **0**
- Ids only in parsed (parser found something DB doesn't have): **71**
- Text identical: **0**
- Text where DB is a suffix of parsed (truncation confirmed): **0**
- Text different (neither identical nor a clean truncation): **0**
  - of which text also found verbatim on a nearby sibling id (amendment-driven renumbering, not a parser bug): **0**
- parent_id mismatches among shared ids: **0**
- DB rows with page-furniture leaked into full_text: **0**
- Parsed rows whose full_text starts with a lowercase letter: **3**

## Ids only in DB

_none_

## Ids only in parsed

(71 total)

- `sec-16-I`
- `sec-16-I-A`
- `sec-16-I-B`
- `sec-16-I-B-1`
- `sec-16-I-B-2`
- `sec-16-I-B-3`
- `sec-16-I-B-4`
- `sec-16-I-B-5`
- `sec-16-I-B-6`
- `sec-16-I-B-7`
- `sec-16-I-B-8`
- `sec-16-I-C`
- `sec-16-I-C-1`
- `sec-16-I-C-1-a`
- `sec-16-I-C-1-b`
- `sec-16-I-D`
- `sec-16-I-D-1`
- `sec-16-I-D-1-a`
- `sec-16-I-D-1-b`
- `sec-16-I-D-1-c`
- `sec-16-I-D-2`
- `sec-16-I-D-2-a`
- `sec-16-I-D-2-b`
- `sec-16-I-D-2-c`
- `sec-16-I-D-2-d`
- `sec-16-I-D-3`
- `sec-16-I-D-4`
- `sec-16-I-E`
- `sec-16-I-E-1`
- `sec-16-I-E-1-a`
- `sec-16-I-E-1-b`
- `sec-16-I-E-1-c`
- `sec-16-I-E-2`
- `sec-16-I-E-2-a`
- `sec-16-I-E-2-b`
- `sec-16-I-E-2-c`
- `sec-16-I-E-3`
- `sec-16-I-F`
- `sec-16-I-G`
- `sec-16-II`
- `sec-16-II-A`
- `sec-16-II-A-1`
- `sec-16-II-B`
- `sec-16-II-B-1`
- `sec-16-II-B-2`
- `sec-16-II-B-3`
- `sec-16-II-B-4`
- `sec-16-II-C`
- `sec-16-II-C-1`
- `sec-16-II-C-2`
- `sec-16-II-C-3`
- `sec-16-II-C-4`
- `sec-16-II-C-5`
- `sec-16-II-C-6`
- `sec-16-II-D`
- `sec-16-II-D-1`
- `sec-16-II-D-1-a`
- `sec-16-II-D-1-b`
- `sec-16-II-D-1-c`
- `sec-16-II-D-1-d`
- `sec-16-II-D-1-e`
- `sec-16-II-D-1-f`
- `sec-16-II-D-2`
- `sec-16-II-D-3`
- `sec-16-II-D-4`
- `sec-16-II-E`
- `sec-16-II-E-1`
- `sec-16-III`
- `sec-16-III-A`
- `sec-16-III-B`
- `sec-16-top-REG-16`

## Duplicate ids in the parsed output (two markers, one id — merged)

Every id below was produced by more than one marker during parsing. This script keeps the first occurrence's citation/parent/title and appends the later occurrence's text as trailing paragraphs so no content is silently dropped. As of this run, the only expected entry is `sec-7-B-VI-D-3-a-(iii)` — the source PDF really does print that exact label twice in a row for two different paragraphs (see "Source-text corrections and anomalies" below). The two other duplicates seen in earlier runs (`sec-7-B-II-J-1-c`, `sec-7-B-III-C-5-b-(iv)-(A)-(2)`, both citation-shaped continuation-line false positives) and the label-typo collision (`sec-7-B-VII-A-20`) are fixed — see the same section and the marker audit below. Anything else appearing here is new and should be reviewed by hand.

_none_

## Source-text corrections and anomalies

Confirmed by reading the actual printed PDF (not a pdftotext artifact). Fixes are applied to the raw lines before marker scanning, matched by (old label + enough of the following words to be unique in the document) so they can't misfire.

### Label typos corrected

| line ~ | printed (wrong) | corrected to | hits | note |
|---|---|---|---|---|
| 68 | `I.B.7,` | `I.B.7.` | OK (1) | Printed "I.B.7," (comma for the trailing dot) between I.B.6. and I.B.8. |
| 78 | `I.C.I.` | `I.C.1.` | OK (1) | Printed "I.C.I." (capital I for the digit 1) — the only numbered item under I.C. |
| 85 | `I.C.I.b.` | `I.C.1.b.` | OK (1) | Printed "I.C.I.b." after "I.C.1.a." — capital I for the digit 1. |
| 111 | `I.D.2.C.` | `I.D.2.c.` | OK (1) | Printed "I.D.2.C." between I.D.2.b. and I.D.2.d. — capital C for the letter c. |
| 134 | `I.E.I.` | `I.E.1.` | OK (1) | Printed "I.E.I." (capital I for the digit 1) before I.E.1.a. and I.E.2. |
| 158 | `I.E.2.C.` | `I.E.2.c.` | OK (1) | Printed "I.E.2.C." after I.E.2.b. — capital C for the letter c. |
| 331 | `II.C.6` | `II.C.6.` | OK (1) | Printed "II.C.6" with no trailing dot after II.C.5. (II.C.2. itself cites "II.C.6"). |

## Marker column / continuation-line audit

Every Part A/B label candidate flagged by the continuation-line guard (its column deviates by more than 2 characters from the learned column for its depth, and/or its previous non-blank line lacks terminal punctuation), whether ultimately accepted as a real label or rejected as a continuation. See IMPORTER_SPEC.md and `_marker_column_signals` for the rule.

- Flagged candidates: **14** (column-deviating: **14**, prev-line-lacks-terminal-punctuation: **0**)
- Rejected as continuations: **0**
- Kept as real labels despite the flag: **14**

| line | citation | part | indent | learned col | col dev | lacks term. | page seam | accepted |
|---|---|---|---|---|---|---|---|---|
| 71 | `I.C.` |  | 0 | 4 | True | False | True | True |
| 73 | `I.C.1.` |  | 0 | 4 | True | False | False | True |
| 83 | `I.D.` |  | 0 | 4 | True | False | False | True |
| 85 | `I.D.1.` |  | 0 | 4 | True | False | False | True |
| 95 | `I.D.2.` |  | 0 | 4 | True | False | False | True |
| 112 | `I.D.3.` |  | 0 | 4 | True | False | False | True |
| 118 | `I.D.4.` |  | 0 | 4 | True | False | False | True |
| 124 | `I.E.` |  | 0 | 4 | True | False | False | True |
| 126 | `I.E.1.` |  | 0 | 4 | True | False | True | True |
| 143 | `I.E.2.` |  | 0 | 4 | True | False | False | True |
| 156 | `I.E.3.` |  | 0 | 4 | True | False | False | True |
| 172 | `II.` |  | 0 | 4 | True | False | False | True |
| 176 | `II.A.1.` |  | 0 | 4 | True | False | True | True |
| 310 | `III.` |  | 0 | 4 | True | False | False | True |

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

- `<span class="xref">` spans — parsed: **11**, DB: **0**
- `<a class="xref-external-reg">` anchors — parsed: **2**, DB: **0**

### Spans by target part

| target | parsed | DB |
|---|---|---|
| Section I. (no parts in this regulation) | 2 | 0 |
| Section II. (no parts in this regulation) | 5 | 0 |
| top (Regulation root) | 4 | 0 |

### Unresolved references, by bucket (top 15 each)

**Historical (former structure — this regulation was renumbered/reorganized; these no longer exist in the current Parts)** — 1 distinct, 1 mentions

| citation text | count |
|---|---|
| V.C.4 | 1 |

**Other regulation not in corpus** — 0 distinct, 0 mentions

_none_

**CFR part/subpart not in corpus** — 0 distinct, 0 mentions

_none_

**Unparseable / genuine parser gap** — 3 distinct, 3 mentions

| citation text | count |
|---|---|
| C.I.b. | 1 |
| I.D.2.C. | 1 |
| D.3. | 1 |

**Form N (ECMC) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

**C.R.S. statute citation (ECMC) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

**California Code of Regulations, Title 13 (Reg 20) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

### Remaining unwrapped "Section..." text

- Total: **10**
- Excluding ones whose roman numeral doesn't exist in any current roman-numbered part at all (historical, expected to stay unlinked): **7**

### 10 random linked paragraphs from the body (no parts in this regulation)

- `sec-16-II-D-2`: <p>Those entities with roadways in the foothills area shall provide two reports with the information listed in <span class="xref" data-target="sec-16-II-D-1">Section II.D.1.</span> One report shall contain the.information for roadways in the foothills area and the other for roadways within the remainder of their jurisdiction.</p>
- `sec-16-II-D-3`: <p>The City and County of Denver and CDOT shall provide two reports with the information listed in <span class="xref" data-target="sec-16-II-D-1">Section II.D.1.</span> One report shall contain the information for roadways in the areas described in <span class="xref" data-target="sec-16-II-C-4">Sections II.C.4</span> and <span class="xref" data-target="sec-16-II-C-5">II.C.5</span>, and the other f
- `sec-16-II-D-4`: <p>Beginning June 30,2002, the City and County of Denver and the CDOT shall provide an additional report of information listed in <span class="xref" data-target="sec-16-II-D-1">Section II.D.1.</span> for the area bounded by, andincluding, Federal Boulevard, Downing Street, 38th Avenue, and Louisiana Avenue as described II.C.6.</p>
- `sec-16-I-E-1-a`: <p>Suppliers shall submit to the Division a monthly report that contains a summary of the results of all percent fines tests performed by the supplier and independent laboratories as required by the provisions of <span class="xref" data-target="sec-16-I-D-2-a">Section I.D.2.a.</span> and b. For material conforming to <span class="xref" data-target="sec-16-I-C-1-b">Section I.C.1.b.</span>, supplier

### 5 random linked paragraphs from the statement-of-basis section (III.)

- `sec-16-III-A`: <p>May 20, 1999</p><p>This Statement of Basis, Specific Authority, and Purpose complies with the requirements of the Administrative Procedures Act, section 24-4-103 C.R.S. and the Colorado Air Pollution Prevention and Control Act, section 25-7-110.5, C.R.S.</p><p>Basis</p><p>The "Colorado State Implementation Plan (SIP) for Particulate Matter (PM-10); Denver Metropolitan Nonattainment Area Element
- `sec-16-III-B`: <p>Denver metropolitan area, redesignation to attainment for PM10</p><p>Adopted: April 19, 2001</p><p>The amendments to the <span class="xref" data-target="sec-16-top-REG-16">Regulation No. 16</span> are a component of the maintenance plan and redesignation request also adopted by the Commission on April 19, 2001 to redesignate the area as attainment for particulate matter less than ten microns in

### DB xref target vs parsed xref target, same provision & citation text

(0 such (provision, citation text) pairs found)

_none found_

_(the hand-reviewed DB-vs-parsed xref-target writeup below is Reg 7-specific and only applies when diffing Reg 7 against a pre-existing DB export)_

## Lowercase-start rows in parsed output (first 30)

- `sec-16-I-C-1-b`: 'less than 4% fines, less than 33% durability index, and a high degree of angular'
- `sec-16-II-D-1-a`: 'the total number of miles driven by maintenance trucks during snow and ice remov'
- `sec-16-II-D-1-b`: 'the total amount of sanding material (both new and recycled), salt, and other de'

## 15 random side-by-side samples
