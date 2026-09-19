# Batch 4 summary review — APCD General Permits GP01–GP12, 40 CFR 60 Subparts JJJJ/IIII, 40 CFR 63 Subpart ZZZZ (September 19, 2026)

Second-pass review of every AI summary generated in the batch-4 Import runs (`summary_generated_at` 2026-09-19 16:00–17:30 UTC). Method as for batches 2–3: 22 Sonnet reviewer slices fetched their own rows read-only from Supabase, read the full text of every row, and flagged anything unsupported by the row's text (brief: `REVIEWER_BRIEF.md` items 1–11 and batch-4 items 17–20). Every flag was then verified by the CEO pass against the database text before any change.

## Result
| | |
|---|---|
| Summaries reviewed | 1,755 (gp01 64 · gp02 134 · gp03 20 · gp05 67 · gp06 98 · gp07 72 · gp08 73 · gp09 148 · gp10 150 · gp11 83 · gp12 298 · jjjj 134 · iiii 186 · zzzz 228) |
| Reviewer flags | 41 |
| Flags upheld and corrected | 21 |
| Truncated summaries completed (not flagged by reviewers; found by an end-of-text check) | 4 (`sec-zzzz-TABLE-2c`, `-2d`, `-6`, `-7` — `MAX_TOKENS = 400` cut them mid-sentence) |
| Flags overruled (summary accurate) | 20 |
| Approved unchanged | 1,730 |
| First-pass accuracy | 98.6% (25 of 1,755 changed) |

Corrected rows keep the original AI text in `summary_original`; `reviewed_by = 'Claude (AI second-pass review; summary corrected, per owner instruction 2026-09-19)'`. Approved rows: `reviewed_by = 'Claude (AI second-pass review, full text read, per owner instruction 2026-09-19)'`. Files: `01_corrections.sql`, `02_approvals.sql`, `03_verify.sql` (already applied).

## Decisions on reviewer flags
**Issuance dates (18 flags, overruled).** Reviewers flagged summaries that say "on or after July 23, 2025" (GP01/02/05/06/07/08 Issuance 4–6) or "May 28, 2026" (GP12 Issuance 1) where the row's text says only "the issuance date of Issuance N". The date is the permit's own issuance date, printed on its title page and carried in the root row's title, so the statement is correct and more useful to a reader than the bare reference. Left as written: `sec-gp01-I-A-1`, `sec-gp01-II-A-3`, `sec-gp01-II-C-2`, `sec-gp02-I-E-4`, `sec-gp02-I-E-5`, `sec-gp05-II-A-2`, `sec-gp05-II-C-2`, `sec-gp06-I-G`, `sec-gp07-II-A-2`, `sec-gp07-II-C-2`, `sec-gp08-I-G-4`, `sec-gp08-II-A-2`, `sec-gp08-II-D-2`, `sec-gp12-III-F-3`, `sec-gp12-IV-A-6-a`, `sec-gp12-IV-A-6-b`, `sec-gp12-IV-A-6-b-(i)`, `sec-gp12-IV-A-6-b-(ii)`.

**`sec-gp05-VIII-C-1` (overruled).** "Air Pollutant Emission Notice" is the Regulation 3 term for APEN; the permit's own "Air Pollution Emission Notice" wording elsewhere is a variant, not a contradiction.

**`sec-zzzz-63.6590-(b)-(2)` (overruled).** The summary labels §§ 63.6625(c), 63.6650(g) and 63.6655(c) as monitoring / notification-and-reporting / recordkeeping requirements. Those are the section titles within the same subpart; accurate, so left.

## Corrections applied (25)

