# Re-review stage 2b (all remaining hand-approved summaries), 6 Oct 2026: 40-row spot-check sample

Stage 2b of the re-review of hand-approved summaries (`pipeline/review.py --rereview`, claude-sonnet-5-5, effort low, prompt version 33b17e6a7a with the full ancestor context, system prompt cached 1h): every approved or edited row whose reviewed_by was still a September hand pass after stages 1 and 2a, 11,917 rows across 42 regulations. Two workflow runs wrote it: https://github.com/ontargetequipment/Essentialregs.com/actions/runs/37410161694 submitted all 12 batches and wrote batches 1 to 7 and part of 8 (7,397 rows: 4,781 pass, 2,602 corrected, 14 fail) before the writer's connection was closed by the database host after 10,000 requests (HTTP/2 stream limit); https://github.com/ontargetequipment/Essentialregs.com/actions/runs/37413829105 (`--resume-batch`, submitted nothing new) consumed the finished batches 8 to 12 and wrote the remaining 4,520 rows (2,852 pass, 1,663 corrected, 5 fail). Stage 2b in total: **7,861 pass, 4,023 corrected, 19 fail** (fail = set back to pending, text untouched, regenerated in step 2). Cost: $15.71 counted for batches 1 to 7 plus $10.60 counted by the resume run, plus an estimated $0.90 for the 383 batch-8 rows the first run wrote before it died (its usage was never tallied): about **$27.2**. Cache read share 78 to 79% of input tokens. Every selected row was snapshotted to `archive.summary_review_snapshot_rereview` before the first write.

This sample: 40 rows drawn at random (seeded): 20 pass and 20 corrected, one row per regulation, the regulations ordered by `md5(reg_key || '20261005')` with ecmc, p192, oooob and ooooc placed first, and within each regulation the first row by `md5(id || '20261005')`. For each: the text above the provision as the reviewer now sees it (every ancestor below the document root, first 700 characters each), the official text (provision plus descendants, first 1,200 characters), the summary before (the hand-approved text from the snapshot) and, for a corrected row, the summary after (live) with the reviewer's one-line reasons. For a pass, before and after are the same. Rows 1 to 20 are passes, 21 to 40 corrections.

Known and accepted (not fixed here, for the ReviewBuiltIn work): in about 2% of corrections the reviewer removes a correct acronym expansion the hand pass had added.

## 1. `sec-ecmc-702-d-(5)-A-iv` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ecmc-702]  Rule 702 . — FINANCIAL ASSURANCE FOR PLUGGING, ABANDONMENT, AND RECLAMATION
> [sec-ecmc-702-d]  Contents of Financial Assurance Plans. Financial Assurance Plans will meet the informational criteria listed below. 
> [sec-ecmc-702-d-(5)] 702.d.(5). Option 5 Plans.
> [sec-ecmc-702-d-(5)-A]  Information Requirements. An Operator requesting Commission approval pursuant to Rule 702.c.(5) will file a Financial Assurance Plan that includes the following information to demonstrate it satisfies the criteria for Option 5: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ecmc-702-d-(5)-A-iv]  Inactive Well List. A list of all the Operator’s Inactive Wells that includes the name, number, API number, status, reason for no or low production, and planned date for return to production or plug each Well. Energy and Carbon Management Commission 

**Summary before (snapshot, the hand-approved text):**

An operator seeking approval of an Option 5 financial assurance plan must submit a list of all its inactive wells, showing each well's name, number, API number, status, the reason it has no or low production, and the planned date to either return it to production or plug it.

**Summary after (live):** unchanged

## 2. `sec-oooob-60.5365b-(d)-(2)-(ii)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-oooob-60.5365b]  You are subject to the applicable provisions of this subpart if you are the owner or operator of one or more of the onshore affected facilities listed in paragraphs (a) through (i) of this section, that is located within the Crude Oil and Natural Gas source category, as defined in § 60.5430b , for which you commence construction, modification, or reconstruction after December 6, 2022. Facilities located inside and including the Local Distribution Company (LDC) custody transfer station are not subject to this subpart. 
> [sec-oooob-60.5365b-(d)]  Each process controller affected facility, which is the collection of natural gas-driven process controllers at a well site, centralized production facility, onshore natural gas processing plant, or a compressor station. Natural gas-driven process controllers that function as emergency shutdown devices and process controllers that are not driven by natural gas are not included in the affected facility. 
> [sec-oooob-60.5365b-(d)-(2)]  For the purposes of § 60.5390b , owners and operators may choose to apply reconstruction as defined in § 60.15(b) based on the fixed capital cost of the new process controllers in accordance with paragraph (d)(2)(i) of this section, or the definition of reconstruction based on the number of natural gas-driven process controllers in the affected facility in accordance with paragraph (d)(2)(ii) of this section. Owners and operators may choose which definition of reconstruction to apply and whether to comply with paragraph (d)(2)(i) or (ii) of this section; they do not need to apply both. If owners and operators choose to comply with paragraph (d)(2)(ii) of this section they may demonstrate co

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-oooob-60.5365b-(d)-(2)-(ii)]  If the owner or operator applies the definition of reconstruction based on the percentage of natural gas-driven process controllers replaced, reconstruction occurs when greater than 50 percent of the natural gas-driven process controllers at a site are replaced. The percentage includes all natural gas-driven process controllers which are or will be replaced pursuant to all continuous programs of natural gas-driven process controller replacement which are commenced within any 24-month rolling period following December 6, 2022. If an owner or operator determines reconstruction based on the percentage of natural gas-driven process controllers that are replaced, the owner or operator must also comply with § 60.15(a). 

**Summary before (snapshot, the hand-approved text):**

If you choose to determine reconstruction based on the percentage of natural gas-driven process controllers replaced at a site, reconstruction occurs when more than 50 percent of those controllers are replaced under any continuous replacement programs started within any 24-month rolling period after December 6, 2022. If you use this percentage-based method, you must also comply with 40 CFR 60.15(a).

**Summary after (live):** unchanged

## 3. `sec-ooooc-60.5415c-(e)-(1)-(vii)-(A)-(3)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ooooc-60.5415c] § 60.5415c How do I demonstrate continuous compliance with the standards for each of my designated facilities?
> [sec-ooooc-60.5415c-(e)]  Additional continuous compliance requirements for well, centrifugal compressor, reciprocating compressor, process controllers in Alaska, storage vessel, process unit equipment, or pump designated facilities. For each associated gas well at your well designated facility, each gas well liquids unloading operation at your well designated facility, each centrifugal compressor designated facility, each reciprocating compressor designated facility, each process controller designated facility in Alaska, each storage vessel designated facility, each process unit equipment designated facility, and each pump designated facility referenced to this paragraph from paragraph (a) , (b) , (c)(2) , (d)(1) ,
> [sec-ooooc-60.5415c-(e)-(1)]  You must demonstrate continuous compliance with the control device performance requirements of § 60.5412c(a) using the procedures specified in paragraphs (e)(1)(i) through (viii) of this section and conducting the monitoring as required by § 60.5417c . If you use a condenser as the control device to achieve the requirements specified in § 60.5412c(a)(2) , you may demonstrate compliance according to paragraph (e)(1)(ix) of this section. You may switch between compliance with paragraphs (e)(1)(i) through (viii) of this section and compliance with paragraph (e)(1)(ix) of this section only after at least 1 year of operation in compliance with the selected approach. You must provide notification
> [sec-ooooc-60.5415c-(e)-(1)-(vii)]  If you use an enclosed combustion device to meet the requirements of § 60.5412c(a)(1) and you demonstrate compliance using the test procedures specified in § 60.5413c(b) , or you use a flare designed and operated in accordance with § 60.5412c(a)(3) , you must comply with the applicable requirements in paragraphs (e)(1)(vii)(A) through (E) of this section. 
> [sec-ooooc-60.5415c-(e)-(1)-(vii)-(A)]  For each enclosed combustion device which is not a catalytic vapor incinerator and for each flare, you must comply with the requirements in paragraphs (e)(1)(vii)(A)(1) through (4) of this section. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ooooc-60.5415c-(e)-(1)-(vii)-(A)-(3)]  Devices failing the visible emissions test must follow manufacturer's repair instructions, if available, or best combustion engineering practice as outlined in the unit inspection and maintenance plan, to return the unit to compliant operation. All repairs and maintenance activities for each unit must be recorded in a maintenance and repair log and must be available for inspection. 

