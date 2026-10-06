# Re-review stage 2a (pilot: OOOOa, 49 CFR 195, ECMC 300 series), 6 Oct 2026: 30-row spot-check sample

Stage 2a of the re-review of hand-approved summaries (`pipeline/review.py --rereview`, claude-sonnet-5-5, effort low, prompt version 33b17e6a7a with the full ancestor context, system prompt cached 1h). Workflow run: https://github.com/ontargetequipment/Essentialregs.com/actions/runs/37405809165 -- 1,501 rows (ooooa 517, p195 544, ECMC rules 301-316 440): **872 pass, 629 corrected, 0 fail**; $3.6056; 79.3% of input tokens were cache reads. Every selected row was snapshotted to `archive.summary_review_snapshot_rereview` before the first write.

This sample: 30 rows drawn at random (seeded, `order by md5(id || '20261005')` within each verdict and regulation): 5 pass and 5 corrected from each of the three regulations. For each: the text above the provision as the reviewer now sees it (every ancestor below the document root, first 700 characters each), the official text (provision plus descendants, first 1,200 characters), the summary before (the hand-approved text from the snapshot) and, for a corrected row, the summary after (live) with the reviewer's one-line reasons. For a pass, before and after are the same. For the Cowork spot-check before stage 2b.

## 1. `sec-ecmc-314-c-(2)-B` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ecmc-314]  Rule 314 . — COMPREHENSIVE AREA PLANS
> [sec-ecmc-314-c]  Duration. Approved CAPs will expire 6 years after the date the Commission approves the CAP, unless the Commission issues an Order to approve a different duration or extend the duration pursuant to Rules 314.c.(1) &amp; (2). 
> [sec-ecmc-314-c-(2)] 314.c.(2). Extensions.

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ecmc-314-c-(2)-B]   The Commission may approve or deny the extension of the CAP following a hearing pursuant to Rule 510 . The Commission may extend the CAP by any duration it determines is necessary and reasonable to protect and minimize adverse impacts to public health, safety, welfare, the environment, and wildlife resources. 

**Summary before (snapshot, the hand-approved text):**

The Commission may approve or deny an extension of a Comprehensive Area Plan (CAP) after holding a hearing under Rule 510. If the Commission grants an extension, it can set whatever duration it finds necessary and reasonable to protect and minimize adverse impacts to public health, safety, welfare, the environment, and wildlife resources.

**Summary after (live):** unchanged

## 2. `sec-ooooa-60.5401a-(b)-(4)-(i)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ooooa-60.5401a] § 60.5401a What are the exceptions to the equipment leak GHG and VOC standards for affected facilities at onshore natural gas processing plants?
> [sec-ooooa-60.5401a-(b)] § 60.5401a(b)
> [sec-ooooa-60.5401a-(b)-(4)] § 60.5401a(b)(4)

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ooooa-60.5401a-(b)-(4)-(i)]   Any pressure relief device that is located in a nonfractionating plant that is monitored only by non-plant personnel may be monitored after a pressure release the next time the monitoring personnel are onsite, instead of within 5 days as specified in paragraph (b)(1) of this section and § 60.482-4a(b)(1). 

**Summary before (snapshot, the hand-approved text):**

If you have a pressure relief device at a nonfractionating plant and only non-plant personnel (not your own staff) do the monitoring, you can wait to monitor it after a pressure release until the next time those monitoring personnel are onsite, rather than within 5 days. This exception only applies to nonfractionating plants where monitoring is done by outside personnel.

**Summary after (live):** unchanged

## 3. `sec-p195-195.1-(b)-(5)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-p195-195.1] § 195.1 Which pipelines are covered by this Part?
> [sec-p195-195.1-(b)]  Excepted. This Part does not apply to any of the following: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-p195-195.1-(b)-(5)]   Transportation of hazardous liquid or carbon dioxide in an offshore pipeline in state waters where the pipeline is located upstream from the outlet flange of the following farthest downstream facility: The facility where hydrocarbons or carbon dioxide are produced or the facility where produced hydrocarbons or carbon dioxide are first separated, dehydrated, or otherwise processed; 

**Summary before (snapshot, the hand-approved text):**

This Part does not apply to offshore pipelines in state waters that are upstream of the outlet flange of whichever is farthest downstream: the production facility or the facility where produced hydrocarbons or carbon dioxide are first separated, dehydrated, or otherwise processed.

**Summary after (live):** unchanged

## 4. `sec-ecmc-309-c-(5)-A` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ecmc-309]  Rule 309 . — POST-COMPLETENESS CONSULTATION AND COMMUNITY MEETING
> [sec-ecmc-309-c]  Post-Completeness Community Meeting. If any Residential Building Units, High Occupancy Building Units, School Facilities, or Child Care Centers are located within 1/2 mile of the proposed Oil and Gas Location, or if any Residential Building Units, High Occupancy Building Units, School Facilities, or Child Care Centers within a Disproportionately Impacted Community are located within 4,000 feet of the proposed Oil and Gas Location, the Operator will hold a post-completeness community meeting that will be open to the public. 
> [sec-ecmc-309-c-(5)] 309.c.(5). Notice.

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ecmc-309-c-(5)-A]   The Operator will provide notice of the post-completeness community meeting to all Surface Owners, Building Unit and High Occupancy Building Unit owners and tenants, and residents, including tenants of both residential and commercial properties, within 1/2 mile of a proposed Oil and Gas Location, and within 4,000 feet of a proposed Oil and Gas Location for any Building Units within a Disproportionately Impacted Community. 

**Summary before (snapshot, the hand-approved text):**

The operator must notify all surface owners, building unit and high-occupancy building unit owners and tenants, and residents (including tenants of both residential and commercial properties) within ½ mile of a proposed Oil and Gas Location. For any Building Units within a Disproportionately Impacted Community, the operator must notify those same groups within 4,000 feet of the proposed location.

