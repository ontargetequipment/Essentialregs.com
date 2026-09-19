# Batch 3 summary review record — Common Provisions, Reg 9, Reg 24, Reg 30 (2026-09-19)

Second-pass review of every AI summary generated 2026-09-18 23:35–23:54 UTC (683 rows: cp 127, 9 119, 24 199, 30 238). Nine Sonnet reviewer agents, one ~60–100-row slice each, full provision text read, graded against `REVIEWER_BRIEF.md` items 1–11 and the batch-3 additions 17–21. CEO (Claude) verified every flag against the provision text in the database before applying.

## Result

| Reg | Summaries | PASS | Corrected | Accuracy |
|---|---|---|---|---|
| cp | 127 | 127 | 0 | 100.0% |
| 9 | 119 | 116 | 3 | 97.5% |
| 24 | 199 | 194 | 5 | 97.5% |
| 30 | 238 | 230 | 8 | 96.6% |
| **Total** | 683 | 667 | 16 | 97.7% |

All 683 rows now `summary_status='approved'`; corrected rows keep the original in `summary_original`. Verify query result: cp 127/127/0, 9 119/119/3, 24 199/199/5, 30 238/238/8 (summaries/approved/corrected), 0 still pending.

## Failure modes seen (feed back into REG_PROMPT_HINTS if they recur)

- Reg 24: dropping one item from a list of cross-referenced regulations ("Regulation Number 7, 24, 25, and 26" → three of four) — 3 rows; inventing the other branch of a "whichever is later" date — 1 row; adding "statewide" — 1 row.
- Reg 30: describing what cross-referenced Sections III.B.1.a/1.b cover (invented thermal spray, anodizing, chromate conversion) instead of citing them — 5 rows; CO limit called a formaldehyde limit — 1; truncated CFR section range — 1; PTAC list invented from memory in a statement of basis — 1.
- Reg 9: acronym expansions (ACD = Air Curtain Destructor, SMP = Smoke Management Program) — 2 rows; an editorial parenthetical contradicting the reg's own definition of unplanned ignition fire — 1.
- Common Provisions: no flags in 127 rows.

## Corrections applied


### sec-24-A-I-B-1-b-(ii)
**Reason:** The summary invents the content of the unshown alternative compliance date, stating the source must comply "by February 1, 2009, or by the date it commenced construction (whichever is later)" — the text only gives the February 1, 2009 date for this branch and never says the other branch of the "whichever date comes later" comparison is the construction-commencement date.

**Corrected summary:** (State Only) For a new source located in an 8-Hour Ozone Control Area but outside the 1-hour ozone nonattainment or attainment maintenance area, the compliance date under this paragraph is February 1, 2009, subject to the parent paragraph's rule that whichever applicable date comes later governs.

### sec-24-A-II-C-1-a-(v)
**Reason:** The summary says modified existing sources must use RACT "under Regulations 24, 25, 26," but the text lists four regulations — "Regulation Number 7, Number 24, Number 25, and Number 26" — and the summary drops Regulation Number 7 from the list.

**Corrected summary:** (State Only) If an existing source undergoes a physical change or a change in its method of operation that increases VOC or NOx emissions on or after March 30, 2008, it must use RACT control technologies under Regulation Number 7, Number 24, Number 25, and Number 26, and Regulation Number 3, Part B, Section III.D.2., when it starts operating again.

### sec-24-A-II-C-1-d
**Reason:** The summary says existing sources must use RACT "under Regulation Number 24, Number 25, Number 26," omitting Regulation Number 7, which the text explicitly lists ("pursuant to Regulation Number 7, Number 24, Number 25, and Number 26").

**Corrected summary:** (State Only) Existing sources in the 1-hour ozone nonattainment or attainment maintenance area or the 8-Hour Ozone Control Area must use RACT under Regulation Number 7, Number 24, Number 25, and Number 26, and Regulation Number 3, Part B, Section III.D.2., by whichever date comes later. The specific dates are not shown in the available text.

### sec-24-A-II-C-2
**Reason:** The summary says new sources must use RACT "as defined in Regulations 24, 25, 26," but the text says controls must represent RACT "pursuant to Regulation Number 7, Number 24, Number 25, and Number 26" — Regulation Number 7 is dropped from the summary's list.

**Corrected summary:** This applies to all new sources covered by Regulation 24. It requires that when a new source starts operating, it must use controls representing RACT pursuant to Regulation Number 7, Number 24, Number 25, and Number 26, and Regulation Number 3, Part B, Section III.D.