**Summary before (snapshot, the hand-approved text):**

Devices that fail the visible emissions test must be repaired following the manufacturer's instructions if available, or using best combustion engineering practice as described in the unit's inspection and maintenance plan, to bring the unit back into compliance. You must record all repairs and maintenance activities for each unit in a maintenance and repair log and keep it available for inspection.

**Summary after (live):** unchanged

## 4. `sec-p192-192.465-(c)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-p192-192.465] § 192.465 External corrosion control: Monitoring and remediation.

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-p192-192.465-(c)]  Each reverse current switch, each diode, and each interference bond whose failure would jeopardize structure protection must be electrically checked for proper performance six times each calendar year, but with intervals not exceeding 2 1/2 months. Each other interference bond must be checked at least once each calendar year, but with intervals not exceeding 15 months. 

**Summary before (snapshot, the hand-approved text):**

Pipeline operators must electrically check reverse current switches, diodes, and interference bonds whose failure would jeopardize structure protection six times each calendar year, with intervals not exceeding 2½ months between checks. All other interference bonds must be checked at least once each calendar year, with intervals not exceeding 15 months.

**Summary after (live):** unchanged

## 5. `sec-23-A-II-E` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-23-A-II] II. Definitions

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-23-A-II-E]  “Average Cost Effectiveness” means the total annualized costs of control divided by annual emissions reductions (the difference between baseline annual emissions and the estimate of emissions after controls). For the purposes of calculating average cost effectiveness, baseline annual emissions mean a realistic depiction of anticipated annual emissions for the source. The source or the Division may use state or federally enforceable permit limits or estimate the anticipated annual emissions based upon actual emissions from a representative baseline period. 

**Summary before (snapshot, the hand-approved text):**

Average Cost Effectiveness is the total annualized cost of a control divided by the annual emissions reduction (baseline emissions minus estimated emissions after controls). Baseline annual emissions should realistically depict what the source is expected to emit annually; the source or the Division may use enforceable permit limits or estimate anticipated emissions based on actual emissions from a representative baseline period.

**Summary after (live):** unchanged

## 6. `sec-28-A-III-FF` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-28-A-III] III. Definitions

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-28-A-III-FF]  “Parking” means buildings and lots used for parking vehicles. This includes open parking lots, partially enclosed parking structures, and completely enclosed (or underground) parking structures. Parking garages may be free standing or physically connected to the property. 

**Summary before (snapshot, the hand-approved text):**

"Parking" means buildings and lots used for parking vehicles, including open lots, partially enclosed structures, and fully enclosed or underground structures, whether free-standing or connected to the property.

**Summary after (live):** unchanged

## 7. `sec-22-A-IV-A-3` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-22-A-IV] IV. Reporting Requirements
> [sec-22-A-IV-A]  Owners and operators of facilities or entities identified in Section III.A. must submit a report of all GHG emissions or supply in the previous calendar year. GHG emissions or supply must be reported utilizing Division-approved format or forms. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-22-A-IV-A-3]  The first report for owners and operators of facilities or entities subject to Subparts VV, WW, XX, YY, or ZZ of 40 CFR, Part 98, or newly subject to reporting under other Subparts of 40 CFR, Part 98 based on the incorporation by reference date for 40 CFR, Part 98 in this rule, is due on or before March 31, 2026 (and by March 31 every year thereafter). I.V.A.4. Owners and operators of facilities or entities under Sections III.A.8. and III.A.9. may report for any year. GHG emissions reported under this Section IV.A.4. must be submitted by March 31 for the prior year. 

**Summary before (snapshot, the hand-approved text):**

If you own or operate a facility or entity subject to federal Subparts VV, WW, XX, YY, or ZZ of 40 CFR Part 98, or you become newly subject to reporting under other Subparts of 40 CFR Part 98 based on the incorporation-by-reference date in this rule, your first report is due by March 31, 2026, and by March 31 every year thereafter. Owners and operators under Sections III.A.8. and III.A.9. may report for any year, and if they do, those GHG emissions must be submitted by March 31 for the prior year.

**Summary after (live):** unchanged

## 8. `sec-31-E-I-B-6` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-31-E-I] I. Remote Methane Monitoring Notifications and Responses
> [sec-31-E-I-B]  The owner or operator of an MSW landfill must investigate a notification of methane emissions detection(s) at or from the landfill obtained from remote methane monitoring within 5 calendar days of receiving the notification from the Division according to the following requirements. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-31-E-I-B-6]  If the owner or operator performs surface emissions monitoring at an MSW landfill in response to a remote methane monitoring notification, the owner or operator is only required to perform a single surface emissions monitoring event, as long as it covers the area(s) where the detected emissions were identified or originated from, and any re-monitoring if necessary, to comply with this Part E , Section I.B. 

**Summary before (snapshot, the hand-approved text):**

If the owner or operator performs surface emissions monitoring in response to a remote methane monitoring notification, they need to do only one surface emissions monitoring event (plus any re-monitoring if necessary to comply with Part E, Section I.B.), as long as it covers the area(s) where the detected emissions were identified or originated from.

**Summary after (live):** unchanged

## 9. `sec-zzzz-63.6590-(a)-(3)-(iii)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-zzzz-63.6590]  This subpart applies to each affected source. 
> [sec-zzzz-63.6590-(a)]  Affected source. An affected source is any existing, new, or reconstructed stationary RICE located at a major or area source of HAP emissions, excluding stationary RICE being tested at a stationary RICE test cell/stand. 
> [sec-zzzz-63.6590-(a)-(3)]  Reconstructed stationary RICE. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-zzzz-63.6590-(a)-(3)-(iii)]  A stationary RICE located at an area source of HAP emissions is reconstructed if you meet the definition of reconstruction in § 63.2 and reconstruction is commenced on or after June 12, 2006. 

**Summary before (snapshot, the hand-approved text):**

A stationary reciprocating internal combustion engine (RICE) at an area source of hazardous air pollutants (HAP) is considered reconstructed if it meets the definition of reconstruction in § 63.2 and reconstruction began on or after June 12, 2006.

**Summary after (live):** unchanged

## 10. `sec-11-A-II-26` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-11-A-II] II. DEFINITIONS

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-11-A-II-26]  “Emissions Control Systems” are those parts, assemblies or systems originally installed by the manufacturer in or on a vehicle for the purpose of reducing emissions. 

**Summary before (snapshot, the hand-approved text):**

"Emissions Control Systems" means the parts, assemblies, or systems that the vehicle manufacturer originally installed on the vehicle to reduce emissions.

**Summary after (live):** unchanged

## 11. `sec-25-B-I-P-1-c-(iii)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-25-B-I] I. Surface Coating Operations
> [sec-25-B-I-P] I.P. Motor Vehicle Materials
> [sec-25-B-I-P-1] I.P.1. Applicability
> [sec-25-B-I-P-1-c] I.P.1.c. This section does not apply to

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-25-B-I-P-1-c-(iii)]  Automotive coatings sold, supplied, or offered for sale in 0.5 fluid ounce or smaller containers intended to be used by the general public to repair tiny surface imperfections. 

**Summary before (snapshot, the hand-approved text):**

Automotive coatings sold in containers of 0.5 fluid ounce or smaller that are intended for use by the general public to repair tiny surface imperfections are exempt from the motor vehicle materials requirements in this section.

