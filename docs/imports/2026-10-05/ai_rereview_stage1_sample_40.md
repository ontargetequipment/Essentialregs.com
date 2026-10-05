# Re-review of hand-approved summaries, stage 1 (general permits, Regulations 3 and 7), 5 Oct 2026: 40-row spot-check sample

Drawn at random (seeded, `order by md5(id || '20261005')`) from the 3,049 hand-approved summaries the automated re-review (`pipeline/review.py --rereview`, claude-sonnet-5-5, effort low, prompt version 9ace8f1496, system prompt cached 1h) processed on 5 Oct 2026 across the eleven general permits and Regulations 3 and 7: 20 the reviewer passed and 20 it corrected. Workflow run: https://github.com/ontargetequipment/Essentialregs.com/actions/runs/37264432082 (1,789 pass, 1,247 corrected, 13 set back to pending; $6.5953; 81.0% of input tokens were cache reads). "Before" is the summary as it stood before the run (`archive.summary_review_snapshot_rereview`); "after" is the live summary; for a corrected row the reviewer's one-line reasons (from `provision_changes.note`) follow. The official text is the provision followed by every descendant in reading order, each prefixed with its id, tag-stripped, first 1,200 characters. For the Cowork spot-check: check each "after" against the text; for a pass, before and after are the same. The 13 rows set back to pending are listed at the end.

## 1. `sec-gp12-VII-C-1` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp12-VII-C-1]   When using a volumetric processes as allowed by the by the Annual Process Limitations section of this general permit: Within one hundred and eighty days (180) after commencement of operation under this general permit, and periodically following the schedule in Table 5 - Sampling frequency, the owner or operator must complete an site specific extended gas analysis [sic] ("Analysis"), of the gas vented during these activities in order to verify the VOC (weight fraction) of this emission stream. The gas sample must be obtained either from a gas line with VOC and HAPs contents that are representative of the gas vented during blowdown events or directly from the equipment blowdown line. Results of the Analysis must be used to calculate site-specific emission factors for VOC, benzene, toluene, ethylbenzene, xylenes, n-hexane, and 2,2,4-trimethylpentane (in units of lb/MMSCF gas vented) using Division approved methods. For the pollutants identified in this permit condition as needing sampling, if any site-specific emission factors developed through this analysis are greater than the emissions factors listed in the general permit registration approval letter, or if an 

**Summary before:**

When you use volumetric processes allowed under the permit's Annual Process Limitations, you must complete a site-specific extended gas analysis of the gas vented during those activities within 180 days of starting operation under GP12, then periodically per the schedule in Table 5. The analysis must verify the VOC weight fraction and be used to calculate site-specific emission factors (in lb/MMSCF) for VOC, benzene, toluene, ethylbenzene, xylenes, n-hexane, and 2,2,4-trimethylpentane using Division-approved methods. If any site-specific emission factor exceeds the factor in your registration approval letter (or the APEN if no letter was issued), you must use the new factor to calculate actual emissions and demonstrate compliance starting the calendar month after the sampling event. You must report initial and periodic emission factors per Regulation Number 7, Part B, Section V, and keep sampling records for at least five years for Division inspection.

**Summary after (live):** unchanged

## 2. `sec-7-B-I-H-3-b` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-I-H-3-b]   The sum of actual uncontrolled emissions of volatile organic compounds from any single glycol natural gas dehydrator or grouping of glycol natural gas dehydrators at a single stationary source is equal to or greater than 15 tons per year. To determine if a grouping of dehydrators meets or exceeds the 15 tons per year threshold, sum the total actual uncontrolled emissions of volatile organic compounds from all individual dehydrators at the stationary source, including those with emissions less than one ton per year. 

**Summary before:**

This provision applies to operators of glycol natural gas dehydrators at oil and gas stationary sources in Colorado. It establishes that the control requirements in Sections I.H.1. and I.H.2. are triggered when the sum of actual uncontrolled VOC emissions from any single dehydrator or grouping of dehydrators at a single stationary source equals or exceeds 15 tons per year. When determining if a grouping meets this threshold, operators must sum the total actual uncontrolled VOC emissions from all individual dehydrators at the stationary source, including those emitting less than one ton per year.

**Summary after (live):** unchanged

## 3. `sec-gp10-VI-A-1` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp10-VI-A-1]   The owner or operator must calculate actual emissions of criteria and hazardous air pollutants from all APEN reportable sources each month and keep a compliance record on site or at a local field office with site responsibility for Division review. For criteria and hazardous air pollutants, the owner or operator must maintain records on a rolling twelve (12) month total basis. By the end of each month a new twelve month total is calculated and recorded based on the previous twelve months’ data. 

**Summary before:**

The permit requires the owner or operator to calculate actual emissions of criteria and hazardous air pollutants from all APEN reportable sources every month and keep a compliance record on site or at a local field office for Division review. For criteria and hazardous air pollutants, records must be maintained on a rolling twelve-month total basis, with a new twelve-month total calculated and recorded by the end of each month based on the previous twelve months' data.

**Summary after (live):** unchanged

## 4. `sec-7-C-DD` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-C-DD]   December 20, 2024 (Revisions to Part A , Section I.A. and Part B , Sections III.C.4. , V.C , and VII. ) This Statement of Basis, Specific Statutory Authority, and Purpose complies with the requirements of the State Administrative Procedure Act, § 24-4-103(4), C.R.S., the Colorado Air Pollution Prevention and Control Act, §§ 25-7-110 and 25-7-110.5., C.R.S., and the Air Quality Control Commission’s (Commission) Procedural Rules, 5 Code Colo. Reg. §1001-1 . Basis In 2021, the Commission adopted requirements for upstream and midstream segment oil and gas operations, to reduce greenhouse gas (GHG) emissions from those operations to achieve the GHG reduction requirements of House Bill 21-1266 (HB 21- 1266). Specifically for the midstream segment, the Commission adopted requirements for owners or operators to submit fuel combustion equipment company emission reduction plans to a midstream steering committee by July 31, 2022; for the midstream steering committee to develop recommendations for a midstream segment emission reduction plan (SERP) and submit the recommendations to the Division by March 31, 2024; and for the Division to submit a regulatory proposal to the Commiss

**Summary before:**