**Summary after (live):** unchanged

## 5. `sec-ooooa-60.5432a-(a)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ooooa-60.5432a] § 60.5432a How do I determine whether a well is a low pressure well using the low pressure well equation?

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ooooa-60.5432a-(a)]   To determine that your well is a low pressure well subject to § 60.5375a(f) , you must determine whether the characteristics of the well are such that the well meets the definition of low pressure well in § 60.5430a . To determine that the well meets the definition of low pressure well in § 60.5430a , you must use the low pressure well equation below: Where: (1) PL is the pressure of flowback fluid immediately before it enters the flow line, expressed in pounds force per square inch (psia), and is to be calculated using the equation above; (2) PR is the pressure of the reservoir containing oil, gas, and water at the well site, expressed in psia; (3) Lis the true vertical depth of the well, expressed in feet (ft); (4) qo is the flow rate of oil in the well, expressed in cubic feet/second (cu ft/sec); (5) qg is the flow rate of gas in the well, expressed in cu ft/sec; (6) qw is the flow rate of water in the well, expressed in cu ft/sec; (7) ρo is the density of oil in the well, expressed in pounds mass per cubic feet (lbm/cu ft). 

**Summary before (snapshot, the hand-approved text):**

This provision tells you how to calculate whether your well qualifies as a "low pressure well" under the regulation. You must use a specific equation that takes into account reservoir pressure, well depth, flow rates of oil/gas/water, and oil density to determine the pressure of flowback fluid before it enters the flow line (called PL). The provision defines each variable in the equation: reservoir pressure (PR) in psia, true vertical depth (L) in feet, flow rates of oil (qo), gas (qg), and water (qw) in cubic feet per second, and oil density (ρo) in pounds mass per cubic foot. If the calculated result shows your well meets the definition of low pressure well in section 60.5430a, then the requirements in section 60.5375a(f) apply to it.

**Summary after (live):** unchanged

## 6. `sec-p195-195.418-(b)-(4)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-p195-195.418] § 195.418 Valves: Onshore valve shut-off for rupture mitigation.
> [sec-p195-195.418-(b)]  Maximum spacing between valves. RMVs and alternative equivalent technology must be installed in accordance with the following requirements: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-p195-195.418-(b)-(4)]   Crossovers. An operator may use a manual valve as an alternative equivalent technology for a crossover connection if, during normal operations, the valve is closed to prevent the flow of hazardous liquid or carbon dioxide with a locking device or other means designed to prevent the opening of the valve by persons other than those authorized by the operator. The operator must document that the valve has been closed and locked in accordance with the operator's lock-out and tag-out procedures to prevent the flow of hazardous liquid or carbon dioxide. An operator using a such a valve as an alternative equivalent technology must submit a request to PHMSA in accordance with § 195.18 . 

**Summary before (snapshot, the hand-approved text):**

An operator may use a manual valve instead of a rupture-mitigation valve (RMV) on a crossover connection if the valve is normally kept closed and locked to prevent unauthorized opening, and the operator documents that the valve has been closed and locked under its lock-out/tag-out procedures. The operator must submit a request to PHMSA under § 195.18 to use a manual valve this way.

**Summary after (live):** unchanged

## 7. `sec-ecmc-316-a-(1)-A-ii-cc` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ecmc-316]  Rule 316 . — REQUIREMENTS FOR OIL AND GAS OPERATIONS IN THE OZONE NONATTAINMENT AREA
> [sec-ecmc-316-a]  Consideration of Operator’s NOx Intensity Target Status for Oil and Gas Development Plans in the Ozone Nonattainment Area between May 1 and September 30. 
> [sec-ecmc-316-a-(1)]  Operator’s Demonstration of NOx Intensity Target Status for Oil and Gas Development Plans. Each Oil and Gas Development Plan application that seeks approval to conduct pre-production operations in the Ozone Nonattainment Area between May 1 and September 30 will provide the following information on a Form 2B: 
> [sec-ecmc-316-a-(1)-A] 316.a.(1).A. Operators Subject to the NOx Intensity Target.
> [sec-ecmc-316-a-(1)-A-ii]  The Operator will provide the following information, as submitted in its annual report pursuant to AQCC Regulation No. 7, Part B.V.B, as incorporated in Rule 301.h : 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ecmc-316-a-(1)-A-ii-cc]   If any data pertaining to an Operator’s NOx Intensity Target is corrected and submitted to CDPHE, the same corrected data will be submitted to the Commission within 10 days of its submission to CDPHE. 

**Summary before (snapshot, the hand-approved text):**

If an operator corrects any data related to its NOx Intensity Target and submits that correction to CDPHE, the operator must submit the same corrected data to the Commission within 10 days of submitting it to CDPHE.

**Summary after (live):** unchanged

## 8. `sec-ooooa-60.5412a-(a)-(1)-(iii)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ooooa-60.5412a]  You must meet the applicable requirements of this section for each control device used to comply with the emission standards for your centrifugal compressor affected facility, or storage vessel affected facility. 
> [sec-ooooa-60.5412a-(a)]  Each control device used to meet the emission reduction standard in § 60.5380a(a)(1) for your centrifugal compressor affected facility must be installed according to paragraphs (a)(1) through (3) of this section. As an alternative, you may install a control device model tested under § 60.5413a(d) , which meets the criteria in § 60.5413a(d)(11) and meet the continuous compliance requirements in § 60.5413a(e) . 
> [sec-ooooa-60.5412a-(a)-(1)]  Each combustion device (e.g., thermal vapor incinerator, catalytic vapor incinerator, boiler, or process heater) must be designed and operated in accordance with one of the performance requirements specified in paragraphs (a)(1)(i) through (iv) of this section. If a boiler or process heater is used as the control device, then you must introduce the vent stream into the flame zone of the boiler or process heater. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ooooa-60.5412a-(a)-(1)-(iii)]   You must operate at a minimum temperature of 760 °Celsius, provided the control device has demonstrated, during the performance test conducted under § 60.5413a(b) , that combustion zone temperature is an indicator of destruction efficiency. 

