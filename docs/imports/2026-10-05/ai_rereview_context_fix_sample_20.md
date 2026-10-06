# Re-review context fix, 5-6 Oct 2026: 20-row sample of rows whose live text changed in Part 3

The Cowork spot-check of the stage-1 sample found the reviewer saw too little of the text above a provision (one parent excerpt of 400 characters, silently cut). PR #61 gave it the own text of every ancestor from the root down to the parent with honest cuts and three new rules (prompt version `33b17e6a7a`). Part 3 then re-reviewed the BEFORE summary (from `archive.summary_review_snapshot_rereview`) of every one of the 1,247 rows stage 1 had corrected: runs https://github.com/ontargetequipment/Essentialregs.com/actions/runs/37269199081 (1,000 rows) and https://github.com/ontargetequipment/Essentialregs.com/actions/runs/37399883902 (the remaining 247; the first run hit PostgREST's 1,000-row cap, fixed in PR #62). Outcome over all 1,247: **171 restored to the original hand-approved text, 367 given the same correction as stage 1, 709 given a different correction, 0 fail**; 880 `provision_changes` rows, one per changed live text. Cost $4.51; 79.8% / 62.9% of input tokens were cache reads.

This sample: 20 rows drawn at random (seeded, `order by md5(id || '20261005')`) from the 880 rows whose live text changed in Part 3 (restored or re-corrected). For each: the text above the provision as the reviewer now sees it (every ancestor below the document root, first 700 characters each), the official text (provision plus descendants, first 1,200 characters), the summary before (the hand-approved text from the snapshot), the summary after (live), and the reviewer's reasons (for a restored row, the standing note). For the Cowork spot-check before stage 2.

## 1. `sec-gp06-VII-A-3` -- restored

**Text above the provision (each ancestor, first 700 characters):**

> [sec-gp06-VII]  Monitoring Requirements for Facilities located in Disproportionately Impacted (DI) Communities 
> [sec-gp06-VII-A]  Owners or operators of new or modified sources located in Disproportionately Impacted Communities must submit a notification at the time of registration for a general permit or permits issued pursuant to Regulation Number 3 , Part B, Section III.I. indicating the source will comply with the monitoring requirements outlined in Regulation Number 3 , Part B, Section III.J. , as applicable, by either: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp06-VII-A-3]   Complying with well production facility monitoring pursuant to Section III.J.4. of Part B. Owners or operators must comply with the monitoring methodology selected on the general permit registration form. 

**Summary before (snapshot, the hand-approved text):**

The permit requires owners or operators of new or modified sources in Disproportionately Impacted Communities to comply with well production facility monitoring under Regulation Number 3, Part B, Section III.J.4., using the monitoring methodology they selected on their general permit registration form.

**Summary after (live, after Part 3):**

The permit requires owners or operators of new or modified sources in Disproportionately Impacted Communities to comply with well production facility monitoring under Regulation Number 3, Part B, Section III.J.4., using the monitoring methodology they selected on their general permit registration form.

**Reviewer's reasons:** re-review with the full ancestor context found no error; the earlier correction is withdrawn and the original summary restored

## 2. `sec-7-C-T` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> (none: the provision sits directly under the document root)

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-C-T]   September 23, 2020 (Part D, Sections II., IV., V., VI. and Part E, Section I.) This Statement of Basis, Specific Statutory Authority, and Purpose complies with the requirements of the Colorado Administrative Procedures Act § 24-4-103(4), the Colorado Air Pollution Prevention and Control Act, Colorado Revised Statutes (CRS) §§ 25-7-110 and 25-7-110.5., and the Air Quality Control Commission’s (Commission) Procedural Rules . Basis The Commission revised Part E, Section I. to reduce emissions from natural gas fired reciprocating internal combustion engines (RICE) greater than or equal to 1,000 horsepower (hp) on a state-wide basis. The revisions are in response to four distinct directives to secure reductions: Senate Bill 19-181 (SB 19-181); the second implementation period of the Regional Haze Rule pursuant to Clean Air Act Section 169A; progress towards the 2008 ozone National Ambient Air Quality Standard (NAAQS) of 75 ppb and 2015 ozone NAAQS of 70 pp; and to address nitrogen deposition at Rocky Mountain National Park (RMNP). The Commission also revised Part D, Sections II.G., IV., and V. to include annual reporting of carbon dioxide (CO2) and nitrous oxide (N2O) and 

**Summary before (snapshot, the hand-approved text):**