**Summary after (live):** unchanged

## 12. `sec-24-B-IV-A-2-e` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-24-B-IV] IV. Storage and Transfer of Petroleum Liquid
> [sec-24-B-IV-A] IV.A. General Requirements
> [sec-24-B-IV-A-2]  Definitions For the purpose of this section, the following definitions apply: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-24-B-IV-A-2-e]  "External Floating Roof" means a storage vessel cover in an open top tank consisting of a double deck or pontoon single deck which rests upon and is supported by the petroleum liquid being contained and is equipped with a closure seal or seals to close the space between the roof edge and tank wall. 

**Summary before (snapshot, the hand-approved text):**

"External Floating Roof" is defined as a cover in an open-top tank that floats on the petroleum liquid inside, supported by either a double deck or a pontoon single deck, and has one or more closure seals between the roof edge and the tank wall.

**Summary after (live):** unchanged

## 13. `sec-29-A-IV-A` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-29-A-IV] IV. Recordkeeping and reporting

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-29-A-IV-A]  State government agencies, local governments, and the federal government must maintain records for five (5) years demonstrating compliance with Sections III.A. through III.C. Records must be made available to the Division upon request. 

**Summary before (snapshot, the hand-approved text):**

State government agencies, local governments, and the federal government must keep records for five years showing they are complying with the restrictions in Sections III.A. through III.C. They must make those records available to the Division (Colorado Air Pollution Control Division) if the Division asks for them.

**Summary after (live):** unchanged

## 14. `sec-27-C-I-C-1-d` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-27-C-I] I. Audit Requirements
> [sec-27-C-I-C] I.C. Audit Reports
> [sec-27-C-I-C-1]  Each EITE stationary source must complete the audit report in accordance with Sections I.C.1.a. through III.C.1.e. and submit the audit report to the Division by December 31 of the audit year that includes the following elements for all GHG emission units listed in accordance with Section I.B. and specified in the Division-approved audit plan, at a minimum. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-27-C-I-C-1-d]  A plain-language summary of the audit findings, determinations, and recommendations in the top two languages spoken by the community surrounding the EITE stationary source. This summary shall include the list of GHG BAECT options for the emission units analyzed, how they were ranked and why they are being recommended. 

**Summary before (snapshot, the hand-approved text):**

The EITE stationary source must include in its audit report a plain-language summary of the audit findings, determinations, and recommendations written in the top two languages spoken by the surrounding community. The summary must list the GHG BAECT options for the emission units analyzed, explain how they were ranked, and state why they are being recommended.

**Summary after (live):** unchanged

## 15. `sec-12-A-III-B` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-12-A-III] III. Compliance Plan Filing – Time, Approval

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-12-A-III-B]  Approval and Disapproval The Division shall review and evaluate each Compliance Plan (filed with it within thirty (30) days of its receipt by the Division. Upon approval of a Compliance Plan, the Division shall return an approved copy of the plan to the Fleet who shall post the plan in a conspicuous place in the business location. If a Compliance Plan as filed is disapproved by the Division, the Division shall issue a letter of disapproval, and the Fleet shall have thirty (30) days within which to revise the plan and resubmit it to the Division. The Division shall have thirty (30) days to approve or disapprove the resubmitted plan. 

**Summary before (snapshot, the hand-approved text):**

The Division has 30 days from receiving a Compliance Plan to approve or disapprove it. If approved, the Division returns a copy to the fleet, which must post it in a conspicuous place at the business location. If disapproved, the Division sends a disapproval letter, the fleet has 30 days to revise and resubmit, and the Division then has another 30 days to approve or disapprove the revised plan.

**Summary after (live):** unchanged

## 16. `sec-jjjj-60.4232` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> (none below the document root)

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-jjjj-60.4232]  Engines manufactured by stationary SI internal combustion engine manufacturers must meet the emission standards as required in § 60.4231 during the certified emissions life of the engines. 

**Summary before (snapshot, the hand-approved text):**

If you manufacture stationary spark-ignition (SI) internal combustion engines, your engines must meet the emission standards in § 60.4231 for the entire certified emissions life of each engine.

**Summary after (live):** unchanged

## 17. `sec-26-B-II-A-6-b-(vi)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-26-B-II]  Control of Emissions from Stationary and Portable Combustion Equipment in the 8-Hour Ozone Control Area or Northern Weld County 
> [sec-26-B-II-A] II.A. Requirements for major sources of NOx
> [sec-26-B-II-A-6] II.A.6. Combustion process adjustment
> [sec-26-B-II-A-6-b] II.A.6.b. Combustion process adjustment

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-26-B-II-A-6-b-(vi)]  The owner or operator of a ceramic kiln must inspect and maintain the combustion controls and adjust the burners as necessary to ensure a proper air-to-fuel ratio. At units where entry into a piece of process equipment is required to complete the combustion process adjustment, in-kiln inspections and adjustments are required only during planned entries. 

**Summary before (snapshot, the hand-approved text):**

Owners or operators of ceramic kilns must inspect and maintain combustion controls and adjust burners as needed to keep the air-to-fuel ratio correct. If entering the kiln is necessary to make adjustments, those in-kiln inspections and adjustments are required only during planned entries (not at other times).

**Summary after (live):** unchanged

## 18. `sec-sip-VII-A` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-sip-VII] VII. Colorado Springs Attainment/Maintenance Area

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-sip-VII-A]  Statement of Basis, Specific Statutory Authority and Purpose Adopted: November 15, 2001 The amendments to the “ State Implementation Plan Specific Regulations for Nonattainment Areas (Local Elements) ” adopted by the Commission eliminate a contingency measure for Colorado Springs that was adopted as part of the nonattainment State Implementation Plan (SIP). Colorado Springs has since been redesignated to attainment/maintenance, and this contingency measure is no longer necessary or federally required. The amendments also revise the title of the regulation to " State Implementation Plan Specific Regulations for Nonattainment - Attainment/Maintenance Areas (Local Elements) .” Federal Requirements The federal requirements for nonattainment SIP contingency measures are set out in Section 172(c)(9) of the Clean Air Act (CAA). In November 1993, the Commission adopted a contingency measure for the Colorado Springs carbon monoxide (CO) nonattainment area that required the implementation of an enhanced inspection and maintenance program if the area failed to attain the CO National Ambient Air Quality Standards (NAAQS). EPA approved this contingency measure in December 1997.

**Summary before (snapshot, the hand-approved text):**

This is a Statement of Basis – rulemaking history explaining why the Commission removed an obsolete contingency measure from the Colorado Springs area regulations in 2001. It does not impose any current requirements.

**Summary after (live):** unchanged

## 19. `sec-30-B-III-E-1-f-(iv)-(A)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-30-B-III]  Emission Control Measures The following sections establish emission control regulations for each of the priority toxic air contaminants identified in Section I. of this Part B . Each priority toxic air contaminant section contains relevant applicability, exemptions, definitions, emission controls or limitations, recordkeeping, and reporting requirements. 
> [sec-30-B-III-E] III.E. Hydrogen sulfide
> [sec-30-B-III-E-1] III.E.1. Applicability
> [sec-30-B-III-E-1-f]  Recordkeeping, for the purposes of determining applicability. The owner or operator of each stationary source as described in Sections III.E.1. must maintain the following records, as applicable, for a period of five (5) years and make records available to the Division upon request. 
> [sec-30-B-III-E-1-f-(iv)]  An owner or operator that is determining stationary source applicability in accordance with Section III.E.1.c. , must maintain records of stationary source-wide forecasted actual hydrogen sulfide emissions and the date of the initial applicability emission threshold determination. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-30-B-III-E-1-f-(iv)-(A)]  An owner or operator that is determining applicability in accordance with Section III.E.1.c. , its forecasted actual hydrogen sulfide emissions are below the 10,000 lb/yr applicability threshold must maintain records of the stationary source-wide annual actual emissions of hydrogen sulfide for each of the five (5) calendar years after commencement of operation of the modified stationary source. 