**Summary before (snapshot, the hand-approved text):**

If you use a combustion device (like a thermal or catalytic incinerator) to control emissions from your centrifugal compressor affected facility, you must operate it at a minimum temperature of 760 degrees Celsius. This option is only allowed if you've already shown during your performance test that combustion zone temperature reliably indicates destruction efficiency.

**Summary after (live):** unchanged

## 9. `sec-p195-195.588-(c)-(4)-(ii)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-p195-195.588] § 195.588 What standards apply to direct assessment?
> [sec-p195-195.588-(c)]  If you use direct assessment on an onshore pipeline to evaluate the effects of stress corrosion cracking, you must develop and follow a Stress Corrosion Cracking Direct Assessment plan that meets all requirements and recommendations of NACE SP0204 (incorporated by reference, see § 195.3 ) and that implements all four steps of the Stress Corrosion Cracking Direct Assessment process including pre-assessment, indirect inspection, detailed examination and post-assessment. As specified in NACE SP0204, Section 1.1.7, Stress Corrosion Cracking Direct Assessment is complementary with other inspection methods such as in-line inspection or hydrostatic testing and is not necessarily an alternative or 
> [sec-p195-195.588-(c)-(4)]  Remediation and mitigation. If any indication of SCC is discovered in a segment, an operator must mitigate the threat in accordance with one of the following applicable methods: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-p195-195.588-(c)-(4)-(ii)]   Significant SCC must be mitigated using a hydrostatic testing program with a minimum test pressure between 100% up to 110% of the specified minimum yield strength for a 30-minute spike test immediately followed by a pressure test in accordance with subpart E of this part. The test pressure for the entire sequence must be continuously maintained for at least 8 hours, in accordance with subpart E of this part. Any test failures due to SCC must be repaired by replacement of the pipe segment, and the segment retested until the pipe passes the complete test without leakage. Pipe segments that have SCC present, but that pass the pressure test, may be repaired by grinding in accordance with paragraph (c)(4)(i) of this section. 

**Summary before (snapshot, the hand-approved text):**

If significant stress corrosion cracking (SCC) is found in a pipeline segment, the operator must mitigate it by hydrostatic testing at a minimum test pressure between 100% and 110% of the specified minimum yield strength – first a 30-minute spike test, then a pressure test under subpart E of this part, with the test pressure held continuously for at least 8 hours total. Any test failure caused by SCC must be fixed by replacing the failed pipe segment, and the segment must be retested until it passes without leaking. Pipe segments that have SCC but pass the pressure test may be repaired by grinding under paragraph (c)(4)(i).

**Summary after (live):** unchanged

## 10. `sec-ecmc-309-e-(2)-E` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ecmc-309]  Rule 309 . — POST-COMPLETENESS CONSULTATION AND COMMUNITY MEETING
> [sec-ecmc-309-e] 309.e. Colorado Parks and Wildlife.
> [sec-ecmc-309-e-(2)]  When Consultation Must Occur. The Operator will consult with the Surface Owner (unless the Surface Owner has waived their right to participate pursuant to Rule 309.e.(4).C ) and with CPW about a Form 2A, Oil and Gas Development Plan, CAP, or other matter where: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ecmc-309-e-(2)-E]   The Operator seeks a variance pursuant to Rule 502 from a provision in the Commission’s 1200 Series Rules, or from wildlife- specific conditions of approval or Best Management Practices approved on a Form 2A; or 

**Summary before (snapshot, the hand-approved text):**

An operator must consult with the surface owner (unless they've waived participation under Rule 309.e.(4).C) and with Colorado Parks and Wildlife when the operator is asking for a variance under Rule 502 from any 1200 Series rule, or from wildlife-specific conditions or Best Management Practices that were approved on a Form 2A.

**Summary after (live):** unchanged

## 11. `sec-ooooa-60.5395a-(d)-(3)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ooooa-60.5395a]  Each storage vessel affected facility must comply with the VOC standards in this section, except as provided in paragraph (e) of this section. 
> [sec-ooooa-60.5395a-(d)]  Compliance, notification, recordkeeping, and reporting. You must comply with paragraphs (d)(1) through (3) of this section. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ooooa-60.5395a-(d)-(3)]   You must perform the required reporting as required by § 60.5420a(b)(1) and (6) and the recordkeeping as required by § 60.5420a(c)(5) through (8), (12) through (14), and (17), as applicable. 

**Summary before (snapshot, the hand-approved text):**

This applies to owners or operators of storage vessel affected facilities under Subpart OOOOa. You must submit reports as spelled out in section 60.5420a(b)(1) and (b)(6), and you must keep records as spelled out in section 60.5420a(c)(5) through (c)(8), (c)(12) through (c)(14), and (c)(17), whichever of those apply to your situation.

**Summary after (live):** unchanged

## 12. `sec-p195-195.414-(c)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-p195-195.414] § 195.414 Inspections of pipelines in areas affected by extreme weather and natural disasters.

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-p195-195.414-(c)]   Time period. The inspection required under paragraph (a) of this section must commence within 72 hours after the cessation of the event, defined as the point in time when the affected area can be safely accessed by the personnel and equipment required to perform the inspection as determined under paragraph (b) of this section. In the event that the operator is unable to commence the inspection due to the unavailability of personnel or equipment, the operator must notify the appropriate PHMSA Region Director as soon as practicable. 

**Summary before (snapshot, the hand-approved text):**

The inspection required by paragraph (a) must begin within 72 hours after the extreme weather or natural disaster event ends – meaning when the area can be safely accessed by the people and equipment needed to do the inspection (as determined under paragraph (b)). If the operator cannot start the inspection within that time because personnel or equipment are unavailable, the operator must notify the appropriate PHMSA Region Director as soon as practicable.