| id | why |
|---|---|
| `sec-gp02-ATTACHMENT-A-5-4` | The summary attaches "(state-only requirement)" to the rich-burn NSCR/air-fuel-controller requirement, but the text's "(State-Only)" tag actually precedes and modifies the lean-burn oxidation-catalyst sentence, not the rich-burn sentence. |
| `sec-gp02-IV-C-1-a-(i)` | The summary adds "These records must be kept for five years," but neither this row's text nor its parent chapeau ("IV.C.1.a. Compliance Time Period") states a retention period. |
| `sec-gp02-IV-C-1-a-(ii)` | The summary adds "These records must be kept for five years," but neither this row's text nor its parent chapeau ("IV.C.1.a. Compliance Time Period") states a retention period. |
| `sec-gp02-IV-C-1-b` | The summary adds "Keep these calculation records for five years," but neither this row's text nor its parent chapeau ("Records that demonstrate compliance with the emission limits of this permit.") states a retention period. |
| `sec-gp05-II-B-2` | Summary adds the editorial rationale 'These limits keep the source below major-source thresholds,' which is not stated anywhere in the text. |
| `sec-gp06-IV-C-1-b-(ii)` | The summary adds 'These calculated emission records must be kept for five years,' but this row's text (the Eq. 2 fuel-consumption calculation methodology) and its parent_chapeau say nothing about a five-year retention period. |
| `sec-gp08-I-A-1` | Summary adds "at an oil and gas facility" to the definition of "Storage Tank," but neither the text nor the immediate chapeau ("I.A. Definitions") states that qualifier. |
| `sec-gp09-II-D` | The summary adds '(such as a flare or thermal oxidizer)' as examples of a combustion device, but the text of I.D. (the generic lead-in condition) does not name or describe any specific combustion device types. |
| `sec-gp09-IV-B-6` | The summary's added note 'GP09 itself covers attainment areas' is an unsupported generalization for this row and is inconsistent with I.D., which states GP09 also covers marginal or moderate nonattainment areas, not only attainment areas. |
| `sec-gp10-I-H` | The summary says the source-grouping citation is "permit Condition II.B.4" but the text places "Section II.B.4" under "Regulation Number 3, Part A" (this general permit has no Condition II.B.4 — its own Section II only runs through II.D), so the summary invents a self-referential cross-reference that isn't in the text. |
| `sec-gp11-III-A-2-b` | The summary defines lb/MMscf as "pounds-per-thousand-cubic-feet," but MMscf denotes million standard cubic feet, not thousand (the text gives the factor as "lb/MMscf" with no thousand-cubic-feet basis). |
| `sec-gp12-ATTACHMENT-A-4-2` | Summary says test results must be "kept on-site," but the text only requires results to be "maintained and made available to the Division upon request" and does not state a storage location. |
| `sec-gp12-V-K-3` | Adds the editorial rationale “a winter-season preference for planned venting to minimize ozone impacts during the warmer months”, which is not stated anywhere in the text. |
| `sec-gp12-VI-E-5` | States that the required inspection items are “listed in Regulation Number 3, Part B, Section III.E.”, but the text only cites that regulation as authority for the condition—the actual list of what visual inspections must include appears in the sub-provisions that follow (e.g., VI.E.5.a, .b, .d), not in Regulation Number 3. |
| `sec-gp12-VI-F-5` | The summary claims the sub-conditions of VI.F.5 'are found in' Regulation Number 3, Part B, Section III.E., but that citation is only the standard regulatory-authority citation appended to nearly every GP12 condition; the actual conditions are the following sub-paragraphs of this same permit (VI.F.5.a, b, d, e, f), not content located in Reg 3 Part B III.E. |
| `sec-iiii-60.4202-(a)-(1)-(i)` | The summary says "If you own or operate an emergency compression-ignition engine..." but this paragraph is nested under § 60.4202, which the parent_chapeau explicitly frames as a manufacturer certification duty ("Stationary CI internal combustion engine manufacturers must certify their 2007 model year and later emergency stationary CI ICE ... to the emission standards specified in paragraphs (a)(1) through (2)"), not an owner/operator obligation. |
| `sec-iiii-60.4202-(a)-(1)-(ii)` | The summary says "If you own or operate an emergency stationary compression-ignition engine..." but this paragraph is nested under § 60.4202, which per the parent_chapeau is a manufacturer certification duty ("Stationary CI internal combustion engine manufacturers must certify their 2007 model year and later emergency stationary CI ICE ... to the emission standards specified in paragraphs (a)(1) through (2)"), not an owner/operator obligation. |
| `sec-iiii-60.4205-(f)` | The summary expands "CI ICE" as "compression ignition reciprocating internal combustion engine (CI RICE)", but the text only uses "CI ICE" (internal combustion engine) and never introduces a "reciprocating" or "RICE" designation. |
| `sec-iiii-60.4215-(a)` | The summary invents a labeling of § 60.4205 as covering "non-emergency engines," but § 60.4216(c) establishes that §§ 60.4202 and 60.4205 together are the emergency-engine standards (contrasted with §§ 60.4201 and 60.4204 for non-emergency engines), so this reverses which standards 60.4205 actually sets. |
| `sec-jjjj-TABLE-4` | The summary says the table notes an exception in § 60.4247(c) for both 1048.205(n) AND 1048.240(b)(c)(d), but the table's explanation column shows that exception note only on the 1048.205(n) row — the 1048.240(b)(c)(d) row has no explanation text at all. |
| `sec-zzzz-63.6675` | The summary says Emergency stationary RICE must meet 'the limited-use requirements in § 63.6640(f)', but the text does not call § 63.6640(f) a 'limited-use' requirement — that language wrongly borrows the wording of the separate, distinct defined term 'Limited use stationary RICE' (an engine that operates less than 100 hours per year), which is a different concept defined elsewhere in the same section. |
| `sec-zzzz-TABLE-2c` | Summary truncated mid-sentence at the 400-token output cap; completed from the table text. |
| `sec-zzzz-TABLE-2d` | Summary truncated mid-sentence at the 400-token output cap; completed from the table text. |
| `sec-zzzz-TABLE-6` | Summary truncated mid-sentence at the 400-token output cap; completed from the table text. |
| `sec-zzzz-TABLE-7` | Summary truncated mid-sentence at the 400-token output cap; completed from the table text. |

## Systematic findings → pipeline changes (delivered with this doc)
- `pipeline/summarize.py`: `MAX_TOKENS` 400 → 700 (four wide ZZZZ tables were cut off; everything else finished well under 400).
- `_GP_HINT` now says: never add a retention period / notice period / deadline the row's text does not state even if another condition sets one (GP02 IV.C.1.a–b and GP06 IV.C.1.b.(ii) all gained an invented "five years"); when a row only cites a regulation or condition, say it cites it rather than describing it (GP12 VI.E.5 / VI.F.5, GP10 I.H); no rationale or examples. Hint stays under the 190-word test cap (188).
- IIII: two rows under § 60.4202 were summarized as owner/operator duties although the section is the manufacturer certification duty; the parent chapeau carried that scope, so no hint change — noted for the next federal batch reviewers (check who the subject is when the chapeau names it).

## Follow-ups
- Re-run Embed provisions for gp02, gp05, gp06, gp08, gp09, gp10, gp11, gp12, jjjj, iiii, zzzz then neighbors_only (pennies).
- `sec-gp02-II-A-2` is reviewed (approved unchanged) → make public for `/sample` (`docs/site/sample_rows_2026-09-19.sql` updated).