**Summary before (snapshot, the hand-approved text):**

If an owner or operator determines under Section III.E.1.c. that its forecasted actual hydrogen sulfide emissions are below the 10,000 lb/yr applicability threshold, it must keep records of the stationary source-wide annual actual emissions of hydrogen sulfide for each of the five calendar years after the modified stationary source begins operating.

**Summary after (live):** unchanged

## 20. `sec-16-II-A-1` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-16-II] II. Street Sanding Requirements Specific to the Denver PM10 Attainment/Maintenance Area
> [sec-16-II-A] II.A. Applicability

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-16-II-A-1]  The provisions of this Section II shall apply to any governmental entity and any employee, official, representative, or agent of such governmental entity responsible for applying street sanding material to any roadway in the Denver PM10 Attainment/Maintenance area as defined in the AQCC Ambient Air Standards Regulation (effective date: July 30, 1991). The provisions of this Section II shall also apply to any person who contracts with such governmental entity for the purpose of applying street sanding material to any roadway in the Denver PM-10 Attainment/Maintenance area. 

**Summary before (snapshot, the hand-approved text):**

Section II applies to any governmental entity (and its employees, officials, representatives, or agents) that applies street sanding material to any roadway in the Denver PM10 Attainment/Maintenance area as defined in the AQCC Ambient Air Standards Regulation (effective date July 30, 1991). It also applies to any person who contracts with such a governmental entity to apply street sanding material to any roadway in that area.

**Summary after (live):** unchanged

## 21. `sec-ecmc-1420-l-(3)-C` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ecmc-1420]  Rule 1420 . — TESTING AND MONITORING REQUIREMENTS The Geologic Storage Operator must prepare, maintain, and comply with a testing and monitoring plan to verify that the Geologic Storage Operations are operating as permitted and are not endangering USDWs. The requirement to maintain and implement an approved plan is directly enforceable regardless of whether the requirement is a condition of the permit. The testing and monitoring plan must be submitted with the permit application, for Commission approval, and must include a description of how the Geologic Storage Operator will meet the requirements of this Rule 1420 , including accessing sites for all necessary monitoring and testing during 
> [sec-ecmc-1420-l] 1420.l. Seismicity Evaluation and Monitoring System.
> [sec-ecmc-1420-l-(3)]  Seismicity Monitoring System Requirements. The Commission may require the Geologic Storage Operator to deploy and maintain a seismicity monitoring system or utilize existing monitoring systems in order to determine the presence or absence, magnitude, and the hypocenter location of seismic activity within the vicinity of the Geologic Storage Facility. Where the Commission requires the Geologic Storage Operator to deploy and maintain a seismicity monitoring system, that system must: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ecmc-1420-l-(3)-C]  Be designed with surface arrays and/or downhole arrays as required to meet minimum magnitude of completeness of 1.0, or an alternative site-appropriate minimum magnitude approved by the Director, and to appropriately calibrate event magnitudes and hypocenter locations; and 

**Summary before (snapshot, the hand-approved text):**

The Commission may require a seismicity monitoring system to be designed with surface and/or downhole arrays that can detect seismic events as small as magnitude 1.0 (or a different minimum magnitude approved by the Director) and accurately determine event magnitudes and hypocenter locations.

**Summary after (live):**

Where the Commission requires a seismicity monitoring system, it must be designed with surface arrays and/or downhole arrays as required to meet a minimum magnitude of completeness of 1.0 (or an alternative site-appropriate minimum magnitude approved by the Director) and to appropriately calibrate event magnitudes and hypocenter locations.

**Reviewer's reasons:** Parent text makes the design requirement mandatory once the Commission requires a system; text says minimum magnitude of completeness, site-appropriate alternative, and calibrate magnitudes and hypocenter locations.

## 22. `sec-oooob-60.5360b-(c)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-oooob-60.5360b] § 60.5360b What is the purpose of this subpart?

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-oooob-60.5360b-(c)]  Exemption. You are exempt from the obligation to obtain a permit under 40 CFR part 70 or 40 CFR part 71, provided you are not otherwise required by law to obtain a permit under 40 CFR 70.3(a) or 40 CFR 71.3(a). Notwithstanding the previous sentence, you must continue to comply with the provisions of this subpart. 

**Summary before (snapshot, the hand-approved text):**

You are exempt from having to get a federal Title V operating permit (under 40 CFR parts 70 or 71) solely because of this subpart, unless some other law already requires you to get one. Even if you're exempt from the permit, you still must comply with all the requirements in this subpart.

**Summary after (live):**

You are exempt from having to get a permit under 40 CFR part 70 or 40 CFR part 71, provided you are not otherwise required by law to obtain a permit under 40 CFR 70.3(a) or 40 CFR 71.3(a). Even if you're exempt from the permit, you still must comply with all the requirements in this subpart.

**Reviewer's reasons:** Text names no 'Title V operating permit' or 'solely because of this subpart', and limits the exception to 40 CFR 70.3(a) or 71.3(a).

## 23. `sec-ooooc-60.5398c-(c)-(1)-(iv)-(B)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ooooc-60.5398c]  This section provides alternative GHG standards for fugitive emissions components designated facilities in § 60.5397c and alternative continuous inspection and monitoring requirements for covers and closed vent systems in § 60.5416c(a)(1)(ii) and (iii), (2)(ii) through (iv), and (3)(iii) and (iv). If you choose to use an alternative standard under this section, you must submit the notification under paragraph (a) of this section. If you choose to demonstrate compliance with the alternative GHG standards through periodic screening, you are subject to the requirements in paragraph (b) of this section. If you choose to demonstrate compliance through a continuous monitoring system, you are subj
> [sec-ooooc-60.5398c-(c)]  Continuous Monitoring. You may choose to demonstrate compliance for your fugitive emissions components designated facility and compliance with continuous inspection and monitoring requirements for your covers and closed vent systems through continuous monitoring using a technology approved in accordance with § 60.5398b(d) . If you choose to demonstrate compliance using continuous monitoring, you must comply and develop a monitoring plan consistent with the requirements in paragraphs (c)(1) through (9) of this section and comply with the recordkeeping and reporting requirements in § 60.5424c . 
> [sec-ooooc-60.5398c-(c)-(1)]  For the purpose of this section, continuous monitoring means the ability of a methane monitoring system to determine and record a valid methane mass emissions rate or equivalent of designated facilities at least once for every 12-hour block. 
> [sec-ooooc-60.5398c-(c)-(1)-(iv)]  The continuous monitoring system must continuously collect data as specified in paragraph (c)(1) of this section, except as specified in paragraphs (c)(1)(iv)(A) through (D) of this section: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ooooc-60.5398c-(c)-(1)-(iv)-(B)]  Operational downtime of the continuous monitoring system is defined as a period of time for which any monitor fails to collect or transmit data as specified in paragraph (c)(1) of this section or any monitor is out-of-control as specified in paragraph (c)(1)(iv)(C) of this section. 

**Summary before (snapshot, the hand-approved text):**

Operational downtime of a continuous monitoring system means any period when a monitor fails to collect or send data as required, or when a monitor is out-of-control. (The specific data-collection requirements and out-of-control criteria are found in other parts of this section not shown here.)

**Summary after (live):**

Operational downtime of a continuous monitoring system means any period when a monitor fails to collect or send data as specified in paragraph (c)(1) of this section, or when a monitor is out-of-control as specified in paragraph (c)(1)(iv)(C) of this section.

**Reviewer's reasons:** The text cites (c)(1) and (c)(1)(iv)(C) directly; the parenthetical implied the references were unspecified.

