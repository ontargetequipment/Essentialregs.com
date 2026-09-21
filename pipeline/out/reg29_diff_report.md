# Reg 29 import diff report

- Parsed rows: **51**
- DB rows: **0**
- Ids in both: **0**
- Ids only in DB (parser gap or DB junk): **0**
- Ids only in parsed (parser found something DB doesn't have): **51**
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

(51 total)

- `sec-29-A-I`
- `sec-29-A-I-A`
- `sec-29-A-I-B`
- `sec-29-A-I-B-1`
- `sec-29-A-I-B-2`
- `sec-29-A-I-B-3`
- `sec-29-A-I-B-4`
- `sec-29-A-I-B-5`
- `sec-29-A-I-C`
- `sec-29-A-II`
- `sec-29-A-II-A`
- `sec-29-A-II-B`
- `sec-29-A-II-C`
- `sec-29-A-II-C-1`
- `sec-29-A-II-C-10`
- `sec-29-A-II-C-11`
- `sec-29-A-II-C-12`
- `sec-29-A-II-C-13`
- `sec-29-A-II-C-14`
- `sec-29-A-II-C-2`
- `sec-29-A-II-C-3`
- `sec-29-A-II-C-4`
- `sec-29-A-II-C-5`
- `sec-29-A-II-C-6`
- `sec-29-A-II-C-7`
- `sec-29-A-II-C-8`
- `sec-29-A-II-C-9`
- `sec-29-A-II-D`
- `sec-29-A-II-E`
- `sec-29-A-II-F`
- `sec-29-A-II-G`
- `sec-29-A-II-H`
- `sec-29-A-II-I`
- `sec-29-A-III`
- `sec-29-A-III-A`
- `sec-29-A-III-B`
- `sec-29-A-III-C`
- `sec-29-A-IV`
- `sec-29-A-IV-A`
- `sec-29-A-IV-B`
- `sec-29-A-IV-B-1`
- `sec-29-A-IV-B-2`
- `sec-29-A-IV-B-3`
- `sec-29-A-IV-B-3-a`
- `sec-29-A-IV-B-3-b`
- `sec-29-A-IV-B-4`
- `sec-29-A-IV-C`
- `sec-29-B-I`
- `sec-29-P-A`
- `sec-29-P-B`
- `sec-29-top-REG-29`

## Duplicate ids in the parsed output (two markers, one id — merged)

Every id below was produced by more than one marker during parsing. This script keeps the first occurrence's citation/parent/title and appends the later occurrence's text as trailing paragraphs so no content is silently dropped. As of this run, the only expected entry is `sec-7-B-VI-D-3-a-(iii)` — the source PDF really does print that exact label twice in a row for two different paragraphs (see "Source-text corrections and anomalies" below). The two other duplicates seen in earlier runs (`sec-7-B-II-J-1-c`, `sec-7-B-III-C-5-b-(iv)-(A)-(2)`, both citation-shaped continuation-line false positives) and the label-typo collision (`sec-7-B-VII-A-20`) are fixed — see the same section and the marker audit below. Anything else appearing here is new and should be reviewed by hand.

_none_

## Source-text corrections and anomalies

Confirmed by reading the actual printed PDF (not a pdftotext artifact). Fixes are applied to the raw lines before marker scanning, matched by (old label + enough of the following words to be unique in the document) so they can't misfire.

### Label typos corrected

| line ~ | printed (wrong) | corrected to | hits | note |
|---|---|---|---|---|
| 163 | `III.C` | `III.C.` | OK (1) | Part A Section III's third and last item is printed "III.C    The restrictions in Sections III.A. and III.B. also apply to lawn and garden services..." (REG_29.txt line 163) — the ONLY label in the whole regulation missing its trailing dot (III.A. and III.B. immediately above both print it, as does every other label in both parts). Without the fix the line was not a marker at all: its text was folded into III.B. as trailing paragraphs (making III.B. a 613-character two-provision row) and the label gate reported Section III's letter sequence as A..B with C missing. Corrected here rather than by setting REG_META `labels_without_trailing_dot` (the Reg 20 flag) because this is a single confirmed misprint, not the sporadic reg-wide habit that flag is for — a one-line fix that reports its own hit count is the narrower change. |
| 62 | `provisions in Section IV.I.C. Severability. If any section, clause, phrase, or standard` | `provisions in Section IV.` | OK (1) | I.B.5.: cut the fused severability sentence's opening words off the end of the line, leaving I.B.5. ending at "...in Section IV." as printed. The cut text is restored verbatim at the front of the next line by the fix below. |
| 63 | `                        contained in these regulations is for any reason held to be inoperative, unconstitutional,` | `              I.C.      Severability. If any section, clause, phrase, or standard contained in these regulations is for any reason held to be inoperative, unconstitutional,` | OK (1) | I.C.: restore the severability sentence's opening words (cut from line 62 by the fix above) at the front of this line, with the "I.C." label the print lost, at Section I's own item indent (14, the column I.A. and I.B.1.-I.B.5. use). Matched with its leading whitespace so the indent is set exactly. |

## Marker column / continuation-line audit

Every Part A/B label candidate flagged by the continuation-line guard (its column deviates by more than 2 characters from the learned column for its depth, and/or its previous non-blank line lacks terminal punctuation), whether ultimately accepted as a real label or rejected as a continuation. See IMPORTER_SPEC.md and `_marker_column_signals` for the rule.

- Flagged candidates: **8** (column-deviating: **8**, prev-line-lacks-terminal-punctuation: **1**)
- Rejected as continuations: **1**
- Kept as real labels despite the flag: **7**

| line | citation | part | indent | learned col | col dev | lacks term. | page seam | accepted |
|---|---|---|---|---|---|---|---|---|
| 8 | `I.B.` | A | 4 | 14 | True | False | False | True |
| 27 | `II.` | A | 0 | 4 | True | False | True | True |
| 29 | `II.A.` | A | 6 | 14 | True | False | False | True |
| 33 | `II.B.` | A | 6 | 14 | True | False | False | True |
| 39 | `II.C.` | A | 6 | 14 | True | False | False | True |
| 95 | `III.` | A | 0 | 4 | True | False | False | True |
| 114 | `III.C.` | A | 16 | 7 | True | True | False | False |
| 142 | `IV.B.4.` | A | 17 | 14 | True | False | False | True |

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

- `<span class="xref">` spans — parsed: **24**, DB: **0**
- `<a class="xref-external-reg">` anchors — parsed: **1**, DB: **0**

### Spans by target part

| target | parsed | DB |
|---|---|---|
| top (Regulation root) | 12 | 0 |
| under Part A | 12 | 0 |

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

**California Code of Regulations, Title 13 (Reg 20) — recognized, deliberately left as plain text** — 0 distinct, 0 mentions

_none_

### Remaining unwrapped "Section..." text

- Total: **0**
- Excluding ones whose roman numeral doesn't exist in any current roman-numbered part at all (historical, expected to stay unlinked): **0**

### 10 random linked paragraphs from Part B

- `sec-29-B-I`: <p>Adopted: February 16, 2024</p><p>This Statement of Basis, Specific Statutory Authority, and Purpose complies with the requirements of the Colorado Administrative Procedure Act §24-4-103, the Colorado Air Pollution Prevention and Control Act §§ 25-7-110 and 25-7-110.5, and the Air Quality Control Commission’s (Commission) <a class="xref-external-reg" data-provision-id="sec-proc-top-REG-proc" hre

### 5 random linked paragraphs from Part C


### DB xref target vs parsed xref target, same provision & citation text

(0 such (provision, citation text) pairs found)

_none found_

_(the hand-reviewed DB-vs-parsed xref-target writeup below is Reg 7-specific and only applies when diffing Reg 7 against a pre-existing DB export)_

## Lowercase-start rows in parsed output (first 30)


## 15 random side-by-side samples
