# Reg 10 import diff report

- Parsed rows: **79**
- DB rows: **0**
- Ids in both: **0**
- Ids only in DB (parser gap or DB junk): **0**
- Ids only in parsed (parser found something DB doesn't have): **79**
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

(79 total)

- `sec-10-I`
- `sec-10-I-A`
- `sec-10-I-B`
- `sec-10-I-C`
- `sec-10-II`
- `sec-10-III`
- `sec-10-III-A`
- `sec-10-III-A-1`
- `sec-10-III-A-2`
- `sec-10-III-A-3`
- `sec-10-III-A-3-a`
- `sec-10-III-A-3-b`
- `sec-10-III-A-3-c`
- `sec-10-III-A-3-d`
- `sec-10-III-A-3-e`
- `sec-10-III-A-3-f`
- `sec-10-III-B`
- `sec-10-III-B-1`
- `sec-10-III-B-1-a`
- `sec-10-III-B-1-b`
- `sec-10-III-B-1-c`
- `sec-10-III-C`
- `sec-10-III-C-1`
- `sec-10-III-C-1-a`
- `sec-10-III-C-1-b`
- `sec-10-III-C-1-c`
- `sec-10-III-C-1-d`
- `sec-10-III-C-1-e`
- `sec-10-III-C-1-f`
- `sec-10-III-C-1-g`
- `sec-10-III-C-2`
- `sec-10-III-C-2-a`
- `sec-10-III-C-2-b`
- `sec-10-III-C-2-c`
- `sec-10-III-C-2-d`
- `sec-10-III-C-3`
- `sec-10-III-C-3-a`
- `sec-10-III-C-3-b`
- `sec-10-III-D`
- `sec-10-III-D-1`
- `sec-10-III-D-2`
- `sec-10-III-E`
- `sec-10-III-E-1`
- `sec-10-III-F`
- `sec-10-III-F-1`
- `sec-10-III-F-1-a`
- `sec-10-III-F-1-b`
- `sec-10-III-F-1-c`
- `sec-10-III-F-1-d`
- `sec-10-III-F-1-e`
- `sec-10-III-F-1-f`
- `sec-10-III-F-1-g`
- `sec-10-III-F-2`
- `sec-10-III-F-3`
- `sec-10-III-G`
- `sec-10-III-G-1`
- `sec-10-III-G-2`
- `sec-10-III-H`
- `sec-10-III-H-1`
- `sec-10-III-H-1-a`
- `sec-10-III-H-1-b`
- `sec-10-III-H-1-c`
- `sec-10-III-H-2`
- `sec-10-III-H-3`
- `sec-10-III-H-4`
- `sec-10-III-H-4-a`
- `sec-10-III-H-4-b`
- `sec-10-III-H-4-c`
- `sec-10-IV`
- `sec-10-IV-A`
- `sec-10-IV-B`
- `sec-10-V`
- `sec-10-V-A`
- `sec-10-VI`
- `sec-10-VI-A`
- `sec-10-VI-B`
- `sec-10-VI-C`
- `sec-10-VI-D`
- `sec-10-top-REG-10`

## Duplicate ids in the parsed output (two markers, one id — merged)

Every id below was produced by more than one marker during parsing. This script keeps the first occurrence's citation/parent/title and appends the later occurrence's text as trailing paragraphs so no content is silently dropped. As of this run, the only expected entry is `sec-7-B-VI-D-3-a-(iii)` — the source PDF really does print that exact label twice in a row for two different paragraphs (see "Source-text corrections and anomalies" below). The two other duplicates seen in earlier runs (`sec-7-B-II-J-1-c`, `sec-7-B-III-C-5-b-(iv)-(A)-(2)`, both citation-shaped continuation-line false positives) and the label-typo collision (`sec-7-B-VII-A-20`) are fixed — see the same section and the marker audit below. Anything else appearing here is new and should be reviewed by hand.

_none_

## Source-text corrections and anomalies

Confirmed by reading the actual printed PDF (not a pdftotext artifact). Fixes are applied to the raw lines before marker scanning, matched by (old label + enough of the following words to be unique in the document) so they can't misfire.

## Marker column / continuation-line audit

Every Part A/B label candidate flagged by the continuation-line guard (its column deviates by more than 2 characters from the learned column for its depth, and/or its previous non-blank line lacks terminal punctuation), whether ultimately accepted as a real label or rejected as a continuation. See IMPORTER_SPEC.md and `_marker_column_signals` for the rule.

- Flagged candidates: **20** (column-deviating: **20**, prev-line-lacks-terminal-punctuation: **2**)
- Rejected as continuations: **2**
- Kept as real labels despite the flag: **18**

| line | citation | part | indent | learned col | col dev | lacks term. | page seam | accepted |
|---|---|---|---|---|---|---|---|---|
| 141 | `III.` |  | 0 | 4 | True | False | False | True |
| 143 | `III.A.` |  | 7 | 14 | True | False | False | True |
| 228 | `III.B.` |  | 6 | 14 | True | False | False | True |
| 276 | `III.C.` |  | 6 | 14 | True | False | False | True |
| 280 | `III.C.1.a.` |  | 19 | 22 | True | False | True | True |
| 289 | `III.C.1.b.` |  | 19 | 22 | True | False | False | True |
| 318 | `III.C.1.c.` |  | 19 | 22 | True | False | False | True |
| 334 | `III.C.1.d.` |  | 19 | 22 | True | False | True | True |
| 367 | `III.C.1.e.` |  | 19 | 22 | True | False | False | True |
| 376 | `III.C.1.f.` |  | 19 | 22 | True | False | False | True |
| 389 | `III.H.` |  | 21 | 14 | True | True | False | False |
| 392 | `III.C.2.` |  | 13 | 16 | True | False | False | True |
| 433 | `III.C.2.d.` |  | 23 | 19 | True | False | True | True |
| 449 | `III.C.3.a.` |  | 23 | 19 | True | False | False | True |
| 454 | `III.C.3.b.` |  | 23 | 19 | True | False | False | True |
| 459 | `III.D.` |  | 6 | 14 | True | False | False | True |
| 482 | `III.E.` |  | 6 | 14 | True | False | False | True |
| 558 | `III.F.` |  | 24 | 6 | True | True | False | False |
| 644 | `IV.` |  | 0 | 4 | True | False | True | True |
| 656 | `V.` |  | 0 | 4 | True | False | False | True |

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

- `<span class="xref">` spans — parsed: **20**, DB: **0**
- `<a class="xref-external-reg">` anchors — parsed: **2**, DB: **0**

### Spans by target part

| target | parsed | DB |
|---|---|---|
| Section III. (no parts in this regulation) | 12 | 0 |
| Section IV. (no parts in this regulation) | 1 | 0 |
| Section V. (no parts in this regulation) | 1 | 0 |
| top (Regulation root) | 6 | 0 |

### Unresolved references, by bucket (top 15 each)

**Historical (former structure — this regulation was renumbered/reorganized; these no longer exist in the current Parts)** — 1 distinct, 2 mentions

| citation text | count |
|---|---|
| Part B | 2 |

**Other regulation not in corpus** — 0 distinct, 0 mentions

_none_

**CFR part/subpart not in corpus** — 2 distinct, 5 mentions

| citation text | count |
|---|---|
| 40 CFR Part 93, Subpart A | 4 |
| 40 CFR Part 93 | 1 |

**Unparseable / genuine parser gap** — 0 distinct, 0 mentions

_none_

**Form N (ECMC) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

**C.R.S. statute citation (ECMC) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

**California Code of Regulations, Title 13 (Reg 20) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

### Remaining unwrapped "Section..." text

- Total: **0**
- Excluding ones whose roman numeral doesn't exist in any current roman-numbered part at all (historical, expected to stay unlinked): **0**

### 10 random linked paragraphs from the body (no parts in this regulation)

- `sec-10-III-D-1`: <p>The MPO shall contact the sponsor of any project disclosed to the MPO pursuant to <span class="xref" data-target="sec-10-III-E">Section III.E.</span>, but whose sponsors have not yet decided these features in sufficient detail to perform the regional emissions analysis according to the requirements of 40 CFR Section 93.122, and shall request that such sponsor develop the location and design con
- `sec-10-I-C`: <p>Colorado-specific provisions in <span class="xref" data-target="sec-10-V">Section V.</span> of this document regarding design concept and scope and enforceability of project-level mitigation and control measures shall apply, pursuant to 40 CFR Section 93.125 (c).</p>
- `sec-10-III-C-1-g`: <p>Choosing conformity tests and methodologies for isolated rural nonattainment areas, as required by 40 CFR Section 93.109(g).</p><p>The Division and CDOT shall choose, in consultation with the members of the review team, the requirements and methodologies to be used to comply with 40 CFR Section 93.109. If the Division and CDOT cannot agree, the issue shall be referred to the Commission for revi
- `sec-10-III-A-2`: <p>It shall be the role and responsibility of each agency identified as a lead agency to prepare the final document and to ensure the adequacy of the interagency consultation process. Designation as a lead agency for any decision item shall mean that such agency shall be responsible for making the final decision on such decision item, except that any such decision shall be subject to the dispute r
- `sec-10-III-C-1-b`: <p>Determining which minor arterials and other transportation projects should be considered “regionally significant” for the purposes of regional emissions analysis (in addition to those functionally classified as principal arterial or higher or fixed guideway systems or extensions that offer an alternative to regional highway travel), and which projects should be considered to have a significant 
- `sec-10-I`: <p>Requirement to Comply with the Federal Rule</p><p>The purpose of <span class="xref" data-target="sec-10-top-REG-10">Regulation Number 10</span> is to fulfill the requirement in 40 CFR 51.390(b) to establish a SIP revision that addresses the provisions of Sections 40 CFR 93.105(a) through (e), 40 CFR 93.122(a)(4)(ii), and 40 CFR 93.125(c) of the federal transportation conformity rule (see 40 CFR
- `sec-10-III-G-1`: <p>The Division may enter into written agreements with the members of the review team to clarify and further develop the procedures for conformity determinations described in this <span class="xref" data-target="sec-10-III">Section III.</span> The Division may also enter into written agreements with the LPA and members of the committee established pursuant to <span class="xref" data-target="sec-10
- `sec-10-II`: <p>Definitions</p><p>CDOT means the Colorado Department of Transportation.</p><p>Commission means the Air Quality Control Commission as defined in Section 25-7-103(7), C.R.S.</p><p>Division means The Air Pollution Control Division, pursuant to Section 25-7-111, C.R.S.</p><p>Hot Spot Analysis is an estimation of likely future localized criteria pollutant (or their precursor) concentrations and a co
- `sec-10-I-A`: <p>The interagency consultation procedures established in <span class="xref" data-target="sec-10-III">Section III.</span> of this document specify Colorado procedures and shall apply in addition to the consultation procedures established in 40 CFR Section 93.105 (a) through (e).</p>
- `sec-10-I-B`: <p>Colorado-specific provisions in <span class="xref" data-target="sec-10-IV">Section IV.</span> of this document that require obtainment of and fulfillment of written commitments to SIP control measures not included in a transportation plan or Transportation Improvement Program (TIP) shall apply, pursuant to 40 CFR Section 93.122 (a)(4)(ii).</p>

### 5 random linked paragraphs from the statement-of-basis section (VI.)

- `sec-10-VI-A`: <p>Amendments Adopted October 15, 1998</p><p>The change to <span class="xref" data-target="sec-10-top-REG-10">Regulation Number 10</span>, “Criteria for Analysis of Conformity,” Part B, “Transportation Conformity” will establish criteria and procedures for making conformity determinations on transportation plans, transportation improvement programs (TIPs), FHWA/FTA projects, and consultation proce
- `sec-10-VI-C`: <p>Amendments Adopted December 15, 2011</p><p>Basis and Purpose</p><p>The purpose of these amendments is to streamline the transportation conformity process by allowing the Colorado Air Pollution Control Division to provide concurrence with routine transportation conformity determinations without the need for a public hearing before the Colorado Air Quality Control Commission. This change to the c
- `sec-10-VI-D`: <p>Adopted: February 18, 2016</p><p>This Statement of Basis, Specific Statutory Authority and Purpose complies with the requirements of the Colorado Administrative Procedure Act Sections 24-4-103, C.R.S. and the Colorado Air Pollution Prevention and Control Act Sections 25-7-110 and 25-7-110.5, C.R.S. (“the Act”), and the Air Quality Control Commission’s (“Commission”) <a class="xref-external-reg"

### DB xref target vs parsed xref target, same provision & citation text

(0 such (provision, citation text) pairs found)

_none found_

_(the hand-reviewed DB-vs-parsed xref-target writeup below is Reg 7-specific and only applies when diffing Reg 7 against a pre-existing DB export)_

## Lowercase-start rows in parsed output (first 30)


## 15 random side-by-side samples