## 24. `sec-p192-192.319-(c)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-p192-192.319] § 192.319 Installation of pipe in a ditch.

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-p192-192.319-(c)]  All offshore pipe in water at least 12 feet (3.7 meters) deep but not more than 200 feet (61 meters) deep, as measured from the mean low tide, except pipe in the Gulf of America and its inlets under 15 feet (4.6 meters) of water, must be installed so that the top of the pipe is below the natural bottom unless the pipe is supported by stanchions, held in place by anchors or heavy concrete coating, or protected by an equivalent means. Pipe in the Gulf of America and its inlets under 15 feet (4.6 meters) of water must be installed so that the top of the pipe is 36 inches (914 millimeters) below the seabed for normal excavation or 18 inches (457 millimeters) for rock excavation. 

**Summary before (snapshot, the hand-approved text):**

Offshore gas pipe in water 12 to 200 feet deep (measured from mean low tide) must be installed below the natural bottom, or else supported by stanchions, anchors, heavy concrete coating, or an equivalent means – except in the Gulf of America and its inlets under 15 feet of water, where the pipe must be at least 36 inches below the seabed for normal excavation, or 18 inches below for rock excavation.

**Summary after (live):**

Offshore gas pipe in water 12 to 200 feet deep (measured from mean low tide) must be installed below the natural bottom, or else supported by stanchions, anchors, heavy concrete coating, or an equivalent means – except in the Gulf of America and its inlets under 15 feet of water, where the top of the pipe must be 36 inches below the seabed for normal excavation, or 18 inches below for rock excavation.

**Reviewer's reasons:** Text says the top of the pipe must be 36 inches (914 mm) below the seabed; it does not say 'at least'.

## 25. `sec-23-A-V-A-1-e-(ii)-(A)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-23-A-V]  Monitoring, Recordkeeping, and Reporting for Regional Haze Limits The provisions of this Section V. of Regulation Number 23 will be incorporated into Colorado’s Regional Haze State Implementation Plan. 
> [sec-23-A-V-A] V.A. Monitoring/Compliance Determination: SO2 and NOx Regional Haze Limits
> [sec-23-A-V-A-1] V.A.1. BART, RP, and BART alternative program units with SO2 and NOx CEMS.
> [sec-23-A-V-A-1-e]  Suncor Refinery FCC Units At all times after the compliance deadline specified in Section IV.F.4. , the owner/operator of each RP unit must maintain, calibrate, and operate a CEMS to accurately measure from such unit SO2, NOx, and O2, as such parameters are relevant to the applicable emission limit. The CEMS must be used to determine compliance with the SO2 and NOx regional haze emission limits in Section IV. F.3. for each such unit. The owner/operator must calculate emissions in the applicable units. 
> [sec-23-A-V-A-1-e-(ii)] V.A.1.e.(ii). FCCU2 Reactor-Regenerator

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-23-A-V-A-1-e-(ii)-(A)]  A continuous monitoring system for measuring SO2, NOx, and O2 must be installed, calibrated, maintained, and operated in compliance with the requirements of 40 CFR Part 60, Section 60.13 and Appendices A, B, and F. In lieu of the requirements of Appendix F, Sections 5.1.1, 5.1.3, and 5.1.4, the owner/operator must conduct either a RAA or a RATA at least once every three years and a CGA each calendar quarter during which a RAA or RATA is not performed. NOx emissions must be calculated on a 12-hour rolling average basis. At the end of each operating hour, the owner/operator must calculate and record a new 12-hour average NOx emission rate. SO2 emissions must be calculated on a 365-day rolling average basis. At the end of each operating day, the owner/operator must calculate and record a new 365-day average emission rate from the arithmetic average of the valid hourly emission rates from the CEMS for the previous 365 operating days. 

**Summary before (snapshot, the hand-approved text):**

For the FCCU2 Reactor-Regenerator at Suncor, you must install, calibrate, maintain, and operate a continuous monitoring system for SO₂, NO�x, and O₂ in compliance with 40 CFR Part 60, Section 60.13 and Appendices A, B, and F, except that instead of Appendix F Sections 5.1.1, 5.1.3, and 5.1.4, you must conduct either a RAA or a RATA at least once every three years and a CGA each calendar quarter in which you do not perform a RAA or RATA. You must calculate NOₓ emissions on a 12-hour rolling average basis, calculating and recording a new 12-hour average at the end of each operating hour, and SO₂ emissions on a 365-day rolling average basis, calculating and recording a new 365-day average at the end of each operating day from the arithmetic average of the valid hourly emission rates for the previous 365 operating days.

**Summary after (live):**

For the FCCU2 Reactor-Regenerator at Suncor, you must install, calibrate, maintain, and operate a continuous monitoring system for SO₂, NOₓ, and O₂ in compliance with 40 CFR Part 60, Section 60.13 and Appendices A, B, and F, except that instead of Appendix F Sections 5.1.1, 5.1.3, and 5.1.4, you must conduct either a RAA or a RATA at least once every three years and a CGA each calendar quarter in which you do not perform a RAA or RATA. You must calculate NOₓ emissions on a 12-hour rolling average basis, calculating and recording a new 12-hour average at the end of each operating hour, and SO₂ emissions on a 365-day rolling average basis, calculating and recording a new 365-day average at the end of each operating day from the arithmetic average of the valid hourly emission rates for the previous 365 operating days.

**Reviewer's reasons:** Corrupted character repaired; the text says NOx.

## 26. `sec-28-C-I-B-1-c-(iv)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-28-C-I]  Compliance pathways Owners of covered buildings must reduce building greenhouse gas emissions through one of the following building performance standards compliance pathways. Owners of covered buildings must comply with the performance standard in the selected compliance pathway on an annual basis beginning in 2026. Owners of covered buildings must meet and maintain the 2026 standard for the calendar years 2026 through 2029 and the 2030 standard for calendar years 2030 through 2050, unless otherwise extended by subsequent rules of the Commission. 
> [sec-28-C-I-B] I.B. Greenhouse gas intensity reductions
> [sec-28-C-I-B-1]  A covered building owner unable to achieve the building performance standards in Part C , Section I.A. may demonstrate compliance through reduction of greenhouse gas emissions attributable to the building’s energy use through energy efficiency or replacing fossil fuel equipment with high-efficiency electric equipment. A building owner unable to fully comply with the greenhouse gas compliance pathway target may use customer- owned retail distributed generation systems or retail distributed generation or utility subscription services in accordance with the requirements of Sections I.B.1.b. or I.B.1.c. or I.B.1.d. , or may achieve greenhouse gas reductions through alternative measures approved
> [sec-28-C-I-B-1-c]  The owner of a covered building who does not own the RECs from their customer-owned retail distributed generation system or from retail distributed generation where the interconnect request was filed with the utility company prior to December 31, 2023, may purchase RECs associated with other renewable energy resources located in Colorado to demonstrate compliance with Section I.B. if the following conditions are met. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-28-C-I-B-1-c-(iv)]  Once the covered building owner has submitted the energy audit and demonstrates that a building owner has exhausted cost-effective energy efficiency and electrification measures for the covered building, the building owner may use renewable energy that represents no more than the amount of electricity produced by the customer-owned retail distributed generation system or retail distributed generation and consumed by the covered building on an annual basis for each compliance year in Table 1. 

**Summary before (snapshot, the hand-approved text):**

If you own a covered building and don't own the RECs from your own on-site renewable generation (or from generation whose interconnect request was filed before December 31, 2023), you can buy Colorado-based RECs to meet the greenhouse gas intensity standard, but only after you've submitted an energy audit showing you've exhausted cost-effective efficiency and electrification measures. The amount of renewable energy you can count is capped at the annual electricity your on-site system produces and your building actually consumes each compliance year in Table 1.

**Summary after (live):**