### sec-24-B-V-C
**Reason:** The summary adds "This applies statewide in Colorado" — a scope claim not stated anywhere in the text or the parent chapeau ("V. Crude Oil"), which says only that crude oil in tanks over 151,412 liters is subject to Sections IV.B.1.b. and IV.B.2. except for the V.A.2. exemption.

**Corrected summary:** Crude oil stored in tanks larger than 151,412 liters (40,000 gallons) must comply with Sections IV.B.1.b. and IV.B.2., except for the exemption in Section V.A.2.

### sec-30-B-III-B-4-b-(i)
**Reason:** The summary invents "hexavalent chromium electroplating or thermal spray operations" to describe the cross-referenced Sections III.B.1.a/1.b, but those sections (per the corpus) actually describe "decorative chromium electroplating" and "functional chromium plating operations" — 'thermal spray' is not part of either and is not mentioned anywhere in this text.

**Corrected summary:** Beginning June 14, 2026 (or when operations start if later), owners or operators of stationary sources with the hexavalent-chromium-emitting operations described in Section III.B.1.a or III.B.1.b must store chromic acid powder, flakes, or other substances that may contain hexavalent chromium in a closed container inside an enclosed storage area.

### sec-30-B-III-B-4-b-(iii)
**Reason:** The summary invents a specific description — "hard chromium electroplating, decorative chromium electroplating, or chromium anodizing" — for the cross-referenced Sections III.B.1.a/1.b, which the row's own text only cites by number and does not describe.

**Corrected summary:** Beginning June 14, 2026 (or when operations start if later), owners or operators of stationary sources with the hexavalent-chromium-emitting operations described in Section III.B.1.a or III.B.1.b must clean up or contain within one hour any spilled liquid or solid material that may contain hexavalent chromium, using one or more of the methods listed in Sections III.B.4.b.(iv)(A) through (E).

### sec-30-B-III-B-4-b-(iv)
**Reason:** The summary adds "thermal-spray operations" to describe who is covered by Sections III.B.1.a/1.b, a category not supported anywhere in the text (the text itself only mentions chrome plating/anodizing tank process areas).

**Corrected summary:** Beginning June 14, 2026 (or when operations start if later), owners or operators of stationary sources with the hexavalent-chromium-emitting operations described in Section III.B.1.a or III.B.1.b must clean surfaces in the enclosed storage area, floors and other surfaces in the chrome plating or anodizing tank(s) process area, and any other surface potentially contaminated with hexavalent chromium at least once every seven days using one or more of the specified methods. Floors within a 20-foot radius of any buffing, grinding, or polishing workstation must also be cleaned at the end of each day those activities are conducted, using one or more of the specified methods.

### sec-30-B-III-B-4-b-(v)
**Reason:** The summary invents "chromate conversion coating operations" as part of the scope of Sections III.B.1.a/1.b, a process not mentioned anywhere in the text or in the definitions for this Part.

**Corrected summary:** Beginning June 14, 2026 (or when operations start if later), owners or operators of stationary sources with the hexavalent-chromium-emitting operations described in Section III.B.1.a or III.B.1.b must minimize the amount of hexavalent-chromium-containing fluid that clings to parts when they are removed from the tank, by following the best management practices set out below.

### sec-30-B-III-B-4-b-(vii)
**Reason:** The summary invents "hexavalent chromium electroplating, anodizing, or chromic acid anodizing operations" to describe who Sections III.B.1.a/1.b cover, which the row's text does not state (1.a is decorative chromium electroplating and 1.b is functional chromium plating, per the corpus — not anodizing).

**Corrected summary:** Beginning June 14, 2026 (or when operations start if later), owners or operators of stationary sources with the hexavalent-chromium-emitting operations described in Section III.B.1.a or III.B.1.b must store, dispose of, recover, or recycle chromium or chromium-containing wastes using practices that do not create fugitive emissions. Containers holding chromium-containing waste must stay closed except when being filled or emptied, and must be stored in an enclosed storage area.

### sec-30-B-III-D-2-c-(ii)-(A)
**Reason:** The summary's final sentence is truncated and misstates the citation, reading '...operating limitations and compliance provisions in 40 CFR Part 63, Subpart ZZZZ, Sections 63.6600 through 63.660.' instead of the correct range '63.6600 through 63.6603, 63.6635, and 63.6640' given in the parent chapeau.

**Corrected summary:** This applies to spark ignition stationary reciprocating internal combustion engines that start construction or reconstruction on or after September 1, 2026, at a stationary source described in Section III.D.1.a. or at a stationary source described in Section III.D.1.c.(iv)(B) that also meets the criteria in either Section III.D.1.c.(i) or III.D.1.c.(ii). If the engine is 100 horsepower or greater, the parent paragraph requires it to meet a carbon monoxide emission limit of 0.40 grams per horsepower-hour (except as provided in Table 1 or Section III.D.2.c.(iii)) and to comply with the operating limitations and compliance provisions in 40 CFR Part 63, Subpart ZZZZ, Sections 63.6600 through 63.6603, 63.6635, and 63.6640, or the corresponding provisions of 40 CFR Part 60, Subpart JJJJ.

