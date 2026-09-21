# Reg 18 import diff report

- Parsed rows: **10**
- DB rows: **0**
- Ids in both: **0**
- Ids only in DB (parser gap or DB junk): **0**
- Ids only in parsed (parser found something DB doesn't have): **10**
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

(10 total)

- `sec-18-I`
- `sec-18-II`
- `sec-18-II-A`
- `sec-18-II-B`
- `sec-18-II-C`
- `sec-18-II-D`
- `sec-18-II-E`
- `sec-18-II-F`
- `sec-18-II-G`
- `sec-18-top-REG-18`

## Duplicate ids in the parsed output (two markers, one id — merged)

Every id below was produced by more than one marker during parsing. This script keeps the first occurrence's citation/parent/title and appends the later occurrence's text as trailing paragraphs so no content is silently dropped. As of this run, the only expected entry is `sec-7-B-VI-D-3-a-(iii)` — the source PDF really does print that exact label twice in a row for two different paragraphs (see "Source-text corrections and anomalies" below). The two other duplicates seen in earlier runs (`sec-7-B-II-J-1-c`, `sec-7-B-III-C-5-b-(iv)-(A)-(2)`, both citation-shaped continuation-line false positives) and the label-typo collision (`sec-7-B-VII-A-20`) are fixed — see the same section and the marker audit below. Anything else appearing here is new and should be reviewed by hand.

_none_

## Source-text corrections and anomalies

Confirmed by reading the actual printed PDF (not a pdftotext artifact). Fixes are applied to the raw lines before marker scanning, matched by (old label + enough of the following words to be unique in the document) so they can't misfire.

## Marker column / continuation-line audit

Every Part A/B label candidate flagged by the continuation-line guard (its column deviates by more than 2 characters from the learned column for its depth, and/or its previous non-blank line lacks terminal punctuation), whether ultimately accepted as a real label or rejected as a continuation. See IMPORTER_SPEC.md and `_marker_column_signals` for the rule.

- Flagged candidates: **0** (column-deviating: **0**, prev-line-lacks-terminal-punctuation: **0**)
- Rejected as continuations: **0**
- Kept as real labels despite the flag: **0**

_none recorded (run `parse` first to generate the sidecar file)_

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

- `<span class="xref">` spans — parsed: **2**, DB: **0**
- `<a class="xref-external-reg">` anchors — parsed: **1**, DB: **0**

### Spans by target part

| target | parsed | DB |
|---|---|---|
| top (Regulation root) | 2 | 0 |

### Unresolved references, by bucket (top 15 each)

**Historical (former structure — this regulation was renumbered/reorganized; these no longer exist in the current Parts)** — 0 distinct, 0 mentions

_none_

**Other regulation not in corpus** — 0 distinct, 0 mentions

_none_

**CFR part/subpart not in corpus** — 1 distinct, 1 mentions

| citation text | count |
|---|---|
| 40 CFR Part 72 | 1 |

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


### 5 random linked paragraphs from the statement-of-basis section (II.)

- `sec-18-II-C`: <p>February 15, 2001</p><p>Statement of Basis, Specific Statutory Authority and Purpose</p><p>Purpose</p><p>The revisions to part 72 and 76 clarify the applicability and intent of the federal acid deposition program. The Title IV program is a delegated program and this action is not a SIP revision. Incorporation by Reference of Federal Amendments to 40 C.F.R. parts 72 and 76, the Federal Acid Rain
- `sec-18-II-D`: <p>Adopted: February 21, 2002</p><p>Statement of Basis, Specific Statutory Authority and Purpose</p><p>Incorporation by Reference of Federal Amendments to 40 C.F.R. part 72, the Federal Acid Rain Program, into Colorado Air Quality Control Commission <span class="xref" data-target="sec-18-top-REG-18">Regulation No. 18</span>, section I</p><p>Background</p><p>This Statement of Basis, Specific Statut

### DB xref target vs parsed xref target, same provision & citation text

(0 such (provision, citation text) pairs found)

_none found_

_(the hand-reviewed DB-vs-parsed xref-target writeup below is Reg 7-specific and only applies when diffing Reg 7 against a pre-existing DB export)_

## Lowercase-start rows in parsed output (first 30)


## 15 random side-by-side samples