This is a purely administrative provision that sets forth the legal basis, statutory authority, and purpose for December 2024 revisions to Regulation 7. It explains that the revisions establish a midstream segment emission reduction program to achieve a 20% reduction in CO₂e from 2015 baseline levels by 2030 as required by HB 21-1266, and adopt ozone State Implementation Plan (SIP) contingency measures in response to EPA's November 2023 disapproval. The provision details the Commission's rationale for adopting company-wide emission caps (rather than facility-level caps), a greenhouse gas credit trading system beginning with 2027 emissions, restrictions on credit trading for larger companies operating in nine Front Range counties until they achieve specified onsite reductions (particularly in disproportionately impacted communities), and incorporation of crankcase venting from natural gas engines over 130 horsepower into emission inventories and annual reporting requirements under Part B, Section V starting with reporting year 2025. It also includes the Commission's findings under §§ 25-7-110.5(5)(b) and 25-7-110.8, C.R.S., justifying why the rules exceed federal requirements and are cost-effective.

**Summary after (live):** unchanged

## 5. `sec-gp12-ATTACHMENT-A-6-3` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp12-ATTACHMENT-A-6-3]   The APEN must be accompanied by the appropriate APEN filing fee, a cover letter explaining that the owner or operator is exercising an alternative operating scenario and is installing a permanent replacement engine, and a copy of the relevant Applicability Reports for the replacement engine. Applicability Reports can be found at Divisions’ alternate operating scenarios webpage. This submittal must be accompanied by a certification from the person legally authorized to act on behalf of the owner or operator indicating that “based on the information and belief formed after reasonable inquiry, the statements and information included in the submittal are true, accurate and complete”. 

**Summary before:**