### sec-30-B-III-D-2-e-(ii)-(A)
**Reason:** The summary calls the 0.4 g/hp-hr limit in Section III.D.2.c.(ii) a 'formaldehyde limit', but the referenced text of Section III.D.2.c.(ii) defines that 0.40 g/hp-hr figure as a carbon monoxide emission limit, not a formaldehyde limit (the summary even contradicts itself by then describing a 'performance test for carbon monoxide').

**Corrected summary:** The owner or operator of an engine subject to the 0.4 g/hp-hr carbon monoxide emission limit in Section III.D.2.c.(ii) must conduct an initial performance test for carbon monoxide within 180 days after startup, using the reference test methods in 40 CFR Part 60, Appendix A (July 1, 2019). The test must follow a protocol submitted to the Division for review at least 30 days before testing and must comply with AQCC Common Provisions Regulation Section II.C.

### sec-30-C-II
**Reason:** The summary states the September 19, 2025 chronic health-protective benchmarks were adopted for "benzene, 1,3-butadiene, ethylene oxide, formaldehyde, and naphthalene," but neither 1,3-butadiene nor naphthalene appears anywhere in the text (or in Appendix A/Section I of Regulation 30), and the actual five PTACs are benzene, hexavalent chromium, ethylene oxide, formaldehyde, and hydrogen sulfide.

**Corrected summary:** This is the Statement of Basis for the Commission's September 19, 2025 adoption of proposed chronic health-protective benchmarks for the five previously identified priority toxic air contaminants, as required by HB22-1244 (Section 25-7-109.5, C.R.S.) for General Assembly approval by April 30, 2026. The Commission calculated the benchmarks using the best available peer-reviewed toxicity values (generally following a 2004 CDPHE policy hierarchy, with one exception for benzene's non-cancer value) and selected risk levels of 1 excess cancer case per 1 million people and a non-cancer hazard quotient of 1.0. The Commission states the benchmarks meet the statutory definition of health-based standards but did not define how they will be used; before the Division can use them to trigger a regulatory or economic impact, the Commission must adopt an enabling regulation. The statement also explains that the benchmarks are not ambient air quality standards like the federal NAAQS, and that multi-pollutant exposure impacts are not captured in these single-pollutant benchmarks.

### sec-9-IV-C-4-d-ii
**Reason:** The summary expands "ACD" as "air contaminant discharge (ACD) permit," but the regulation defines ACD as "Air Curtain Destructor" (Section II.B), and the text's "co-located with another ACD" refers to another Air Curtain Destructor device, not an "air contaminant discharge" permit.

**Corrected summary:** An air curtain destructor (ACD) permit may prohibit the device from being co-located with another air curtain destructor, with any other facility required to have an air quality permit, or with any commercial or industrial facility.

### sec-9-V-B
**Reason:** The summary adds the invented parenthetical "(A prescribed fire is a fire you plan and ignite on purpose, not an accidental or unplanned fire.)", which is not stated in this provision's text and contradicts the regulation's own definitions, since Section II.W defines "Unplanned Ignition Fire" as a type of prescribed fire ignited by natural phenomena or military munitions.

**Corrected summary:** Any person who wants to conduct a prescribed fire that may emit smoke above the low-smoke-impact de minimis threshold listed in Appendix A must apply for and may receive a planned ignition fire permit under the conditions set forth in Section V.

### sec-9-VIII-C-1
**Reason:** Summary glosses SMP as "(Significant User of Prescribed Fire)" but the text's own Appendix C and IX-N sections establish SMP means "Smoke Management Program," so the summary invents a wrong acronym expansion.

**Corrected summary:** The Division does not charge a flat fee when someone applies for a planned ignition fire permit through an Authorized Local Agency rather than directly to the Division. Permitting activity and actual burning activity under those permits also do not count toward the applicant's SMP score under Appendix C's "Distribution of Cost" section.

## Follow-ups

- The 16 corrected rows were embedded with their pre-correction summaries; re-run **Embed provisions** for regs 9, 24, 30 (content-hash gating re-embeds only those rows) and then a neighbors_only pass.
- Reviewer edits by CEO: `sec-30-C-II` corrected summary no longer lists the five PTACs by name (the row's text names only benzene); `sec-24-A-I-B-1-b-(ii)` reworded for clarity.