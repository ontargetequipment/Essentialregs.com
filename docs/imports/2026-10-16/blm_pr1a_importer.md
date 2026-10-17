# BLM PR 1a: 43 CFR Parts 3160 / 3170, the mechanical half (16 Oct 2026)

Branch `claude/blm-importer-1a`, pull request "Importer: 43 CFR plumbing,
hyphenated sections, four-digit part refs (BLM PR 1a)". Sections 1–4 of the
BLM importer brief. No import, no database change, no paid call. PR 1b
(subpart-nested appendices, the no-silent-drops rule, inline figures) and
PR 2 (front-end wiring) are not attempted here.

## 1. Sources

`.github/workflows/fetch-ecfr-part.yml` (workflow_dispatch and workflow_call;
inputs `title`, `part`, `date` defaulting to today in America/Denver) runs
`scripts/fetch_ecfr_part.py`: versioner `/full/<date>/title-<title>.xml?part=<part>`,
gzip-aware, falling back to the title's `up_to_date_as_of` when the date is
refused; the root must be `<DIV5 TYPE="PART" N="<part>">`. It writes
`pipeline/sources/P<part>.xml`, records the fetch in
`pipeline/sources/manifest.json` under a new top-level `ecfr_fetches` key
(beside `sources`, which freshness.py / source_dates.py /
changelog_sources.py iterate — a document joins `sources` when it is
imported), and commits to the branch it ran on.

workflow_dispatch reaches only a workflow already on the default branch, so
on this branch it was called once from a one-off push workflow (added and
deleted in this PR). The first call's 3170 job checked out the event commit
and could not rebase onto the 3160 commit; the workflow now checks out the
branch tip, and the second run re-fetched both (3160: same bytes, no commit).

| title | part | date served | requested | bytes | sha256 |
|---|---|---|---|---:|---|
| 43 | 3160 | 2026-10-15 | 2026-10-16 | 120,001 | `6c264a78a91166fbdbf6c60db00060c9dbbb01d74a6d0788f388057607d6ca54` |
| 43 | 3170 | 2026-10-15 | 2026-10-16 | 691,264 | `ac87aa7a18f22cb9d37fe23472b1c3fde54594153903c309da3aeefccabe0abc` |

## 2–4. Importer changes

See the three importer commits. In short: `PART_META` / `CFR_PART_TO_REGKEY`
/ import_ccr's maps / import.yml; `_is_section_range` (a range has a full
section number on both sides) and heading-only umbrella sections;
title-aware section resolution (a title-43 prefix is the subpart, its part
is the tens: 3162.3-1 → Part 3160), widened shared patterns, a title-43-only
pattern set (any title's "NN CFR", bare members 3160–3179, numeric
subparts, a stray-§ bucket), and the title printed before "part N".

`import_ccr`'s `CFR_TITLE_PART_RE` still reads "49 CFR" only, so the new
`("43", "3160")` / `("43", "3170")` map entries are inert for Colorado
documents (ECMC prints two "43 C.F.R." mentions, Reg 7 one; widening it
means re-baselining those parses — a later change).

`pipeline/method_links.py` runs unchanged on both parts: one anchor (EPA
Method 21 in § 3179.101(c)); API MPMS (40 rows) and AGA Report (11 rows) in
Subpart 3175 stay plain text, counted in `standard_not_in_corpus`.

## 5. Regression: every existing document, main vs this branch