**Summary after (live):** unchanged

## 13. `sec-ecmc-309-f-(1)-A-iii` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ecmc-309]  Rule 309 . — POST-COMPLETENESS CONSULTATION AND COMMUNITY MEETING
> [sec-ecmc-309-f] 309.f. Consultation with CDPHE.
> [sec-ecmc-309-f-(1)] 309.f.(1). When Consultation Will Occur.
> [sec-ecmc-309-f-(1)-A] 309.f.(1).A. The Director will request consultation with CDPHE if:

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ecmc-309-f-(1)-A-iii]   An Operator proposes an Oil and Gas Location with a Working Pad Surface within 1/2 mile of a Residential Building Unit, High Occupancy Building Unit, School Facility, or Child Care Center, or within 1 mile if the Building Unit or High Occupancy Building Unit is within a Disproportionately Impacted Community; 

**Summary before (snapshot, the hand-approved text):**

The Director will ask CDPHE to consult if an operator proposes an Oil and Gas Location with a Working Pad Surface within ½ mile of a home, high-occupancy building, school, or child care center, or within 1 mile if the building or high-occupancy building is in a Disproportionately Impacted Community.

**Summary after (live):** unchanged

## 14. `sec-ooooa-60.5412a-(d)-(1)-(iv)-(B)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ooooa-60.5412a]  You must meet the applicable requirements of this section for each control device used to comply with the emission standards for your centrifugal compressor affected facility, or storage vessel affected facility. 
> [sec-ooooa-60.5412a-(d)]  Each control device used to meet the emission reduction standard in § 60.5395a(a)(2) for your storage vessel affected facility must be installed according to paragraphs (d)(1) through (4) of this section, as applicable. As an alternative to paragraph (d)(1) of this section, you may install a control device model tested under § 60.5413a(d) , which meets the criteria in § 60.5413a(d)(11) and meet the continuous compliance requirements in § 60.5413a(e) . 
> [sec-ooooa-60.5412a-(d)-(1)]  For each combustion control device (e.g., thermal vapor incinerator, catalytic vapor incinerator, boiler, or process heater) you must meet the requirements in paragraphs (d)(1)(i) through (iv) of this section. 
> [sec-ooooa-60.5412a-(d)-(1)-(iv)]  Each enclosed combustion control device (e.g., thermal vapor incinerator, catalytic vapor incinerator, boiler, or process heater) must be designed and operated in accordance with one of the performance requirements specified in paragraphs (d)(1)(iv)(A) through (D) of this section. If a boiler or process heater is used as the control device, then you must introduce the vent stream into the flame zone of the boiler or process heater. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ooooa-60.5412a-(d)-(1)-(iv)-(B)]   You must reduce the concentration of TOC in the exhaust gases at the outlet to the device to a level equal to or less than 275 parts per million by volume as propane on a wet basis corrected to 3 percent oxygen as determined in accordance with the applicable requirements of § 60.5413a(b) . 

**Summary before (snapshot, the hand-approved text):**

This applies to owners using an enclosed combustion device (like a thermal or catalytic incinerator, boiler, or process heater) to control emissions from storage vessels. You must reduce the TOC (total organic compounds) concentration in the exhaust gases leaving the device to 275 ppmv or less (measured as propane on a wet basis, corrected to 3 percent oxygen), following the testing methods in § 60.5413a(b).

**Summary after (live):** unchanged

## 15. `sec-p195-195.444-(a)` -- pass

**Text above the provision (each ancestor, first 700 characters):**

> [sec-p195-195.444] § 195.444 Leak detection.

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-p195-195.444-(a)]   Scope. Except for offshore gathering and regulated rural gathering pipelines, this section applies to all hazardous liquid pipelines transporting liquid in single phase (without gas in the liquid). 

**Summary before (snapshot, the hand-approved text):**

This section applies to all hazardous liquid pipelines that transport liquid in single phase (without gas in the liquid), except it does not apply to offshore gathering lines or regulated rural gathering pipelines.

**Summary after (live):** unchanged

## 16. `sec-ecmc-301-c-(1)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ecmc-301]  Rule 301 . — GENERAL REQUIREMENTS FOR APPROVAL, CHANGES TO OPERATIONS, AND FILING FEES FOR OIL AND GAS OPERATIONS
> [sec-ecmc-301-c] 301.c. Changes to Approved Oil and Gas Development Plans.

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ecmc-301-c-(1)]   Operators will file any proposed change to an approved Oil and Gas Development Plan with the Director in writing through a Form 4, Sundry Notice. The Form 4 will be posted to the Commission’s website at least 14 days prior to approval or denial of the requested change. 

**Summary before (snapshot, the hand-approved text):**

Operators must submit any proposed change to an approved Oil and Gas Development Plan to the Director in writing using a Form 4, Sundry Notice. The Form 4 will be posted on the Commission's website at least 14 days before the Director approves or denies the requested change.

**Summary after (live):**

Operators must submit any proposed change to an approved Oil and Gas Development Plan to the Director in writing using a Form 4, Sundry Notice. The Form 4 will be posted on the Commission's website at least 14 days before approval or denial of the requested change.

**Reviewer's reasons:** The text does not name the Director as the party who approves or denies; it says only 'prior to approval or denial of the requested change'.