The permit requires that when you install a permanent replacement engine under this AOS, you must submit an APEN with the correct filing fee, a cover letter stating you are exercising an alternative operating scenario and installing a permanent replacement engine, and a copy of the relevant Applicability Reports for the replacement engine (available on the Division's AOS webpage). A person legally authorized to act on behalf of the owner or operator must certify that, based on information and belief formed after reasonable inquiry, the statements and information in the submittal are true, accurate, and complete.

**Summary after (live):** unchanged

## 6. `sec-3-D-V-A-7-c-(ii)` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-D-V-A-7-c-(ii)]   If the emissions unit is an existing electric utility steam generating unit, before beginning actual construction, the owner or operator shall provide a copy of the information set out in Section V.A.7.c.(i) to the Division. Nothing in this Section V.A.7.c.(ii) shall be construed to require the owner or operator of such a unit to obtain any determination from the Division before beginning actual construction. 

**Summary before:**

This applies to existing electric utility steam generating units at a major stationary source when the owner or operator is using a specific calculation method for projected actual emissions and the project is not part of a major modification. Before starting actual construction, the owner or operator must give the Division a copy of the information described in Section V.A.7.c.(i), but the owner or operator does not need to wait for any determination or approval from the Division before beginning construction.

**Summary after (live):** unchanged

## 7. `sec-3-D-IV-A-2-d` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-D-IV-A-2-d]   That any interested person may submit a written request for a public comment hearing to be held pursuant to Section VII. of the Commission's Procedural Rules to receive comments regarding the foregoing concerns, the sufficiency of the preliminary analysis, and whether the Division should approve or deny the permit application; and 

**Summary before:**

If you want a public hearing on a Part D permit application, you can submit a written request under Section VII of the Commission's Procedural Rules; the notice must tell people they have this right and that the hearing would cover comments on the analysis, the concerns raised, and whether the Division should approve or deny the permit.

**Summary after (live):** unchanged

## 8. `sec-3-A-V-A` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-A-V-A]   Purpose This section establishes principles and procedures for the certification of emissions reductions into the Division’s registry and for their subsequent use as emission offsets to meet the requirements of Section V.A.3. of Part D of this regulation. 

**Summary before:**

This section sets up the rules for how emission reductions get certified and entered into the Division's registry, and how those certified reductions can later be used as offsets to satisfy offset requirements found in Section V.A.3. of Part D of this regulation.

**Summary after (live):** unchanged

## 9. `sec-gp07-VII-A-3` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp07-VII-A-3]   Complying with well production facility monitoring pursuant to Section III.J.4. of Part B. Owners or operators must comply with the monitoring methodology selected on the general permit registration form. 

**Summary before:**

The permit requires owners or operators of new or modified sources in Disproportionately Impacted Communities to comply with the well production facility monitoring requirements in Regulation Number 3, Part B, Section III.J.4., using the monitoring methodology they selected on their general permit registration form.

**Summary after (live):** unchanged

## 10. `sec-7-B-II-H-2-b-(iv)` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-II-H-2-b-(iv)]   Beginning April 14, 2025, disproportionately impacted community is defined as in Section II.A.11.b. The owner or operator must assess by December 31, 2025, whether the pigging station is located within a disproportionately impacted community to determine the capture and recovery or control requirements for the calendar year beginning in 2026. 

**Summary before:**

This provision applies to owners or operators of standalone pigging stations. Beginning April 14, 2025, they must use the definition of "disproportionately impacted community" found in Section II.A.11.b., and by December 31, 2025, they must assess whether their pigging station is located within such a community to determine applicable capture, recovery, or control requirements for calendar year 2026.

**Summary after (live):** unchanged

## 11. `sec-3-D-II-A-14` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-D-II-A-14]   Electric Utility Steam Generating Unit Any steam electric generating unit that is constructed for the purpose of supplying more than one-third of its potential electrical output capacity and more than twenty-five megawatts electrical output to any utility power distribution system for sale. Any steam supplied to a steam distribution system for the purpose of providing steam to a steam-electric generator that would produce electrical energy for sale is also considered in determining the electrical energy output capacity of the affected facility. 

**Summary before:**

This defines "Electric Utility Steam Generating Unit" for Part D (major source permitting and PSD). It means a steam electric generating unit built to supply more than one-third of its potential electrical output capacity and more than 25 megawatts of electrical output to a utility power distribution system for sale. Steam supplied to a steam distribution system that feeds a steam-electric generator producing electricity for sale also counts toward the unit's electrical energy output capacity.

**Summary after (live):** unchanged

## 12. `sec-gp03-I-B` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp03-I-B]   Land development refers to all land clearing activities, including but not limited to land preparation such as excavating or grading, for residential, commercial, or industrial development, or oil and gas exploration and production. Land development does not include mining operations or the disturbance of contaminated soils. 

**Summary before:**

This permit covers land clearing, excavating, and grading for residential, commercial, industrial, or oil & gas exploration and production projects, but does not cover mining operations or disturbance of contaminated soils.

**Summary after (live):** unchanged

## 13. `sec-7-B-VI-C-2-b-(xi)` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-VI-C-2-b-(xi)]   In the last monthly report, a certification by the company representative that supervised the development and submission of the monitoring reports that, based on information and belief formed after reasonable inquiry, the statements and information in the monthly reports are true, accurate, and complete. 

**Summary before:**

This provision applies to operators conducting air quality monitoring at oil and gas operations. It requires that the final monthly monitoring report include a certification from the company representative who supervised the development and submission of all monitoring reports, stating that after reasonable inquiry, the statements and information in the monthly reports are true, accurate, and complete. This certification must be based on the representative's information and belief.

**Summary after (live):** unchanged

## 14. `sec-7-B-I-F-3-a` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-I-F-3-a]   On or before April 30, 2021, and April 30 of each year thereafter, each owner or operator of storage tanks in the 8-Hour Ozone Control Area must submit a report using Division-approved format. A copy of each report must be retained for a period of five (5) years. 

**Summary before:**

If you operate storage tanks in the 8-Hour Ozone Control Area, you must submit an annual report to the Division by April 30 each year (starting in 2021) using their approved format. You need to keep a copy of each report for five years.

**Summary after (live):** unchanged

## 15. `sec-7-B-III-F-2-f-(ii)` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-III-F-2-f-(ii)]   Quarterly at natural gas compressor stations with fugitive volatile organic compound emissions greater than twelve (12) and less than or equal to fifty (50) tons per year, based on a rolling twelve-month total. 

**Summary before:**

This provision applies to operators of natural gas compressor stations with fugitive volatile organic compound emissions greater than 12 and up to 50 tons per year (calculated on a rolling twelve-month basis). It requires pneumatic controller inspections to be conducted quarterly at such facilities.

**Summary after (live):** unchanged

## 16. `sec-3-A-IX-A-2-b-(viii)` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-A-IX-A-2-b-(viii)]   Disturbance of surface areas for purposes of land development, that do not exceed twenty-five contiguous acres and that do not exceed six months in duration. (This does not include mining operations or disturbance of contaminated soil). 

**Summary before:**

If your facility disturbs surface areas for land development, you do not need to quantify and report toxic air contaminant (TAC) emissions from that disturbance if it covers 25 contiguous acres or less and lasts six months or less. This exemption does not apply to mining operations or disturbance of contaminated soil.

**Summary after (live):** unchanged

## 17. `sec-3-F-I-XX` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-F-I-XX]   Adopted February 20, 2014 Regulation Number 3 , Parts A, B, C, D, and Appendices A and B of Part A – removing requirements for a source subject to a NSPS or NESHAP/MACT incorporated into Regulation Number 6 , Part A or Number 8, Parts A, C, D, and E to file an APEN and obtain a minor source permit regardless of whether the source’s emissions exceed the reporting of permitting thresholds (“catch-all provisions”); simplifying the Part A , Appendix A de minimis determination for non-criteria reportable pollutants; removing the crude oil storage tank exemptions; and correcting other typographical, grammatical, and formatting errors. This Statement of Basis, Specific Statutory Authority, and Purpose complies with the requirements of the Colorado Administrative Procedures Act, C.R.S. § 24-4-103, the Colorado Air Pollution Prevention and Control Act, C.R.S. §§ 25-7-110 and 25-7-110.5, and the Air Quality Control Commission’s (“Commission”) Procedural Rules . Specific Statutory Authority The Colorado Air Pollution Prevention and Control Act § 25-7-105(1) directs the Commission to promulgate such rules and regulations as are consistent with the legislative declaration set f

**Summary before:**

This is a statement of basis and purpose – an explanatory preamble – for a February 20, 2014 amendment to Regulation Number 3. It explains why the Commission made several changes: it removed "catch-all" provisions that automatically required sources subject to a federal NSPS or NESHAP/MACT to file an air pollutant emission notice and get a minor source permit even when their emissions were below reporting or permitting thresholds; it simplified the de minimis determination for non-criteria pollutants by setting a uniform 250 pounds per year threshold statewide; it removed permitting exemptions for crude oil storage tanks; and it corrected errors in the crude oil truck loading equipment exemption. The changes were part of a larger package that incorporated federal NSPS OOOO into Regulation Number 6 and revised Regulation Number 7 for oil and gas operations.

**Summary after (live):** unchanged

## 18. `sec-3-C-I-A-4` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-C-I-A-4]   Permit Shield Where a source operates in compliance with all operating permit terms and conditions, the source shall be deemed in compliance with the state and Federal Acts where the permit includes all applicable requirements of such acts, specifically states that other identified provisions are not applicable, and states that the permit shield applies. The permit shield does not apply to terms and conditions that become applicable to the source subsequent to permit issuance. The permit shield shall not alter or affect the provisions of Colorado Revised Statutes Sections 25-7-112 or 25-7-113, Section 303 of the Federal Act, the applicable requirements of the acid rain program, consistent with Section 408(a) of the Federal Act, or the ability of the Administrator to obtain information from a source pursuant to Section 114 of the Federal Act; nor shall the permit shield affect the liability of an owner or operator of a source for any violation of applicable requirements prior to or at the time of permit issuance. 

**Summary before:**

This defines what a "permit shield" means in Colorado's operating permit program. If your source operates in full compliance with all the terms and conditions in your operating permit, and the permit explicitly lists all applicable requirements and states which provisions don't apply to you and that the shield applies, then you are deemed in compliance with state and federal air laws. The shield does not cover requirements that become applicable after your permit is issued, and it does not protect you from enforcement under certain Colorado statutes, the federal acid rain program, EPA's information-request authority, or liability for violations that occurred before or when the permit was issued.

**Summary after (live):** unchanged

## 19. `sec-gp02-II-A-6` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp02-II-A-6]   The owner or operator of facilities located in an area classified as serious nonattainment for ozone, and which are not otherwise subject to Conditions I.B. or I.C. or I.D. of this permit, must track potential emissions from all insignificant activities at the facility on an annual basis to demonstrate compliance with facility emission limitations as indicated below. An inventory of each insignificant activity and associated emission calculations must be made available to the Division for inspection upon request. For the purposes of this condition, insignificant activities are defined as any activity or equipment, which emits any amount of VOC or NOx but does not require an APEN or is permit exempt. Note that for reclassifications of an existing nonattainment area to serious, the limit applies upon the effective date of reclassification. ( Regulation Number 3 , Part B. Section III.E. ) Total point source potential emissions from the facility, including all permitted emissions and potential to emit from all insignificant activities, must be less than: Volatile Organic Compounds (VOC): 50 tons per year Nitrogen Oxides (NOx): 50 tons per year 

**Summary before:**

The permit requires owners or operators of facilities in serious ozone nonattainment areas (that are not covered by Conditions I.B., I.C., or I.D.) to track annual potential emissions from all insignificant activities – meaning any activity or equipment that emits VOC or NOx but doesn't require an APEN or is permit-exempt – and keep an inventory with emission calculations available for Division inspection. Total facility-wide potential emissions, including all permitted emissions plus all insignificant-activity emissions, must stay below 50 tons per year for VOC and 50 tons per year for NOx. For an existing nonattainment area reclassified to serious, this limit applies on the effective date of reclassification.

**Summary after (live):** unchanged

## 20. `sec-7-B-IV-B-3` -- pass

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-IV-B-3]   By December 31, 2020, each segment owner or operator must develop a company-specific BMP plan. The BMP plan must contain each element from the BMP plan template chapter of the program guidance document, which will include, but is not limited to, a list of information the owner or operator must collect to demonstrate the BMPs performed. By December 31st of each year (beginning December 31st, 2021), each owner or operator must review and update, as appropriate, its company-specific BMP plan and document in the BMP plan any changes. 

