# Reg gp01 import diff report

- Parsed rows: **103**
- DB rows: **0**
- Ids in both: **0**
- Ids only in DB (parser gap or DB junk): **0**
- Ids only in parsed (parser found something DB doesn't have): **103**
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

(103 total)

- `sec-gp01-I`
- `sec-gp01-I-A`
- `sec-gp01-I-A-1`
- `sec-gp01-I-A-2`
- `sec-gp01-I-A-3`
- `sec-gp01-I-B`
- `sec-gp01-I-C`
- `sec-gp01-I-D`
- `sec-gp01-I-E`
- `sec-gp01-I-F`
- `sec-gp01-I-F-1`
- `sec-gp01-I-F-2`
- `sec-gp01-I-F-3`
- `sec-gp01-II`
- `sec-gp01-II-A`
- `sec-gp01-II-A-1`
- `sec-gp01-II-A-2`
- `sec-gp01-II-A-2-a`
- `sec-gp01-II-A-2-b`
- `sec-gp01-II-A-3`
- `sec-gp01-II-B`
- `sec-gp01-II-B-1`
- `sec-gp01-II-B-1-a`
- `sec-gp01-II-B-1-b`
- `sec-gp01-II-B-1-c`
- `sec-gp01-II-B-2`
- `sec-gp01-II-B-3`
- `sec-gp01-II-C`
- `sec-gp01-II-C-1`
- `sec-gp01-II-C-2`
- `sec-gp01-II-C-3`
- `sec-gp01-II-C-4`
- `sec-gp01-II-C-5`
- `sec-gp01-II-D`
- `sec-gp01-II-D-1`
- `sec-gp01-III`
- `sec-gp01-III-A`
- `sec-gp01-III-B`
- `sec-gp01-III-C`
- `sec-gp01-IV`
- `sec-gp01-IV-A`
- `sec-gp01-IV-B`
- `sec-gp01-IV-C`
- `sec-gp01-IV-C-1`
- `sec-gp01-IV-C-2`
- `sec-gp01-IV-C-3`
- `sec-gp01-IX`
- `sec-gp01-IX-A`
- `sec-gp01-IX-B`
- `sec-gp01-V`
- `sec-gp01-V-A`
- `sec-gp01-V-B`
- `sec-gp01-V-B-1`
- `sec-gp01-V-B-2`
- `sec-gp01-V-B-3`
- `sec-gp01-V-B-4`
- `sec-gp01-V-B-5`
- `sec-gp01-V-B-6`
- `sec-gp01-V-B-7`
- `sec-gp01-VI`
- `sec-gp01-VI-A`
- `sec-gp01-VI-B`
- `sec-gp01-VI-C`
- `sec-gp01-VI-D`
- `sec-gp01-VII`
- `sec-gp01-VII-A`
- `sec-gp01-VII-A-1`
- `sec-gp01-VII-A-2`
- `sec-gp01-VII-A-3`
- `sec-gp01-VII-B`
- `sec-gp01-VIII`
- `sec-gp01-VIII-A`
- `sec-gp01-VIII-B`
- `sec-gp01-VIII-C`
- `sec-gp01-VIII-C-1`
- `sec-gp01-VIII-C-1-a`
- `sec-gp01-VIII-C-1-a-(i)`
- `sec-gp01-VIII-C-1-a-(ii)`
- `sec-gp01-VIII-C-1-a-(iii)`
- `sec-gp01-VIII-C-1-b`
- `sec-gp01-VIII-C-2`
- `sec-gp01-VIII-C-3`
- `sec-gp01-VIII-C-4`
- `sec-gp01-VIII-C-5`
- `sec-gp01-VIII-C-6`
- `sec-gp01-VIII-C-7`
- `sec-gp01-VIII-C-8`
- `sec-gp01-VIII-C-9`
- `sec-gp01-VIII-D`
- `sec-gp01-VIII-D-1`
- `sec-gp01-VIII-D-2`
- `sec-gp01-VIII-D-3`
- `sec-gp01-VIII-E`
- `sec-gp01-VIII-E-1`
- `sec-gp01-VIII-E-2`
- `sec-gp01-VIII-E-3`
- `sec-gp01-VIII-E-4`
- `sec-gp01-VIII-E-5`
- `sec-gp01-VIII-F`
- `sec-gp01-VIII-F-1`
- `sec-gp01-VIII-F-2`
- `sec-gp01-VIII-F-3`
- `sec-gp01-top-REG-gp01`

## Duplicate ids in the parsed output (two markers, one id — merged)

Every id below was produced by more than one marker during parsing. This script keeps the first occurrence's citation/parent/title and appends the later occurrence's text as trailing paragraphs so no content is silently dropped. As of this run, the only expected entry is `sec-7-B-VI-D-3-a-(iii)` — the source PDF really does print that exact label twice in a row for two different paragraphs (see "Source-text corrections and anomalies" below). The two other duplicates seen in earlier runs (`sec-7-B-II-J-1-c`, `sec-7-B-III-C-5-b-(iv)-(A)-(2)`, both citation-shaped continuation-line false positives) and the label-typo collision (`sec-7-B-VII-A-20`) are fixed — see the same section and the marker audit below. Anything else appearing here is new and should be reviewed by hand.

_none_

## Source-text corrections and anomalies

Confirmed by reading the actual printed PDF (not a pdftotext artifact). Fixes are applied to the raw lines before marker scanning, matched by (old label + enough of the following words to be unique in the document) so they can't misfire.

## Marker column / continuation-line audit

Every Part A/B label candidate flagged by the continuation-line guard (its column deviates by more than 2 characters from the learned column for its depth, and/or its previous non-blank line lacks terminal punctuation), whether ultimately accepted as a real label or rejected as a continuation. See IMPORTER_SPEC.md and `_marker_column_signals` for the rule.

- Flagged candidates: **42** (column-deviating: **40**, prev-line-lacks-terminal-punctuation: **7**)
- Rejected as continuations: **9**
- Kept as real labels despite the flag: **33**

| line | citation | part | indent | learned col | col dev | lacks term. | page seam | accepted |
|---|---|---|---|---|---|---|---|---|
| 132 | `II.B.1.a.` |  | 0 | 18 | True | False | False | True |
| 144 | `II.B.1.b.` |  | 0 | 18 | True | False | False | True |
| 266 | `II.A.` |  | 8 | 0 | True | False | False | False |
| 285 | `IV.C.2.` |  | 13 | 8 | True | False | True | True |
| 292 | `IV.C.3.` |  | 13 | 8 | True | False | False | True |
| 354 | `II.` |  | 0 | 0 | False | True | False | False |
| 375 | `V.B.1.` |  | 5 | 8 | True | False | False | True |
| 377 | `V.B.2.` |  | 5 | 8 | True | False | False | True |
| 380 | `V.B.3.` |  | 5 | 8 | True | False | False | True |
| 382 | `V.B.4.` |  | 5 | 8 | True | False | False | True |
| 384 | `V.B.5.` |  | 5 | 8 | True | False | False | True |
| 387 | `V.B.4.` |  | 17 | 8 | True | True | False | False |
| 398 | `II.B.` |  | 20 | 0 | True | True | False | False |
| 404 | `II.A.` |  | 20 | 0 | True | True | False | False |
| 410 | `V.B.6.` |  | 0 | 8 | True | False | False | True |
| 413 | `V.B.7.` |  | 0 | 8 | True | False | False | True |
| 438 | `I.C.1.` |  | 8 | 8 | False | True | False | False |
| 527 | `III.J.4.` |  | 21 | 8 | True | False | False | False |
| 540 | `V.` |  | 10 | 0 | True | True | False | False |
| 553 | `VIII.C.1.` |  | 0 | 8 | True | False | True | True |
| 556 | `VIII.C.1.a.` |  | 1 | 18 | True | False | False | True |
| 572 | `VIII.C.1.b.` |  | 1 | 18 | True | False | False | True |
| 579 | `VIII.C.2.` |  | 0 | 8 | True | False | False | True |
| 586 | `VIII.C.3.` |  | 0 | 8 | True | False | True | True |
| 596 | `VIII.C.4.` |  | 0 | 8 | True | False | False | True |
| 601 | `VIII.C.5.` |  | 0 | 8 | True | False | False | True |
| 606 | `VIII.C.6.` |  | 0 | 8 | True | False | False | True |
| 611 | `VIII.C.7.` |  | 0 | 8 | True | False | False | True |
| 615 | `VIII.C.8.` |  | 0 | 8 | True | False | False | True |
| 621 | `VIII.C.9.` |  | 3 | 8 | True | False | False | True |
| 630 | `VIII.D.1.` |  | 3 | 8 | True | False | False | True |
| 633 | `VIII.D.2.` |  | 3 | 8 | True | False | False | True |
| 638 | `VIII.D.3.` |  | 3 | 8 | True | False | False | True |
| 644 | `VIII.E.1.` |  | 3 | 8 | True | False | False | True |
| 647 | `VIII.E.2.` |  | 3 | 8 | True | False | False | True |
| 653 | `VIII.E.3.` |  | 4 | 8 | True | False | False | True |
| 661 | `VIII.E.4.` |  | 4 | 8 | True | False | False | True |
| 666 | `VIII.E.5.` |  | 4 | 8 | True | False | False | True |
| 675 | `VIII.F.1.` |  | 1 | 8 | True | False | False | True |
| 677 | `VIII.F.2.` |  | 14 | 8 | True | True | False | False |
| 685 | `VIII.F.2.` |  | 1 | 8 | True | False | False | True |
| 692 | `VIII.F.3.` |  | 1 | 8 | True | False | False | True |

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

- `<span class="xref">` spans — parsed: **39**, DB: **0**
- `<a class="xref-external-reg">` anchors — parsed: **50**, DB: **0**

### Spans by target part

| target | parsed | DB |
|---|---|---|
| Section I. (no parts in this regulation) | 10 | 0 |
| Section II. (no parts in this regulation) | 12 | 0 |
| Section III. (no parts in this regulation) | 2 | 0 |
| Section V. (no parts in this regulation) | 1 | 0 |
| Section VIII. (no parts in this regulation) | 4 | 0 |
| top (Regulation root) | 10 | 0 |

### Unresolved references, by bucket (top 15 each)

**Historical (former structure — this regulation was renumbered/reorganized; these no longer exist in the current Parts)** — 1 distinct, 3 mentions

| citation text | count |
|---|---|
| Part B | 3 |

**Other regulation not in corpus** — 0 distinct, 0 mentions

_none_

**CFR part/subpart not in corpus** — 2 distinct, 3 mentions

| citation text | count |
|---|---|
| NSPS Subpart OOOO | 2 |
| 40 CFR Part 60 | 1 |

**Unparseable / genuine parser gap** — 8 distinct, 8 mentions

| citation text | count |
|---|---|
| III.E. | 1 |
| I.C.1. | 1 |
| III.J.2. | 1 |
| III.J.3. | 1 |
| III.J.4. | 1 |
| I.A.4 | 1 |
| I.A.5 | 1 |
| V.C.5.b. | 1 |

**Form N (ECMC) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

**C.R.S. statute citation (ECMC) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

### Remaining unwrapped "Section..." text

- Total: **46**
- Excluding ones whose roman numeral doesn't exist in any current roman-numbered part at all (historical, expected to stay unlinked): **46**

### 10 random linked paragraphs from the body (no parts in this regulation)

- `sec-gp01-VI-B`: <p>The owner or operator may be subject to emission control, monitoring, performance testing, and recordkeeping and reporting requirements contained in <a class="xref-external-reg" href="/regulations/7">Regulation Number 7</a>, Part B, Section I.C., <span class="xref" data-target="sec-gp01-I-D">Section I.D.</span>, <span class="xref" data-target="sec-gp01-I-E">Section I.E.</span> and <span class="
- `sec-gp01-I-E`: <p>This general permit applies only to the equipment as described in <span class="xref" data-target="sec-gp01-I-A">Section I.A.</span> above having uncontrolled actual emissions of Sulfur Oxides (SOx), Particulate Matter (PM), Particulate Matter 2.5 (PM2.5), and Particulate Matter 10 (PM10) less than the Air Pollutant Emission Notice (APEN) reporting thresholds for each pollutant in <a class="xref
- `sec-gp01-V-B-6`: <p>Records required by <span class="xref" data-target="sec-gp01-III-B">Conditions III.B</span> (AOS), IV.C.1. (Annual tank inspections) and IV.C.3 (Control device monitoring).</p>
- `sec-gp01-II-C-2`: <p>The ten digit AIRS ID number assigned by the Division (e.g. 123/1234/001) must be marked on the subject equipment for ease of identification. The permit number (i.e. <span class="xref" data-target="sec-gp01-top-REG-gp01">GP01</span>) must be marked on equipment newly registered and deemed complete on or after the issuance date of Issuance 6 of this general permit (Reference: <a class="xref-exte
- `sec-gp01-III-C`: <p>The following changes are not considered modifications. These changes should be reflected in any revised APEN required by <span class="xref" data-target="sec-gp01-VIII-C-1">Condition VIII.C.1.</span></p><p>• Removal of a well serviced by the storage tank with no increase to permitted emission rates and no changes to the configuration that will impact a dispersion analysis;</p><p>• Re-piping of 
- `sec-gp01-I-A-2`: <p>Combustion devices, vapor recovery units, or other Division-approved control equipment used to reduce emissions below the limits specified in <span class="xref" data-target="sec-gp01-II">Section II.</span></p>
- `sec-gp01-V-B-5`: <p>Records that clearly demonstrate compliance with the emission limits of this permit. This must include the most currently available production records necessary to calculate emissions in accordance with this <span class="xref" data-target="sec-gp01-V-B-4">Condition V.B.4</span> and documentation of all periods of control device downtime for sources where a control device is required to comply w
- `sec-gp01-VIII-F-1`: <p>Conditional certification of a registration under this general permit is effective from the date the registration is deemed complete as indicated in <span class="xref" data-target="sec-gp01-VIII-F-2">Condition VIII.F.2.</span> A complete registration request consists of all General Permit application materials required by the Division and associated fees. The owner or operator may commence cons
- `sec-gp01-II-A-3`: <p>For new or modified registrations deemed complete on or after the effective date of this permit issuance (Issuance 6), the maximum allowable emissions of nitrogen oxides (NOx) and carbon monoxide (CO) from all tank batteries and control of emissions from all tank batteries under the <span class="xref" data-target="sec-gp01-top-REG-gp01">GP01</span> registration that are owned and operated by th
- `sec-gp01-I-B`: <p>Stationary Sources that became subject to Title V Operating Permit requirements or became classified as an existing major stationary source for which a complete <span class="xref" data-target="sec-gp01-top-REG-gp01">GP01</span> registration request was received by the Division prior to the effective date (January 27, 2020) on which the 8-hour Ozone Control Area was re-classified from moderate t

### 5 random linked paragraphs from the statement-of-basis section (None.)


### DB xref target vs parsed xref target, same provision & citation text

(0 such (provision, citation text) pairs found)

_none found_

_(the hand-reviewed DB-vs-parsed xref-target writeup below is Reg 7-specific and only applies when diffing Reg 7 against a pre-existing DB export)_

## Lowercase-start rows in parsed output (first 30)


## 15 random side-by-side samples