If you own a covered building and don't own the RECs from your customer-owned retail distributed generation system or from retail distributed generation where the interconnect request was filed with the utility company before December 31, 2023, you can buy RECs from other renewable energy resources located in Colorado to meet the greenhouse gas intensity standard, but only after you've submitted an energy audit showing you've exhausted cost-effective efficiency and electrification measures. The amount of renewable energy you can count is capped at the annual electricity your customer-owned retail distributed generation system or retail distributed generation produces and your building actually consumes each compliance year in Table 1.

**Reviewer's reasons:** Parent I.B.1.c. states the December 31, 2023 interconnect condition for the systems, and does not use "on-site".; Parent text says RECs associated with other renewable energy resources located in Colorado.; Provision text uses these terms, not "on-site".

## 27. `sec-22-B-I-C-2-a` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-22-B-I]  Prohibitions on Use of Certain Hydrofluorocarbons in Aerosol Propellants, Chillers, Foam, and Stationary Refrigeration End-Uses 
> [sec-22-B-I-C] I.C. Requirements
> [sec-22-B-I-C-2] I.C.2. Exemptions.

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-22-B-I-C-2-a]  Except where an existing system is retrofit after the date of prohibition, nothing in this regulation requires a person that acquired a product or equipment containing a prohibited substance prior to the applicable date of prohibition in Section I.E.1. to cease use of that product or equipment. Products or equipment manufactured prior to the applicable date of prohibition specified in Table 1 of Section I.E.1 (including spray foam systems not yet applied on site) may be sold, imported, exported, distributed, installed, serviced, and used after the specified date of prohibition. 

**Summary before (snapshot, the hand-approved text):**

If you bought a product or piece of equipment containing a prohibited substance before the prohibition date kicked in, you don't have to stop using it. You can also still sell, import, export, distribute, install, service, and use products or equipment (including spray foam systems not yet applied) that were manufactured before the prohibition date, even after that date has passed. The exception is if you retrofit an existing system after the prohibition date – then the normal prohibition rules apply.

**Summary after (live):**

If you bought a product or piece of equipment containing a prohibited substance before the prohibition date kicked in, you don't have to stop using it, except where an existing system is retrofit after the prohibition date. You can also still sell, import, export, distribute, install, service, and use products or equipment (including spray foam systems not yet applied on site) that were manufactured before the prohibition date, even after that date has passed.

**Reviewer's reasons:** The retrofit exception qualifies the first sentence about ceasing use.; The text does not say 'normal prohibition rules apply' and the exception does not qualify the sale and related activities sentence.; The text says 'not yet applied on site'.

## 28. `sec-31-A-IV-K` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-31-A-IV] IV. Definitions

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-31-A-IV-K]  “Corrective action analysis” means a description of all reasonable interim and long-term measures, if any, that are available, and an explanation of why the selected corrective action(s) is/are the best alternative(s), including, but not limited to, considerations of cost effectiveness, technical feasibility, safety, and secondary impacts. 

**Summary before (snapshot, the hand-approved text):**

A corrective action analysis is a written description that lists all reasonable short-term and long-term fixes available to address a problem, and explains why the chosen fix or fixes are the best option when considering cost, technical feasibility, safety, and side effects.

**Summary after (live):**

A corrective action analysis is a description of all reasonable interim and long-term measures, if any, that are available to address a problem, and explains why the chosen fix or fixes are the best option when considering, among other things, cost effectiveness, technical feasibility, safety, and secondary impacts.

**Reviewer's reasons:** Text says "a description" (not written), "interim" measures, and "if any".; Text says "including, but not limited to" and uses "cost effectiveness" and "secondary impacts".

## 29. `sec-zzzz-63.6605-(b)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-zzzz-63.6605] § 63.6605 What are my general requirements for complying with this subpart?

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-zzzz-63.6605-(b)]  At all times you must operate and maintain any affected source, including associated air pollution control equipment and monitoring equipment, in a manner consistent with safety and good air pollution control practices for minimizing emissions. The general duty to minimize emissions does not require you to make any further efforts to reduce emissions if levels required by this standard have been achieved. Determination of whether such operation and maintenance procedures are being used will be based on information available to the Administrator which may include, but is not limited to, monitoring results, review of operation and maintenance procedures, review of operation and maintenance records, and inspection of the source. 

**Summary before (snapshot, the hand-approved text):**

You must always operate and maintain your engine, air pollution control equipment, and monitoring equipment in a way that is safe and follows good air pollution control practices to minimize emissions. Once you've met the emission levels required by this standard, you don't have to do anything more to reduce emissions. The Administrator will decide whether you're meeting this duty based on available information, which may include monitoring results, your operation and maintenance procedures and records, and inspections of the source.

**Summary after (live):**

You must always operate and maintain any affected source, including associated air pollution control equipment and monitoring equipment, in a way that is safe and follows good air pollution control practices to minimize emissions. Once you've met the emission levels required by this standard, you don't have to do anything more to reduce emissions. The Administrator will decide whether you're meeting this duty based on available information, which may include monitoring results, your operation and maintenance procedures and records, and inspections of the source.

**Reviewer's reasons:** The text applies the duty to "any affected source, including associated air pollution control equipment and monitoring equipment", not just an engine.

## 30. `sec-11-C-I-E` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-11-C-I] I. PRE-INSPECTION REQUIREMENTS

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-11-C-I-E]  The emissions mechanic, emissions inspector or automated emissions testing system (Kiosk) shall ascertain from the inspection record data base if an initial inspection or an after-repairs inspection is to be conducted. If an after-repairs inspection is to be conducted, previous inspection data is required for comparison. Specific emissions related repair information as specified in Section VII (B) of this Part C shall be entered to the database. Inspections conducted within 60 days of the initial inspection date are to be considered an after-repairs inspection. Inspections conducted greater than 60 days from the initial inspection date are to be considered initial inspections. 

**Summary before (snapshot, the hand-approved text):**

The inspector or automated kiosk must check the database to determine whether the vehicle is due for an initial inspection or an after-repairs inspection. If it is an after-repairs inspection, the system must pull up the previous inspection data for comparison and the inspector must enter the specific emissions-related repair information described in Section VII(B) of Part C. An inspection is considered an after-repairs inspection if it occurs within 60 days of the initial inspection date; if more than 60 days have passed, it is treated as a new initial inspection.

**Summary after (live):**

The emissions mechanic, inspector or automated kiosk must check the database to determine whether the vehicle is due for an initial inspection or an after-repairs inspection. If it is an after-repairs inspection, previous inspection data is required for comparison, and the specific emissions-related repair information described in Section VII(B) of Part C must be entered into the database. An inspection is considered an after-repairs inspection if it occurs within 60 days of the initial inspection date; if more than 60 days have passed, it is treated as a new initial inspection.

**Reviewer's reasons:** The text names the emissions mechanic, emissions inspector or Kiosk.; The text does not assign pulling up the data or entering the information to a particular party.

## 31. `sec-25-B-I-Q-4-b-(iii)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-25-B-I] I. Surface Coating Operations
> [sec-25-B-I-Q] I.Q. Aerospace Vehicles or Components
> [sec-25-B-I-Q-4] I.Q.4. Application methods.
> [sec-25-B-I-Q-4-b]  The following situations are exempt from the application equipment requirements in Section I.Q.4.a. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-25-B-I-Q-4-b-(iii)]  The application of coatings that contain fillers that adversely affect atomization with HVLP spray guns and that cannot be applied by any of the other application methods specified in Section I.Q.4.a. 

**Summary before (snapshot, the hand-approved text):**

Aerospace coating operations in the covered areas do not have to use the application equipment required by Section I.Q.4.a. when applying coatings that contain fillers that interfere with atomization in HVLP spray guns and cannot be applied by any of the other methods listed in Section I.Q.4.a.

**Summary after (live):**

Aerospace coating operations do not have to use the application equipment required by Section I.Q.4.a. when applying coatings that contain fillers that interfere with atomization in HVLP spray guns and cannot be applied by any of the other methods listed in Section I.Q.4.a.