**Summary before:**

This provision applies to each segment owner or operator of oil and natural gas operations. It required them to develop a company-specific BMP (Best Management Practices) plan by December 31, 2020, containing all elements from the BMP plan template chapter of the program guidance document, including a list of information to demonstrate BMPs performed. Beginning December 31, 2021, and annually thereafter by December 31st of each year, owners or operators must review and update their BMP plan as appropriate and document any changes in the plan.

**Summary after (live):** unchanged

## 21. `sec-gp06-VII-A-3` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp06-VII-A-3]   Complying with well production facility monitoring pursuant to Section III.J.4. of Part B. Owners or operators must comply with the monitoring methodology selected on the general permit registration form. 

**Summary before:**

The permit requires owners or operators of new or modified sources in Disproportionately Impacted Communities to comply with well production facility monitoring under Regulation Number 3, Part B, Section III.J.4., using the monitoring methodology they selected on their general permit registration form.

**Summary after (live):**

The permit requires owners or operators of new or modified sources in Disproportionately Impacted Communities to notify, at registration, that they will comply with monitoring requirements, and one way to do so is complying with well production facility monitoring under Regulation Number 3, Part B, Section III.J.4., using the monitoring methodology they selected on their general permit registration form.

**Reviewer's reasons:** Parent VII.A. makes this one of two ways ("by either") to indicate compliance in the registration notification, not a standalone mandate.

## 22. `sec-7-C-T` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-C-T]   September 23, 2020 (Part D, Sections II., IV., V., VI. and Part E, Section I.) This Statement of Basis, Specific Statutory Authority, and Purpose complies with the requirements of the Colorado Administrative Procedures Act § 24-4-103(4), the Colorado Air Pollution Prevention and Control Act, Colorado Revised Statutes (CRS) §§ 25-7-110 and 25-7-110.5., and the Air Quality Control Commission’s (Commission) Procedural Rules . Basis The Commission revised Part E, Section I. to reduce emissions from natural gas fired reciprocating internal combustion engines (RICE) greater than or equal to 1,000 horsepower (hp) on a state-wide basis. The revisions are in response to four distinct directives to secure reductions: Senate Bill 19-181 (SB 19-181); the second implementation period of the Regional Haze Rule pursuant to Clean Air Act Section 169A; progress towards the 2008 ozone National Ambient Air Quality Standard (NAAQS) of 75 ppb and 2015 ozone NAAQS of 70 pp; and to address nitrogen deposition at Rocky Mountain National Park (RMNP). The Commission also revised Part D, Sections II.G., IV., and V. to include annual reporting of carbon dioxide (CO2) and nitrous oxide (N2O) and 

**Summary before:**

This provision is a Statement of Basis, Specific Statutory Authority, and Purpose for September 23, 2020 revisions to Regulation 7. It is purely administrative and explanatory, documenting the Commission's rationale for adopting new requirements for natural gas-fired reciprocating internal combustion engines (RICE) ≥1,000 horsepower, pre-production monitoring and controls, class II disposal well facility emissions controls and reporting, and expanded annual greenhouse gas reporting (CO₂ and N₂O). The statement explains that the revisions respond to Senate Bill 19-181, Regional Haze Rule obligations, ozone NAAQS attainment, and nitrogen deposition at Rocky Mountain National Park, with statutory authority derived from C.R.S. §§25-7-101 et seq., particularly §25-7-109(10) directing methane and VOC/NOx minimization from oil and gas operations. It details phased compliance deadlines (May 1, 2024 for engines in the 8-Hour Ozone Control Area; May 1, 2026 outside), alternative company-wide compliance plan options, performance testing and monitoring protocols, pre-production air quality monitoring requirements, flowback vessel controls, and class II disposal well facility tank and loadout requirements, while clarifying the Commission's intent regarding applicability, definitions (e.g., "placed in service," "relocated"), and implementation expectations for the Division and regulated entities.

**Summary after (live):**