This provision is a Statement of Basis, Specific Statutory Authority, and Purpose for September 23, 2020 revisions to Regulation 7. It is purely administrative and explanatory, documenting the Commission's rationale for adopting new requirements for natural gas-fired reciprocating internal combustion engines (RICE) ≥1,000 horsepower, pre-production monitoring and controls, class II disposal well facility emissions controls and reporting, and expanded annual greenhouse gas reporting (CO₂ and N₂O). The statement explains that the revisions respond to Senate Bill 19-181, Regional Haze Rule obligations, ozone NAAQS attainment, and nitrogen deposition at Rocky Mountain National Park, with statutory authority derived from C.R.S. §§25-7-101 et seq., particularly §25-7-109(10) directing methane and VOC/NOx minimization from oil and gas operations. It details phased compliance deadlines (May 1, 2024 for engines in the 8-Hour Ozone Control Area; May 1, 2026 outside), alternative company-wide compliance plan options, performance testing and monitoring protocols, pre-production air quality monitoring requirements, flowback vessel controls, and class II disposal well facility tank and loadout requirements, while clarifying the Commission's intent regarding applicability, definitions (e.g., "placed in service," "relocated"), and implementation expectations for the Division and regulated entities.

**Summary after (live, after Part 3):**

This provision is a Statement of Basis, Specific Statutory Authority, and Purpose for September 23, 2020 revisions to Regulation 7. It documents the Commission's rationale for adopting new requirements for natural gas-fired reciprocating internal combustion engines (RICE) ≥1,000 horsepower, pre-production monitoring and controls, class II disposal well facility emissions controls and reporting, and expanded annual greenhouse gas reporting (CO₂ and N₂O). The statement explains that the revisions respond to Senate Bill 19-181, the second implementation period of the Regional Haze Rule, progress towards the ozone NAAQS, and nitrogen deposition at Rocky Mountain National Park, with statutory authority derived from C.R.S. §§25-7-101 et seq., particularly §25-7-109(10) directing methane and VOC/NOx minimization from oil and gas operations. It details phased compliance deadlines (for owners or operators with any engines in the 8-Hour Ozone Control Area, May 1, 2024 for engines inside the area and May 1, 2026 for engines outside; operators with no engines inside the area must meet the standards for at least 20% of engines each year from 2022 to 2026), alternative company-wide compliance plan options, performance testing and monitoring protocols, pre-production air quality monitoring requirements, flowback vessel controls, and class II disposal well facility tank and loadout requirements, while clarifying the Commission's intent regarding applicability, definitions (e.g., "placed in service," "relocated"), and implementation expectations for the Division and regulated entities.

**Reviewer's reasons:** Text does not describe itself as purely administrative; it also states intent and directions to the Division.; Text says second implementation period and progress towards the 2008 and 2015 ozone NAAQS.; Text conditions the deadlines on having engines in the area and gives a separate timeline for others.

## 3. `sec-3-A-II-D-1-ooo` -- restored

**Text above the provision (each ancestor, first 700 characters):**

> [sec-3-A-II] II. Air Pollutant Emission Notice (APEN) Requirements
> [sec-3-A-II-D] II.D. Exemptions from Air Pollutant Emission Notice Requirements
> [sec-3-A-II-D-1]  Stationary sources having emission units that are exempt from the requirement to file an Air Pollutant Emission Notice must nevertheless comply with all requirements that are otherwise applicable specifically to the exempted emission units, including, but not limited to: Title V, Prevention of Significant Deterioration, nonattainment New Source Review, opacity limitations, odor limitations, particulate matter limitations and volatile organic compounds controls. An applicant may not omit any information regarding APEN exempt emission units in any permit application if such information is needed to determine the applicability of Title V ( Part C of this Regulation Number 3 ), Prevention of Si

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-A-II-D-1-ooo]   The use of pesticides, fumigants, and herbicides when used in accordance with requirements established under the federal Insecticide, Fungicide and Rodenticide Act as established by the U.S. EPA (United States Code Title 7, Section 136 et seq.). 

**Summary before (snapshot, the hand-approved text):**

The use of pesticides, fumigants, and herbicides is exempt from the Air Pollutant Emission Notice requirement when used in accordance with the federal Insecticide, Fungicide and Rodenticide Act (Title 7, Section 136 et seq.). This exemption does not relieve the source from complying with any other applicable air quality requirements.

**Summary after (live, after Part 3):**

The use of pesticides, fumigants, and herbicides is exempt from the Air Pollutant Emission Notice requirement when used in accordance with the federal Insecticide, Fungicide and Rodenticide Act (Title 7, Section 136 et seq.). This exemption does not relieve the source from complying with any other applicable air quality requirements.

**Reviewer's reasons:** re-review with the full ancestor context found no error; the earlier correction is withdrawn and the original summary restored