## 17. `sec-ooooa-60.5371a-(b)-(1)-(vii)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ooooa-60.5371a]  The provisions of this section will not apply between July 31, 2025, and January 22, 2027. The provisions of this section will apply after January 22, 2027. This section applies to super-emitter events. For purposes of this section, a super-emitter event is defined as any emissions event that is located at or near an oil and gas facility (e.g., individual well site, natural gas processing plant or compressor station) and that is detected using remote detection methods and has a quantified emission rate of 100 kg/hr of methane or greater. Upon receiving a notification of a super emitter event issued by the EPA under § 60.5371b(c) in subpart OOOOb of this part, owners or operators must take t
> [sec-ooooa-60.5371a-(b)]  Super-emitter event report. You must submit the results of the super-emitter event investigation conducted under paragraph (a) of this section to the EPA in accordance with paragraph (b)(1) of this section. If the super-emitter event (i.e., emission at 100 kg/hr of methane or more) is ongoing at the time of this initial report, submit the additional information in accordance with paragraph (b)(2) of this section. You must attest to the information included in the report as specified in paragraph (b)(3) of this section. 
> [sec-ooooa-60.5371a-(b)-(1)]  Within 15 days of receiving a notification from the EPA under § 60.5371b(c) , you must submit a report of the super-emitter event investigation conducted under paragraph (a) of this section through the Super-Emitter Program Portal, at www.epa.gov/super-emitter. You must include the applicable information in paragraphs (b)(1)(i) through (viii) of this section in the report. If you have identified a demonstrable error in the notification, the report may include a statement of the demonstrable error. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ooooa-60.5371a-(b)-(1)-(vii)]   Identification of whether the source of the super-emitter event is an affected facility or associated equipment subject to regulation under of this subpart. If the source of the super- emitter event is an affected facility or associated equipment subject to regulation under this subpart, identify the applicable regulation(s) under this subpart. 

**Summary before (snapshot, the hand-approved text):**

When you receive a super-emitter event report, you must state whether the source of the event is an affected facility or associated equipment regulated under this subpart (OOOOa). If it is regulated under this subpart, you must identify which specific OOOOa regulation(s) apply to that source.

**Summary after (live):**

When you receive a super-emitter event notification from the EPA, your report must state whether the source of the event is an affected facility or associated equipment regulated under this subpart (OOOOa). If it is regulated under this subpart, you must identify which OOOOa regulation(s) apply to that source.

**Reviewer's reasons:** Parent text: the owner or operator receives an EPA notification and submits the report; the report must include this information.; Text says 'the applicable regulation(s) under this subpart', with no 'specific' qualifier.

## 18. `sec-p195-195.440-(f)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-p195-195.440] § 195.440 Public awareness.

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-p195-195.440-(f)]   The program and the media used must be as comprehensive as necessary to reach all areas in which the operator transports hazardous liquid or carbon dioxide. 

**Summary before (snapshot, the hand-approved text):**

The operator's public awareness program and the communication methods it uses must be thorough enough to reach everyone in all areas where the operator's pipeline transports hazardous liquid or carbon dioxide.

**Summary after (live):**

The operator's public awareness program and the communication methods it uses must be as comprehensive as necessary to reach all areas in which the operator transports hazardous liquid or carbon dioxide.

**Reviewer's reasons:** Text requires reaching all areas as comprehensively as necessary; it does not say 'everyone' or limit to 'the operator's pipeline'.

## 19. `sec-ecmc-316-a-(4)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ecmc-316]  Rule 316 . — REQUIREMENTS FOR OIL AND GAS OPERATIONS IN THE OZONE NONATTAINMENT AREA
> [sec-ecmc-316-a]  Consideration of Operator’s NOx Intensity Target Status for Oil and Gas Development Plans in the Ozone Nonattainment Area between May 1 and September 30. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ecmc-316-a-(4)]   Commission Consideration of an Operator’s NOx Intensity Target Status. The Commission will review the Director’s Recommendation pursuant to Rule 307 and consider the Operator’s NOx Intensity Target status. 

**Summary before (snapshot, the hand-approved text):**

The Commission will review the Director's recommendation under Rule 307 and consider whether the operator has met its NOx Intensity Target when deciding on oil and gas development plans in the Ozone Nonattainment Area between May 1 and September 30.

**Summary after (live):**

The Commission will review the Director's recommendation under Rule 307 and consider the operator's NOx Intensity Target status when deciding on oil and gas development plans in the Ozone Nonattainment Area between May 1 and September 30.

**Reviewer's reasons:** The text says the Commission considers the Operator's NOx Intensity Target status, not whether the target was met.

## 20. `sec-ooooa-60.5415a-(b)-(2)-(ii)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ooooa-60.5415a] § 60.5415a How do I demonstrate continuous compliance with the standards for my well, centrifugal compressor, reciprocating compressor, pneumatic controller, pneumatic pump, storage vessel, collection of fugitive emissions components at a well site, and collection of fugitive emissions components at a compressor station affected facilities, equipment leaks at onshore natural gas processing plants and sweetening unit affected facilities?
> [sec-ooooa-60.5415a-(b)]  For each centrifugal compressor affected facility and each pneumatic pump affected facility, you must demonstrate continuous compliance according to paragraph (b)(3) of this section. For each centrifugal compressor affected facility, you also must demonstrate continuous compliance according to paragraphs (b)(1) and (2) of this section. 
> [sec-ooooa-60.5415a-(b)-(2)]  For each control device used to reduce emissions, you must demonstrate continuous compliance with the performance requirements of § 60.5412a(a) using the procedures specified in paragraphs (b)(2)(i) through (vii) of this section. If you use a condenser as the control device to achieve the requirements specified in § 60.5412a(a)(2) , you may demonstrate compliance according to paragraph (b)(2)(viii) of this section. You may switch between compliance with paragraphs (b)(2)(i) through (vii) of this section and compliance with paragraph (b)(2)(viii) of this section only after at least 1 year of operation in compliance with the selected approach. You must provide notification of such a change in

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ooooa-60.5415a-(b)-(2)-(ii)]   You must calculate the daily average of the applicable monitored parameter in accordance with § 60.5417a(e) except that the inlet gas flow rate to the control device must not be averaged. 

**Summary before (snapshot, the hand-approved text):**

If you use a control device to comply with centrifugal compressor standards, you must calculate the daily average of the monitored parameters (like temperature or pressure) following the method in section 60.5417a(e), but you cannot average the inlet gas flow rate to the control device – that flow rate must be tracked without averaging. This ensures you're continuously monitoring whether the control device is receiving the gas it's supposed to treat.