This provision is a Statement of Basis, Specific Statutory Authority, and Purpose for September 23, 2020 revisions to Regulation 7. It is purely administrative and explanatory, documenting the Commission's rationale for adopting new requirements for natural gas-fired reciprocating internal combustion engines (RICE) ≥1,000 horsepower, pre-production monitoring and controls, class II disposal well facility emissions controls and reporting, and expanded annual greenhouse gas reporting (CO₂ and N₂O). The statement explains that the revisions respond to Senate Bill 19-181, Regional Haze Rule obligations, ozone NAAQS attainment, and nitrogen deposition at Rocky Mountain National Park, with statutory authority derived from C.R.S. §§25-7-101 et seq., particularly §25-7-109(10) directing methane and VOC/NOx minimization from oil and gas operations. It details phased compliance deadlines (for owners or operators with any engines in the 8-Hour Ozone Control Area, May 1, 2024 for engines inside the area and May 1, 2026 for engines outside; operators with no engines inside the area must meet the standards for at least 20% of engines each year from 2022 to 2026), alternative company-wide compliance plan options, performance testing and monitoring protocols, pre-production air quality monitoring requirements, flowback vessel controls, and class II disposal well facility tank and loadout requirements, while clarifying the Commission's intent regarding applicability, definitions (e.g., "placed in service," "relocated"), and implementation expectations for the Division and regulated entities.

**Reviewer's reasons:** Text ties the 2024/2026 dates to operators with any engines in the Area and gives a different 20%-per-year timeline for others.

## 23. `sec-3-A-II-D-1-ooo` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-A-II-D-1-ooo]   The use of pesticides, fumigants, and herbicides when used in accordance with requirements established under the federal Insecticide, Fungicide and Rodenticide Act as established by the U.S. EPA (United States Code Title 7, Section 136 et seq.). 

**Summary before:**

The use of pesticides, fumigants, and herbicides is exempt from the Air Pollutant Emission Notice requirement when used in accordance with the federal Insecticide, Fungicide and Rodenticide Act (Title 7, Section 136 et seq.). This exemption does not relieve the source from complying with any other applicable air quality requirements.

**Summary after (live):**

The use of pesticides, fumigants, and herbicides is exempt from the Air Pollutant Emission Notice requirement when used in accordance with the federal Insecticide, Fungicide and Rodenticide Act (Title 7, Section 136 et seq.). This exemption does not relieve the source from complying with requirements that are otherwise applicable specifically to the exempted emission units.

**Reviewer's reasons:** Parent paragraph II.D.1. limits continued compliance to requirements otherwise applicable specifically to the exempted emission units.

## 24. `sec-7-B-II-E-4-f-(ii)` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-II-E-4-f-(ii)]   The owner or operator uses only non-emitting pneumatic controllers, installs and operates a software system providing automated operational feedback to a central control system, and does not install and operate hydrocarbon liquid storage tanks (other than a maintenance tank) or natural gas-fired reciprocating internal combustion engines. 

**Summary before:**

This provision describes an exemption scenario for well production facilities: if an owner or operator uses only non-emitting pneumatic controllers, installs and operates a software system with automated operational feedback to a central control system, and does not install or operate hydrocarbon liquid storage tanks (except maintenance tanks) or natural gas-fired reciprocating internal combustion engines, then certain requirements under II.E.4.f. do not apply.

**Summary after (live):**

This provision describes an alternative inspection frequency scenario for well production facilities: an owner or operator uses only non-emitting pneumatic controllers, installs and operates a software system with automated operational feedback to a central control system, and does not install or operate hydrocarbon liquid storage tanks (except maintenance tanks) or natural gas-fired reciprocating internal combustion engines. Under II.E.4.f., owners or operators in compliance with this provision must inspect components for leaks using an approved instrument monitoring method at least semi-annually or consistent with the inspection frequency in Table 4, whichever is more frequent.

**Reviewer's reasons:** Parent paragraph II.E.4.f. sets alternative inspection frequency requirements, not an exemption.

## 25. `sec-3-D-VI-B-2-b` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-D-VI-B-2-b]   As they relate to any maximum allowable increase for a Class II area, to a modification of a major stationary source that was in existence on March 1, 1978, if the net increase in allowable emissions of each pollutant subject to regulation, excluding GHG, under the Act from the modification after the application of best available control technology would be less than fifty tons per year. 

**Summary before:**

This exemption applies to modifications of major stationary sources that existed on March 1, 1978. If such a modification would increase allowable emissions of any regulated pollutant (except greenhouse gases) by less than 50 tons per year after applying best available control technology, certain PSD requirements do not apply as they relate to maximum allowable increases for Class II areas.

**Summary after (live):**

This exemption applies to modifications of major stationary sources that existed on March 1, 1978. If the net increase in allowable emissions of each regulated pollutant (except greenhouse gases) from such a modification would be less than 50 tons per year after applying best available control technology, certain PSD requirements do not apply as they relate to maximum allowable increases for Class II areas.

**Reviewer's reasons:** Text says the net increase in allowable emissions of each pollutant must be under fifty tons per year, not any one pollutant.

## 26. `sec-7-B-I-L-5-a-(i)` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-I-L-5-a-(i)]   If parts are unavailable, they must be ordered promptly and the repair must be made within fifteen (15) working days of receipt of the parts. 

**Summary before:**

This provision applies to operators who have identified equipment requiring repair under the leak detection and repair program. It requires that if replacement parts needed for a repair are unavailable, the operator must order them promptly and complete the repair within 15 working days after receiving the parts. This extends the normal repair deadline when parts availability causes delays.

**Summary after (live):**

This provision applies when a leak has been discovered and parts needed for the repair are unavailable. It requires that if parts are unavailable, they must be ordered promptly and the repair must be made within 15 working days after receiving the parts. This extends the normal repair deadline when parts availability causes delays.

**Reviewer's reasons:** The text, via the parent paragraph, refers to repairing a leak and mentions no operators or leak detection and repair program.; Removes the unstated 'operator' party and 'replacement' parts; the text says only that parts must be ordered and the repair made.

## 27. `sec-gp01-VIII-C-1-a-(ii)` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp01-VIII-C-1-a-(ii)]   For volatile organic compounds and nitrogen oxides sources in ozone non-attainment areas, a change in annual actual emissions of one ton per year or more or five percent, whichever is greater, above the level reported on the last APEN submitted to the Division; or 

**Summary before:**

The permit requires you to submit an updated Air Pollutant Emission Notice (APEN) by April 30 if your facility is in an ozone non-attainment area and your annual actual emissions of VOC or NOx increased by 1 tpy or more, or by 5 percent, whichever is greater, compared to the emissions level in your last APEN. This applies only when that increase qualifies as a "significant increase" under the permit's definition.