## 4. `sec-7-B-II-E-4-f-(ii)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-7-B-II] II. (State Only) Statewide Controls for Oil and Gas Operations
> [sec-7-B-II-E]  (State Only) Leak detection and repair program for well production facilities and natural gas compressor stations 
> [sec-7-B-II-E-4] II.E.4. Requirements for well production facilities
> [sec-7-B-II-E-4-f]  Alternative inspection frequency requirements. Owners or operators of well production facilities in compliance with Sections II.E.4.f.(i) or II.E.4.f.(ii) must inspect components for leaks using an approved instrument monitoring method at least semi- annually or consistent with the inspection frequency in Table 4, whichever is more frequent, except that a well production facility with uncontrolled actual VOC emissions less than two (2) tons per year as of February 14, 2022, need only be inspected at least annually. Owners or operators must comply with all other requirements of Section II.E. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-II-E-4-f-(ii)]   The owner or operator uses only non-emitting pneumatic controllers, installs and operates a software system providing automated operational feedback to a central control system, and does not install and operate hydrocarbon liquid storage tanks (other than a maintenance tank) or natural gas-fired reciprocating internal combustion engines. 

**Summary before (snapshot, the hand-approved text):**

This provision describes an exemption scenario for well production facilities: if an owner or operator uses only non-emitting pneumatic controllers, installs and operates a software system with automated operational feedback to a central control system, and does not install or operate hydrocarbon liquid storage tanks (except maintenance tanks) or natural gas-fired reciprocating internal combustion engines, then certain requirements under II.E.4.f. do not apply.

**Summary after (live, after Part 3):**

This provision describes one of the conditions for the alternative inspection frequency for well production facilities: the owner or operator uses only non-emitting pneumatic controllers, installs and operates a software system with automated operational feedback to a central control system, and does not install or operate hydrocarbon liquid storage tanks (except maintenance tanks) or natural gas-fired reciprocating internal combustion engines. A facility in compliance with this provision (or II.E.4.f.(i)) must inspect components for leaks at least semi-annually or per Table 4, whichever is more frequent, and must comply with all other requirements of Section II.E.

**Reviewer's reasons:** Parent II.E.4.f is headed "Alternative inspection frequency requirements" and does not create an exemption.; Parent text states the inspection frequency and requires compliance with all other Section II.E requirements; it waives nothing.

## 5. `sec-3-D-VI-B-2-b` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-3-D-VI]  Requirements applicable to attainment and unclassifiable areas and pollutants implemented under Section 110 of the Federal Act (Prevention of Significant Deterioration Program). 
> [sec-3-D-VI-B] VI.B. Applicability of Certain PSD Requirements.
> [sec-3-D-VI-B-2]  The requirements contained in Sections VI.A.2. through VI.A.4. of this part do not apply: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-D-VI-B-2-b]   As they relate to any maximum allowable increase for a Class II area, to a modification of a major stationary source that was in existence on March 1, 1978, if the net increase in allowable emissions of each pollutant subject to regulation, excluding GHG, under the Act from the modification after the application of best available control technology would be less than fifty tons per year. 

**Summary before (snapshot, the hand-approved text):**

This exemption applies to modifications of major stationary sources that existed on March 1, 1978. If such a modification would increase allowable emissions of any regulated pollutant (except greenhouse gases) by less than 50 tons per year after applying best available control technology, certain PSD requirements do not apply as they relate to maximum allowable increases for Class II areas.

**Summary after (live, after Part 3):**

This exemption applies to modifications of major stationary sources that existed on March 1, 1978. If such a modification would increase allowable emissions of each regulated pollutant (except greenhouse gases) by less than 50 tons per year after applying best available control technology, certain PSD requirements do not apply as they relate to maximum allowable increases for Class II areas.

**Reviewer's reasons:** Text says 'each pollutant subject to regulation', so the threshold must be met for every pollutant.

## 6. `sec-7-B-I-L-5-a-(i)` -- restored

**Text above the provision (each ancestor, first 700 characters):**

> [sec-7-B-I] I. Volatile Organic Compound Emissions from Oil and Gas Operations
> [sec-7-B-I-L]  Leak detection and repair program for well production facilities and natural gas compressor stations located in the 8-hour Ozone Control Area or northern Weld County, or centralized oil stabilization facilities specified in Section I.A.3. 
> [sec-7-B-I-L-5] I.L.5. Repair and remonitoring
> [sec-7-B-I-L-5-a]  First attempt to repair a leak must be made no later than five (5) working days after discovery and completed no later than thirty (30) working days after discovery, unless parts are unavailable, the equipment requires shutdown to complete repair, or other good cause exists. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-I-L-5-a-(i)]   If parts are unavailable, they must be ordered promptly and the repair must be made within fifteen (15) working days of receipt of the parts. 

**Summary before (snapshot, the hand-approved text):**

This provision applies to operators who have identified equipment requiring repair under the leak detection and repair program. It requires that if replacement parts needed for a repair are unavailable, the operator must order them promptly and complete the repair within 15 working days after receiving the parts. This extends the normal repair deadline when parts availability causes delays.

**Summary after (live, after Part 3):**

This provision applies to operators who have identified equipment requiring repair under the leak detection and repair program. It requires that if replacement parts needed for a repair are unavailable, the operator must order them promptly and complete the repair within 15 working days after receiving the parts. This extends the normal repair deadline when parts availability causes delays.

