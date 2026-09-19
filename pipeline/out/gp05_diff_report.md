# Reg gp05 import diff report

- Parsed rows: **111**
- DB rows: **0**
- Ids in both: **0**
- Ids only in DB (parser gap or DB junk): **0**
- Ids only in parsed (parser found something DB doesn't have): **111**
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

(111 total)

- `sec-gp05-I`
- `sec-gp05-I-A`
- `sec-gp05-I-A-1`
- `sec-gp05-I-A-2`
- `sec-gp05-I-A-3`
- `sec-gp05-I-B`
- `sec-gp05-I-C`
- `sec-gp05-I-D`
- `sec-gp05-I-E`
- `sec-gp05-I-F`
- `sec-gp05-I-F-1`
- `sec-gp05-I-F-2`
- `sec-gp05-I-F-3`
- `sec-gp05-II`
- `sec-gp05-II-A`
- `sec-gp05-II-A-1`
- `sec-gp05-II-A-1-a`
- `sec-gp05-II-A-1-b`
- `sec-gp05-II-A-1-b-(i)`
- `sec-gp05-II-A-1-b-(ii)`
- `sec-gp05-II-A-2`
- `sec-gp05-II-B`
- `sec-gp05-II-B-1`
- `sec-gp05-II-B-1-a`
- `sec-gp05-II-B-1-b`
- `sec-gp05-II-B-1-c`
- `sec-gp05-II-B-2`
- `sec-gp05-II-B-3`
- `sec-gp05-II-C`
- `sec-gp05-II-C-1`
- `sec-gp05-II-C-2`
- `sec-gp05-II-C-3`
- `sec-gp05-II-C-4`
- `sec-gp05-II-C-5`
- `sec-gp05-II-D`
- `sec-gp05-II-D-1`
- `sec-gp05-III`
- `sec-gp05-III-A`
- `sec-gp05-III-B`
- `sec-gp05-III-C`
- `sec-gp05-IV`
- `sec-gp05-IV-A`
- `sec-gp05-IV-B`
- `sec-gp05-IV-B-1`
- `sec-gp05-IV-B-1-a`
- `sec-gp05-IV-B-1-b`
- `sec-gp05-IV-B-1-c`
- `sec-gp05-IV-B-2`
- `sec-gp05-IV-B-3`
- `sec-gp05-IV-B-4`
- `sec-gp05-IX`
- `sec-gp05-IX-A`
- `sec-gp05-IX-B`
- `sec-gp05-V`
- `sec-gp05-V-A`
- `sec-gp05-V-B`
- `sec-gp05-V-B-1`
- `sec-gp05-V-B-2`
- `sec-gp05-V-B-3`
- `sec-gp05-V-B-4`
- `sec-gp05-V-B-5`
- `sec-gp05-V-B-5-a`
- `sec-gp05-V-B-5-b`
- `sec-gp05-V-B-6`
- `sec-gp05-V-B-7`
- `sec-gp05-VI`
- `sec-gp05-VI-A`
- `sec-gp05-VI-B`
- `sec-gp05-VI-C`
- `sec-gp05-VI-D`
- `sec-gp05-VII`
- `sec-gp05-VII-A`
- `sec-gp05-VII-A-1`
- `sec-gp05-VII-A-2`
- `sec-gp05-VII-A-3`
- `sec-gp05-VII-B`
- `sec-gp05-VIII`
- `sec-gp05-VIII-A`
- `sec-gp05-VIII-B`
- `sec-gp05-VIII-C`
- `sec-gp05-VIII-C-1`
- `sec-gp05-VIII-C-1-a`
- `sec-gp05-VIII-C-1-a-(i)`
- `sec-gp05-VIII-C-1-a-(ii)`
- `sec-gp05-VIII-C-1-a-(iii)`
- `sec-gp05-VIII-C-1-b`
- `sec-gp05-VIII-C-1-c`
- `sec-gp05-VIII-C-1-d`
- `sec-gp05-VIII-C-2`
- `sec-gp05-VIII-C-3`
- `sec-gp05-VIII-C-4`
- `sec-gp05-VIII-C-5`
- `sec-gp05-VIII-C-6`
- `sec-gp05-VIII-C-7`
- `sec-gp05-VIII-C-8`
- `sec-gp05-VIII-C-9`
- `sec-gp05-VIII-D`
- `sec-gp05-VIII-D-1`
- `sec-gp05-VIII-D-2`
- `sec-gp05-VIII-D-3`
- `sec-gp05-VIII-E`
- `sec-gp05-VIII-E-1`
- `sec-gp05-VIII-E-2`
- `sec-gp05-VIII-E-3`
- `sec-gp05-VIII-E-4`
- `sec-gp05-VIII-E-5`
- `sec-gp05-VIII-F`
- `sec-gp05-VIII-F-1`
- `sec-gp05-VIII-F-2`
- `sec-gp05-VIII-F-3`
- `sec-gp05-top-REG-gp05`

## Duplicate ids in the parsed output (two markers, one id — merged)

Every id below was produced by more than one marker during parsing. This script keeps the first occurrence's citation/parent/title and appends the later occurrence's text as trailing paragraphs so no content is silently dropped. As of this run, the only expected entry is `sec-7-B-VI-D-3-a-(iii)` — the source PDF really does print that exact label twice in a row for two different paragraphs (see "Source-text corrections and anomalies" below). The two other duplicates seen in earlier runs (`sec-7-B-II-J-1-c`, `sec-7-B-III-C-5-b-(iv)-(A)-(2)`, both citation-shaped continuation-line false positives) and the label-typo collision (`sec-7-B-VII-A-20`) are fixed — see the same section and the marker audit below. Anything else appearing here is new and should be reviewed by hand.

_none_

## Source-text corrections and anomalies

Confirmed by reading the actual printed PDF (not a pdftotext artifact). Fixes are applied to the raw lines before marker scanning, matched by (old label + enough of the following words to be unique in the document) so they can't misfire.

## Marker column / continuation-line audit

Every Part A/B label candidate flagged by the continuation-line guard (its column deviates by more than 2 characters from the learned column for its depth, and/or its previous non-blank line lacks terminal punctuation), whether ultimately accepted as a real label or rejected as a continuation. See IMPORTER_SPEC.md and `_marker_column_signals` for the rule.

- Flagged candidates: **37** (column-deviating: **37**, prev-line-lacks-terminal-punctuation: **1**)
- Rejected as continuations: **4**
- Kept as real labels despite the flag: **33**

| line | citation | part | indent | learned col | col dev | lacks term. | page seam | accepted |
|---|---|---|---|---|---|---|---|---|
| 20 | `I.D.` |  | 18 | 0 | True | True | False | False |
| 49 | `I.A.` |  | 7 | 0 | True | False | False | False |
| 126 | `II.B.1.a.` |  | 0 | 10 | True | False | False | True |
| 138 | `II.B.1.b.` |  | 0 | 10 | True | False | False | True |
| 160 | `II.B.2.` |  | 3 | 6 | True | False | False | True |
| 169 | `II.B.3.` |  | 3 | 6 | True | False | False | True |
| 173 | `II.C.1.` |  | 3 | 6 | True | False | False | True |
| 175 | `II.C.2.` |  | 3 | 6 | True | False | False | True |
| 182 | `II.C.3.` |  | 3 | 6 | True | False | False | True |
| 261 | `IV.B.1.` |  | 3 | 6 | True | False | False | True |
| 263 | `IV.B.1.a.` |  | 13 | 0 | True | False | False | True |
| 268 | `IV.B.1.b.` |  | 13 | 0 | True | False | False | True |
| 275 | `IV.B.1.c.` |  | 13 | 0 | True | False | False | True |
| 279 | `IV.B.2.` |  | 3 | 6 | True | False | False | True |
| 385 | `V.B.2.` |  | 0 | 6 | True | False | True | True |
| 388 | `V.B.3.` |  | 0 | 6 | True | False | False | True |
| 390 | `V.B.4.` |  | 0 | 6 | True | False | False | True |
| 392 | `V.B.5.` |  | 0 | 6 | True | False | False | True |
| 399 | `V.B.5.a.` |  | 9 | 0 | True | False | False | True |
| 404 | `V.B.5.b.` |  | 9 | 0 | True | False | False | True |
| 414 | `V.B.6.` |  | 0 | 6 | True | False | False | True |
| 439 | `I.D.3.` |  | 15 | 6 | True | False | False | False |
| 535 | `VII.A.1.` |  | 14 | 6 | True | False | False | True |
| 536 | `III.J.2.` |  | 25 | 6 | True | False | False | False |
| 538 | `VII.A.2.` |  | 14 | 6 | True | False | False | True |
| 541 | `VII.A.3.` |  | 14 | 6 | True | False | False | True |
| 574 | `VIII.C.1.a.(i).` |  | 14 | 21 | True | False | False | True |
| 578 | `VIII.C.1.a.(ii).` |  | 14 | 21 | True | False | False | True |
| 584 | `VIII.C.1.a.(iii).` |  | 9 | 21 | True | False | False | True |
| 588 | `VIII.C.1.b.` |  | 5 | 0 | True | False | False | True |
| 591 | `VIII.C.1.c.` |  | 5 | 0 | True | False | False | True |
| 594 | `VIII.C.1.d.` |  | 5 | 0 | True | False | False | True |
| 596 | `VIII.C.2.` |  | 0 | 6 | True | False | False | True |
| 604 | `VIII.C.3.` |  | 0 | 6 | True | False | False | True |
| 613 | `VIII.C.4.` |  | 3 | 6 | True | False | True | True |
| 618 | `VIII.C.5.` |  | 3 | 6 | True | False | False | True |
| 709 | `VIII.F.3.` |  | 6 | 3 | True | False | True | True |

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

- `<span class="xref">` spans — parsed: **32**, DB: **0**
- `<a class="xref-external-reg">` anchors — parsed: **50**, DB: **0**

### Spans by target part

| target | parsed | DB |
|---|---|---|
| Section I. (no parts in this regulation) | 7 | 0 |
| Section II. (no parts in this regulation) | 10 | 0 |
| Section III. (no parts in this regulation) | 2 | 0 |
| Section V. (no parts in this regulation) | 1 | 0 |
| Section VIII. (no parts in this regulation) | 4 | 0 |
| top (Regulation root) | 8 | 0 |

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

**Unparseable / genuine parser gap** — 7 distinct, 7 mentions

| citation text | count |
|---|---|
| III.E. | 1 |
| III.J.2. | 1 |
| III.J.3. | 1 |
| III.J.4. | 1 |
| I.A.4 | 1 |
| I.A.5. | 1 |
| V.C.5.b. | 1 |

**Form N (ECMC) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

**C.R.S. statute citation (ECMC) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

### Remaining unwrapped "Section..." text

- Total: **46**
- Excluding ones whose roman numeral doesn't exist in any current roman-numbered part at all (historical, expected to stay unlinked): **46**

### 10 random linked paragraphs from the body (no parts in this regulation)

- `sec-gp05-VIII-F-1`: <p>Conditional certification of a registration under this general permit is effective from the date the registration is deemed complete as indicated in <span class="xref" data-target="sec-gp05-VIII-F-2">Condition VIII.F.2.</span> A complete registration request consists of all General Permit application materials required by the Division and associated fees. The owner or operator may commence cons
- `sec-gp05-II-B-1`: <p>The owner or operator not subject to <span class="xref" data-target="sec-gp05-I-B">Conditions I.B.</span> or <span class="xref" data-target="sec-gp05-I-C">I.C.</span> or <span class="xref" data-target="sec-gp05-I-D">I.D.</span> of this permit must track potential emissions from all insignificant activities at the facility on an annual basis to demonstrate compliance with the facility emission l
- `sec-gp05-VI-D`: <p>At the frequency specified in Table 2, the owner or operator of storage tanks utilizing site-specific emission factors must complete site-specific sampling as necessary to develop site-specific emission factors. Periodic site-specific sampling must be conducted at a minimum of one hundred and eighty (180) days apart. Sampling and analysis must be in accordance with Division-approved methods and
- `sec-gp05-IV-B`: <p>If a control device is used to comply with the emission limits in <span class="xref" data-target="sec-gp05-II-A">Section II.A.</span> of this permit the following conditions must be met:</p>
- `sec-gp05-V-B-5-b`: <p>For sources located at a synthetic minor or major facilities, compliance with the emission limits in <span class="xref" data-target="sec-gp05-II-A">Section II.A.</span> and <span class="xref" data-target="sec-gp05-II-B">Section II.B.</span> must be determined by recording the annual emissions from each emission unit on a rolling 12-month total. By the end of each month a new 12-month total is c
- `sec-gp05-I-B`: <p>Stationary Sources that became subject to Title V Operating Permit requirements or became classified as an existing major stationary source which a complete <span class="xref" data-target="sec-gp05-top-REG-gp05">GP05</span> registration request was received by the Division prior to the effective date (January 27, 2020) on which the 8-hour Ozone Control Area was re-classified, from moderate to s
- `sec-gp05-III-C`: <p>The following changes are not considered modifications. These changes should be reflected in any revised APEN required by <span class="xref" data-target="sec-gp05-VIII-C-1">Condition VIII.C.1.</span></p><p>• Removal of a well serviced by the storage tank with no increase to permitted emissions rates and no changes to the configuration that will impact a dispersion analysis;</p><p>• Re-piping of
- `sec-gp05-II-D-1`: <p>The owner or operator may be subject to emission control, auto igniter, operate without venting, storage tank emissions management (STEM) plan, performance testing, metering, reporting, and recordkeeping requirements contained in <a class="xref-external-reg" href="/regulations/7">Regulation Number 7</a>, Part B, Section II.B and <span class="xref" data-target="sec-gp05-II-C">Section II.C.</span
- `sec-gp05-I-E`: <p>This general permit applies only to the equipment as described in <span class="xref" data-target="sec-gp05-I-A">Section I.A.</span> above having uncontrolled actual emissions of Sulfur Oxides (SOx), Particulate Matter (PM), Particulate Matter 2.5 (PM2.5), and Particulate Matter 10 (PM10) less than the APEN reporting thresholds for each pollutant in <a class="xref-external-reg" href="/regulation
- `sec-gp05-III-A`: <p>Provided that there are no emissions increases, and the emission limits set forth in <span class="xref" data-target="sec-gp05-II-A">Section II.A.</span> and <span class="xref" data-target="sec-gp05-II-B">Section II.B.</span> are still met, the owner or operator may invoke an AOS for the following changes to an existing tank battery registered under the general permit without modifying the gener

### 5 random linked paragraphs from the statement-of-basis section (None.)


### DB xref target vs parsed xref target, same provision & citation text

(0 such (provision, citation text) pairs found)

_none found_

_(the hand-reviewed DB-vs-parsed xref-target writeup below is Reg 7-specific and only applies when diffing Reg 7 against a pre-existing DB export)_

## Lowercase-start rows in parsed output (first 30)


## 15 random side-by-side samples