**Summary after (live):**

The permit requires action annually by April 30 of the year following a significant increase in emissions, if your facility is a volatile organic compound (VOC) or nitrogen oxides (NOx) source in an ozone non-attainment area and your annual actual emissions changed by 1 ton per year or more, or by 5 percent, whichever is greater, above the level reported on your last APEN submitted to the Division.

**Reviewer's reasons:** Text does not say what is submitted; adds the year-following timing, the Division, and the actual wording of the change threshold.; Text gives no separate definition of significant increase; the stated threshold is the test.

## 28. `sec-7-B-VI-D-1-a-(iii)-(B)` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-VI-D-1-a-(iii)-(B)]   Opening the thief hatch or other access point if required to inspect, test, or calibrate the tank measurement system or to add biocides or chemicals is not a violation of Section VI.D.1.a.(ii)(A). 

**Summary before:**

Opening the thief hatch or other access point on a pre-production flowback vessel for purposes of inspecting, testing, or calibrating the tank measurement system or adding biocides or chemicals does not constitute a violation of the emission control requirements in Section VI.D.1.a.(ii)(A). This provision applies to operators of pre-production flowback vessels and provides an exception for necessary operational and maintenance activities.

**Summary after (live):**

Opening the thief hatch or other access point on a pre-production flowback vessel if required to inspect, test, or calibrate the tank measurement system or to add biocides or chemicals does not constitute a violation of Section VI.D.1.a.(ii)(A). This provision applies to operators of pre-production flowback vessels and provides an exception for these activities.

**Reviewer's reasons:** Text conditions the exception on the opening being 'required'.; Text does not describe the content of that section.; Text lists specific activities only, not general operational and maintenance activities.

## 29. `sec-7-B-II-H-5-c-(iii)` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-II-H-5-c-(iii)]   The date, location, identification of equipment or piping and number of blowdown events (other than pigging operations), including identification of whether the volume between isolation valves is less than 50 cf. 

**Summary before:**

This provision applies to operators conducting blowdown events at oil and gas facilities. It requires records to document the date, location, equipment or piping identification, and number of blowdown events (excluding pigging operations), and must identify whether the volume between isolation valves is less than 50 cubic feet. This is a recordkeeping requirement that specifies the information that must be captured for each blowdown event as part of the broader blowdown records required under II.H.5.c.

**Summary after (live):**

This provision concerns records of blowdown events. It requires records to document the date, location, equipment or piping identification, and number of blowdown events (excluding pigging operations), and must identify whether the volume between isolation valves is less than 50 cubic feet. This is a recordkeeping requirement that specifies the information that must be captured for each blowdown event as part of the broader blowdown records required under II.H.5.c.

**Reviewer's reasons:** Text names no operators or facilities; it only lists record contents under II.H.5.c. Records of blowdowns.

## 30. `sec-gp07-II-B-1-b` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp07-II-B-1-b]   Facilities located in an area classified as serious nonattainment for ozone, total potential point source emissions from the facility, including all permitted emissions and potential to emit from all insignificant activities, must be less than: Volatile Organic Compounds (VOC): 50 tons per year Nitrogen Oxides (NOx): 50 tons per year Carbon Monoxide (CO): 100 tons per year 

**Summary before:**

The permit requires facilities in a serious ozone nonattainment area to keep total potential point source emissions (permitted plus all insignificant activities) below 50 tpy VOC, 50 tpy NOx, and 100 tpy CO. The owner or operator must track insignificant-activity emissions annually and make the inventory and calculations available to the Division on request.

**Summary after (live):**

The permit requires facilities in a serious ozone nonattainment area to keep total potential point source emissions (permitted plus all insignificant activities) below 50 tpy VOC, 50 tpy NOx, and 100 tpy CO. An owner or operator not subject to Conditions I.B., I.C. or I.D. must track insignificant-activity emissions annually and make the inventory and calculations available to the Division for inspection.

**Reviewer's reasons:** Parent paragraph II.B.1. limits the tracking duty to those not subject to Conditions I.B., I.C. or I.D.; Parent text says 'for inspection', with no mention of a request.

## 31. `sec-7-B-II-E-9-g` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-II-E-9-g]   Each report must be accompanied by a certification by a responsible official that, based on information and belief formed after reasonable inquiry, the statements and information in the document are true, accurate, and complete 

**Summary before:**

Every report submitted under this section must include a signed statement from a responsible company official certifying that they made a reasonable effort to verify the information and that, to the best of their knowledge, everything in the report is true, accurate, and complete. This is basically requiring an official signature vouching for the accuracy of what's being submitted.

**Summary after (live):**

Every report submitted under this section must be accompanied by a certification from a responsible official that, based on information and belief formed after reasonable inquiry, everything in the report is true, accurate, and complete. This is basically requiring an official to vouch for the accuracy of what's being submitted.

**Reviewer's reasons:** Text requires a certification by a responsible official; no signed statement or "company" is stated.; Text does not mention a signature.

## 32. `sec-3-B-III-J-2-b-(ii)` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-B-III-J-2-b-(ii)]   If accessible to the source’s owner/operator, the installation and operation of air quality monitors within 0.25- miles of the area of highest annual average modeled concentration if the area of highest annual average modeled concentration is within 0.25-miles of an Occupied Area or the nearest logistically practical location. Monitor locations must be approved by the Division; 

**Summary before:**

If the source owner or operator can access it, they must install and operate air quality monitors within a quarter-mile of the spot where modeling shows the highest annual average concentration – but only if that spot is itself within a quarter-mile of an Occupied Area; if not accessible at that exact location, monitors go at the nearest practical spot. The Division must approve the monitor locations.

**Summary after (live):**

If the source owner or operator can access it, they must install and operate air quality monitors within a quarter-mile of the spot where modeling shows the highest annual average concentration if that spot is within a quarter-mile of an Occupied Area; otherwise the monitors go at the nearest logistically practical location. The Division must approve the monitor locations.

**Reviewer's reasons:** Text gives the nearest logistically practical location as the alternative to the Occupied Area proximity case, not as an accessibility fallback, and does not say monitoring applies only if the spot is near an Occupied Area.

