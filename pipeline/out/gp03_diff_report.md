# Reg gp03 import diff report

- Parsed rows: **59**
- DB rows: **0**
- Ids in both: **0**
- Ids only in DB (parser gap or DB junk): **0**
- Ids only in parsed (parser found something DB doesn't have): **59**
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

(59 total)

- `sec-gp03-I`
- `sec-gp03-I-A`
- `sec-gp03-I-B`
- `sec-gp03-I-C`
- `sec-gp03-II`
- `sec-gp03-II-A`
- `sec-gp03-II-A-1`
- `sec-gp03-II-B`
- `sec-gp03-II-B-1`
- `sec-gp03-II-B-1-a`
- `sec-gp03-II-B-1-a-(i)`
- `sec-gp03-II-B-1-a-(ii)`
- `sec-gp03-II-B-1-a-(iii)`
- `sec-gp03-II-B-1-b`
- `sec-gp03-II-B-1-b-(i)`
- `sec-gp03-II-B-1-b-(ii)`
- `sec-gp03-II-B-1-b-(iii)`
- `sec-gp03-II-B-1-b-(iv)`
- `sec-gp03-II-B-1-b-(v)`
- `sec-gp03-II-B-1-c`
- `sec-gp03-II-B-1-c-(i)`
- `sec-gp03-II-B-1-c-(ii)`
- `sec-gp03-II-B-1-c-(iii)`
- `sec-gp03-III`
- `sec-gp03-III-A`
- `sec-gp03-III-B`
- `sec-gp03-III-C`
- `sec-gp03-III-D`
- `sec-gp03-IV`
- `sec-gp03-IV-A`
- `sec-gp03-IV-A-1`
- `sec-gp03-IV-A-2`
- `sec-gp03-IV-A-3`
- `sec-gp03-IV-A-4`
- `sec-gp03-IV-A-4-a`
- `sec-gp03-IV-A-4-b`
- `sec-gp03-IV-A-5`
- `sec-gp03-IV-A-6`
- `sec-gp03-IV-A-7`
- `sec-gp03-IV-A-8`
- `sec-gp03-IV-A-9`
- `sec-gp03-IV-B`
- `sec-gp03-IV-B-1`
- `sec-gp03-IV-C`
- `sec-gp03-IV-C-1`
- `sec-gp03-IV-C-1-a`
- `sec-gp03-IV-C-1-b`
- `sec-gp03-IV-C-1-c`
- `sec-gp03-IV-C-1-d`
- `sec-gp03-IV-D`
- `sec-gp03-IV-D-1`
- `sec-gp03-IV-D-2`
- `sec-gp03-IV-D-3`
- `sec-gp03-IV-E`
- `sec-gp03-IV-E-1`
- `sec-gp03-IV-E-2`
- `sec-gp03-IV-E-3`
- `sec-gp03-IV-E-4`
- `sec-gp03-top-REG-gp03`

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

- `<span class="xref">` spans — parsed: **0**, DB: **0**
- `<a class="xref-external-reg">` anchors — parsed: **8**, DB: **0**

### Spans by target part

| target | parsed | DB |
|---|---|---|

### Unresolved references, by bucket (top 15 each)

**Historical (former structure — this regulation was renumbered/reorganized; these no longer exist in the current Parts)** — 0 distinct, 0 mentions

_none_

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

### Remaining unwrapped "Section..." text

- Total: **6**
- Excluding ones whose roman numeral doesn't exist in any current roman-numbered part at all (historical, expected to stay unlinked): **6**

### 10 random linked paragraphs from the body (no parts in this regulation)


### 5 random linked paragraphs from the statement-of-basis section (None.)


### DB xref target vs parsed xref target, same provision & citation text

(0 such (provision, citation text) pairs found)

_none found_

_(the hand-reviewed DB-vs-parsed xref-target writeup below is Reg 7-specific and only applies when diffing Reg 7 against a pre-existing DB export)_

## Lowercase-start rows in parsed output (first 30)


## 15 random side-by-side samples