**Reviewer's reasons:** The text states no covered areas or geographic qualifier.

## 32. `sec-24-B-V-A-2` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-24-B-V] V. Crude Oil
> [sec-24-B-V-A] V.A. General Exemptions

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-24-B-V-A-2]  Storage tanks with capacities of less than 1,590 cubic meters (10,000 barrels) used to store crude oil and condensate prior to lease custody transfer are exempt from the provisions of Regulation Number 24 . 

**Summary before (snapshot, the hand-approved text):**

Storage tanks smaller than 1,590 cubic meters (10,000 barrels) that store crude oil and condensate before lease custody transfer are exempt from Regulation Number 24. This exemption applies only to tanks used before the oil or condensate leaves the lease and changes custody.

**Summary after (live):**

Storage tanks smaller than 1,590 cubic meters (10,000 barrels) that store crude oil and condensate before lease custody transfer are exempt from Regulation Number 24.

**Reviewer's reasons:** The text says only 'prior to lease custody transfer'; it does not mention the oil leaving the lease or add an 'only' limit.

## 33. `sec-29-A-IV-B-4` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-29-A-IV] IV. Recordkeeping and reporting
> [sec-29-A-IV-B]  On or before June 1, 2026, and June 1 of each year thereafter, all state government agencies, local governments, and federal government conducting or contracting for lawn and garden services subject to Section III. must submit information for the preceding calendar year (e.g., for the June 1, 2026, report submit information for the period of June 1, 2025, through August 31, 2025) using a Division-approved format. The report must include: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-29-A-IV-B-4]  The company name and designated contact person for the lawn and garden services contractor(s), if applicable, and description of the services (e.g., list of activities, duration, frequency, expected equipment use) provided. 

**Summary before (snapshot, the hand-approved text):**

If a state government agency, local government, or the federal government hires a contractor to do lawn and garden work covered by Section III, the annual report due June 1 must include the contractor's company name, a contact person, and a description of the services (what activities, how long, how often, and what equipment is expected to be used).

**Summary after (live):**

The annual report due June 1 must include the company name and designated contact person for the lawn and garden services contractor(s), if applicable, and a description of the services provided (what activities, how long, how often, and what equipment is expected to be used) for lawn and garden work covered by Section III.

**Reviewer's reasons:** Text applies 'if applicable' to the contractor details only; the service description is required regardless, and the contact person is a 'designated' one.

## 34. `sec-27-C-I-B-1-c-(i)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-27-C-I] I. Audit Requirements
> [sec-27-C-I-B] I.B. Audit Plan
> [sec-27-C-I-B-1]  Each EITE stationary source must submit an audit plan to the Division for approval at least 120 days prior to beginning the audit as required in Section I.A. The Division will review the audit plan and notify the EITE stationary source within 60 days of submission of any deficiencies. If notified of deficiencies, the EITE stationary source must submit a revised audit plan for final approval no later than 30 days prior to beginning the audit. The EITE stationary source must receive approval from the Division of the audit plan prior to beginning the audit. Such approval shall not be unreasonably withheld. The audit plan must include: 
> [sec-27-C-I-B-1-c]  If an EITE stationary source is certified to the Federal Energy Star Program or ISO 50001, the EITE stationary source will be determined to be employing energy BMPs and the energy audit will be limited in scope. Proof of certification of the EITE stationary source to one or more of these existing standards must be included in the audit plan to utilize this option. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-27-C-I-B-1-c-(i)]  If an EITE stationary source is planning on becoming certified to one of these standards, the EITE stationary source must submit the certification or registration timeline or plan, including key milestones towards certification or registration with certification scheduled for no more than 12 months after the audit date. 

**Summary before (snapshot, the hand-approved text):**

If your EITE stationary source is planning to become certified to Federal Energy Star or ISO 50001 (but is not yet certified), you must submit the certification or registration timeline or plan, including key milestones, with certification scheduled for no more than 12 months after the audit date. Submitting this plan allows you to use the limited-scope energy audit option described in the parent paragraph.

**Summary after (live):**

If your EITE stationary source is planning to become certified to Federal Energy Star or ISO 50001 (but is not yet certified), you must submit the certification or registration timeline or plan, including key milestones, with certification scheduled for no more than 12 months after the audit date.

**Reviewer's reasons:** The text does not say that submitting a plan gives access to the limited-scope audit option; the parent ties that option to existing certification with proof of it.

## 35. `sec-12-A-I-B-5` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-12-A-I] I. General Provisions
> [sec-12-A-I-B]  Definitions The following terms shall have the following meanings when used in this regulation: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-12-A-I-B-5]  “Diesel Powered Motor Vehicle” or “Diesel Vehicle” as applicable to opacity inspections, includes only a motor vehicle with four wheels or more on the ground, powered by an internal combustion, compression ignition, diesel fueled engine, and also includes such a motor vehicle having a personal property classification of A, B, or C, pursuant to Section 42-3-106, C.R.S., as specified on its vehicle registration, and for which registration in this state is required for operation on the public roads and highways. “Diesel Vehicle” does not include the following: vehicles registered pursuant to Section 42-12-301, or 42-3-306 (4), C.R.S. off- road use only powered vehicles or heavy construction equipment. 

**Summary before (snapshot, the hand-approved text):**

For opacity inspection purposes, a "Diesel Powered Motor Vehicle" or "Diesel Vehicle" includes only a motor vehicle with four or more wheels on the ground, powered by an internal combustion, compression ignition, diesel-fueled engine, that has a personal property classification of A, B, or C under Section 42-3-106, C.R.S. as shown on its registration, and that must be registered in Colorado to operate on public roads and highways. The term does not include vehicles registered pursuant to Section 42-12-301 or 42-3-306(4), C.R.S., off-road-use-only powered vehicles, or heavy construction equipment.

**Summary after (live):**

For opacity inspection purposes, a "Diesel Powered Motor Vehicle" or "Diesel Vehicle" includes only a motor vehicle with four or more wheels on the ground, powered by an internal combustion, compression ignition, diesel-fueled engine, and also includes such a motor vehicle that has a personal property classification of A, B, or C under Section 42-3-106, C.R.S. as specified on its registration, and for which registration in this state is required for operation on public roads and highways. The term does not include vehicles registered pursuant to Section 42-12-301 or 42-3-306(4), C.R.S., off-road-use-only powered vehicles, or heavy construction equipment.

**Reviewer's reasons:** The text says the definition "also includes" such a vehicle with classification A, B, or C. It does not make the classification or registration a condition of coverage.

## 36. `sec-jjjj-60.4243-(b)-(2)-(ii)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-jjjj-60.4243] § 60.4243 What are my compliance requirements if I am an owner or operator of a stationary SI internal combustion engine?
> [sec-jjjj-60.4243-(b)]  If you are an owner or operator of a stationary SI internal combustion engine and must comply with the emission standards specified in § 60.4233(d) or (e), you must demonstrate compliance according to one of the methods specified in paragraphs (b)(1) and (2) of this section. 
> [sec-jjjj-60.4243-(b)-(2)]  Purchasing a non-certified engine and demonstrating compliance with the emission standards specified in § 60.4233(d) or (e) and according to the requirements specified in § 60.4244 , as applicable, and according to paragraphs (b)(2)(i) and (ii) of this section. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-jjjj-60.4243-(b)-(2)-(ii)]  If you are an owner or operator of a stationary SI internal combustion engine greater than 500 HP, you must keep a maintenance plan and records of conducted maintenance and must, to the extent practicable, maintain and operate the engine in a manner consistent with good air pollution control practice for minimizing emissions. In addition, you must conduct an initial performance test and conduct subsequent performance testing every 8,760 hours or 3 years, whichever comes first, thereafter to demonstrate compliance. 

**Summary before (snapshot, the hand-approved text):**