## 33. `sec-7-C-J` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-C-J]   December 17, 2006 ( Sections I.A.1.b. and XVII.) This Statement of Basis, Specific Statutory Authority and Purpose complies with the requirements of the Colorado Administrative Procedure Act §§ 24-4-103(4), C.R.S. for new and revised regulations. Basis The Air Quality Control Commission has adopted these state-only provisions as a means of reducing air emissions from oil and gas operations throughout Colorado. Due to the large growth in oil and gas production in a number of regions of the state emissions from oil and gas operations have rapidly increased over the past few years and are expected to increase further in the foreseeable future. These revisions are a proactive measure designed to eliminate air emissions that could threaten attainment of ambient air quality standards and adversely affect visibility in Class I Areas. These revisions are based on reasonably available, validated, reviewed and sound scientific methodologies. All validated, reviewed and sound scientific methodologies made available by interested parties have been considered. Evidence in the record supports the finding that the rule shall result in a demonstrable reduction in air pollution, and w

**Summary before:**

This is an administrative provision that provides the legal basis, statutory authority, and purpose for December 17, 2006 revisions to Regulation 7 Sections I.A.1.b. and XVII. It explains that the Air Quality Control Commission adopted state-only provisions to reduce air emissions from oil and gas operations statewide due to rapid production growth, establishing emission control requirements for condensate storage tanks (production tanks only, not produced water tanks), glycol dehydrators, and natural gas-fired reciprocating internal combustion engines, with a 95% average control efficiency standard for tanks and dehydrators. The provision clarifies that applicability thresholds are based on emissions during the preceding 12-month period (or projected 12-month emissions for tanks in service less than 12 months), operators have 90 days to install controls for tanks serving newly drilled/recompleted/restimulated wells, and units subject to MACT, BACT, or NSPS programs are exempted. The statutory authority is found in Colorado Air Pollution Prevention and Control Act sections 25-7-105.1, 25-7-106, and 25-7-109.

**Summary after (live):**

This is an administrative provision that provides the legal basis, statutory authority, and purpose for December 17, 2006 revisions to Regulation 7 Sections I.A.1.b. and XVII. It explains that the Air Quality Control Commission adopted state-only provisions to reduce air emissions from oil and gas operations statewide due to rapid production growth, establishing emission control requirements for condensate storage tanks (production tanks only, not produced water tanks), glycol dehydrators, and natural gas-fired reciprocating internal combustion engines, with a 95% average control efficiency standard for tanks and dehydrators. The provision clarifies that applicability thresholds are based on emissions during the preceding 12-month period (or projected 12-month emissions for tanks in service less than 12 months), operators have 90 days to determine anticipated production and, if necessary, install controls for tanks serving newly drilled/recompleted/restimulated wells, and units subject to MACT, BACT, or NSPS programs are exempted. The statutory authority is found in Colorado Air Pollution Prevention and Control Act sections 25-7-105.1, 25-7-106, and 25-7-109.

**Reviewer's reasons:** Text says the 90 days is to determine anticipated production and, if necessary, install a control device.

## 34. `sec-gp05-VIII-E-4` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp05-VIII-E-4]   If the Division terminates this general permit, it will provide written notice to affected registrants prior to the termination of the general permit. The notice will advise registrants that they must apply for an individual permit as required by Regulation Number 3 , Part B . 

**Summary before:**

The permit requires that if the Division terminates GP05, it will give written notice to all registrants before the termination takes effect. The notice will tell registrants they must apply for an individual permit under Regulation Number 3, Part B.

**Summary after (live):**

The permit requires that if the Division terminates GP05, it will give written notice to affected registrants before the termination takes effect. The notice will tell registrants they must apply for an individual permit under Regulation Number 3, Part B.

**Reviewer's reasons:** Text says notice is provided to "affected registrants", not all registrants.

## 35. `sec-7-B-VI-C-1-a` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-VI-C-1-a]   Owners or operators must monitor air quality for at least ten (10) days prior to beginning pre-production operations, during all pre-production operations, and for at least six months after the well is capable of consistently producing either separable gas or salable liquid hydrocarbons (i.e., early production). 

**Summary before:**

Owners or operators must conduct air quality monitoring for at least 10 days before starting pre-production operations, throughout all pre-production operations, and for at least six months after the well can consistently produce either separable gas or salable liquid hydrocarbons (early production). This monitoring requirement applies to all phases from pre-production through the first six months of consistent production capability.

**Summary after (live):**

Owners or operators must conduct air quality monitoring for at least 10 days before starting pre-production operations, throughout all pre-production operations, and for at least six months after the well can consistently produce either separable gas or salable liquid hydrocarbons (early production). This monitoring requirement applies to all phases from pre-production through early production.

**Reviewer's reasons:** Text sets six months as a minimum after the well can consistently produce, not a cap, so 'the first six months' is inaccurate.

## 36. `sec-3-D-II-A-13-b-(i)` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-D-II-A-13-b-(i)]   A new emissions unit is any emissions unit that is (or will be) newly constructed and that has existed for less than two years from the date such emissions unit first operated. 

**Summary before:**

A new emissions unit (for greenhouse gases) is any part of a stationary source that is newly built and has been operating for less than two years from the date it first started up.

**Summary after (live):**

A new emissions unit (for greenhouse gases) is any part of a stationary source that is (or will be) newly built and has existed for less than two years from the date it first operated.

**Reviewer's reasons:** Text says the unit is (or will be) newly constructed and has existed for less than two years from the date it first operated, not that it has been operating for that time.

## 37. `sec-3-A-II-D-5` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-A-II-D-5]   Commercial (for hire) laboratories whose primary responsibilities are to perform qualitative or quantitative analysis on environmental, clinical, geological, forensic, or process samples may estimate emissions for purposes of Air Pollutant Emission Notice reporting based upon a mass balance calculation utilizing inventory and purchase records of solvents and reagents. Such laboratories may, at their discretion, group emission points if such grouping meets the grouping criteria outlined in this regulation. All inert samples are exempt from Air Pollutant Emission Notice reporting. Emissions from samples subjected to analysis provided to such laboratories for analysis and testing, and by-products that result from sample testing, are exempt from Air Pollutant Emission Notice reporting, provided such samples subjected to analysis are less than five gallons for liquids, or five pounds for solids. 

**Summary before:**