**Summary after (live):**

If you use a control device to reduce emissions at a centrifugal compressor affected facility, you must calculate the daily average of the applicable monitored parameter following the method in § 60.5417a(e), except that the inlet gas flow rate to the control device must not be averaged.

**Reviewer's reasons:** The text says "the applicable monitored parameter" and gives no temperature or pressure examples.; The text says only that the inlet gas flow rate must not be averaged; it does not say how it is tracked.; The text states no purpose or rationale for this rule.; Parent (b)(2) says "each control device used to reduce emissions", and (b) places this duty under centrifugal compressor affected facilities.

## 21. `sec-p195-195.52-(a)-(4)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-p195-195.52] § 195.52 Immediate notice of certain accidents.
> [sec-p195-195.52-(a)]  Notice requirements. At the earliest practicable moment following discovery, of a release of the hazardous liquid or carbon dioxide transported resulting in an event described in § 195.50 , but no later than one hour after confirmed discovery, the operator of the system must give notice, in accordance with paragraph (b) of this section of any failure that: 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-p195-195.52-(a)-(4)]   Resulted in pollution of any stream, river, lake, reservoir, or other similar body of water that violated applicable water quality standards, caused a discoloration of the surface of the water or adjoining shoreline, or deposited a sludge or emulsion beneath the surface of the water or upon adjoining shorelines; or 

**Summary before (snapshot, the hand-approved text):**

Within one hour of confirmed discovery, a pipeline operator must notify PHMSA (per the method in paragraph (b)) if a release of hazardous liquid or carbon dioxide polluted any stream, river, lake, reservoir, or similar body of water in a way that violated applicable water quality standards, discolored the water surface or shoreline, or deposited sludge or emulsion under the water or on the shoreline.

**Summary after (live):**

At the earliest practicable moment following discovery, but no later than one hour after confirmed discovery, the operator of the system must give notice (per the method in paragraph (b)) if a release of hazardous liquid or carbon dioxide polluted any stream, river, lake, reservoir, or similar body of water in a way that violated applicable water quality standards, discolored the water surface or shoreline, or deposited sludge or emulsion under the water or on the shoreline.

**Reviewer's reasons:** Text in § 195.52(a) names no recipient such as PHMSA and sets the timing as earliest practicable moment, no later than one hour after confirmed discovery.

## 22. `sec-ecmc-315-b-(3)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ecmc-315]  Rule 315 . — CUMULATIVE IMPACTS DATA AND ANALYSIS
> [sec-ecmc-315-b] 315.b. Cumulative Impacts Analysis.

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ecmc-315-b-(3)]   Analysis of Evaluations and Information. The Operator will submit a brief narrative analysis of the combined impacts contained in the evaluations and information required pursuant to Rules 315.b.(2).E -G that will not be avoided, minimized, or mitigated. 

**Summary before (snapshot, the hand-approved text):**

The operator must submit a short written analysis that discusses the combined impacts identified in the evaluations and information required by Rules 315.b.(2).E through G that cannot be avoided, minimized, or mitigated.

**Summary after (live):**

The operator must submit a short written analysis that discusses the combined impacts identified in the evaluations and information required by Rules 315.b.(2).E through G that will not be avoided, minimized, or mitigated.

**Reviewer's reasons:** Text says "will not be avoided, minimized, or mitigated", not "cannot".

## 23. `sec-ooooa-60.5417a-(c)-(1)-(ii)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ooooa-60.5417a]  You must meet the applicable requirements of this section to demonstrate continuous compliance for each control device used to meet emission standards for your storage vessel affected facility or centrifugal compressor affected facility. 
> [sec-ooooa-60.5417a-(c)]  If you are required to install a continuous parameter monitoring system, you must meet the specifications and requirements in paragraphs (c)(1) through (4) of this section. 
> [sec-ooooa-60.5417a-(c)-(1)]  Each continuous parameter monitoring system must measure data values at least once every hour and record the parameters in paragraphs (c)(1)(i) or (ii) of this section. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ooooa-60.5417a-(c)-(1)-(ii)]   Each block average value for each 1-hour period or shorter periods calculated from all measured data values during each period. If values are measured more frequently than once per minute, a single value for each minute may be used to calculate the hourly (or shorter period) block average instead of all measured values. 

**Summary before (snapshot, the hand-approved text):**

If you are monitoring a control device (like a flare or combustor) serving a centrifugal compressor or storage vessel, you must calculate a block average for each 1-hour period (or shorter) using all the data points your monitor collected during that time. If your instrument takes readings more often than once per minute, you can use just one value per minute to calculate the hourly average instead of using every single measurement.

**Summary after (live):**

If you are required to install a continuous parameter monitoring system on a control device serving a centrifugal compressor or storage vessel, one option for what you record is the block average value for each 1-hour period (or shorter), calculated from all the data values measured during that period. If your instrument takes readings more often than once per minute, you can use just one value per minute to calculate the hourly (or shorter period) average instead of using every single measurement.

**Reviewer's reasons:** Parent (c) and (c)(1) say the system must record the parameters in (c)(1)(i) or (ii), so the block average is one of two alternatives, and it applies when a CPMS is required.

## 24. `sec-p195-195.3-(b)-(16)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-p195-195.3] § 195.3 What documents are incorporated by reference partly or wholly in this part?
> [sec-p195-195.3-(b)]  American Petroleum Institute (API), 200 Massachusetts Avenue NW, Suite 1100, Washington, DC 20001-5571; phone: (202) 682-8000; website: www.api.org/. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-p195-195.3-(b)-(16)]   API Standard 620, Design and Construction of Large, Welded, Low-pressure Storage Tanks, 12th edition, effective October 2013, including Addendum 1 through 4 (November 2014), Addendum 2 (April 2018), Addendum 3 (March 2021), Addendum 4 (February 2025), Errata 1 (March 2025), (API Std 620); IBR approved for §§ 195.132(b) ; 195.205(b); 195.264(e); 195.307(b); 195.565; 195.579(d). 