**Reviewer's reasons:** re-review with the full ancestor context found no error; the earlier correction is withdrawn and the original summary restored

## 7. `sec-gp01-VIII-C-1-a-(ii)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-gp01-VIII] VIII. General Permit Terms and Administration
> [sec-gp01-VIII-C] VIII.C. General Terms
> [sec-gp01-VIII-C-1]  A revised APEN must be filed: (Reference: Regulation Number 3 , Part A, Section II.C. ) 
> [sec-gp01-VIII-C-1-a]  Annually by April 30th of the year following a significant increase in emissions as follows: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp01-VIII-C-1-a-(ii)]   For volatile organic compounds and nitrogen oxides sources in ozone non-attainment areas, a change in annual actual emissions of one ton per year or more or five percent, whichever is greater, above the level reported on the last APEN submitted to the Division; or 

**Summary before (snapshot, the hand-approved text):**

The permit requires you to submit an updated Air Pollutant Emission Notice (APEN) by April 30 if your facility is in an ozone non-attainment area and your annual actual emissions of VOC or NOx increased by 1 tpy or more, or by 5 percent, whichever is greater, compared to the emissions level in your last APEN. This applies only when that increase qualifies as a "significant increase" under the permit's definition.

**Summary after (live, after Part 3):**

The permit requires you to submit a revised Air Pollutant Emission Notice (APEN) by April 30 of the year following a significant increase in emissions, if your source is in an ozone non-attainment area and your annual actual emissions of VOC or NOx increased by 1 tpy or more, or by 5 percent, whichever is greater, compared to the emissions level in your last APEN submitted to the Division.

**Reviewer's reasons:** Parent text VIII.C.1.a. sets the deadline as April 30th of the year following a significant increase.; The text gives no definition of "significant increase"; the threshold is stated in the provision itself.; Provision text says the level reported on the last APEN submitted to the Division.

## 8. `sec-7-B-VI-D-1-a-(iii)-(B)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-7-B-VI]  (State Only) Oil and Natural Gas Pre-Production, Early Production and Production Operations 
> [sec-7-B-VI-D] VI.D. Emission reduction from pre-production flowback vessels
> [sec-7-B-VI-D-1] VI.D.1. Control
> [sec-7-B-VI-D-1-a]  Owners or operators of a well with flowback that begins on or after May 1, 2021, must collect and control emissions from each flowback vessel on and after the date flowback is routed to the flowback vessel by routing emissions to and operating air pollution control equipment that achieves a hydrocarbon control efficiency of at least 95%. If a combustion device is used, it must have a design destruction efficiency of at least 98% for hydrocarbons. 
> [sec-7-B-VI-D-1-a-(iii)]  Owners or operators must use a tank measurement system to determine the quantity of liquids in the flowback vessel(s). 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-VI-D-1-a-(iii)-(B)]   Opening the thief hatch or other access point if required to inspect, test, or calibrate the tank measurement system or to add biocides or chemicals is not a violation of Section VI.D.1.a.(ii)(A). 

**Summary before (snapshot, the hand-approved text):**

Opening the thief hatch or other access point on a pre-production flowback vessel for purposes of inspecting, testing, or calibrating the tank measurement system or adding biocides or chemicals does not constitute a violation of the emission control requirements in Section VI.D.1.a.(ii)(A). This provision applies to operators of pre-production flowback vessels and provides an exception for necessary operational and maintenance activities.

**Summary after (live, after Part 3):**

Opening the thief hatch or other access point on a pre-production flowback vessel if required to inspect, test, or calibrate the tank measurement system or to add biocides or chemicals does not constitute a violation of Section VI.D.1.a.(ii)(A). This provision applies to owners or operators who must use a tank measurement system to determine the quantity of liquids in flowback vessels.

**Reviewer's reasons:** Text conditions the exception on the opening being 'if required'.; Text does not describe the cited section.; The parent (iii) addresses owners or operators using a tank measurement system; 'necessary operational and maintenance activities' is not in the text.

## 9. `sec-7-B-II-H-5-c-(iii)` -- restored

**Text above the provision (each ancestor, first 700 characters):**

> [sec-7-B-II] II. (State Only) Statewide Controls for Oil and Gas Operations
> [sec-7-B-II-H]  (State Only) Emission reductions from midstream segment pigging operations and blowdowns of piping and equipment. 
> [sec-7-B-II-H-5]  Recordkeeping. The owner or operator must maintain records for a period of five (5) years and make them available to the Division upon request, including 
> [sec-7-B-II-H-5-c] II.H.5.c. Records of blowdowns.

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-II-H-5-c-(iii)]   The date, location, identification of equipment or piping and number of blowdown events (other than pigging operations), including identification of whether the volume between isolation valves is less than 50 cf. 

**Summary before (snapshot, the hand-approved text):**

