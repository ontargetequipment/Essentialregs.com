# Reg 7 summary review — September 14, 2026

Second-pass AI review of the 840 pending Reg 7 plain-English summaries, each checked against the regulation text stored in the database. Eight reviewers, ~105 provisions each.

## Result

| Outcome | Count | Action taken |
|---|---|---|
| Summary accurate, regulation text intact | **286** | **Approved** in the database (reviewed_by = "Claude (AI second-pass review, per owner instruction 2026-09-14)") |
| Summary accurate, but the stored regulation text is missing its opening line | 458 | **Held** — see "Data defect" below |
| Summary wrong (contradicts or invents something) | **56** | **Held for you** — list below |
| Summary makes a claim the stored text can't confirm | 40 | Held — list at the end |

## Data defect found during review — this matters more than the summaries

Roughly 500+ Reg 7 provisions in the database are **missing the first line of their text**. Example, `I.J.1.a.` (sec-7-B-I-J-1-a) starts with "uncontrolled actual volatile organic compound emissions…" — the real provision begins "(State Only) Beginning January 1, 2018, or May 1, 2023 for northern Weld County, owners or operators of…". Other examples start with fragments like "monitored." or "the operations and proximal populations." The importer appears to have dropped whatever text shared a line with the citation number.

Consequences: (1) customers reading `/regulations/7` see incomplete regulatory text; (2) the AI summaries for those rows either omit the opening clause's dates/applicability, or — worse — fill them in from the model's general knowledge of Reg 7, which is plausible but unverifiable (that's most of the 40 "unsure" items). Fix: re-import Reg 7 from the original source with the first-line bug corrected, then regenerate summaries for affected rows (~$2). Until then, the 458 held rows should not be stamped "reviewed." Reg 3 and Reg 26 show only a handful of the same symptom; OOOOb shows about half.

## The 56 flagged summaries (need your judgment)

**A. "MFCE" misdefined — 10 rows.** The summaries expand MFCE as "major facilities and covered equipment" / "major fugitive and combustion equipment" / similar. The regulation defines it as *midstream fuel combustion equipment*. Two of these also invent a "by January 1, 2029" deadline.
VII.F.1.a · VII.F.1.a.(i) · VII.F.2.a · VII.F.2.b · VII.F.2.b.(i) · VII.F.2.b.(ii) · VII.F.2.c · VII.F.5.c · VII.F.6.d.(i) · VII.G.2.j

**B. Invented "through 2026" end date — 4 rows.** The text says the annual submission continues "thereafter"; the summaries say it stops in 2026.
VI.E.4 · VI.E.4.a.(v) · VI.E.4.a.(vii) · VI.E.4.b.(i)

**C. "Northern Weld County" wrongly added — 5 rows.** Applicability in the text is by I.A.3./I.A.4. (8-Hour Ozone Control Area) or statewide; the summaries add a Weld County qualifier that isn't there.
I.D.3.b.(x) · I.D.3.b.(xi) · I.D.3.b.(xii) · I.D.3.b.(xiii) · II.H.4.b

**D. Wrong number or date — 12 rows.**
- I.L.7.e — says report due December 31; parent I.L.7. sets May 31.
- II.B.2.g.(i) — "within 45 days": the "45" is a page number that leaked into the text, not a day count.
- VI.A.16 — "between 45,000 and 50,000 kBOE"; text says greater than 45 kBOE (thousand-fold error).
- VIII.A.23 and VIII.B.7.a — majority operator stated as 50,000 BOE (and "per day"); regulation uses 10,000 kBOE/year.
- Part C, CC — NOx goal "50% by 2030"; text says 50% by 2050.
- Part C, XVII — state threshold given as 6 tpy; text shows the uncontrolled-equivalent is 120 tpy.
- Part C, XII — "lowered from 6 tpy to 2 tpy"; no 6 tpy figure exists in the text.
- VI.C.1.a — invents "at least 10 days before" pre-production monitoring.
- VI.C.2.c — invents a "Starting May 1, 2025" trigger.
- VI.C.2.b.(iii).(G) — conflates the monitoring-plan date with the monthly-report date.
- III.E.1.b.(i) — invents compile-by deadlines (Jan 1, 2019 / Jan 1, 2024).
- V.B.1.i — adds a June 2022 report year the text doesn't include.

**E. Wrong agency or term — 3 rows.**
- II.E.7.b.(i) — tells the operator to notify COGCC; "the Division" in Reg 7 is CDPHE's Air Pollution Control Division.
- III.C.4.g.(viii) and Part C XVII.F — AIMM expanded as "Advanced Inspection and Maintenance Monitoring" / "for Minor Sources"; it means *approved instrument monitoring method*.

**F. Wrong scope / who it applies to — 15 rows.**
- I.M — says requirements are in I.A.4; they're in I.M's own subsections.
- II.C.1.b.(ii).(B) — says the pollution-control device can be removed; text allows removing *monitoring equipment*.
- II.G.3.a.(vi) — attributes the full pollutant list to one sub-item that covers only CO, ethane, methane.
- II.H.2.c.(iv) — adds "began operations on or after Jan 1, 2024"; parent covers stations that commenced *before* Feb 14, 2022.
- III.C.4.d.(vi).(A).(2) — says "inactive" stations; text is a certification for active, operating stations.
- III.C.4.f.(iv) — broadens a compressor-station plan to well production facilities.
- III.C.5.c.(v).(B) — narrows a general recordkeeping clause to self-contained controllers only.
- III.C.5.c.(vi).(A).(1) — labels the report as self-contained-controllers only; it also covers closed-vent routing.
- III.F.2.a — calls it a one-time inspection; sub-items set recurring frequencies.
- III.F.2.b.(i) — says 8-Hour Ozone Control Area; siblings say anywhere in Colorado.
- V.D.1.a.(iv) and V.D.1.b — turn a *Division* reporting duty into a Commission/operator obligation.
- VI.C.2.b.(xi) — limits certification to the "final" monthly report; text doesn't.
- VI.E.1.e — says statewide; parent VI.E.1 limits to the ozone control area / northern Weld County, May–Sept.
- VII.G.2.l — invents example causes (malfunction, startup/shutdown); the referenced purposes are about unreliable utility power.

**G. Invented cross-references or "state-only" claims — 4 rows.**
- I.F.1.d and III.C.5.a.(ii).(A) — assert "state-only requirement"; no such designation in the text.
- III.C.4.c.(i) and III.C.4.c.(ii) — cite an exception in III.C.4.c.(iv) that the text doesn't mention.

**H. Summary describes the wrong provision entirely — 2 rows.**
- Part C, II.B.2.h.(ii) (sec-7-C-II-B-2-h-(ii)) — summary is about separator capture/COGCC venting; text is about combustion-device performance testing.
- Part C, I.D.5.g.(iii) (sec-7-C-I-D-5-g-(iii)) — summary is about GHG-intensity verification; text is about DI-community commitments and typographical corrections.

**Recommended handling:** groups A, B and C are systematic, so rather than hand-editing 19 rows, fix the generation prompt (tell it MFCE = midstream fuel combustion equipment; never add dates, thresholds, or geographic qualifiers not present in the text; define acronyms only as the text defines them) and regenerate just these 56 with `--force`. Groups D–H can be regenerated the same way, then re-reviewed. Total cost well under $1.

## The 40 "unsure" summaries

Each states a date, number, or detail that does not appear in the stored text — in most cases because the stored text is missing its opening line (see the data defect). They may well be correct, but they can't be verified until the text is fixed.

I.E.2.c.(viii) · I.E.2.c.(ix) · I.F.3.b · I.H.5.a · I.J.1.a · II.B.1.b · II.B.2.j.(i) · II.B.2.j.(iii) · II.B.2.j.(v) · II.C.2.a.(i).(B) · II.C.2.b.(ii).(G) (garbled table) · II.E.3.e (garbled table) · II.G.2.c.(iii) · III.F.2.g.(ii) · III.F.3.a · III.F.3.b · IV.B.3 · V.B.1.c.(i) · VI.A.5.b · VI.A.10.a · VI.C.1.b.(iii) · VI.C.1.b.(ix).(B) · VI.C.1.b.(ix).(D) · VI.C.1.b.(xii) · VI.C.2.a.(v) · VI.C.2.b.(vi) · VI.E.3.d · VII.A.7.a · VIII.C.2 · VIII.C.3 · VIII.C.4 · VIII.E.2.a · VIII.E.2.b · VIII.E.2.c · Part C: M · XVII.F.7 · XVI · V.D · DI · VII.A.8

## One honesty note for the reader page

Approved rows show subscribers "AI-generated · reviewed Sep 14, 2026". For the 286 approved today, the reviewer was an AI second pass, not a person. Recommend the Code session change the label to distinguish "checked by a second AI review" from "reviewed by [a person]" so customers aren't misled — it's a small change in `summaryPanelHtml()` keyed on `reviewed_by`.

---

## Status update from the CEO session (Sep 14 2026)

- **Task 2 (prompt fix + regenerate the 56):** done. `SYSTEM_PROMPT` in `pipeline/summarize.py` now defines MFCE/AIMM explicitly, forbids inventing any date/number/threshold/geographic qualifier not in the given text, and tells the model to say plainly when a provision's opening clause isn't shown rather than guess. Added a `--ids` flag (and matching workflow input) to target an exact list of provision ids without reprocessing a whole regulation. All 56 flagged ids above were regenerated with the new prompt.
- **Task 3 (reader label):** done, per Brody's explicit decision — the honesty-note recommendation above (distinguish AI-second-pass from human review in the label) was superseded: the panel no longer says anything about who/what reviewed a summary or when at all, replaced with a "View official source" link. This resolves the same underlying concern without needing to track reviewer type in the copy.
- **Task 1 (fix the truncated-text importer, re-import):** not yet started — no import script or original source file (reader HTML / CCR PDF) exists in the repo; waiting on Brody for its location.