**Summary before (snapshot, the hand-approved text):**

API Standard 620 (12th edition, October 2013, with Addenda 1–4 and Errata 1) is incorporated by reference for use in sections covering design, construction, inspection, and testing of large, welded, low-pressure storage tanks in hazardous liquid pipeline systems.

**Summary after (live):**

API Standard 620 (12th edition, effective October 2013, with Addenda 1–4 and Errata 1), Design and Construction of Large, Welded, Low-pressure Storage Tanks, is incorporated by reference, with IBR approved for §§ 195.132(b), 195.205(b), 195.264(e), 195.307(b), 195.565 and 195.579(d).

**Reviewer's reasons:** The text lists the approved sections and does not describe their subject matter as inspection, testing or pipeline systems.; The text says the edition is effective October 2013.

## 25. `sec-ecmc-309-e-(6)-A` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ecmc-309]  Rule 309 . — POST-COMPLETENESS CONSULTATION AND COMMUNITY MEETING
> [sec-ecmc-309-e] 309.e. Colorado Parks and Wildlife.
> [sec-ecmc-309-e-(6)] 309.e.(6). Conditions of Approval.

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ecmc-309-e-(6)-A]   If the Director agrees that the conditions of approval or denial as recommended by CPW are necessary and reasonable to Avoid, Minimize, or Mitigate Adverse Impacts to Wildlife Resources, the Director will incorporate CPW’s recommended conditions into the Director’s Recommendation on an Oil and Gas Development Plan, Form 2A, or CAP. 

**Summary before (snapshot, the hand-approved text):**

If the Director agrees that conditions recommended by Colorado Parks and Wildlife (CPW) are necessary and reasonable to avoid, minimize, or mitigate adverse impacts to wildlife resources, the Director will include those conditions in the Director's Recommendation on an Oil and Gas Development Plan, Form 2A, or Comprehensive Area Plan.

**Summary after (live):**

If the Director agrees that conditions recommended by Colorado Parks and Wildlife (CPW) are necessary and reasonable to avoid, minimize, or mitigate adverse impacts to wildlife resources, the Director will include those conditions in the Director's Recommendation on an Oil and Gas Development Plan, Form 2A, or CAP.

**Reviewer's reasons:** The text only says "CAP" and does not define it, so the expansion is unsupported.

## 26. `sec-ooooa-60.5397a-(g)-(2)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ooooa-60.5397a]  For each affected facility under § 60.5365a(i) and (j), you must reduce GHG (in the form of a limitation on emissions of methane) and VOC emissions by complying with the requirements of paragraphs (a) through (j) of this section. The requirements in this section are independent of the closed vent system and cover requirements in § 60.5411a . Alternatively, you may comply with the requirements of § 60.5398b , including the notification, recordkeeping, and reporting requirements outlined in § 60.5424b . For the purpose of this subpart, compliance with the requirements in § 60.5398b will be deemed compliance with this section. When complying with § 60.5398b , the definitions in § 60.5430b shal
> [sec-ooooa-60.5397a-(g)]  A monitoring survey of each collection of fugitive emissions components at a well site or at a compressor station must be performed at the frequencies specified in paragraphs (g)(1) and (2) of this section, with the exceptions noted in paragraphs (g)(3) through (6) of this section. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ooooa-60.5397a-(g)-(2)]   Except as provided in this paragraph (g)(2), a monitoring survey of the collection of fugitive emissions components at a compressor station must be conducted at least quarterly after the initial survey. Consecutive quarterly monitoring surveys must be conducted at least 60 days apart. A monitoring survey of the collection of fugitive emissions components at a compressor station located on the Alaskan North Slope must be conducted at least annually. Consecutive annual monitoring surveys must be conducted at least 9 months apart and no more than 13 months apart. 

**Summary before (snapshot, the hand-approved text):**

If you operate a compressor station (outside Alaska), you must conduct a fugitive emissions monitoring survey at least once every quarter (every three months), with at least 60 days between consecutive surveys. If your compressor station is on the Alaskan North Slope, you must conduct the survey at least once a year, with consecutive surveys spaced at least 9 months apart but no more than 13 months apart.

**Summary after (live):**

If you operate a compressor station, you must conduct a fugitive emissions monitoring survey at least once every quarter (every three months), with at least 60 days between consecutive surveys. If your compressor station is on the Alaskan North Slope, you must conduct the survey at least once a year, with consecutive surveys spaced at least 9 months apart but no more than 13 months apart.

**Reviewer's reasons:** The text gives the quarterly rule for compressor stations generally and carves out only the Alaskan North Slope, not all of Alaska.

## 27. `sec-p195-195.2-pipeline` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-p195-195.2]  As used in this part — 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-p195-195.2-pipeline]   Pipeline or pipeline system means all parts of a pipeline facility through which a hazardous liquid or carbon dioxide moves in transportation, including, but not limited to, line pipe, valves, and other appurtenances connected to line pipe, pumping units, fabricated assemblies associated with pumping units, metering and delivery stations and fabricated assemblies therein, and breakout tanks.   [sec-p195-195.2-pipeline-facility]   Pipeline facility means new and existing pipe, rights-of-way and any equipment, facility, or building used in the transportation of hazardous liquids or carbon dioxide. 

**Summary before (snapshot, the hand-approved text):**

**Pipeline** (or **pipeline system**) means all parts of a facility through which hazardous liquid or carbon dioxide moves in transportation – including line pipe, valves and other appurtenances connected to line pipe, pumping units and their fabricated assemblies, metering and delivery stations and their fabricated assemblies, and breakout tanks. The list is not exhaustive.

**Summary after (live):**