This provision applies to operators conducting blowdown events at oil and gas facilities. It requires records to document the date, location, equipment or piping identification, and number of blowdown events (excluding pigging operations), and must identify whether the volume between isolation valves is less than 50 cubic feet. This is a recordkeeping requirement that specifies the information that must be captured for each blowdown event as part of the broader blowdown records required under II.H.5.c.

**Summary after (live, after Part 3):**

This provision applies to operators conducting blowdown events at oil and gas facilities. It requires records to document the date, location, equipment or piping identification, and number of blowdown events (excluding pigging operations), and must identify whether the volume between isolation valves is less than 50 cubic feet. This is a recordkeeping requirement that specifies the information that must be captured for each blowdown event as part of the broader blowdown records required under II.H.5.c.

**Reviewer's reasons:** re-review with the full ancestor context found no error; the earlier correction is withdrawn and the original summary restored

## 10. `sec-gp07-II-B-1-b` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-gp07-II] II. Operating Terms and Conditions
> [sec-gp07-II-B] II.B. Facility-Wide Emission Limitation Requirements
> [sec-gp07-II-B-1]  The owner or operator not subject to Conditions I.B. or I.C. or I.D. of this permit must track potential emissions from all insignificant activities at the facility on an annual basis to demonstrate compliance with the facility emission limitations indicated below. An inventory of each insignificant activity and associated emission calculations must be made available to the Division for inspection upon request. For the purposes of this condition, insignificant activities are defined as any activity or equipment which emits any amount of a regulated pollutant but does not require an APEN or is permit exempt. Note that for reclassifications of an existing nonattainment area, the limit applies

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp07-II-B-1-b]   Facilities located in an area classified as serious nonattainment for ozone, total potential point source emissions from the facility, including all permitted emissions and potential to emit from all insignificant activities, must be less than: Volatile Organic Compounds (VOC): 50 tons per year Nitrogen Oxides (NOx): 50 tons per year Carbon Monoxide (CO): 100 tons per year 

**Summary before (snapshot, the hand-approved text):**

The permit requires facilities in a serious ozone nonattainment area to keep total potential point source emissions (permitted plus all insignificant activities) below 50 tpy VOC, 50 tpy NOx, and 100 tpy CO. The owner or operator must track insignificant-activity emissions annually and make the inventory and calculations available to the Division on request.

**Summary after (live, after Part 3):**

The permit requires facilities in a serious ozone nonattainment area to keep total potential point source emissions (permitted plus all insignificant activities) below 50 tpy VOC, 50 tpy NOx, and 100 tpy CO. The owner or operator not subject to Conditions I.B., I.C. or I.D. must track insignificant-activity emissions annually and make the inventory and calculations available to the Division on request.

**Reviewer's reasons:** Parent II.B.1. limits the tracking duty to owners or operators not subject to Conditions I.B., I.C. or I.D.

## 11. `sec-7-B-II-E-9-g` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-7-B-II] II. (State Only) Statewide Controls for Oil and Gas Operations
> [sec-7-B-II-E]  (State Only) Leak detection and repair program for well production facilities and natural gas compressor stations 
> [sec-7-B-II-E-9]  Reporting. The owner or operator of each facility subject to the leak detection and repair requirements in Section II.E. must submit a single annual report using the Division-approved format on or before May 31st of each year (beginning May 31st, 2019) that includes, at a minimum, the following information regarding leak detection and repair activities at their subject facilities conducted the previous calendar year: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-II-E-9-g]   Each report must be accompanied by a certification by a responsible official that, based on information and belief formed after reasonable inquiry, the statements and information in the document are true, accurate, and complete 

**Summary before (snapshot, the hand-approved text):**

Every report submitted under this section must include a signed statement from a responsible company official certifying that they made a reasonable effort to verify the information and that, to the best of their knowledge, everything in the report is true, accurate, and complete. This is basically requiring an official signature vouching for the accuracy of what's being submitted.

**Summary after (live, after Part 3):**

Every report submitted under this section must be accompanied by a certification by a responsible official that, based on information and belief formed after reasonable inquiry, the statements and information in the report are true, accurate, and complete. This is basically requiring an official to certify the accuracy of what's being submitted.

**Reviewer's reasons:** Text says the report is accompanied by a certification by a responsible official; it does not mention a signed statement or a company official.; Text requires a certification and does not mention a signature.