If you own or operate a stationary spark-ignition engine larger than 500 HP that you purchased without EPA certification and are demonstrating compliance through performance testing, you must keep a maintenance plan and maintenance records and operate the engine in a manner consistent with good air pollution control practice to minimize emissions. You must conduct an initial performance test and then repeat performance testing every 8,760 hours or 3 years, whichever comes first, thereafter.

**Summary after (live):**

If you own or operate a stationary spark-ignition engine larger than 500 HP that you purchased as a non-certified engine, you must keep a maintenance plan and maintenance records and, to the extent practicable, operate the engine in a manner consistent with good air pollution control practice to minimize emissions. You must conduct an initial performance test and then repeat performance testing every 8,760 hours or 3 years, whichever comes first, thereafter.

**Reviewer's reasons:** Text says "to the extent practicable" for maintaining and operating the engine.; Parent (b)(2) says "non-certified engine" with no mention of EPA; performance testing is a duty in this provision, not a condition.

## 37. `sec-26-B-IV-A-6` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-26-B-IV] IV. Control of Emissions from Breweries in the 8-hour Ozone Control Area
> [sec-26-B-IV-A] IV.A. Requirements for Brewing Operations

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-26-B-IV-A-6]  Wastewater management and treatment. Owners or operators employing microbial and vegetative destruction of VOCs through the land application of wastewater must ensure that the areas where wastewater is applied are areas covered with vegetation at all times when wastewater is applied, except as required following tilling and seeding for crop rotation and field work per standard agricultural practices. 

**Summary before (snapshot, the hand-approved text):**

Breweries in the 8-hour ozone control area that use land application of wastewater to destroy VOCs through microbial and vegetative processes must apply the wastewater only to areas covered with vegetation. The only exception is when vegetation is temporarily absent due to tilling, seeding, crop rotation, or field work that follows standard agricultural practices.

**Summary after (live):**

Breweries in the 8-hour ozone control area that use land application of wastewater to destroy VOCs through microbial and vegetative processes must apply the wastewater only to areas covered with vegetation at all times when wastewater is applied. The only exception is as required following tilling and seeding for crop rotation and field work per standard agricultural practices.

**Reviewer's reasons:** Text excepts only what is required following tilling and seeding for crop rotation and field work per standard agricultural practices; it does not mention vegetation being temporarily absent.; Text requires vegetation cover at all times when wastewater is applied.

## 38. `sec-sip-VIII-E-1` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-sip-VIII] VIII. Steamboat Springs PM10 Attainment/Maintenance Area
> [sec-sip-VIII-E] VIII.E. Implementation of Local Control Strategies

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-sip-VIII-E-1]  City of Steamboat Springs The City of Steamboat Springs shall implement and enforce Ordinance Number 1191 (1991), Ordinance Number 1148 (1990), Ordinance Number 1045 (1988), and Ordinance Number 977 (1987), as they exist on February 1, 1995. A copy of each ordinance is included in Appendix A to this regulation. These ordinances limit the number and type of solid fuel burning devices. In addition, the City of Steamboat Springs shall implement and enforce any ordinance in accordance with these regulations. These ordinances may be amended in the sole discretion of the City Council of the City of Steamboat Springs, provided that they shall be submitted immediately to the Colorado Air Quality Control Commission and the EPA as revisions to the State Implementation Plan. Any amendments to these ordinances shall not constitute a revision to the State Implementation Plan until such time as the State Implementation Plan is appropriately revised. These ordinances shall remain in full force and effect until such time as the City obtains full approval of a State Implementation Plan revision. 

**Summary before (snapshot, the hand-approved text):**

**Steamboat Springs PM10 area:** The City of Steamboat Springs must implement and enforce Ordinances 1191 (1991), 1148 (1990), 1045 (1988), and 977 (1987) as they existed on February 1, 1995, which limit the number and type of solid fuel burning devices. The City may amend these ordinances at its own discretion, but must immediately submit any amendments to the Colorado Air Quality Control Commission and the EPA as proposed SIP revisions; amendments do not become part of the SIP until formally approved. The ordinances remain in effect until the City obtains full approval of a SIP revision.

**Summary after (live):**

Steamboat Springs PM10 area: The City of Steamboat Springs must implement and enforce Ordinances 1191 (1991), 1148 (1990), 1045 (1988), and 977 (1987) as they existed on February 1, 1995, which limit the number and type of solid fuel burning devices. The City may amend these ordinances at its own discretion, but must immediately submit any amendments to the Colorado Air Quality Control Commission and the EPA as proposed SIP revisions; amendments do not become part of the SIP until formally approved. The ordinances remain in effect until the City obtains full approval of a SIP revision.

**Reviewer's reasons:** stray Markdown markers removed

## 39. `sec-30-B-III-D-2-e-(ii)-(A)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-30-B-III]  Emission Control Measures The following sections establish emission control regulations for each of the priority toxic air contaminants identified in Section I. of this Part B . Each priority toxic air contaminant section contains relevant applicability, exemptions, definitions, emission controls or limitations, recordkeeping, and reporting requirements. 
> [sec-30-B-III-D] III.D. Formaldehyde
> [sec-30-B-III-D-2]  Requirements for Stationary Spark Ignition Internal Combustion Engines. 
> [sec-30-B-III-D-2-e] III.D.2.e. Performance testing and monitoring.
> [sec-30-B-III-D-2-e-(ii)]  The owner or operator of an engine subject to the 0.4 g/hp-hr emissions limitation in Section III.D.2.c.(ii) must 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-30-B-III-D-2-e-(ii)-(A)]  Conduct an initial performance test for carbon monoxide within 180 days after startup in accordance with the applicable reference test methods of 40 C.F.R. Part 60, Appendix A (July 1, 2019), and a test protocol submitted to the Division for review at least thirty (30) days prior to testing and in accordance with AQCC Common Provisions Regulation Section II.C. 

**Summary before (snapshot, the hand-approved text):**

The owner or operator of an engine subject to the 0.4 g/hp-hr carbon monoxide emission limit in Section III.D.2.c.(ii) must conduct an initial performance test for carbon monoxide within 180 days after startup, using the reference test methods in 40 CFR Part 60, Appendix A (July 1, 2019). The test must follow a protocol submitted to the Division for review at least 30 days before testing and must comply with AQCC Common Provisions Regulation Section II.C.

**Summary after (live):**

The owner or operator of an engine subject to the 0.4 g/hp-hr emissions limitation in Section III.D.2.c.(ii) must conduct an initial performance test for carbon monoxide within 180 days after startup, using the reference test methods in 40 CFR Part 60, Appendix A (July 1, 2019). The test must follow a protocol submitted to the Division for review at least 30 days before testing and must comply with AQCC Common Provisions Regulation Section II.C.

**Reviewer's reasons:** Parent text calls it the 0.4 g/hp-hr emissions limitation; it does not say the limit is for carbon monoxide.

## 40. `sec-16-I-E-2-b` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-16-I] I. Street Sanding Materials Specifications
> [sec-16-I-E] I.E. Reporting Requirements
> [sec-16-I-E-2] I.E.2. Users Requirements

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-16-I-E-2-b]  Within 7 calendar days of awarding a contract for the purchase of street sanding material to a supplier, the user shall notify the Division of the supplier's name and the location of the aggregate pit(s) from which the material will be supplied. 

**Summary before (snapshot, the hand-approved text):**

If you are a government entity or contractor that buys street sanding material in the AIR program area, you must notify the Division within 7 calendar days after you award a purchase contract, telling them the supplier's name and the location of the aggregate pit(s) where the material will come from.

**Summary after (live):**

If you are a user that buys street sanding material, you must notify the Division within 7 calendar days after you award a purchase contract, telling them the supplier's name and the location of the aggregate pit(s) where the material will come from.

**Reviewer's reasons:** Text refers only to 'the user'; no government/contractor or AIR program area qualifier is stated.