Every document in `pipeline/sources/` except P3160/P3170 (58: 32 AQCC
regulations, 11 general permits, ECMC, 7 eCFR subparts, 8 PHMSA parts)
parsed with the Import workflow's own command (`import_ccr.py parse --reg
<key> --pdf … --txt … --out …`), once from `main` (`ae18c69`) and once from
this branch, with the committed corpus id and definitions indexes in force.
Every rows JSON and every sidecar JSON (303 files) was compared byte for
byte.

| document | rows | rows JSON (main vs branch) | report / sidecar JSON |
|---|---:|---|---|
| 1 | 344 | identical sha256 `a53267e65576` | identical (sidecar JSON) |
| 2 | 310 | identical sha256 `8e3debce5dcb` | identical (sidecar JSON) |
| 3 | 2,065 | identical sha256 `c10edd2cd28e` | identical (sidecar JSON) |
| 4 | 348 | identical sha256 `86a0eab740f0` | identical (sidecar JSON) |
| 6 | 462 | identical sha256 `90faca317fe8` | identical (sidecar JSON) |
| 7 | 2,182 | identical sha256 `f5f3d0908119` | identical (sidecar JSON) |
| 8 | 1,340 | identical sha256 `ab518f0f9374` | identical (sidecar JSON) |
| 9 | 217 | identical sha256 `686a4e413b47` | identical (sidecar JSON) |
| 10 | 79 | identical sha256 `4ebc1e75953e` | identical (sidecar JSON) |
| 11 | 715 | identical sha256 `85a04977f911` | identical (sidecar JSON) |
| 12 | 455 | identical sha256 `337e783cde21` | identical (sidecar JSON) |
| 15 | 36 | identical sha256 `7003b6300807` | identical (sidecar JSON) |
| 16 | 71 | identical sha256 `f0023edd4606` | identical (sidecar JSON) |
| 18 | 10 | identical sha256 `e14bf4a1b8a0` | identical (sidecar JSON) |
| 19 | 731 | identical sha256 `4a123d9fc0e6` | identical (sidecar JSON) |
| 20 | 327 | identical sha256 `1d0e3fc65d92` | identical (sidecar JSON) |
| 21 | 509 | identical sha256 `0c2baa85a2cc` | identical (sidecar JSON) |
| 22 | 344 | identical sha256 `8a31778a092e` | identical (sidecar JSON) |
| 23 | 221 | identical sha256 `f264d629011a` | identical (sidecar JSON) |
| 24 | 415 | identical sha256 `940432dd1ef2` | identical (sidecar JSON) |
| 25 | 993 | identical sha256 `266a758191c5` | identical (sidecar JSON) |
| 26 | 626 | identical sha256 `b767954089b3` | identical (sidecar JSON) |
| 27 | 413 | identical sha256 `294b73baf28e` | identical (sidecar JSON) |
| 28 | 282 | identical sha256 `2cfba74d5f31` | identical (sidecar JSON) |
| 29 | 51 | identical sha256 `218d531b5f4e` | identical (sidecar JSON) |
| 30 | 444 | identical sha256 `518ff88f341e` | identical (sidecar JSON) |
| 31 | 757 | identical sha256 `4e4a909435a4` | identical (sidecar JSON) |
| aqs | 80 | identical sha256 `a56876dd2c77` | identical (sidecar JSON) |
| cp | 220 | identical sha256 `8aa6f360d255` | identical (sidecar JSON) |
| ecmc | 6,754 | identical sha256 `60b8a31627f9` | identical (sidecar JSON) |
| gp01 | 103 | identical sha256 `bfaa2ccca821` | identical (sidecar JSON) |
| gp02 | 210 | identical sha256 `17089f9749b2` | identical (sidecar JSON) |
| gp03 | 59 | identical sha256 `ecbbd9bc3a6c` | identical (sidecar JSON) |
| gp05 | 111 | identical sha256 `34f7c732ad5d` | identical (sidecar JSON) |
| gp06 | 174 | identical sha256 `f9cc572ce041` | identical (sidecar JSON) |
| gp07 | 124 | identical sha256 `1a8ca2ef949f` | identical (sidecar JSON) |
| gp08 | 119 | identical sha256 `18ca4ed15e06` | identical (sidecar JSON) |
| gp09 | 251 | identical sha256 `ab6e743bebf5` | identical (sidecar JSON) |
| gp10 | 254 | identical sha256 `58e858a01e27` | identical (sidecar JSON) |
| gp11 | 129 | identical sha256 `469e0ddbc67e` | identical (sidecar JSON) |
| gp12 | 541 | identical sha256 `b3bb5fa67ace` | identical (sidecar JSON) |
| iiii | 288 | identical sha256 `de6f78a40469` | identical |
| jjjj | 205 | identical sha256 `a7031596b40e` | identical |
| oooo | 710 | identical sha256 `b8e50342acc6` | identical |
| ooooa | 1,106 | identical sha256 `64bba40d6904` | identical |
| oooob | 2,256 | identical sha256 `3347e677cce4` | identical |
| ooooc | 1,932 | identical sha256 `b914baf8dd5d` | identical |
| p190 | 517 | identical sha256 `36758a93ee88` | +4 keys, all empty |
| p191 | 127 | identical sha256 `81087e26753b` | +4 keys, all empty |
| p192 | 2,612 | identical sha256 `540b595957a1` | +4 keys, all empty |
| p193 | 436 | identical sha256 `6d1d54cac8d9` | +4 keys, all empty |
| p194 | 155 | identical sha256 `316b5dbd7a48` | +4 keys, all empty |
| p195 | 1,394 | identical sha256 `3544440406ea` | +4 keys, all empty |
| p196 | 27 | identical sha256 `0641f1f25530` | +4 keys, all empty |
| p199 | 243 | identical sha256 `b9b888ab22d2` | +4 keys, all empty |
| proc | 791 | identical sha256 `774db1905bff` | identical (sidecar JSON) |
| sip | 173 | identical sha256 `44cefc16465d` | identical (sidecar JSON) |
| zzzz | 360 | identical sha256 `d62944e8c858` | identical |
| **58 documents** | **37,208** | **58 / 58 identical** | |

The eight PHMSA parse reports gain four keys, `prefix_collisions`,
`section_order_breaks`, `heading_only_sections`, `dropped`, each an empty
list; no existing key changes. Rows: 58 / 58 byte-identical (37,208 rows,
the total the 9 Oct test-methods record reports).

## Parse reports

Parsed with `import_ccr.py parse --reg blm3160|blm3170` (the Import
workflow's command); the three sanity checks are `apply`'s own `stats.md`
checks, run against an empty DB export (`[]`), plan only — no SQL executed.

Row counts are well off the brief's estimates (about 500 and 1,700): the XML
has 297 and 2,460 `<P>` paragraphs, and every labelled paragraph is a row,
so 342 and 2,489 are what the source holds.

### blm3160 — 43 CFR Part 3160 — Onshore Oil and Gas Operations

- **Rows:** 342 — root 1, part 6, section 60, item 243, definition 27, heading 5
- **Subparts (6):** Subpart 3160, Subpart 3161, Subpart 3162, Subpart 3163, Subpart 3164, Subpart 3165
- **Sections:** 60 (every `DIV8`, in XML order); definitions 27; reserved 0; heading-only (no body, not reserved) § 3162.2, § 3162.4, § 3162.5, § 3162.7
- **Appendices found:** 0
- **Not read:** nothing
- **Tables:** 2 rendered
- **Images → placeholders:** 0 (0 in the XML)
- **prefix_collisions:** 29 — § 3162.2 ×15, § 3162.3 ×4, § 3162.4 ×2, § 3162.5 ×3, § 3162.7 ×4, § 3165.1 ×1
- **Section order breaks (document order ≠ numeric order):** 0
- **Ordering check §3162.2-1 … -15** (PASS; sort_order follows the XML): § 3162.2-1 630, § 3162.2-2 660, § 3162.2-3 710, § 3162.2-4 750, § 3162.2-5 790, § 3162.2-6 800, § 3162.2-7 830, § 3162.2-8 860, § 3162.2-9 870, § 3162.2-10 970, § 3162.2-11 980, § 3162.2-12 1100, § 3162.2-13 1150, § 3162.2-14 1160, § 3162.2-15 1170
  (bare § 3162.2 = 620, § 3162.3 = 1180; a text sort would put -10…-15 before -2)
- **Duplicate ids:** 0; **dead link targets:** 0; **label anomalies:** 0
- **Links:** 108 same-document spans, 19 cross-document anchors (to `/regulations/blm31x0`; no deep hash until the corpus id index holds the BLM rows)
- **Unresolved, by bucket:**
  - `cfr_not_in_corpus`: 18 distinct / 23 mentions — “part 4” ×6, “parts 221” ×1, “part 212” ×1, “part 213” ×1, “part 227” ×1, “parts 2” ×1
  - `other_subpart`: 0 distinct / 0 mentions
  - `standard_not_in_corpus`: 0 distinct / 0 mentions
  - `statute`: 14 distinct / 17 mentions — “30 U.S.C. 181” ×2, “44 U.S.C. 3507” ×2, “30 U.S.C. 1713” ×2, “30 U.S.C. 301-306” ×1, “30 U.S.C. 351-359” ×1, “25 U.S.C. 396a-396q” ×1
  - `unparseable`: 1 distinct / 1 mentions — “3162.7-5” ×1
  - `unrecognised_section_sign`: 1 distinct / 1 mentions — “§ 441” ×1
- **Rows under 25 words:** 152 of 342 — by kind: item 92, section 38, definition 10, part 6, heading 5, root 1
- **The three `apply` sanity checks** (`apply` against an empty DB export, plan only): Every parent_id referenced in the final state exists in the final state — **PASS**; No id in both delete and upsert sets — **PASS**; Every obsolete id resolved to a surviving ancestor — **PASS**
  (plan: 342 new rows; SQL carries `federal` / `BLM` / the eCFR part URL)

### blm3170 — 43 CFR Part 3170 — Onshore Oil and Gas Production

- **Rows:** 2,489 — root 1, part 10, section 206, item 2,015, definition 248, heading 9
- **Subparts (10):** Subpart 3170, Subpart 3171, Subpart 3172, Subpart 3173, Subpart 3174, Subpart 3175, Subpart 3176, Subpart 3177, Subpart 3178, Subpart 3179
- **Sections:** 206 (every `DIV8`, in XML order); definitions 248; reserved 1 (§ 3170.5); heading-only (no body, not reserved) none
- **Subject groups flattened into their subpart (reported, not rowed):** “Flaring and Venting Gas During Drilling and Production Operations” (4); “Gas Flared or Vented From Equipment and During Well Maintenance Operations” (3); “Leak Detection and Repair (LDAR)” (3); “Immediate Assessments” (1)
- **Appendices found:** 0
- **Not read (BLM PR 1b), 10 element(s):**
  - Subpart 3171: `<DIV9>` Appendix A to Subpart 3171 — Sample Format for Notice of Staking (10 words, 0 images, 0 tables)
  - part: `<EXTRACT>` (166 words, 0 images, 0 tables)
  - part: `<P>` (61 words, 0 images, 0 tables)
  - part: `<P-2>` (5 words, 0 images, 0 tables)
  - part: `<P-2>` (5 words, 0 images, 0 tables)
  - part: `<P-2>` (7 words, 0 images, 0 tables)
  - Subpart 3172: `<DIV9>` Appendix A to Subpart 3172 — Diagrams of Choke Manifold Equipment (55 words, 4 images, 0 tables)
  - Subpart 3173: `<DIV9>` Appendix A to Subpart 3173 of Part 3170 — Examples of Site Facility Diagrams (297 words, 26 images, 1 table)
  - Subpart 3175: `<DIV9>` Appendix A to Subpart 3175 of Part 3170 — Table of Atmospheric Pressures (11 words, 2 images, 0 tables)
  - Subpart 3177: `<DIV9>` Appendix A to Subpart 3177 — Examples of Acceptable Designs and Construction (81 words, 5 images, 0 tables)
- **Tables:** 128 rendered (+1 inside the unread appendices)
- **Images → placeholders:** 24 (+37 inside the unread appendices; 61 in the XML)
- **prefix_collisions:** 0
- **Section order breaks (document order ≠ numeric order):** 0
- **Duplicate ids:** 0; **dead link targets:** 0; **label anomalies:** 16
  - § 3172.12 (B) after (a)(1)(v): “[Reserved]” — kept as text in the open row, not dropped
  - § 3175.93 (i) after (e): “Orifice bore diameter (inches); or” — kept as text in the open row, not dropped
  - § 3175.93 (ii) after (e): “Beta or area ratio, discharge coefficient, and other information neces” — kept as text in the open row, not dropped
  - § 3175.93 (i) after (q): “The time and date on and time and date off;” — kept as text in the open row, not dropped
  - § 3175.93 (ii) after (q): “Average differential pressure (inches of water);” — kept as text in the open row, not dropped
  - § 3175.93 (iii) after (q): “Average static pressure;” — kept as text in the open row, not dropped
  - § 3175.93 (iv) after (q): “Static-pressure units of measure (psia or psig);” — kept as text in the open row, not dropped
  - § 3175.93 (v) after (q): “Average temperature ( °F);” — kept as text in the open row, not dropped
  - § 3175.93 (vi) after (q): “Integrator counts or extension;” — kept as text in the open row, not dropped
  - § 3175.93 (vii) after (q): “Hours of flow; and” — kept as text in the open row, not dropped
  - § 3175.93 (viii) after (q): “Volume (Mcf).” — kept as text in the open row, not dropped
  - § 3175.102 (vii) after (e)(2)(v): “The tolerance for differential pressure, static pressure, and temperat” — kept as text in the open row, not dropped
  - § 3175.102 (viii) after (e)(2)(v): “Whether or not each transducer required verification under paragraph (” — kept as text in the open row, not dropped
  - § 3176.6 (B) after (b)(3)(iii): “Portable H 2 S and SO 2 monitor(s);” — kept as text in the open row, not dropped
  - § 3176.8 (ii) after (c)(3): “All tests of the H 2 S monitoring system shall be recorded on the dril” — kept as text in the open row, not dropped
  - § 3176.8 (iii) after (c)(3): “For workover operations, 1 operational sensing point shall be located ” — kept as text in the open row, not dropped
- **Links:** 866 same-document spans, 83 cross-document anchors (to `/regulations/blm31x0`; no deep hash until the corpus id index holds the BLM rows)
- **Unresolved, by bucket:**
  - `cfr_not_in_corpus`: 42 distinct / 79 mentions — “part 3180” ×5, “part 251” ×5, “part 2800” ×5, “part 4” ×4, “part 2880” ×4, “part 51” ×4
  - `other_subpart`: 0 distinct / 0 mentions
  - `standard_not_in_corpus`: 60 distinct / 261 mentions — “API MPMS” ×40, “API 21.1” ×19, “API 14.3.2” ×18, “AGA Report” ×13, “API 14.3.3” ×9, “API 21.2” ×7
  - `statute`: 18 distinct / 25 mentions — “30 U.S.C. 1719” ×4, “5 U.S.C. 552” ×4, “25 U.S.C. 396” ×2, “30 U.S.C. 181” ×1, “30 U.S.C. 351” ×1, “30 U.S.C. 1701” ×1
  - `unparseable`: 0 distinct / 0 mentions
  - `unrecognised_section_sign`: 0 distinct / 0 mentions
- **Rows under 25 words:** 1,352 of 2,489 — by kind: item 1079, section 149, definition 104, part 10, heading 9, root 1
- **The three `apply` sanity checks** (`apply` against an empty DB export, plan only): Every parent_id referenced in the final state exists in the final state — **PASS**; No id in both delete and upsert sets — **PASS**; Every obsolete id resolved to a surviving ancestor — **PASS**
  (plan: 2489 new rows; SQL carries `federal` / `BLM` / the eCFR part URL)

## For PR 1b and PR 2 (not done here)

- **PR 1b:** the five subpart-nested appendices (37 images, 1 table) and
  the five part-level elements after Subpart 3171 (the Notice of Staking
  body, 244 words) are listed in `dropped`, not read. The 16 label
  anomalies in 3170 (§ 3175.93's roman lists directly under a letter,
  § 3175.102(e)(2)(vii)–(viii), § 3176.6/.8, the "(B) [Reserved]" in
  § 3172.12) keep their text in the open row; they do not get rows of
  their own.
- **PR 2 (front end):** the reader splits ids on "-" —
  `citationLabelFromId("sec-blm3160-3162.2-15")` reads "3162.2.15", and
  `subtreeLikePattern("sec-blm3160-3162.2")` (`sec-blm3160-3162.2-%`)
  matches its 15 sibling sections: the 29 `prefix_collisions` are exactly
  the ids that pattern over-matches. Also `FEDERAL_KEY`, display names,
  the federal page heading, the admin review list, `summarize.py` /
  `freshness.py` key lists and a `manifest.json` `sources` entry at import
  time.
- Cross-part links between 3160 and 3170 point at `/regulations/blm31x0`
  without a hash until the corpus id index (`dump-ids`) holds BLM rows;
  they deepen on the first parse after import with no code change.

## Not verified here

- `npm run build` compiles and type-checks, then stops prerendering
  `/states` and `/federal`, which read the database (no Supabase secrets in
  this container) — the same failure the 9 Oct record notes on an
  unmodified `main`; this PR changes nothing under `src/`. The Vercel
  preview on the pull request is the real build.
- `fetch-ecfr-part.yml` has run only through workflow_call on this branch;
  its workflow_dispatch form becomes reachable once it is on `main`.