## 12. `sec-3-B-III-J-2-b-(ii)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-3-B-III] III. Construction Permit Review Procedures
> [sec-3-B-III-J] III.J. (State Only) Disproportionately Impacted Community Monitoring Provisions
> [sec-3-B-III-J-2] III.J.2. (State Only) Source-Specific Monitoring Table 1 – Cumulatively Impacted Community Monitoring Thresholds Affected Pollutant Maximum Annual Average Modeled Concentration Benzene ≥ 5 ppb Toluene ≥ 664 ppb Ethylbenzene ≥ 115 ppb Xylene ≥ 12 ppb PM2.5 &gt; 6 µg/m3 Nitrogen Dioxide &gt; 50 µg/m3 
> [sec-3-B-III-J-2-b]  Source-specific monitoring plans required pursuant to Section III.J.2. of this Part B or Section V.C.5.d.(i) of Part C of this Regulation Number 3 must identify how the selected source- specific monitoring is the best available monitoring technology that is reasonably available and capable of detecting or monitoring pollutants for which the Affected Construction Source triggered source-specific monitoring. The source-specific monitoring plan must also identify how the source-specific monitoring will inform how the emissions of the Affected Pollutant being monitored will impact the ambient air concentrations in the Disproportionately Impacted Community in which the source is located. Source-

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-B-III-J-2-b-(ii)]   If accessible to the source’s owner/operator, the installation and operation of air quality monitors within 0.25- miles of the area of highest annual average modeled concentration if the area of highest annual average modeled concentration is within 0.25-miles of an Occupied Area or the nearest logistically practical location. Monitor locations must be approved by the Division; 

**Summary before (snapshot, the hand-approved text):**

If the source owner or operator can access it, they must install and operate air quality monitors within a quarter-mile of the spot where modeling shows the highest annual average concentration – but only if that spot is itself within a quarter-mile of an Occupied Area; if not accessible at that exact location, monitors go at the nearest practical spot. The Division must approve the monitor locations.

**Summary after (live, after Part 3):**

If the source owner or operator can access it, monitoring may be done by installing and operating air quality monitors within a quarter-mile of the spot where modeling shows the highest annual average concentration if that spot is within a quarter-mile of an Occupied Area, or otherwise at the nearest logistically practical location. The Division must approve the monitor locations.

**Reviewer's reasons:** Text offers this as one option, with the nearest logistically practical location as the alternative to the Occupied Area condition, not an accessibility fallback.

## 13. `sec-7-C-J` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> (none: the provision sits directly under the document root)

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-C-J]   December 17, 2006 ( Sections I.A.1.b. and XVII.) This Statement of Basis, Specific Statutory Authority and Purpose complies with the requirements of the Colorado Administrative Procedure Act §§ 24-4-103(4), C.R.S. for new and revised regulations. Basis The Air Quality Control Commission has adopted these state-only provisions as a means of reducing air emissions from oil and gas operations throughout Colorado. Due to the large growth in oil and gas production in a number of regions of the state emissions from oil and gas operations have rapidly increased over the past few years and are expected to increase further in the foreseeable future. These revisions are a proactive measure designed to eliminate air emissions that could threaten attainment of ambient air quality standards and adversely affect visibility in Class I Areas. These revisions are based on reasonably available, validated, reviewed and sound scientific methodologies. All validated, reviewed and sound scientific methodologies made available by interested parties have been considered. Evidence in the record supports the finding that the rule shall result in a demonstrable reduction in air pollution, and w

**Summary before (snapshot, the hand-approved text):**

This is an administrative provision that provides the legal basis, statutory authority, and purpose for December 17, 2006 revisions to Regulation 7 Sections I.A.1.b. and XVII. It explains that the Air Quality Control Commission adopted state-only provisions to reduce air emissions from oil and gas operations statewide due to rapid production growth, establishing emission control requirements for condensate storage tanks (production tanks only, not produced water tanks), glycol dehydrators, and natural gas-fired reciprocating internal combustion engines, with a 95% average control efficiency standard for tanks and dehydrators. The provision clarifies that applicability thresholds are based on emissions during the preceding 12-month period (or projected 12-month emissions for tanks in service less than 12 months), operators have 90 days to install controls for tanks serving newly drilled/recompleted/restimulated wells, and units subject to MACT, BACT, or NSPS programs are exempted. The statutory authority is found in Colorado Air Pollution Prevention and Control Act sections 25-7-105.1, 25-7-106, and 25-7-109.

**Summary after (live, after Part 3):**

This is an administrative provision that provides the legal basis, statutory authority, and purpose for December 17, 2006 revisions to Regulation 7 Sections I.A.1.b. and XVII. It explains that the Air Quality Control Commission adopted state-only provisions to reduce air emissions from oil and gas operations statewide due to rapid production growth, establishing emission control requirements for condensate storage tanks (production tanks only, not produced water tanks), glycol dehydrators, and natural gas-fired reciprocating internal combustion engines, with a 95% average control efficiency standard for tanks and dehydrators. The provision clarifies that applicability thresholds are based on emissions during the preceding 12-month period (or projected 12-month emissions for tanks in service less than 12 months), operators have 90 days to determine anticipated production and, if necessary, install a control device for tanks serving newly drilled/recompleted/restimulated wells, and units subject to MACT, BACT, or NSPS programs are exempted. The statutory authority is found in Colorado Air Pollution Prevention and Control Act sections 25-7-105.1, 25-7-106, and 25-7-109.