Commercial laboratories that analyze environmental, clinical, geological, forensic, or process samples for hire may estimate emissions for APEN reporting using a mass balance calculation based on solvent and reagent inventory and purchase records. They may group emission points if the grouping meets the regulation's criteria. All inert samples are exempt from APEN reporting, and emissions from samples being analyzed and their testing by-products are also exempt as long as the samples are less than five gallons (liquids) or five pounds (solids).

**Summary after (live):**

Commercial laboratories whose primary responsibilities are to analyze environmental, clinical, geological, forensic, or process samples for hire may estimate emissions for APEN reporting using a mass balance calculation based on solvent and reagent inventory and purchase records. They may group emission points if the grouping meets the regulation's criteria. All inert samples are exempt from APEN reporting, and emissions from samples being analyzed and their testing by-products are also exempt as long as the samples are less than five gallons (liquids) or five pounds (solids).

**Reviewer's reasons:** Text limits this to laboratories whose primary responsibilities are to perform such analysis.

## 38. `sec-gp02-XI-C-1-a-(ii)` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp02-XI-C-1-a-(ii)]   For volatile organic compounds and nitrogen oxides sources in ozone non-attainment areas, a change in annual actual emissions of one ton per year or more or five percent, whichever is greater, above the level reported on the last APEN submitted to the Division; or 

**Summary before:**

The permit requires an updated APEN by April 30 of the year after a significant emission increase, which for VOC and NOx sources in ozone non-attainment areas means an increase of one ton per year or more, or five percent (whichever is greater), above the emissions level reported on the last APEN submitted to the Division.

**Summary after (live):**

The permit requires action annually by April 30 of the year after a significant emission increase, which for VOC and NOx sources in ozone non-attainment areas means a change in annual actual emissions of one ton per year or more, or five percent (whichever is greater), above the emissions level reported on the last APEN submitted to the Division.

**Reviewer's reasons:** Text states only 'Annually by 30 April of the year following a significant increase in emissions'; it does not say an updated APEN is required.; Text says 'a change in annual actual emissions of one ton per year or more or five percent, whichever is greater, above the level reported'.

## 39. `sec-3-A-V-E-3-c` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-A-V-E-3-c]   ERCs intended to be used as offsets to meet the requirements of nonattainment new source review must be obtained by the owner or operator of the proposed new or modified source prior to the application to use them. The owner or operator intending to use the credits as offsets may supply ERCs they have certified themselves or alternatively, secure ERCs from other entities through transfer of ownership as described in Section V.F. 

**Summary before:**

This applies to owners or operators who want to use emission reduction credits (ERCs) as offsets in nonattainment new source review. You must obtain the ERCs before you apply to use them as offsets. You can either use ERCs you certified yourself or buy/transfer ERCs from another entity.

**Summary after (live):**

This applies to owners or operators who want to use emission reduction credits (ERCs) as offsets in nonattainment new source review. You must obtain the ERCs before you apply to use them as offsets. You can either use ERCs you certified yourself or secure ERCs from another entity through transfer of ownership as described in Section V.F.

**Reviewer's reasons:** The text says ERCs are secured from other entities through transfer of ownership per Section V.F; it does not mention buying.

## 40. `sec-gp05-VIII-C-9` -- corrected

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp05-VIII-C-9]   Registration under this permit is approved in reliance upon the accuracy and completeness of information supplied by the applicant and is conditioned upon operation of the source, in accordance with this information and with representations made by the applicant or applicant's agents. It is valid only for the equipment and operations or activity specifically identified on the general permit registration. 

**Summary before:**

The permit is valid only for the specific equipment and operations you listed in your registration, and the Division approved it based on the accuracy and completeness of the information you submitted. You must operate the source exactly as described in your application and any representations you or your agents made.

**Summary after (live):**

The registration is valid only for the specific equipment and operations or activity identified on your general permit registration, and it was approved in reliance on the accuracy and completeness of the information you supplied. Registration is conditioned on operating the source in accordance with that information and with representations made by you or your agents.

**Reviewer's reasons:** The text does not name the Division as the approving party.; The text says operation is a condition 'in accordance with' the information and representations, not 'exactly' as described in the application.

## Rows set back to pending (13) -- summary text unchanged, to be regenerated after stage 2

| id | reviewer's reason |
|---|---|
| `sec-7-C-Y` | validator: Markdown-only correction changed more than the markers (summary opens with a bold "**Warning:**") |
| `sec-3-A-VIII-D-2-a` | validator: Markdown-only correction changed more than the markers (same row failed the same way in both audits) |
| `sec-7-B-II-I-2-c-(i)-(B)-(4)` | validator: correction is a rewrite (176 words from 89) |
| `sec-7-C-P` | provision text truncated to the first 6,000 of 10,504 words; the summary describes the whole provision and makes claims the visible text does not support |
| `sec-7-C-N` | truncated (6,000 of 8,718 words); several unsupported statements (building units vs "occupied buildings", a C.R.S. range the text does not state) |
| `sec-3-F-I-L` | truncated (6,000 of 10,605 words), cut mid-sentence |
| `sec-3-F-I-KKK` | truncated (6,000 of 6,587 words); summary makes whole-document claims |
| `sec-3-F-I-C` | truncated (6,000 of 9,842 words) |
| `sec-3-D-V-A-3-b-(iii)` | parent paragraph excerpt truncated before the lead-in that defines "such other area"; the summary's framing cannot be verified |
| `sec-3-C-VIII-A-2` | parent paragraph truncated mid-sentence; the provision is a fragment that depends on the missing lead-in |
| `sec-3-D-VI-D-2` | table flattened without column alignment; pollutant-to-averaging-time assignments cannot be verified |
| `sec-3-C-V-C-5-d-(i)-(B)` | parent paragraph cut off at "the Divisi..."; the consequence is missing |
| `sec-7-B-II-D-3-b` | parent paragraph II.D.3. truncated; the summary's exemption claim cannot be verified |

Nine of the thirteen are the same kind of row as sec-1-X from the 5 Oct pending run: the provision or its parent excerpt is cut by the summarizer's `MAX_PROMPT_WORDS` / parent-excerpt limits, so the reviewer cannot verify a summary of the whole; the fix is regeneration (an overview that names the sections), not an edit.