Pipeline (or pipeline system) means all parts of a facility through which hazardous liquid or carbon dioxide moves in transportation – including line pipe, valves and other appurtenances connected to line pipe, pumping units and their fabricated assemblies, metering and delivery stations and their fabricated assemblies, and breakout tanks. The list is not exhaustive.

**Reviewer's reasons:** stray Markdown markers removed

## 28. `sec-ecmc-314-e-(10)-E-iv` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ecmc-314]  Rule 314 . — COMPREHENSIVE AREA PLANS
> [sec-ecmc-314-e]  Informational Requirements for Comprehensive Area Plan. At a minimum, the Operator will submit the following materials as components of its CAP application: 
> [sec-ecmc-314-e-(10)]  Evaluating and Addressing Cumulative Impacts. Unless otherwise specified by Rule 314.e.(11) , the Operator will submit a Form 2F, CAP Cumulative Impacts Data Identification, that provides quantitative and qualitative data to evaluate incremental adverse impacts and beneficial contributions to each resource listed below that are likely to be caused by Oil and Gas Operations associated with the proposed CAP. Such Operations include access road construction and maintenance, flowline, pipeline, or utility corridor construction, Oil and Gas Location construction, drilling and completions operations, and production operations, including anticipated maintenance operations. Data will include a summ
> [sec-ecmc-314-e-(10)-E] 314.e.(10).E. Biological, Ecosystem, and Soil Resources.

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ecmc-314-e-(10)-E-iv]   A qualitative evaluation of incremental adverse impacts to topsoil as a result of surface disturbance associated with the proposed CAP; Energy and Carbon Management Commission 

**Summary before (snapshot, the hand-approved text):**

This provision requires a qualitative evaluation of the incremental harm to topsoil caused by surface disturbance from the proposed Comprehensive Area Plan (CAP). The evaluation must assess how the CAP's activities will incrementally damage topsoil resources in the area.

**Summary after (live):**

This provision requires a qualitative evaluation of the incremental harm to topsoil caused by surface disturbance from the proposed Comprehensive Area Plan (CAP). The evaluation must assess the incremental adverse impacts to topsoil resulting from surface disturbance associated with the CAP.

**Reviewer's reasons:** Text asks for evaluation of incremental adverse impacts to topsoil from surface disturbance; it does not state that activities will damage topsoil or refer to "the area".

## 29. `sec-ooooa-60.5420a-(b)-(13)-(iv)` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-ooooa-60.5420a] § 60.5420a What are my notification, reporting, and recordkeeping requirements?
> [sec-ooooa-60.5420a-(b)]  Reporting requirements. You must submit annual reports containing the information specified in paragraphs (b)(1) through (8) and (12) of this section and performance test reports as specified in paragraph (b)(9) or (10) of this section, if applicable. You must submit annual reports following the procedure specified in paragraph (b)(11) of this section. The initial annual report is due no later than 90 days after the end of the initial compliance period as determined according to § 60.5410a . Subsequent annual reports are due no later than same date each year as the initial annual report. If you own or operate more than one affected facility, you may submit one report for multiple affected f
> [sec-ooooa-60.5420a-(b)-(13)]  If you are required to electronically submit a report through CEDRI in the EPA's CDX, you may assert a claim of EPA system outage for failure to timely comply with the reporting requirement. To assert a claim of EPA system outage, you must meet the requirements outlined in paragraphs (b)(13)(i) through (vii) of this section. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-ooooa-60.5420a-(b)-(13)-(iv)]   You must submit notification to the Administrator in writing as soon as possible following the date you first knew, or through due diligence should have known, that the event may cause or caused a delay in reporting. 

**Summary before (snapshot, the hand-approved text):**

If an event causes or may cause you to miss a reporting deadline, you must notify EPA in writing as soon as possible after you first knew (or should have known through reasonable diligence) that the delay might happen or did happen. This applies to any affected source under this subpart that experiences such a delay.

**Summary after (live):**

If you are required to submit a report electronically through CEDRI in the EPA's CDX and want to assert a claim of EPA system outage, you must notify the Administrator in writing as soon as possible after you first knew (or through due diligence should have known) that the event may cause or caused a delay in reporting.

**Reviewer's reasons:** Text names the Administrator and sits under the (b)(13) EPA system outage claim for CEDRI/CDX submissions.; No such scope is stated in the text; the duty is tied to the system outage claim in (b)(13).

## 30. `sec-p195-195.6-threatened-and-endangered-species-t-e` -- corrected

**Text above the provision (each ancestor, first 700 characters):**

> [sec-p195-195.6]  As used in this part , a USA means a drinking water or ecological resource area that is unusually sensitive to environmental damage from a hazardous liquid pipeline release. 

**Official text (first 1,200 characters, descendants' ids in brackets):**

> [sec-p195-195.6-threatened-and-endangered-species-t-e]   Threatened and endangered species (T&amp;E) means an animal or plant species that has been listed and is protected under the Endangered Species Act of 1973, as amended (ESA73) (16 U.S.C. 1531 et seq.). “Endangered species” is defined as “any species which is in danger of extinction throughout all or a significant portion of its range” (16 U.S.C. 1532). “Threatened species” is defined as “any species which is likely to become an endangered species within the foreseeable future throughout all or a significant portion of its range” (16 U.S.C. 1532). 

**Summary before (snapshot, the hand-approved text):**

**Threatened and endangered species (T&E)** means an animal or plant species listed and protected under the Endangered Species Act of 1973. Endangered species are those in danger of extinction throughout all or a significant portion of their range; threatened species are those likely to become endangered in the foreseeable future throughout all or a significant portion of their range.

**Summary after (live):**

Threatened and endangered species (T&E) means an animal or plant species listed and protected under the Endangered Species Act of 1973. Endangered species are those in danger of extinction throughout all or a significant portion of their range; threatened species are those likely to become endangered in the foreseeable future throughout all or a significant portion of their range.

**Reviewer's reasons:** stray Markdown markers removed