**Reviewer's reasons:** Text gives 90 days to determine anticipated production and, if necessary, install a control device.

## 14. `sec-7-B-VI-C-1-a` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-7-B-VI]  (State Only) Oil and Natural Gas Pre-Production, Early Production and Production Operations 
> [sec-7-B-VI-C] VI.C. Air quality monitoring
> [sec-7-B-VI-C-1]  Owners or operators of drilling operations that begin on or after May 1, 2021, must monitor air quality at and/or around the pre-production and early production operations. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-7-B-VI-C-1-a]   Owners or operators must monitor air quality for at least ten (10) days prior to beginning pre-production operations, during all pre-production operations, and for at least six months after the well is capable of consistently producing either separable gas or salable liquid hydrocarbons (i.e., early production). 

**Summary before (snapshot, the hand-approved text):**

Owners or operators must conduct air quality monitoring for at least 10 days before starting pre-production operations, throughout all pre-production operations, and for at least six months after the well can consistently produce either separable gas or salable liquid hydrocarbons (early production). This monitoring requirement applies to all phases from pre-production through the first six months of consistent production capability.

**Summary after (live, after Part 3):**

Owners or operators must conduct air quality monitoring for at least 10 days before starting pre-production operations, throughout all pre-production operations, and for at least six months after the well can consistently produce either separable gas or salable liquid hydrocarbons (early production). This applies to owners or operators of drilling operations that begin on or after May 1, 2021.

**Reviewer's reasons:** The six months is a minimum ("at least"), not the first six months only; the parent text limits the duty to drilling operations beginning on or after May 1, 2021.

## 15. `sec-3-D-II-A-13-b-(i)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-3-D-II] II. Definitions
> [sec-3-D-II-A]  The following definitions apply specifically to the provisions contained in this Part D . 
> [sec-3-D-II-A-13] II.A.13. Emissions Unit
> [sec-3-D-II-A-13-b]  With respect to GHGs means any part of a stationary source that emits or has the potential to emit GHGs. For purposes of Section XV. , there are two types of emissions units: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-D-II-A-13-b-(i)]   A new emissions unit is any emissions unit that is (or will be) newly constructed and that has existed for less than two years from the date such emissions unit first operated. 

**Summary before (snapshot, the hand-approved text):**

A new emissions unit (for greenhouse gases) is any part of a stationary source that is newly built and has been operating for less than two years from the date it first started up.

**Summary after (live, after Part 3):**

A new emissions unit (for greenhouse gases) is any part of a stationary source that is (or will be) newly constructed and has existed for less than two years from the date it first operated.

**Reviewer's reasons:** Text: "is (or will be) newly constructed and that has existed for less than two years from the date such emissions unit first operated."

## 16. `sec-3-A-II-D-5` -- restored

**Text above the provision (each ancestor, first 700 characters):**

> [sec-3-A-II] II. Air Pollutant Emission Notice (APEN) Requirements
> [sec-3-A-II-D] II.D. Exemptions from Air Pollutant Emission Notice Requirements

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-A-II-D-5]   Commercial (for hire) laboratories whose primary responsibilities are to perform qualitative or quantitative analysis on environmental, clinical, geological, forensic, or process samples may estimate emissions for purposes of Air Pollutant Emission Notice reporting based upon a mass balance calculation utilizing inventory and purchase records of solvents and reagents. Such laboratories may, at their discretion, group emission points if such grouping meets the grouping criteria outlined in this regulation. All inert samples are exempt from Air Pollutant Emission Notice reporting. Emissions from samples subjected to analysis provided to such laboratories for analysis and testing, and by-products that result from sample testing, are exempt from Air Pollutant Emission Notice reporting, provided such samples subjected to analysis are less than five gallons for liquids, or five pounds for solids. 

**Summary before (snapshot, the hand-approved text):**

Commercial laboratories that analyze environmental, clinical, geological, forensic, or process samples for hire may estimate emissions for APEN reporting using a mass balance calculation based on solvent and reagent inventory and purchase records. They may group emission points if the grouping meets the regulation's criteria. All inert samples are exempt from APEN reporting, and emissions from samples being analyzed and their testing by-products are also exempt as long as the samples are less than five gallons (liquids) or five pounds (solids).

**Summary after (live, after Part 3):**

Commercial laboratories that analyze environmental, clinical, geological, forensic, or process samples for hire may estimate emissions for APEN reporting using a mass balance calculation based on solvent and reagent inventory and purchase records. They may group emission points if the grouping meets the regulation's criteria. All inert samples are exempt from APEN reporting, and emissions from samples being analyzed and their testing by-products are also exempt as long as the samples are less than five gallons (liquids) or five pounds (solids).

**Reviewer's reasons:** re-review with the full ancestor context found no error; the earlier correction is withdrawn and the original summary restored

## 17. `sec-gp02-XI-C-1-a-(ii)` -- restored

