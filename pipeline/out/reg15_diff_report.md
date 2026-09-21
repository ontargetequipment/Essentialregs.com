# Reg 15 import diff report

- Parsed rows: **36**
- DB rows: **0**
- Ids in both: **0**
- Ids only in DB (parser gap or DB junk): **0**
- Ids only in parsed (parser found something DB doesn't have): **36**
- Text identical: **0**
- Text where DB is a suffix of parsed (truncation confirmed): **0**
- Text different (neither identical nor a clean truncation): **0**
  - of which text also found verbatim on a nearby sibling id (amendment-driven renumbering, not a parser bug): **0**
- parent_id mismatches among shared ids: **0**
- DB rows with page-furniture leaked into full_text: **0**
- Parsed rows whose full_text starts with a lowercase letter: **0**

## Ids only in DB

_none_

## Ids only in parsed

(36 total)

- `sec-15-I`
- `sec-15-I-A`
- `sec-15-I-B`
- `sec-15-I-C`
- `sec-15-I-D`
- `sec-15-I-E`
- `sec-15-I-F`
- `sec-15-I-G`
- `sec-15-II`
- `sec-15-II-A`
- `sec-15-II-B`
- `sec-15-II-C`
- `sec-15-II-D`
- `sec-15-III`
- `sec-15-III-A`
- `sec-15-III-B`
- `sec-15-III-C`
- `sec-15-IV`
- `sec-15-IV-A`
- `sec-15-IV-A-1`
- `sec-15-IV-A-2`
- `sec-15-IV-A-3`
- `sec-15-IV-B`
- `sec-15-IV-C`
- `sec-15-V`
- `sec-15-V-A`
- `sec-15-V-A-1`
- `sec-15-V-A-2`
- `sec-15-V-A-3`
- `sec-15-V-B`
- `sec-15-VI`
- `sec-15-VI-A`
- `sec-15-VI-B`
- `sec-15-VI-C`
- `sec-15-VI-D`
- `sec-15-top-REG-15`

## Duplicate ids in the parsed output (two markers, one id — merged)

Every id below was produced by more than one marker during parsing. This script keeps the first occurrence's citation/parent/title and appends the later occurrence's text as trailing paragraphs so no content is silently dropped. As of this run, the only expected entry is `sec-7-B-VI-D-3-a-(iii)` — the source PDF really does print that exact label twice in a row for two different paragraphs (see "Source-text corrections and anomalies" below). The two other duplicates seen in earlier runs (`sec-7-B-II-J-1-c`, `sec-7-B-III-C-5-b-(iv)-(A)-(2)`, both citation-shaped continuation-line false positives) and the label-typo collision (`sec-7-B-VII-A-20`) are fixed — see the same section and the marker audit below. Anything else appearing here is new and should be reviewed by hand.

_none_

## Source-text corrections and anomalies

Confirmed by reading the actual printed PDF (not a pdftotext artifact). Fixes are applied to the raw lines before marker scanning, matched by (old label + enough of the following words to be unique in the document) so they can't misfire.

### Label typos corrected

| line ~ | printed (wrong) | corrected to | hits | note |
|---|---|---|---|---|
| 113 | `IV. Notification and Reporting Requirements for Air Conditioning and Refrigeration Service` | `IV. Notification and Reporting Requirements for Air Conditioning and Refrigeration Service Facilities` | OK (1) | Section IV: join the wrapped second line of the printed heading onto the heading line, so the section row is titled instead of carrying its title as body text. The orphaned "Facilities" line is blanked by the fix below. |
| 114 | `        Facilities` | `(line removed)` | OK (1) | Section IV: blank the orphaned second line of the wrapped heading (its text is already restored on the heading line by the fix above). Matched with its leading whitespace — the only other "Facilities" line in REG_15.txt (line 170, "Facilities. In order to effectively collect such a fee...") is flush left. |

## Marker column / continuation-line audit

Every Part A/B label candidate flagged by the continuation-line guard (its column deviates by more than 2 characters from the learned column for its depth, and/or its previous non-blank line lacks terminal punctuation), whether ultimately accepted as a real label or rejected as a continuation. See IMPORTER_SPEC.md and `_marker_column_signals` for the rule.

- Flagged candidates: **13** (column-deviating: **13**, prev-line-lacks-terminal-punctuation: **0**)
- Rejected as continuations: **0**
- Kept as real labels despite the flag: **13**

| line | citation | part | indent | learned col | col dev | lacks term. | page seam | accepted |
|---|---|---|---|---|---|---|---|---|
| 70 | `II.C.` |  | 0 | 4 | True | False | True | True |
| 73 | `II.D.` |  | 0 | 4 | True | False | False | True |
| 82 | `III.` |  | 0 | 4 | True | False | False | True |
| 84 | `III.A.` |  | 0 | 4 | True | False | False | True |
| 90 | `III.B.` |  | 0 | 4 | True | False | False | True |
| 106 | `III.C.` |  | 0 | 4 | True | False | False | True |
| 109 | `IV.` |  | 0 | 4 | True | False | False | True |
| 112 | `IV.A.` |  | 0 | 4 | True | False | False | True |
| 127 | `IV.B.` |  | 0 | 4 | True | False | False | True |
| 130 | `IV.C.` |  | 0 | 4 | True | False | False | True |
| 135 | `V.` |  | 0 | 4 | True | False | False | True |
| 137 | `V.A.` |  | 0 | 4 | True | False | False | True |
| 152 | `V.B.` |  | 0 | 4 | True | False | False | True |

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

- `<span class="xref">` spans — parsed: **38**, DB: **0**
- `<a class="xref-external-reg">` anchors — parsed: **0**, DB: **0**

### Spans by target part

| target | parsed | DB |
|---|---|---|
| Section III. (no parts in this regulation) | 4 | 0 |
| Section IV. (no parts in this regulation) | 2 | 0 |
| Section V. (no parts in this regulation) | 4 | 0 |
| top (Regulation root) | 28 | 0 |

### Unresolved references, by bucket (top 15 each)

**Historical (former structure — this regulation was renumbered/reorganized; these no longer exist in the current Parts)** — 1 distinct, 1 mentions

| citation text | count |
|---|---|
| Part C | 1 |

**Other regulation not in corpus** — 0 distinct, 0 mentions

_none_

**CFR part/subpart not in corpus** — 0 distinct, 0 mentions

_none_

**Unparseable / genuine parser gap** — 0 distinct, 0 mentions

_none_

**Form N (ECMC) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

**C.R.S. statute citation (ECMC) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

**California Code of Regulations, Title 13 (Reg 20) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

### Remaining unwrapped "Section..." text

- Total: **1**
- Excluding ones whose roman numeral doesn't exist in any current roman-numbered part at all (historical, expected to stay unlinked): **1**

### 10 random linked paragraphs from the body (no parts in this regulation)

- `sec-15-V-A-1`: <p>Owners or operators of motor vehicle air conditioning service facilities shall maintain records of motor vehicle air conditioning service and/or invoices and leak checks for a minimum of one (1) year and be available for inspection, including those records required in this <span class="xref" data-target="sec-15-V">Section V.</span> of this <span class="xref" data-target="sec-15-top-REG-15">Regu
- `sec-15-II-D`: <p>All material referenced in this <span class="xref" data-target="sec-15-top-REG-15">Regulation No. 15</span> is hereby incorporated by reference by the Air Quality Control Commission and made a part of the Colorado Air Quality Control Commission Regulations. Materials incorporated by reference are those in existence as of the date of this regulation and do not include later amendments. The mater
- `sec-15-IV-B`: <p>Air conditioning and refrigeration service facilities which meet the requirements of this <span class="xref" data-target="sec-15-top-REG-15">Regulation No. 15</span> shall renew the notification and fee annually with the Division within sixty (60) days of April 1.</p>
- `sec-15-IV-C`: <p>This section shall not be construed to require any individual technician to pay a fee or to notify the Division if such individual is employed by an air conditioning and refrigeration service facility that has complied with the requirements of this section and that has accounted for such individual in the fee submitted pursuant to <span class="xref" data-target="sec-15-V-A-1">Sections V.A.1.</s
- `sec-15-I-G`: <p>"Stationary Appliance" shall mean any refrigeration and air conditioning equipment that contains and uses an ozone depleting compound refrigerant, which is not portable by nature or design or considered an integral part of a building or structure, has compressor(s) motors rated by the original equipment manufacturer at one hundred (100) horsepower or greater, and is not a refrigerated food appl

### 5 random linked paragraphs from the statement-of-basis section (VI.)

- `sec-15-VI-B`: <p>May 21, 1998</p><p>Background</p><p>This Statement of Basis, Specific Statutory Authority and Purpose complies with the requirements of the Administrative Procedures Act, C.R.S. (1988), Sections 24-4-103(4) and (12.5) for adopted or modified regulations, and federal regulations which are incorporated by reference.</p><p>Basis</p><p><span class="xref" data-target="sec-15-top-REG-15">Regulation N
- `sec-15-VI-C`: <p>December 20 &amp; 21, 2007</p><p>Revisions to <span class="xref" data-target="sec-15-top-REG-15">Regulation Number 15</span>, <span class="xref" data-target="sec-15-III-A">Sections III.A.</span> &amp; B. and IV.A.1. &amp; 2. and IV.B.</p><p>This Statement of Basis, Specific Statutory Authority and Purpose complies with the requirements of the Colorado Administrative Procedure Act Sections 24-4-
- `sec-15-VI-D`: <p>September 18, 2008</p><p>Revisions to <span class="xref" data-target="sec-15-top-REG-15">Regulation Number 15</span>, <span class="xref" data-target="sec-15-III-A">Sections III.A.</span> &amp; B.</p><p>This Statement of Basis, Specific Statutory Authority and Purpose complies with the requirements of the Colorado Administrative Procedure Act Sections 24-4-103(4), C.R.S. for new and revised regu
- `sec-15-VI-A`: <p>November 20, 1997</p><p>The purpose of the changes to § XII of Part C of <span class="xref" data-target="sec-15-top-REG-15">Regulation No. 15</span> is to replace the fee and registration requirements applicable to technicians with a fee to be paid by Air Conditioning and Refrigeration Service Facilities. In order to effectively collect such a fee, the revised rule also requires such facilities

### DB xref target vs parsed xref target, same provision & citation text

(0 such (provision, citation text) pairs found)

_none found_

_(the hand-reviewed DB-vs-parsed xref-target writeup below is Reg 7-specific and only applies when diffing Reg 7 against a pre-existing DB export)_

## Lowercase-start rows in parsed output (first 30)


## 15 random side-by-side samples