**Text above the provision (each ancestor, first 700 characters):**

> [sec-gp02-XI] XI. General Permit Terms and Administration
> [sec-gp02-XI-C] XI.C. General Terms
> [sec-gp02-XI-C-1]  A revised APEN shall be filed: (Reference: Regulation Number 3 , Part A, Section II.C. ) 
> [sec-gp02-XI-C-1-a]  Annually by 30 April of the year following a significant increase in emissions as follows: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp02-XI-C-1-a-(ii)]   For volatile organic compounds and nitrogen oxides sources in ozone non-attainment areas, a change in annual actual emissions of one ton per year or more or five percent, whichever is greater, above the level reported on the last APEN submitted to the Division; or 

**Summary before (snapshot, the hand-approved text):**

The permit requires an updated APEN by April 30 of the year after a significant emission increase, which for VOC and NOx sources in ozone non-attainment areas means an increase of one ton per year or more, or five percent (whichever is greater), above the emissions level reported on the last APEN submitted to the Division.

**Summary after (live, after Part 3):**

The permit requires an updated APEN by April 30 of the year after a significant emission increase, which for VOC and NOx sources in ozone non-attainment areas means an increase of one ton per year or more, or five percent (whichever is greater), above the emissions level reported on the last APEN submitted to the Division.

**Reviewer's reasons:** re-review with the full ancestor context found no error; the earlier correction is withdrawn and the original summary restored

## 18. `sec-3-A-V-E-3-c` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-3-A-V] V. Emission Reduction Credits Certification, Transfer, and Use for Offsets
> [sec-3-A-V-E] V.E. Use of emission reduction credits
> [sec-3-A-V-E-3]  Criteria and procedure for use The use of emission reduction credits as offsets to meet the requirements of nonattainment new source review, as outlined in Section V.A.3. of Part D of this regulation, may be approved only if it meets the following criteria: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-A-V-E-3-c]   ERCs intended to be used as offsets to meet the requirements of nonattainment new source review must be obtained by the owner or operator of the proposed new or modified source prior to the application to use them. The owner or operator intending to use the credits as offsets may supply ERCs they have certified themselves or alternatively, secure ERCs from other entities through transfer of ownership as described in Section V.F. 

**Summary before (snapshot, the hand-approved text):**

This applies to owners or operators who want to use emission reduction credits (ERCs) as offsets in nonattainment new source review. You must obtain the ERCs before you apply to use them as offsets. You can either use ERCs you certified yourself or buy/transfer ERCs from another entity.

**Summary after (live, after Part 3):**

This applies to owners or operators who want to use emission reduction credits (ERCs) as offsets in nonattainment new source review. You must obtain the ERCs before you apply to use them as offsets. You can either use ERCs you certified yourself or secure ERCs from other entities through transfer of ownership as described in Section V.F.

**Reviewer's reasons:** Text says ERCs are secured through transfer of ownership under Section V.F; it does not mention buying.

## 19. `sec-gp05-VIII-C-9` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-gp05-VIII] VIII. General Permit Terms and Administration
> [sec-gp05-VIII-C] VIII.C. General Terms

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-gp05-VIII-C-9]   Registration under this permit is approved in reliance upon the accuracy and completeness of information supplied by the applicant and is conditioned upon operation of the source, in accordance with this information and with representations made by the applicant or applicant's agents. It is valid only for the equipment and operations or activity specifically identified on the general permit registration. 

**Summary before (snapshot, the hand-approved text):**

The permit is valid only for the specific equipment and operations you listed in your registration, and the Division approved it based on the accuracy and completeness of the information you submitted. You must operate the source exactly as described in your application and any representations you or your agents made.

**Summary after (live, after Part 3):**

The permit is valid only for the specific equipment and operations you listed in your registration, and the registration was approved based on the accuracy and completeness of the information you submitted. The registration is conditioned on operating the source in accordance with that information and any representations you or your agents made.

**Reviewer's reasons:** Text names no approving party; it says registration is approved in reliance on the information.; Text states a condition of registration, in accordance with the information and representations, with no 'exactly'.

## 20. `sec-3-C-II-F` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-3-C-II] II. General Requirements for Operating Permits

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-3-C-II-F]   Sources that are not required by this Part C to obtain an operating permit may elect to apply for, and may be issued, an operating permit. Any such permit issued must contain terms and conditions sufficient to satisfy the requirements of this regulation. 

**Summary before (snapshot, the hand-approved text):**

If your source is not required to get an operating permit under Part C, you may still choose to apply for one. If the Division issues you that voluntary permit, it must include terms and conditions that meet the requirements of this regulation.

**Summary after (live, after Part 3):**

If your source is not required to get an operating permit under Part C, you may still choose to apply for one. If such a permit is issued to you, it must include terms and conditions that meet the requirements of this regulation.

**Reviewer's reasons:** The text says only that such a permit may be issued and does not name the Division.
