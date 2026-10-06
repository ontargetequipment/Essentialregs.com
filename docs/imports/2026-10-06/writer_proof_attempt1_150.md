# Writer proof, attempt 1 (read-only), 6 Oct 2026: old vs new writer instructions on 150 provisions the reviewer corrected in October

Workflow run: https://github.com/ontargetequipment/Essentialregs.com/actions/runs/37471297852 (Review workflow, input writer_proof=execute, prompt as of commit bf66b4c). Nothing was written to the database. The 100-row subset used for attempt 2 is the first 20 rows of each group below; on that subset the old writer's would-correct rate is 53.0% (53/100) and attempt 1's is 27.0% (27/100).


- 150 provisions the reviewer corrected in October 2026 (seed 20261006; groups {'gp': 30, '3': 30, '7': 30, 'oooob': 30, 'ecmc': 30}; eligible {'3': 438, '7': 578, 'ecmc': 1122, 'gp': 347, 'oooob': 715}; 0 left out as over the old 6,000-word cap, outline mode or headings-only)
- Writer `claude-sonnet-4-5` (temperature 0, batch); reviewer `claude-sonnet-5-5` (effort low, prompt version 7f111afa89, audit mode: nothing written)
- Cost: writer $1.2761 + reviewer $0.8399 = **$2.1160** (estimate was $2.26; cap $3.00)

## Would-correct rate

| writer | reviewed | pass | corrected | fail | would-correct rate |
|---|---:|---:|---:|---:|---:|
| old | 150 | 76 | 74 | 0 | **49.3%** |
| new | 150 | 111 | 39 | 0 | **26.0%** |

## By group

| group | old: would-correct | new: would-correct |
|---|---:|---:|
| gp | 60.0% (18/30) | 30.0% (9/30) |
| 3 | 70.0% (21/30) | 36.7% (11/30) |
| 7 | 26.7% (8/30) | 16.7% (5/30) |
| oooob | 30.0% (9/30) | 20.0% (6/30) |
| ecmc | 60.0% (18/30) | 26.7% (8/30) |

## Most common remaining reasons (new writer, keyword tally over the reviewer's reasons)

- other: 119
- party named differently: 17
- dropped condition or exception: 10
- wrong term or paraphrase: 10
- statement the text does not make: 8
- option presented as a duty: 7
- citation or cross-reference: 5
- limit from a parent paragraph: 4
- date, deadline or timing: 4
- scope wider: 3

## Most common reasons (old writer)

- other: 90
- party named differently: 28
- option presented as a duty: 22
- wrong term or paraphrase: 21
- statement the text does not make: 20
- dropped condition or exception: 17
- citation or cross-reference: 13
- limit from a parent paragraph: 12
- date, deadline or timing: 11
- number, threshold or unit: 11

## Rows

### sec-gp02-VI-E-5 (gp)
- **old** -> corrected
  - summary: The permit requires monthly recording of the pressure drop across the catalyst bed, and the monthly value must stay within +/- 2 inches of water column of the most recent baseline. If the pressure drop is out of range, the operator must take and document corrective action, or artificially load the engine to within +/- 10 percent of the baseline load and document the values if the pressure drop then comes into range, or skip maintenance and run a portable analyzer test to set a new baseline. The baseline pressure drop must be established during each initial and periodic compliance test and within the first 30 days after the catalyst is cleaned, reconditioned, or replaced.
  - reason: VI.E.5.b.(i)-(iii) say periodic performance test, 30 days of engine operation, and allow deferral of the baseline.
- **new** -> pass
  - summary: The permit requires monthly recording of the pressure drop across the catalyst bed for each engine with a catalytic emission control device. The monthly pressure drop must stay within +/- 2 inches of water column of the most recent baseline value. If the pressure drop is out of range, the owner or operator must take corrective action and document it, or artificially load the engine to within +/- 10 percent of the most recent baseline load value and document the results if the pressure drop is then in range, or perform a portable analyzer test to establish a new baseline. The baseline pressure drop must be established during each initial compliance test (or deferred to the first periodic performance test if historical test data without baseline pressure drop is used), during each periodic performance test, and within the first 30 days of engine operation after the catalyst is cleaned, reconditioned, or replaced.

### sec-gp08-VI-C (gp)
- **old** -> pass
  - summary: The permit requires that in ozone non-attainment areas, control devices used to meet Regulation Number 7 Part B Section I.D.3. and II.D.2. must be either a combustion device or a vapor recovery unit and must meet all requirements of Regulation Number 7 Part B Section I.C.1 and II.B.2. Alternative control equipment must be approved through an individual permit as required by Regulation Number 7 Part B Section I.D.4 or II.B.2.e.
- **new** -> pass
  - summary: In ozone nonattainment areas, control devices used to meet Regulation Number 7, Part B, Section I.D.3. and II.D.2. must be either a combustion device or a vapor recovery unit and must meet all requirements of Regulation Number 7, Part B, Section I.C.1 and II.B.2. Alternative control equipment must be approved through an individual permit as required by Regulation Number 7, Part B, Section I.D.4 or II.B.2.e.

### sec-gp09-I-C (gp)
- **old** -> corrected
  - summary: The permit covers only the well production facility and equipment that the operator specifically described and registered in the application materials submitted to the Division.
  - reason: Text ties the equipment to the description in Section I.A and to registration under this general permit in the application materials; it does not say the operator described it in the application.
- **new** -> pass
  - summary: The permit applies only to the specific well production facility and equipment described in Section I.A that the operator has registered under this general permit in the application materials submitted to the Division.

### sec-gp08-VIII-C-9 (gp)
- **old** -> pass
  - summary: The permit registration is valid only if the information you submitted was accurate and complete, you operate exactly as described in your application and representations, and you use only the specific equipment and conduct only the operations identified in your registration.
- **new** -> pass
  - summary: The permit registration is approved based on the accuracy and completeness of the information the applicant provided and is valid only for the specific equipment and operations identified in the registration. The registration is conditioned on operating the source according to that information and the representations the applicant or the applicant's agents made.

### sec-gp12-VI-F-5 (gp)
- **old** -> corrected
  - summary: The permit requires that each natural gas-fired engine equipped with a catalytic emission control device meet monitoring, maintenance, and testing conditions. Engines subject to Regulation Number 26 Part B Section I.D.5 or I.D.6 must comply with the monitoring requirements in those sections. The catalyst must be cleaned, reconditioned, and replaced per manufacturer recommendations, and catalyst inlet temperature must be recorded weekly (750°F to 1250°F for rich burn engines with NSCR, 450°F to 1350°F for lean burn engines with oxidation catalyst), with corrective action taken and documented if out of range. Pressure drop across the catalyst bed must be recorded monthly and must not deviate by more than +/- 2 inches of water column from the most recent baseline; if out of range, the owner or operator must take corrective action, artificially load the engine to check if pressure drop comes into range, or perform a portable analyzer test to establish a new baseline, and the baseline must be reestablished during each initial and periodic compliance test and within 30 days after catalyst cleaning, reconditioning, or replacement. Periodic portable analyzer performance tests for NOx and CO are required quarterly for major sources, quarterly (reducing to semi-annually after four consecutive passing tests) for minor and synthetic minor sources with facility-wide permitted NOx or CO at or above the Table 3 thresholds, and semi-annually (reducing to annually after two consecutive passing tests) for minor and synthetic minor sources below those thresholds, with tests performed at the highest load practicable and meeting the Portable Analyzer Monitoring Protocol or other Division-approved protocol.
  - reason: VI.F.5.c includes "or equivalent".
  - reason: VI.F.5.d carves out a more stringent Reg 26 requirement.
  - reason: VI.F.5.e.(i) gives these as options with stated conditions.
  - reason: VI.F.5.e.(ii)(C) says first thirty days of engine operation.
  - reason: VI.F.5.f.(i) states this scope and that frequency stays quarterly.
  - reason: VI.F.5.f.(iv) says artificial loading is not required.
- **new** -> corrected
  - summary: The permit requires that each natural gas-fired engine equipped with a catalytic emission control device meet several conditions. Engines subject to Regulation Number 26, Part B, Section I.D.5. or I.D.6. must comply with the monitoring requirements in those sections. The catalyst must be cleaned, reconditioned and replaced per the manufacturer's recommended maintenance or equivalent. Catalyst inlet temperature must be recorded weekly (750°F to 1250°F for rich burn engines with NSCR, 450°F to 1350°F for lean burn engines with oxidation catalyst), and corrective action must be taken and documented if the temperature is outside the specified range. Pressure drop across the catalyst bed must be recorded monthly and must not deviate by more than +/- 2 inches of water column from the most recent baseline value; if out of range, the owner or operator must take corrective action, artificially load the engine to check if pressure drop comes within range, or perform a portable analyzer test to establish a new baseline. Periodic performance tests for NOx and CO using a portable analyzer are required on a schedule that depends on source classification and emission thresholds in Table 3 (quarterly for major sources, quarterly reducing to semi-annually for some minor sources, and semi-annually reducing to annually for others after consecutive passing tests).
  - reason: VI.F.5.d. makes weekly recording subject to a more stringent requirement in Reg 26 I.D.5.e.(ii).

### sec-gp12-III-A-1 (gp)
- **old** -> corrected
  - summary: The permit requires that VOC, NOx, and CO emissions from each emission point not exceed the annual limits (in tons per year) stated in the Division's registration approval letter, or if no approval letter has been issued yet, the limits the owner or operator certified in the APEN submitted with the registration. This condition cites Regulation Number 3, Part B, Sections II.A.4. and II.A.7.
  - reason: Text says "the general permit registration approval letter" and names no Division.
- **new** -> pass
  - summary: The permit requires that VOC, NOx, and CO emissions from each registered emission point must not exceed the annual emission limitations (in tons per year) listed in the registration approval letter, or if no approval letter has been issued, the limits certified by the owner or operator in the APEN submitted with the registration.

### sec-gp10-IV-B-7-g (gp)
- **old** -> corrected
  - summary: The permit requires monthly measurement and recording of pressure drop across the catalyst bed on natural gas spark ignition engines controlled by air pollution control equipment. The monthly pressure drop must stay within +/- 2 inches of water column of the most recent baseline value. If out of range, corrective action must be taken and documented within 15 days, which may include artificially loading the engine to within +/- 10 percent of the baseline load to recheck, performing a portable analyzer test to establish a new baseline, or other appropriate action. The baseline pressure drop must be reestablished during each initial and periodic compliance test and within 30 days after the catalyst is cleaned, reconditioned, or replaced.
  - reason: Text refers to periodic performance tests and allows deferral when historical initial compliance test data is used without a recorded baseline.
  - reason: Text says the first thirty days of engine operation from the cleaning date.
- **new** -> corrected
  - summary: The permit requires the owner or operator to measure and record the pressure drop across the catalyst bed monthly, and the monthly values must not deviate by more than +/- 2 inches of water column from the most recent baseline value. If the pressure drop is out of range, corrective action must be taken and documented within 15 days, including artificially loading the engine to within +/- 10 percent of the most recent baseline load (and if then in range, documenting the values with no further action required), performing a portable analyzer test to establish a new baseline without maintenance, or taking other corrective action the owner or operator deems appropriate. The baseline pressure drop must be established by recording engine load and pressure drop during engine testing, and must be reestablished during each initial compliance test required by Section V (or deferred to the first periodic test if historical data without baseline pressure drop is used), during each periodic performance test required by Section VI.E.4, and within the first 30 days of engine operation after the catalyst is cleaned, reconditioned, or replaced.
  - reason: Text makes deferral optional, conditioned on no baseline recorded in the historical data, and cites Section VI.D.4.

### sec-gp01-VI-C (gp)
- **old** -> corrected
  - summary: The permit requires that in ozone non-attainment areas, control devices used to meet Regulation Number 7 Part B requirements must be either a combustion device or a vapor recovery unit and must satisfy all requirements of Regulation Number 7 Part B Sections I.C.1. and II.B.2. If the owner or operator wants to use alternative control equipment, they must obtain an individual permit as required by Regulation Number 7 Part B Section I.D.4. or II.B.2.e.
  - reason: The text applies the requirement only to control devices used to comply with Sections I.D.3. and II.D.2.
- **new** -> pass
  - summary: The permit requires that control devices used to meet Regulation Number 7, Part B, Sections I.D.3. and II.D.2. must be either a combustion device or a vapor recovery unit and must meet all requirements of Regulation Number 7, Part B, Section I.C.1. and II.B.2. Alternative control equipment must be approved through an individual permit as required by Regulation Number 7, Part B, Section I.D.4. or II.B.2.e.

### sec-gp12-VII-C-2 (gp)
- **old** -> corrected
  - summary: When using events-based processes (like blowdowns or tank flashing), within 180 days of starting operation under this permit and then periodically per Table 5, the owner or operator must analyze all equipment involved in those activities. For each piece of equipment, the owner or operator must determine the actual physical volume between isolation valves and the absolute pressure at actual conditions (engineering calculations and estimates are allowed). The owner or operator must also complete either a site-specific extended gas analysis of the vented gas to verify VOC and HAP content, or a site-specific sampling and compositional analysis of the pre-flash liquids routed to storage tanks (and if needed, a sales oil analysis for RVP and API gravity) to calculate site-specific emission factors using Division-approved methods; if the resulting emission factors exceed those in the registration approval letter or APEN, the owner or operator must use the new factors to calculate emissions and demonstrate compliance starting the month after sampling, and must report initial and periodic emission factors per Regulation Number 7, Part B, Section V. Table 5 sets sampling frequency based on area classification and facility-wide permitted VOC emissions: every five years for facilities below the threshold (90 TPY in attainment/marginal/moderate, 40 TPY in serious, 15 TPY in severe) and annually at or above it, with storage tanks having actual uncontrolled VOC emissions ≥ 80 TPY sampled every two years or annually depending on the same thresholds, and extreme ozone nonattainment areas sampled annually regardless of emissions.
  - reason: The text names no such examples of events-based processes.
  - reason: The text states this exemption for the sampling condition.
- **new** -> corrected
  - summary: The permit requires the owner or operator using events-based processes to complete an analysis of all equipment associated with those activities within 180 days after starting operation under this permit, and then periodically according to Table 5's sampling frequency (which varies from annually to every five years depending on area classification and facility-wide permitted VOC emissions). For each piece of equipment in each activity, the owner or operator must document the actual unique physical volume between isolation valves, the absolute pressure at actual conditions in that volume, and complete either a site-specific extended gas analysis of the vented gas or a site-specific sampling and compositional analysis of pre-flash pressurized condensate, crude oil, intermediate hydrocarbons, or produced water routed to storage tanks to verify VOC, benzene, toluene, ethylbenzene, xylenes, n-hexane, and 2,2,4-trimethylpentane content (weight fraction). If the site-specific emission factors developed are greater than those in the registration approval letter or certified in the APEN, the owner or operator must use the new factors to calculate actual emissions and demonstrate compliance starting with the calendar month following the sampling event, and must report initial and periodic emission factors per Regulation Number 7, Part B, Section V and keep records for a minimum of five years. Owners or operators using state-default emission factors are not required to comply with this condition, and storage tanks with actual uncontrolled VOC emissions ≥ 80 tons per year must be sampled every two years in attainment and marginal/moderate/serious non-attainment areas, or annually in extreme ozone non-attainment areas.
  - reason: Reporting and records apply to all initial and periodic sampling, not only when factors are greater.
  - reason: Table 5 ties tank frequency to facility-wide VOC thresholds and includes severe areas.

### sec-gp05-II-A-2 (gp)
- **old** -> corrected
  - summary: The permit requires that for new or modified GP05 registrations deemed complete on or after July 23, 2025, total NOx and CO emissions from all tank batteries and their controls owned by the same operator and co-located at the same stationary source must not exceed the annual tons-per-year limits listed in the registration approval letter, or if no approval letter has been issued, the limits the owner or operator certified in the APEN submitted with the registration. This emission cap applies to all GP05-registered tank batteries at that source combined, not individually.
  - reason: The text gives the trigger as the effective date of Issuance 5 and states no date for it.
  - reason: The text says "owned and operated by the same person".
- **new** -> corrected
  - summary: The permit requires that for new or modified GP05 registrations deemed complete on or after July 23, 2025, the maximum allowable NOx and CO emissions from all tank batteries and their controls owned and operated by the same person and co-located at the same stationary source must not exceed the requested annual emission limitations (in tons per year) listed on the general permit registration approval letter, or if no approval letter has been issued, as certified by the owner or operator in the APEN included with the registration (Regulation Number 3, Part B, Sections II.A.4. and II.A.7.).
  - reason: The provision gives the effective date of Issuance 5 and does not state a calendar date; July 23, 2025 is only the issuance date in the title.

### sec-gp03-I-A (gp)
- **old** -> corrected
  - summary: The permit is available to the owner or operator of any land development activity that can comply with all the operating conditions in Section II and meet all requirements of Section I (General Permit Applicability).
  - reason: The text says the owner or operator "may register for" the permit and refers to "this Section 0", not Section I.
- **new** -> pass
  - summary: The owner or operator of any land development activity may register for this permit if it can comply with all the operating conditions in Section II and meets all the requirements of Section I.

### sec-gp12-XI-E-5 (gp)
- **old** -> corrected
  - summary: The Division may require a well production facility operating under GP12 to apply for a source-specific construction permit if circumstances have changed since the original general permit application such that the facility is no longer appropriately controlled or permitted under the general construction permit. This provision cites Regulation Number 3, Part B, Section III.I.3.c.(i)(B).
  - reason: Text says "apply for and obtain".
- **new** -> pass
  - summary: The Division may require a well production facility that is authorized under this general permit to apply for and obtain a source-specific construction permit if circumstances have changed since the original general permit application so that the facility is no longer appropriately controlled or permitted under the general permit.

### sec-gp09-IX-B (gp)
- **old** -> corrected
  - summary: If the source has a Title V operating permit, some or all of the monitoring required by this general permit will be written into that Title V permit as specific conditions, and the Division may add other monitoring not listed in this general permit to satisfy periodic monitoring requirements under Colorado Regulation Number 3, Part C, Section V.C.5.
  - reason: Text names no Division as actor and cites Section V.C.5.b for the periodic monitoring requirements.
- **new** -> corrected
  - summary: The permit states that some or all of the monitoring required by this general permit will be incorporated as specific conditions in the registrant's Title V Operating Permit (if the source has one). Additional monitoring not listed in this general permit may also be included in the Operating Permit to satisfy the periodic monitoring requirements of Colorado Regulation Number 3, Part C, Section V.C.5.b.
  - reason: Text says "the source's Title V Operating Permit (if applicable)"; no registrant is named.

### sec-gp09-IV-J-2 (gp)
- **old** -> corrected
  - summary: The permit requires the owner or operator to use best management practices to minimize hydrocarbon emissions during routine or predictable gas venting events, or to reduce how often those events occur. The owner or operator must develop and maintain a written description of the best management practices used, including how they are implemented and performed.
  - reason: IV.J.2.a requires a description but does not say it must be written.
- **new** -> corrected
  - summary: The permit requires the owner or operator to use best management practices to minimize hydrocarbon emissions during routine or predictable gas venting events, or to reduce how often those events occur. The owner and operator must develop and maintain a written description of the best management practices used, including how they are implemented and performed.
  - reason: IV.J.2.a requires a description but does not say it must be written.

### sec-gp10-IV-A-3-h (gp)
- **old** -> corrected
  - summary: The permit requires the owner or operator to maintain on-site or at a local field office documentation of applicable MACT HH requirements (National Emissions Standards for Hazardous Air Pollutants for Oil and Natural Gas Production Facilities), referencing 40 CFR Part 63 Subparts A and HH and Regulation Number 8, Part E, Subparts A and HH.
  - reason: The provision text gives the full title including 'for Source Categories from'.
- **new** -> pass
  - summary: The permit requires the owner or operator to maintain documentation of applicable MACT HH requirements (National Emissions Standards for Hazardous Air Pollutants for Source Categories from Oil and Natural Gas Production Facilities, 40 CFR part 63 subparts A and HH, and Regulation Number 8 part E subparts A and HH). The documentation must be kept on-site or at a local field office with well production facility responsibility and must be available in electronic or hard copy format that can be promptly supplied to the Division upon request.

### sec-gp12-IX-C-1-a (gp)
- **old** -> pass
  - summary: The permit allows the owner or operator to replace a control device on a registered separator with equipment of the same make and model (and no configuration changes that would affect dispersion modeling) as an Alternative Operating Scenario without modifying the GP12 registration, provided there are no emission increases and all permit emission limits are still met.
- **new** -> pass
  - summary: Under the AOS provisions for gas venting from separators, the permit allows the owner or operator to replace an existing control device with control equipment of the same make and model without modifying the GP12 registration, provided there are no emissions increases, the permit's emission limits are still met, and there are no configuration changes that would impact a dispersion analysis.

### sec-gp07-VIII-C-9 (gp)
- **old** -> corrected
  - summary: The permit is valid only for the equipment and operations specifically listed in the registration, and approval is based on the accuracy and completeness of the information the applicant provided. The registrant must operate the source in accordance with that information and any representations made during the application process.
  - reason: Text says representations made by the applicant or applicant's agents, with no limit to the application process.
- **new** -> pass
  - summary: The permit registration is approved based on the accuracy and completeness of the information the applicant provided and is valid only for the equipment and operations specifically identified in the registration. The registration is conditioned on operating the source in accordance with that information and the representations the applicant or the applicant's agents made.

### sec-gp02-VII-A-2-f (gp)
- **old** -> pass
  - summary: The permit requires that when permanently replacing an existing registered engine with a like-kind engine, the owner or operator must not change the configuration in ways that might affect dispersion analysis, including stack heights, stack locations, or exit velocity.
- **new** -> pass
  - summary: The permit requires that a permanent replacement engine under an AOS must not include changes to the configuration that might impact a dispersion analysis, including stack heights, stack locations, or exit velocity.

### sec-gp09-IV-A-3-j (gp)
- **old** -> corrected
  - summary: The permit requires the owner or operator to maintain on-site or at a local field office documentation of applicable requirements under MACT ZZZZ (National Emission Standards for Hazardous Air Pollutants for Stationary Reciprocating Internal Combustion Engines), which is found in 40 CFR Part 63 Subparts A and ZZZZ and Colorado Regulation Number 8 Part D Subparts A and ZZZZ. Records may be kept electronically or in hard copy.
  - reason: Parent IV.A.3. conditions either format on records being promptly supplied to the Division upon request.
- **new** -> pass
  - summary: The permit requires the owner or operator to maintain documentation for MACT ZZZZ (National Emission Standards for Hazardous Air Pollutants for Stationary Reciprocating Internal Combustion Engines, 40 CFR Part 63, Subparts A and ZZZZ, and Regulation Number 8, Part D, Subparts A and ZZZZ) as one of the potentially applicable requirements for equipment registered under this permit. The documentation must be kept on-site or at a local field office with well production facility responsibility, in electronic or hard copy format, and must be promptly supplied to the Division upon request.

### sec-gp05-VIII-C-2 (gp)
- **old** -> corrected
  - summary: The permit requires that if a source or modification becomes major (triggering PSD/NANSR review) solely because an enforceable limit on capacity or operation (such as restricted hours) established after August 7, 1980 is relaxed, Colorado Regulation Number 3 Part D applies at that time.
  - reason: The text does not mention PSD or NANSR review; it only says Regulation Number 3, Part D requirements apply.
- **new** -> pass
  - summary: The permit requires that if a source or modification becomes major solely because an enforceable limit on capacity or operation (such as restricted hours) established after August 7, 1980, is relaxed, Colorado Regulation Number 3, Part D applies at that time, per Sections VI.B.4 and/or V.A.7.b.

### sec-gp05-VIII-E-4 (gp)
- **old** -> pass
  - summary: The permit requires the Division to give written notice to registrants before terminating the general permit, and that notice will tell registrants they must apply for an individual permit under Regulation Number 3, Part B.
- **new** -> pass
  - summary: If the Division terminates this general permit, it will give written notice to affected registrants before the termination. The notice will tell registrants they must apply for an individual permit as required by Regulation Number 3, Part B.

### sec-gp09-IV-A-3 (gp)
- **old** -> pass
  - summary: The permit requires the owner or operator to maintain documentation that clearly outlines which NSPS and MACT requirements apply to equipment registered under this permit. The documentation must be kept on-site or at a local field office with responsibility for the well production facility, in either electronic or hard copy format, and must be promptly supplied to the Division upon request. The potentially applicable requirements include NSPS GG (stationary gas turbines), NSPS Kb (VOC storage vessels), NSPS JJJJ (spark ignition engines), NSPS KKKK (stationary combustion turbines), NSPS OOOO/OOOOa/OOOOb (oil and gas production, transmission, and distribution), MACT HH (oil and gas production facilities), MACT YYYY (stationary combustion turbines), and MACT ZZZZ (stationary reciprocating internal combustion engines).
- **new** -> pass
  - summary: The permit requires the owner or operator to maintain documentation that clearly outlines which NSPS and MACT requirements apply to equipment registered under this permit. The documentation must be kept on-site or at a local field office with responsibility for the well production facility, in either electronic or hard copy format, and must be promptly supplied to the Division upon request. Potentially applicable requirements include NSPS GG, Kb, JJJJ, KKKK, OOOO, OOOOa, OOOOb and MACT HH, YYYY, ZZZZ.

### sec-gp12-XI-E-3 (gp)
- **old** -> pass
  - summary: If the Division revises GP12, it will notify registered owners or operators in writing that their existing registration will automatically convert to the revised permit, as long as they continue to meet all requirements of the revised permit. Owners or operators who do not want coverage under the revised permit may instead apply for a source-specific construction permit under Regulation Number 3, Part B, or apply for a different general permit if appropriate.
- **new** -> pass
  - summary: When the Division revises this general permit, it will notify affected owners or operators in writing that their existing registration will automatically convert to the revised permit, as long as they continue to meet all requirements of the revised permit. Owners or operators who do not want coverage under the revised permit may instead apply for a source-specific construction permit under Regulation Number 3, Part B, or apply for a different general permit, as appropriate.

### sec-gp08-VIII-D-2 (gp)
- **old** -> pass
  - summary: The permit may be reissued to a new owner or in a new company name by the Division under Regulation Number 3, Part B, Section II.B. when the owner or operator requests a transfer of ownership or company name change and submits a revised APEN and the required fees.
- **new** -> pass
  - summary: The Division may reissue a registration under this permit to a new owner or in a new company name as provided in Regulation Number 3, Part B, Section II.B. when the owner or operator requests a transfer of ownership or company name change and submits a revised APEN and the required fees.

### sec-gp10-IX-E-5 (gp)
- **old** -> pass
  - summary: The Division may require a facility operating under this general permit to apply for an individual construction permit if circumstances have changed since the original application such that the general permit is no longer appropriate for controlling or permitting that facility.
- **new** -> corrected
  - summary: The Division may require a facility operating under this general permit to apply for a site-specific Construction Permit if circumstances have changed since the original application such that the general permit no longer appropriately controls or permits the facility.
  - reason: The text says 'apply for and obtain a Construction Permit' and does not say 'site-specific'.

### sec-gp05-IX-B (gp)
- **old** -> pass
  - summary: The permit requires the owner or operator to maintain documentation that clearly outlines which NSPS Subpart OOOO, OOOOa, or OOOOb requirements apply to the produced water storage tank battery registered under this permit. The documentation must be kept on-site or at a local field office with stationary source responsibility, in either electronic or hard copy format, and must be promptly available to the Division upon request.
- **new** -> pass
  - summary: The permit requires the owner or operator to maintain documentation that clearly outlines which NSPS Subpart OOOO, OOOOa, or OOOOb requirements apply to the produced water storage tank battery registered under this permit. The documentation must be kept on-site or at a local field office with stationary source responsibility. Records can be electronic or hard copy as long as they can be promptly supplied to the Division upon request.

### sec-gp09-IX-D-1 (gp)
- **old** -> pass
  - summary: The Division may deny or revoke a registration under this general permit and require the owner or operator to apply for a Construction Permit instead, under the circumstances specified in Regulation Number 3, Part B, Section III.I.3.c.
- **new** -> pass
  - summary: The Division may deny or revoke a registration under this general permit in the circumstances listed in Regulation Number 3, Part B, Section III.I.3.c., and may require the owner or operator to apply for a Construction Permit under Regulation Number 3, Part B.

### sec-gp11-I-A-3 (gp)
- **old** -> pass
  - summary: The permit allows sources that became Title V or existing major sources because the 8-hour Ozone Control Area was reclassified from serious to severe to continue operating under GP11 if the Division received a complete GP11 registration request before November 3, 2022. The 8-hour Ozone Control Area is defined in Regulation Number 7, Part A, Section II.A.1.
- **new** -> pass
  - summary: The permit allows sources that became Title V sources or existing major sources because the 8-hour Ozone Control Area was reclassified from serious to severe, and for which a complete GP11 registration was received by the Division before November 3, 2022, to continue operating under this general permit. The 8-hour Ozone Control Area is defined in Regulation Number 7, Part A, Section II.A.1.

### sec-gp12-IX-E-1 (gp)
- **old** -> corrected
  - summary: The permit allows the owner or operator to invoke an Alternative Operating Scenario for certain modifications to an existing registered natural gas-fired engine, as long as the emission limits in Condition III are still met. The modifications covered are: temporarily replacing an engine with a different or like-kind engine per Attachment A; permanently replacing an engine with a like-kind engine per Attachment A (without changing stack height, location, or exit velocity); routine maintenance, repair, or like-kind replacement of control equipment; and adding a control device when the operator will not claim federally enforceable emission-reduction credit.
  - reason: IX.E.1.b.(i) bars configuration changes that might impact a dispersion analysis, 'includes but is not limited to' the three items, so the list is not exhaustive.
- **new** -> corrected
  - summary: The permit allows the owner or operator to use an Alternative Operating Scenario (AOS) for certain modifications to an existing registered natural gas-fired engine, as long as the emission limits in Condition III are still met. The allowed modifications are: temporarily replacing an engine with a different or like-kind engine per Attachment A; permanently replacing an engine with a like-kind engine per Attachment A (without changing stack height, location, or exit velocity); routine maintenance, repair, or like-kind replacement of control equipment; and adding a control device when the operator will not claim federally enforceable emission-reduction credit.
  - reason: IX.E.1.b.(i) says the list is not limited to stack heights, stack locations and exit velocity, and ties the bar to changes that might impact a dispersion analysis.

### sec-gp10-IV-A-3-a (gp)
- **old** -> corrected
  - summary: The permit requires the owner or operator to maintain on-site or at a local field office documentation of the applicable requirements of NSPS GG (Standards of Performance for Stationary Gas Turbines), referencing 40 CFR Part 60 Subparts A and GG and Colorado Regulation Number 6, Part A, Subparts A and GG. Records may be kept electronically or in hard copy.
  - reason: The text does not say 'Colorado'.
  - reason: Parent IV.A.3 conditions the record format on prompt supply to the Division upon request.
- **new** -> corrected
  - summary: The permit requires the owner or operator to maintain on-site or at a local field office documentation showing that equipment registered under this permit meets NSPS GG (Standards of Performance for Stationary Gas Turbines, 40 CFR Part 60 Subparts A and GG, and Regulation Number 6 Part A Subparts A and GG). Records may be electronic or hard copy and must be promptly available to the Division upon request.
  - reason: Parent IV.A.3 requires documentation outlining applicable NSPS/MACT requirements and lists NSPS GG only as a potentially applicable requirement, not as proof of compliance.

### sec-3-D-II-A-21-b (3)
- **old** -> corrected
  - summary: LAER (Lowest Achievable Emissions Rate) can be the most stringent emission limit actually achieved in practice by that type of source. A new or modified source cannot emit more than what an applicable new source performance standard (Regulation Number 6) allows, even if the in-practice limit would be higher.
  - reason: The text says only that application of the term may not permit emissions above the new source performance standard; the 'even if the in-practice limit would be higher' clause is not in the text.
- **new** -> pass
  - summary: LAER (Lowest Achievable Emissions Rate) for a source includes the most stringent emission limit actually achieved in practice by that class or category of source. A proposed new or modified stationary source may not emit any pollutant in excess of the amount allowed under an applicable new source performance standard in Regulation Number 6.

### sec-3-C-V-B-6 (3)
- **old** -> corrected
  - summary: The EPA Administrator may object to a Colorado operating permit if the Division determines the permit won't comply with applicable requirements or 40 CFR Part 70. The objection must state the Administrator's reasons and describe what terms the permit needs to address the objection. The Administrator also has grounds to object if the Division fails to submit required copies of applications and permits to EPA, fails to comply with affected-state review requirements, fails to give EPA information needed to review the permit, or fails to comply with public-participation requirements.
  - reason: V.B.6 says the objection rests on the Administrator's determination, not the Division's.
- **new** -> pass
  - summary: The EPA Administrator may object to a permit if the proposed permit will not comply with applicable requirements or 40 CFR part 70. Any objection must include the Administrator's reasons and describe the terms and conditions needed to address the objection. The Administrator may also object if the Division fails to submit required copies of applications and permits to EPA (Section V.F.), fails to comply with affected-state review (Section IX.), fails to submit information EPA needs to review the permit, or fails to comply with public participation requirements (Section VI.).

### sec-3-D-VI-A-3-b (3)
- **old** -> corrected
  - summary: For a regulated pollutant that has no national ambient air quality standard but does have an acceptable monitoring method, the applicant must include whatever air quality monitoring data the Division decides are necessary to assess ambient air quality for that pollutant in any area the emissions would affect. This applies to the pre-construction analysis required for major stationary source permits.
  - reason: VI.A applies to any new major stationary source or major modification, not only major stationary sources.
- **new** -> pass
  - summary: For a regulated pollutant that has no national ambient air quality standard but does have an acceptable monitoring method, the analysis must include whatever air quality monitoring data the Division determines are necessary to assess ambient air quality for that pollutant in any area the emissions would affect.

### sec-3-B-II-D-1-g (3)
- **old** -> pass
  - summary: Surface mining activities that mine 70,000 tons or fewer of product material per year are exempt from construction permit requirements, but must have a fugitive dust control plan. Crushers, screens, and other processing equipment are not covered by this exemption.
- **new** -> pass
  - summary: Surface mining activities that mine 70,000 tons or fewer of product material per year are exempt from construction permit requirements, but a fugitive dust control plan is required. Crushers, screens, and other processing equipment are not covered by this exemption.

### sec-3-B-III-D-1-g (3)
- **old** -> pass
  - summary: Permit approval does not excuse the owner or operator from complying with the state implementation plan or any other local, state, or federal requirements.
- **new** -> pass
  - summary: Approval of a construction permit does not relieve the owner or operator from the duty to comply fully with the state implementation plan and any other applicable local, state, or federal requirements.

### sec-3-D-II-A-35 (3)
- **old** -> pass
  - summary: A Plant-wide Applicability Limitation (PAL) is an emission limit for a pollutant at a major stationary source or GHG-only source, expressed in tons per year (or tons per year CO2e for greenhouse gases). The limit applies to the entire source and must be enforceable as a practical matter. It is established according to Section XV of Part D of this regulation.
- **new** -> pass
  - summary: A Plant-wide Applicability Limitation (PAL) is an emission limit for a pollutant at a major stationary source or GHG-only source, expressed in tons per year (or tons per year CO2e for greenhouse gases). The limit is enforceable as a practical matter and applies to the entire source. It must be established according to Section XV of Part D.

### sec-3-C-XIII-A (3)
- **old** -> corrected
  - summary: A Part C operating permit must be reopened and revised if new applicable requirements take effect with three or more years left on the permit (completed within 18 months of the new requirement), if acid rain program requirements become applicable, if the Division or the Administrator finds a material mistake or inaccurate statements in the permit, or if the Division or the Administrator determines revision is needed to assure compliance. The Division must give the source at least 30 days' advance notice before reopening a permit, except in an emergency. Reopening affects only the parts of the permit for which cause exists, and follows the same procedures as initial permit issuance.
  - reason: XIII.A.1 applies to a major source and the 18 months run from promulgation.
  - reason: XIII.A.2 refers to an affected source under the acid rain program.
  - reason: XIII.A.5 cites Sections III, IV and V for permit issuance and permit renewal.
- **new** -> corrected
  - summary: A Part C operating permit must be reopened and revised in any of seven circumstances: when new applicable requirements take effect for a major source with at least three years left on the permit (completed within 18 months of the requirement's promulgation, with exceptions); when new requirements apply to an acid rain affected source; when the Division or the Administrator finds a material mistake or inaccurate statements in the permit's emissions standards or other terms; when the Division or the Administrator determines revision or revocation is needed to assure compliance with applicable requirements; reopening follows the same procedures as initial issuance and renewal; reopening affects only the parts of the permit for which cause exists; and the Division must give the source at least 30 days' advance notice before reopening (shorter in an emergency).
  - reason: Only XIII.A.1 to XIII.A.4 are circumstances for reopening; XIII.A.5 to A.7 are procedural.
  - reason: XIII.A.5 to A.7 are not circumstances; restated as procedure, scope and notice rules.

### sec-3-A-V-D-2-b (3)
- **old** -> pass
  - summary: Emission reductions from an emission unit that is violating an emission limit for a nonattainment pollutant at the time the application is reviewed, and continuing through ERC certification, do not qualify for emission reduction credits.
- **new** -> corrected
  - summary: Emission reductions from an emission unit that is violating an emission limit for a nonattainment pollutant do not qualify for emission reduction credits, covering the period from when the Division reviews the application until the credit is certified.
  - reason: The text says "at the time of application review until ERC certification" and names no Division.

### sec-3-D-VIII-B-3 (3)
- **old** -> corrected
  - summary: Lands administered by the Federal Bureau of Land Management in the Gunnison Gorge Recreation Area as of October 27, 1977 are designated Class II, but the increase allowed in sulfur dioxide concentrations over baseline is the same as in Class I areas. These areas may be redesignated as provided in Section IX of this part.
  - reason: Parent VIII.B. states the Section 163(b) basis and both exceptions to the Class I-equivalent increase.
- **new** -> pass
  - summary: Lands managed by the Federal Bureau of Land Management in the Gunnison Gorge Recreation Area as of October 27, 1977 are designated Class II, but the increase allowed in sulfur dioxide concentrations over baseline must be the same as the increase established for Class I areas under Section 163(b) of the Federal Act, except that the increase may not be allowed if a Federal Land Manager makes an adverse impact determination under Section XIII.C. that the Division agrees with, and the increase may be exceeded by complying with Sections XIII.D., XIII.E., or XIII.F. These areas may be redesignated as provided in Section IX.

### sec-3-C-X-F (3)
- **old** -> pass
  - summary: Within five working days of receiving a complete minor permit modification application, the Division must send a copy of the notice (completed under Section X.D.4.) to the Administrator. The Administrator here means the EPA Administrator.
- **new** -> pass
  - summary: Within five working days of receiving a complete minor permit modification application, the Division must send a copy of the notice (completed under Section X.D.4.) to the Administrator.

### sec-3-C-V-C-5-d-(i)-(A) (3)
- **old** -> corrected
  - summary: For sources in Cumulatively Impacted Communities, if a permit modification since the last operating permit renewal increased the source's requested or permitted emissions of nitrogen oxides or direct PM2.5 above the Affected Construction Source thresholds in Part A, Section I.B.4, the operating permit must include certain information. (The specific information required is set out in the parent provision.)
  - reason: Parent text covers permit modification applications submitted or permits issued since the last renewal application.
  - reason: Provision text says 'and/or' and 'in excess of'.
  - reason: The parent states a monitoring plan requirement, not a requirement to include certain information in the permit.
- **new** -> pass
  - summary: For sources in Cumulatively Impacted Communities that have had permit modifications or permits issued since the last operating permit renewal that increased emissions, the Division will require source-specific monitoring if the requested or permitted emissions of nitrogen oxides and/or direct PM2.5 exceed the Affected Construction Source thresholds defined in Part A, Section I.B.4. The source must design and implement a Division-approved monitoring plan within three months of permit issuance (or another Division-approved timeline) as outlined in Section III.J.2.b. of Part B. Sources already operating Division-approved source-specific monitoring for these pollutants do not need to conduct additional monitoring under this provision.

### sec-3-C-VIII-H (3)
- **old** -> corrected
  - summary: A general operating permit cannot be issued to a major source if doing so would violate any requirement in another operating permit the source already holds, or if the general permit would let the source avoid triggering a modification under Title I of the Clean Air Act.
  - reason: Text says "any applicable requirement in any other operating permit held by the source".
- **new** -> corrected
  - summary: A general operating permit cannot be issued to a major source if doing so would violate any requirement in another operating permit the source already holds, or if it would let the source avoid a modification under Title I of the Federal Clean Air Act.
  - reason: Text says "any applicable requirement in any other operating permit held by the source".

### sec-3-A-V-D-1-b (3)
- **old** -> corrected
  - summary: To be certified as an emission reduction credit (ERC) for use as an offset, the emission reductions must be surplus (as defined in Section V.C.9. of Part A), permanent, quantifiable, and federally enforceable at the time of certification.
  - reason: The text applies 'at the time of ERC certification' only to the surplus criterion.
- **new** -> corrected
  - summary: To be certified as an emission reduction credit (ERC), the emission reduction must be surplus (as defined in Section V.C.9.), permanent, quantifiable, and federally enforceable at the time of certification.
  - reason: The text applies "at the time of ERC certification" only to the surplus requirement.

### sec-3-B-III-J-2-b (3)
- **old** -> corrected
  - summary: When a construction source in a Disproportionately Impacted Community triggers source-specific monitoring (by exceeding the thresholds in Table 1), the source must submit a monitoring plan showing that the chosen monitoring is the best reasonably available technology capable of detecting the pollutant(s) that triggered the requirement, and explaining how the monitoring will inform the source's impact on ambient air concentrations in that community. The source must use one of three options: a Division-approved fenceline monitoring network; air quality monitors within 0.25 miles of the highest modeled concentration area (if that area is within 0.25 miles of an Occupied Area) or the nearest practical location, with Division approval; or existing or new monitoring technologies (such as CEMS, performance testing, parametric monitoring, source sampling, or real-time process systems like SCADA) under a Division-approved plan that demonstrates how the monitoring informs community air-quality impacts.
  - reason: Option (ii) begins 'If accessible to the source's owner/operator'; the summary omitted this condition.
- **new** -> corrected
  - summary: A source-specific monitoring plan required under Section III.J.2. or Section V.C.5.d.(i) must identify how the selected monitoring is the best available monitoring technology that is reasonably available and capable of detecting or monitoring the pollutants that triggered the requirement. The plan must also identify how the monitoring will inform how the emissions of the monitored pollutant will impact ambient air concentrations in the Disproportionately Impacted Community where the source is located. The monitoring must be implemented using one of three options: a Division-approved fenceline monitoring network; air quality monitors within 0.25 miles of the area of highest modeled concentration (if that area is within 0.25 miles of an Occupied Area) or the nearest practical location, with Division-approved locations; or monitoring technologies operated under a Division-approved detailed description of existing or new monitoring for the relevant pollutant(s), including type and frequency, with a demonstration of how it informs ambient air impacts (which may include dispersion modeling or other information), such as CEMS, performance testing, Division-approved parametric monitoring, source-specific sampling, or real or near real-time process monitoring systems like SCADA.
  - reason: Option (ii) applies only if accessible to the owner/operator and refers to the highest annual average modeled concentration.
  - reason: Text says 'nearest logistically practical location'.

### sec-3-A-I-B-30-a (3)
- **old** -> corrected
  - summary: A stationary source is a major source if it directly emits or has the potential to emit (considering enforceable controls) 10 tons per year or more of any single hazardous air pollutant, or 25 tons per year or more of any combination of hazardous air pollutants. Emissions from oil or gas exploration or production wells (with associated equipment) and from pipeline compressor or pump stations must not be aggregated with emissions from other similar units to determine major source status, and for oil or gas exploration or production wells such emissions must not be aggregated for any purpose under this provision. Fugitive emissions are counted when determining whether a stationary source of hazardous air pollutants is a major source.
  - reason: Text says "any hazardous air pollutant" (not "single") and adds the lesser quantity that may be established pursuant to the Federal Act.
- **new** -> pass
  - summary: A stationary source or group of sources under common control is a major source if it directly emits or has the potential to emit (considering enforceable controls) 10 tons per year or more of any single hazardous air pollutant, or 25 tons per year or more of any combination of hazardous air pollutants, or a lesser quantity if established under the Federal Act. Emissions from oil or gas exploration or production wells (with associated equipment) and from pipeline compressor or pump stations may not be aggregated with emissions from other similar units to determine major source status, and for oil or gas exploration or production wells (with associated equipment) such emissions may not be aggregated for any purpose under this provision. Fugitive emissions must be considered when determining whether a stationary source of hazardous air pollutants is a major source.

### sec-3-A-II-D-1-zzz (3)
- **old** -> pass
  - summary: Venting natural gas lines for safety purposes is exempt from the requirement to file an Air Pollutant Emission Notice. The exemption does not cover routine or predictable emissions at or associated with a stationary source.
- **new** -> pass
  - summary: Venting natural gas lines for safety purposes is exempt from filing an Air Pollutant Emission Notice. This exemption does not apply to routine or predictable emissions at or associated with a stationary source.

### sec-3-F-I-AAA (3)
- **old** -> corrected
  - summary: On October 12, 2016, the Commission revised three definitions in Regulation Number 3, Part D to align with federal requirements and avoid future permitting disruptions if Colorado's ozone nonattainment area is ever reclassified to a more stringent category. The revisions updated "major stationary source" to include ozone nonattainment area major source thresholds that step down based on area classification (serious, severe, or extreme), removed an unnecessary example from the "major emissions unit" definition, and added emission rates for serious, severe, and extreme ozone nonattainment areas to the definition of "significant." The changes ensure Colorado can maintain its permitting authority and provide regulatory certainty if an ozone nonattainment area is reclassified beyond moderate.
  - reason: Text says Colorado's prior definition did not step down thresholds by classification; it names no classes for this revision.
- **new** -> corrected
  - summary: The Commission revised three definitions in Regulation Number 3, Part D, Section II to match federal requirements for ozone nonattainment areas. The definition of "major stationary source" now includes lower thresholds that would apply if Colorado's ozone nonattainment area is ever reclassified from moderate to serious, severe, or extreme (currently the definition uses a 100 tons per year threshold regardless of classification). The definition of "major emissions unit" was simplified by removing an example about volatile organic compounds. The definition of "significant" was updated to add emission rates for serious, severe, and extreme ozone nonattainment areas that were previously missing.
  - reason: Text discusses reclassification to serious or severe and 'a more stringent classification beyond a moderate' area for the major source definition; extreme is named only for the significant definition.

### sec-3-C-V-C-5-d-(iv)-(B)-(1) (3)
- **old** -> corrected
  - summary: Sources that modified their operating permit or applied to increase permitted emissions of volatile organic compounds, nitrogen oxides, or direct PM<sub>2.5</sub> since their last renewal (on or after October 15, 2024) must use the estimated annual actual emissions of benzene, toluene, ethylbenzene, and xylenes and/or the requested permitted emissions of volatile organic compounds, nitrogen oxides, and direct PM<sub>2.5</sub> from their Air Pollutant Emission Notice and related submittals for calculating the Disproportionately Impacted Community Monitoring Fee.
  - reason: The text states that the figures shall be used for fee assessment based on filings with the Division; it places no duty on sources, and the parent condition covers both emission groups.
  - reason: Matches the provision text on the filings and on fee assessment.
  - reason: Text says 'and/or'; HTML markup removed.
- **new** -> pass
  - summary: The estimated annual actual emissions of benzene, toluene, ethylbenzene, and/or xylenes and/or the requested permitted emissions of volatile organic compounds, nitrogen oxides, and/or direct PM2.5 shown on the Air Pollutant Emission Notice(s) and information submitted under Section III.C. of Part C will be used to assess the Disproportionately Impacted Community Monitoring Fee.

### sec-3-C-XI-C (3)
- **old** -> corrected
  - summary: When applying for group processing of minor permit modifications, you must submit a complete operating permit application signed by a responsible official, including all information the Division needs to evaluate the modification and any required ambient air impact analysis. The application must describe the change and resulting emissions, include a draft permit, certify that the modification qualifies for group processing, list other pending applications and whether they collectively meet the thresholds in XI.A.2.a through XI.A.2.c, certify that you notified EPA, and provide copies of Air Pollutant Emission Notices on file with the Division (or submit new ones if none exist, without paying the usual fee). You must also provide completed forms for the Division to notify the Administrator and affected states, though such notice is not required for minor sources voluntarily seeking operational flexibility or for group processing of modifications involving state-only conditions. Minor permit modifications under this group processing procedure do not trigger the procedural requirements that otherwise apply to modifications under Part B.
  - reason: XI.C.4 requires a determination of whether the modification aggregated with other applications equals or exceeds the threshold.
  - reason: XI.C.6 waives the fee only for copies of previously filed notices.
  - reason: XI.C.7 says the forms are for the permitting authority.
- **new** -> corrected
  - summary: Applications for group processing of minor permit modifications must meet the operating permit application requirements in Regulation 3, Part C, Section III and be signed by a responsible official. The applicant must provide all information and data the Division requires to evaluate the application, including any required ambient air impact analysis under Part A, Section VIII. The application must include a description of the change and resulting emissions, the source's suggested draft permit, certification that the modification meets group processing criteria, a list of other pending applications and whether they collectively meet the thresholds in Sections XI.A.2.a through XI.A.2.c, certification that the source notified EPA, copies of Air Pollutant Emission Notices on file (or new ones if not previously filed, with no fee for copies already on file), completed forms for notifying the Administrator and affected states (though notice to affected states is not required for minor sources voluntarily applying or for group processing involving state-only conditions), and acknowledgment that these minor modifications will not trigger the procedural requirements otherwise applicable under Part B.
  - reason: XI.C.7 says state-only group processing needs no notice to affected states or the Administrator.
  - reason: XI.C.8 is a statement, qualified by the state implementation plan, not an applicant acknowledgment.

### sec-3-D-XV-J-1-a (3)
- **old** -> corrected
  - summary: The owner or operator must submit a complete application to the Division to request an increase in the PAL (plantwide applicability limit) emission limitation for a PAL major modification. The application must identify which emissions units are contributing to the increase that causes the source's emissions to equal or exceed its PAL.
  - reason: The provision does not say to whom the application is submitted.
- **new** -> pass
  - summary: The owner or operator must submit a complete application to request an increase in the PAL limit for a PAL major modification. The application must identify the emissions units contributing to the increase in emissions that cause the source's emissions to equal or exceed its PAL.

### sec-3-D-II-A-4-f-(iv) (3)
- **old** -> pass
  - summary: When an existing electric utility steam generating unit sets its baseline actual GHG emissions for a plantwide applicability limit (PAL), the owner or operator cannot choose a 24-month period for which there isn't enough information to determine annual GHG emissions or to make the adjustments required by Sections II.A.4.a.(ii) and II.A.4.a.(iii). In other words, the baseline period must have adequate data to calculate and adjust the emissions properly.
- **new** -> pass
  - summary: The average rate used to calculate baseline actual emissions for a GHG PAL at an existing electric utility steam generating unit cannot be based on any consecutive 24-month period that lacks adequate information to determine annual GHG emissions and to make the adjustments required by Sections II.A.4.a.(ii) and II.A.4.a.(iii).

### sec-3-C-V-C-16-e-(iv) (3)
- **old** -> pass
  - summary: An operating permit must require the source to submit all compliance certifications to both the EPA Administrator and the Division, unless the source is subject to operating permit requirements only because of state-only conditions under Colorado law. Sources that hold permits solely for state-only reasons do not have to send certifications to the EPA.
- **new** -> corrected
  - summary: Operating permits must require that all compliance certifications be submitted to both the EPA Administrator and the Division, except for sources that are subject to operating permit requirements only because of state-only conditions under the Colorado Air Pollution Prevention and Control Act.
  - reason: Text says "the Administrator" without naming the EPA.
  - reason: Text says "the state Act" and does not name the statute.

### sec-3-A-I-B-3 (3)
- **old** -> corrected
  - summary: "Adverse Environmental Effect" is a term used when regulating hazardous air pollutants; it means any significant and widespread harm that may reasonably be expected to wildlife, aquatic life, or other natural resources, including harm to endangered or threatened species or significant degradation of environmental quality over broad areas.
  - reason: Text says "adverse impacts on populations of endangered or threatened species".
- **new** -> pass
  - summary: "Adverse Environmental Effect" is defined for purposes of regulating hazardous air pollutants as any significant and widespread adverse effect that may reasonably be anticipated to wildlife, aquatic life, or other natural resources, including adverse impacts on populations of endangered or threatened species or significant degradation of environmental quality over broad areas.

### sec-3-B-II-D-10 (3)
- **old** -> pass
  - summary: Sources that report greenhouse gases under Part A, Section II.A.2. do not need to get a construction permit just because they emit greenhouse gases.
- **new** -> pass
  - summary: Sources that report greenhouse gases under Part A, Section II.A.2. do not have to get a construction permit just because of those greenhouse gas emissions.

### sec-3-A-I-B-23-e (3)
- **old** -> corrected
  - summary: This is part of the definition of "Disproportionately Impacted Community." A census block group qualifies if multiple factors – such as socioeconomic stressors, vulnerable populations, disproportionate environmental burdens, vulnerability to environmental degradation or climate change, and lack of public participation – act together to affect health and the environment and contribute to persistent disparities.
  - reason: Text says the factors "may act cumulatively" and "may contribute", not that they do.
- **new** -> corrected
  - summary: This is part of the definition of "Disproportionately Impacted Community." A census block group qualifies if multiple factors—including socioeconomic stressors, vulnerable populations, disproportionate environmental burdens, vulnerability to environmental degradation or climate change, and lack of public participation—act cumulatively to affect health and the environment and may contribute to persistent disparities.
  - reason: The text says the factors "may act cumulatively", not that they do.

### sec-3-D-XIV-D-2-c-(vii) (3)
- **old** -> corrected
  - summary: A facility seeking an exemption from Best Available Retrofit Technology will have its case decided individually, considering the geographic extent, intensity, duration, frequency, and timing of the visibility impairment, how those factors line up with when visitors use the Class I area, and how often natural conditions reduce visibility.
  - reason: Text says 'frequency and timing of natural conditions that reduce visibility'.
- **new** -> corrected
  - summary: Any determination of whether a facility causes or contributes to visibility impairment (and thus must install Best Available Retrofit Technology) will be made case by case, considering the geographic extent, intensity, duration, frequency and timing of the impairment, how those factors correlate with when visitors use the Class I area, and the frequency and timing of natural conditions that reduce visibility.
  - reason: Parent XIV.D.2.c. concerns applying for an exemption; the text does not describe the determination as one of causing or contributing to impairment.

### sec-3-F-I-TT (3)
- **old** -> corrected
  - summary: This is a statement of basis and purpose – an explanatory preamble – for revisions to Regulation Number 3 that were adopted on October 21, 2010 to incorporate greenhouse gas (GHG) permitting requirements into Colorado's Title V and PSD programs. It explains that the revisions align Colorado's rules with EPA's GHG Tailoring Rule (which phased in GHG permitting starting January 2, 2011) and allow sources to obtain synthetic minor permits with federally enforceable GHG limits to avoid major-source thresholds. The statement includes a rescission clause: if federal courts or legislation later invalidate or limit GHG regulation under the Clean Air Act, Colorado's GHG permit requirements automatically become unenforceable to the same extent. The document summarizes the specific changes made throughout Parts A, B, C, and D of Regulation Number 3, including new definitions (GHG, CO2 equivalent, subject to regulation), revised major-source thresholds, and clarifications that GHG emissions must be reported in permit applications.
  - reason: Part A revises the Major Source definition to cover regulated NSR pollutants; the text does not say thresholds were revised.
- **new** -> pass
  - summary: This is a statement of basis and purpose (not an operational requirement) that explains why the Commission adopted October 2010 revisions to Regulation Number 3 to address greenhouse gases (GHGs). The revisions incorporated EPA's GHG Tailoring Rule into Colorado's Title V and PSD permitting programs, established a phased approach (Steps 1 and 2) for applying permitting requirements to GHGs starting January 2, 2011, and authorized synthetic minor permits for sources that voluntarily seek federally enforceable GHG limits to avoid major-source thresholds. The statement includes a rescission clause: if federal legislation or court rulings limit or invalidate GHG regulation under the federal Clean Air Act's PSD or Title V provisions, then GHG requirements in Colorado permits under Regulation Number 3 become unenforceable to the same extent. The document summarizes the specific changes made throughout Parts A, B, C, and D of Regulation Number 3, including new definitions (GHG, CO₂ equivalent, subject to regulation), revised major-source definitions, exclusion of GHGs from annual emission fees, and clarifications to permit-application requirements.

### sec-3-A-II-D-4-b-(iii) (3)
- **old** -> corrected
  - summary: When someone asks the Division to exempt a source or activity from permit requirements, the Division may grant the exemption if the source meets the criteria in sections II.D.4.b.(i) and/or (ii), has no applicable requirement that applies to it, and the Division determines that monitoring or recordkeeping are not necessary. The Division must also find that emissions from the source category or activity have a negligible impact on air quality and public health in Colorado.
  - reason: The provision states conditions for permit exemptions; it does not say the Division may grant the exemption.
  - reason: II.D.4.b requires requests to include documentation of negligible impact; it does not require a Division finding.
- **new** -> corrected
  - summary: When someone asks the Division to exempt a source category or activity from permit requirements, the Division may grant the exemption if the criteria in sections II.D.4.b.(i) and/or II.D.4.b.(ii) are met, the source or activity has no applicable requirement that applies to it, and the Division finds that monitoring or record keeping are not necessary.
  - reason: II.D.4 and II.D.4.b only describe a request to examine and the documentation criteria; the text gives the Division no power to 'grant' here.

### sec-3-D-VI-A-3-d (3)
- **old** -> corrected
  - summary: Pre-construction air quality monitoring data must generally be collected for one year immediately before the application is submitted. The Division may allow a shorter monitoring period (but no less than four months) if it determines that period will provide a complete and adequate analysis.
  - reason: Text says data are gathered over one year and represent the year preceding receipt of the application, and names the two kinds of monitoring covered.
- **new** -> pass
  - summary: The continuous air quality monitoring data required under Section VI.A.3.c. or the pre-application monitoring of air quality related values required by Section XIII.B. must be gathered over a period of one year and must represent the year preceding receipt of the application. However, if the Division determines that a complete and adequate analysis can be accomplished with monitoring data gathered over a shorter period (but not less than four months), the data must be gathered over at least that shorter period.

### sec-3-A-IX-A-2-b-(vi) (3)
- **old** -> corrected
  - summary: Sources that must file annual emissions reports do not need to quantify or report toxic air contaminant (TAC) emissions from residential structures (buildings used primarily as a place of residence) or from constructing or altering those structures, including home heating devices.
  - reason: Text says residential structures include home heating devices; the summary's placement tied them to construction or alteration.
- **new** -> pass
  - summary: Sources that must file annual emissions reports do not need to quantify or report toxic air contaminant (TAC) emissions from residential structures (buildings or other structures used primarily as a place of residence), including home heating devices, or from constructing or altering those structures.

### sec-7-B-I-H-5 (7)
- **old** -> pass
  - summary: For glycol dehydrator emissions under this section, you must calculate emissions from still vents and from any flash separator or flash tank using a method the Division has approved in advance. You cannot use just any calculation method – it must be pre-approved by the Division.
- **new** -> pass
  - summary: For calculating emissions from still vents and vents from any flash separator or flash tank on a glycol natural gas dehydrator under Section I.H., you must use a method approved in advance by the Division.

### sec-7-B-III-C-4-g-(i) (7)
- **old** -> pass
  - summary: An operator must keep records of the date a well production facility finished its retrofit (or all its wells were plugged and abandoned), or the date natural gas compressor station pneumatic controllers were retrofit or taken out of service. These records must be kept for five years and provided to the Division on request.
- **new** -> pass
  - summary: Records must be kept of the date a well production facility completes retrofit or all wells flowing to it are plugged and abandoned, or the date natural gas compressor station pneumatic controllers were retrofit or the station is taken out of service. These records must be kept for five years and made available to the Division upon request.

### sec-7-B-II-I-2-c-(i) (7)
- **old** -> corrected
  - summary: At natural gas-processing plants, each pump in light liquid service, pressure relief device in gas/vapor service, valve in gas/vapor or light liquid service, and connector in gas/vapor or light liquid service must be inspected for leaks. If you use optical gas imaging (OGI) under 40 CFR Part 60, Appendix K, inspect bimonthly (every other month); if you use Method 21, inspect pumps monthly, pressure relief devices and valves quarterly, and connectors annually. Inaccessible, ceramic, ceramic-lined, and instrumentation-system connectors are exempt from the annual inspection requirement, with detailed criteria defining what counts as inaccessible (buried, insulated, obstructed, requiring scaffolding or lifts above 7.6 meters or 2 meters above a permanent support surface, or posing safety hazards).
  - reason: Matches the text's inaccessibility criteria in II.I.2.c.(i).(B).(4).
- **new** -> pass
  - summary: Each pump in light liquid service, pressure relief device in gas/vapor service, valve in gas/vapor or light liquid service, and connector in gas/vapor or light liquid service must be inspected for leaks. The owner or operator can meet this by conducting OGI inspections every other month under 40 CFR Part 60, Appendix K (May 7, 2024), or by using Method 21 (August 3, 2017) monthly for pumps, quarterly for pressure relief devices and valves, and annually for connectors (with certain connectors exempt from the annual inspection, including inaccessible, ceramic, ceramic-lined, and instrumentation-system connectors, where inaccessibility is defined by burial, insulation, obstruction, height above 7.6 meters or 2 meters above a permanent support surface, need for scaffolding, or safety hazards).

### sec-7-B-III-B-11 (7)
- **old** -> pass
  - summary: A low-bleed pneumatic controller is a continuous-bleed pneumatic controller designed to emit 6 standard cubic feet per hour (scfh) or less of natural gas to the atmosphere.
- **new** -> pass
  - summary: "Low-Bleed Pneumatic controller" means a continuous bleed pneumatic controller designed to emit 6 scfh of natural gas or less to the atmosphere.

### sec-7-B-VII-F-3-c (7)
- **old** -> pass
  - summary: If an existing midstream facility is transferred to a midstream company that does not yet have an assigned company cap, the acquiring company is not treated as a new entrant under the midstream emissions reduction program.
- **new** -> pass
  - summary: When an existing midstream facility is transferred to a midstream company that does not have an assigned company cap, the acquiring company is not treated as a new entrant under the midstream segment emissions reduction program.

### sec-7-B-III-C-4-a-(ii) (7)
- **old** -> pass
  - summary: Well production facilities that receive production from a well that first begins production, is recompleted, or is refractured on or after May 1, 2021 must use only non-emitting controllers (subject to an exception in Section III.C.4.e.(i)).
- **new** -> pass
  - summary: Well production facilities that receive production from a well that first begins production or is recompleted or refractured on or after May 1, 2021 must use only non-emitting controllers, except as provided in Section III.C.4.e.(i).

### sec-7-B-II-B-3-d (7)
- **old** -> corrected
  - summary: Beginning February 14, 2022, you must replace the rod packing on any reciprocating compressor at a natural gas processing plant every 26,000 hours of operation or every 36 months, whichever comes first, unless the compressor is already subject to reciprocating compressor emission control, monitoring, recordkeeping, and reporting requirements under Section I.J.2, 40 CFR Part 60 Subpart OOOO, OOOOa, OOOOb, or Part B Section II.I.2. The 26,000-hour and 36-month clocks start on February 14, 2022.
  - reason: The text does not say 'whichever comes first'; it states 26,000 hours of operation or thirty-six months.
- **new** -> corrected
  - summary: Starting February 14, 2022, rod packing on any reciprocating compressor at a natural gas processing plant must be replaced every 26,000 hours of operation or every 36 months, whichever comes first, unless the compressor is subject to the reciprocating compressor requirements in Section I.J.2., 40 CFR Part 60 Subpart OOOO, OOOOa, or OOOOb, or Part B Section II.I.2. The counting of the 26,000 hours or 36 months begins on February 14, 2022.
  - reason: The text does not say 'whichever comes first'.

### sec-7-B-III-G-2-b (7)
- **old** -> corrected
  - summary: Starting May 1, 2026, if you operate natural gas-driven diaphragm or piston pumps at a facility without electrical power and with fewer than three natural gas-driven pumps (and you're not already subject to Section I.K.1.), you must do one of the following: route pump emissions to a process if a vapor recovery unit is on site; reduce methane emissions by 95% using a control device if no vapor recovery unit is on site; route emissions to whatever on-site control device you have and certify that no vapor recovery unit or 95%-capable control device exists; or certify that no vapor recovery unit or control device is on site at all. If you later install a vapor recovery unit or control device, you must route the pump emissions to it within 30 days of its startup.
  - reason: III.G.2.b.(iii) applies only when no vapor recovery unit is on site and no control device can achieve 95%.
- **new** -> pass
  - summary: Starting May 1, 2026, owners or operators of natural gas-driven diaphragm and piston pumps at facilities without electrical power and with fewer than three natural gas-driven pumps must do one of the following: route pump emissions to a process if a vapor recovery unit is on site; if no vapor recovery unit is on site, reduce methane emissions by 95% by routing to a control device; if no vapor recovery unit or 95%-capable control device is on site, route emissions to an on-site control device and certify that no vapor recovery unit or 95%-capable control device is available; or certify that no vapor recovery unit or control device is on site. If a vapor recovery unit or control device is later installed, the owner or operator must route pump emissions to it within 30 days of its startup.

### sec-7-B-VII-F-1-b-(i) (7)
- **old** -> corrected
  - summary: The Division will extend a midstream company's compliance deadline if the company needs a construction permit or permit modification to comply with Section VII and submitted a complete application at least twelve months before planned construction (but no later than December 31, 2028), yet the Division has not issued the permit by December 31, 2029.
  - reason: The text does not say the Division is the issuer; it says only that the company "has not been issued the relevant permit".
- **new** -> pass
  - summary: The Division will extend a midstream company's compliance deadline if the company needs a construction permit or permit modification to comply with Section VII., submitted a complete application at least 12 months before planned construction or modification (but no later than December 31, 2028), and has not received the permit by December 31, 2029.

### sec-7-B-VII-G-2-f (7)
- **old** -> corrected
  - summary: Midstream companies must include in their annual report (due June 30 each year starting in 2025) a description of completed projects that identifies each affected midstream fuel combustion equipment (MFCE) by location name and AIRS ID, states whether the MFCE is in a disproportionately impacted community or the Front Range Protection Area, gives the project completion date(s), and reports the emission reductions achieved for CO₂e and harmful air pollutants.
  - reason: The text only says "FRPA" and never expands it, so the expansion is unsupported.
- **new** -> pass
  - summary: Midstream companies must include in their annual report (due June 30 each year starting in 2025) a description of completed projects that identifies the affected midstream fuel combustion equipment (MFCE) by location name and AIRS ID, states whether the MFCE is in a disproportionately impacted community or in the FRPA, gives the project completion date(s), and reports the achieved reductions in CO2e and harmful air pollutants.

### sec-7-B-I-E-2-c-(iii) (7)
- **old** -> pass
  - summary: The owner or operator of tanks controlled under Section I.D. that use combustion devices may use a surveillance system to keep records of combustion device operation, in addition to meeting the weekly inspection requirements in Sections I.E.2.c.(i) and I.E.2.c.(ii).
- **new** -> pass
  - summary: The owner or operator of tanks controlled under Section I.D. that use combustion devices may use a surveillance system to keep records of combustion device operation, in addition to meeting the requirements in Sections I.E.2.c.(i) and I.E.2.c.(ii).

### sec-7-B-III-C-5-b-(vi)-(A)-(1) (7)
- **old** -> pass
  - summary: By December 1, 2025, operators of well production facilities outside the 8-hour Ozone Control Area and northern Weld County must determine the total liquids production (barrels of hydrocarbon liquids plus water) for calendar year 2023 for each facility counted under Section III.C.5.b.(iii)(A)(2), using data reported under Regulation Number 7, Part B, Section V.
- **new** -> corrected
  - summary: By December 1, 2025, owners or operators must determine the total liquids production (total barrels of hydrocarbon liquids plus water produced) for calendar year 2023 for each well production facility that was counted under Section III.C.5.b.(iii)(A)(2), using data reported under Regulation Number 7, Part B, Section V.
  - reason: Parent III.C.5.b.(vi).(A) limits the requirement to well production facilities outside the 8-hour Ozone Control Area and northern Weld County.

### sec-7-B-II-E-9-g (7)
- **old** -> pass
  - summary: Each annual leak detection and repair report must include a certification signed by a responsible official stating that, based on reasonable inquiry, the information in the report is true, accurate, and complete.
- **new** -> pass
  - summary: The owner or operator must include with each annual leak detection and repair report a certification by a responsible official stating that, based on information and belief formed after reasonable inquiry, the statements and information in the document are true, accurate, and complete.

### sec-7-B-III-G-1-a (7)
- **old** -> pass
  - summary: This section applies to natural gas-driven diaphragm pumps and piston pumps at well production facilities, natural gas compressor stations upstream of natural gas processing plants, and natural gas processing plants.
- **new** -> pass
  - summary: This section applies to natural gas-driven diaphragm and piston pumps at well production facilities, natural gas compressor stations upstream of natural gas processing plants, and at natural gas processing plants.

### sec-7-B-II-C-2-b-(i) (7)
- **old** -> pass
  - summary: Owners or operators of storage tanks subject to certain control requirements must create a Storage Tank Emission Management System (STEM) plan that includes the control technologies, monitoring practices, operational practices, or other strategies they have chosen; an engineering-design analysis of the tank and control equipment; procedures for evaluating how well the tank is capturing emissions over time; and monitoring using approved instrument monitoring methods on the schedule in Section II.C.2.b.(ii).
- **new** -> pass
  - summary: STEM plans must include the control technologies, monitoring practices, operational practices, and/or other strategies selected; an analysis of the engineering design of the storage tank and air pollution control equipment; procedures for evaluating ongoing storage tank emission capture performance; and monitoring in accordance with approved instrument monitoring methods following the schedule in Section II.C.2.b.(ii).

### sec-7-C-J (7)
- **old** -> pass
  - summary: This statement explains the basis, authority, and purpose for state-only oil & gas emission rules adopted on December 17, 2006 (covering Sections I.A.1.b. and XVII). The Commission adopted these rules to reduce emissions from oil & gas operations statewide because production and emissions were growing rapidly and could threaten air quality standards and visibility in Class I Areas. The rules require 95% control efficiency for condensate storage tanks and glycol dehydrators, with applicability based on emissions during the preceding 12 months (or projected 12-month emissions for tanks in service less than a year); operators have 90 days after drilling, recompletion, or restimulation to determine if controls are needed. The rules also set standards for natural gas–fired reciprocating internal combustion engines constructed or relocated into Colorado after the applicability date, but exempt units already subject to MACT, BACT, or NSPS control standards.
- **new** -> corrected
  - summary: This is a statement of basis, statutory authority, and purpose for December 17, 2006 revisions to Sections I.A.1.b. and XVII. It explains that the Commission adopted state-only provisions to reduce air emissions from oil and gas operations throughout Colorado because emissions have rapidly increased and are expected to continue growing. The revisions establish emission control requirements for condensate storage tanks, glycol dehydrators, and natural gas fired reciprocating internal combustion engines, requiring that condensate tank and dehydrator controls meet a 95% control efficiency. For condensate tanks, applicability is based on emissions during the preceding twelve-month period (or actual emissions multiplied out to twelve months for tanks in service less than twelve months), and for tanks serving newly drilled, recompleted or restimulated wells the owner or operator has 90 days to determine anticipated production and install controls if necessary. The statement clarifies that units subject to control standards under the MACT, BACT or NSPS Programs are exempt, and the engine provisions apply only to engines constructed or relocated into Colorado after the applicability date.
  - reason: Text says applicability for tanks in service under twelve months is based on uncontrolled actual emissions over the service period, multiplied out to twelve months.

### sec-7-B-II-C-5-a-(iii)-(E) (7)
- **old** -> pass
  - summary: The owner or operator must inspect onsite loading equipment (hoses, couplings, and valves) at least monthly to make sure they are maintained to prevent dripping, leaking, or other liquid or vapor loss during loadout. If loadout happens less often than monthly, inspections must occur as often as loadout is occurring.
- **new** -> pass
  - summary: The owner or operator must inspect onsite loading equipment (hoses, couplings, and valves) to ensure they are maintained to prevent dripping, leaking, or other liquid or vapor loss during loadout. These inspections must occur at least monthly, unless loadout happens less frequently, in which case inspections must occur as often as loadout is occurring.

### sec-7-B-III-C-1-f-(ii) (7)
- **old** -> pass
  - summary: For high-bleed pneumatic controllers in the 8-Hour Ozone Control Area that are placed in service on or after February 1, 2009, the owner/operator must submit justification for installing them for safety and/or process reasons thirty days before installation.
- **new** -> pass
  - summary: For high-bleed pneumatic controllers in the 8-Hour Ozone Control Area that are placed in service on or after February 1, 2009, the owner or operator must submit justification for installing the controller due to safety or process purposes 30 days prior to installation.

### sec-7-B-II-E-7-a-(i) (7)
- **old** -> corrected
  - summary: If parts needed to fix a leak are not available, the operator must order them promptly and complete the repair within 15 working days after the parts arrive. This exception applies when the standard 30-day repair deadline cannot be met because parts are unavailable.
  - reason: Parent II.E.7.a. states thirty (30) working days, not calendar days.
- **new** -> pass
  - summary: If parts needed to repair a leak are unavailable, they must be ordered promptly and the repair must be completed within 15 working days after the parts are received.

### sec-7-B-III-G-4-b-(i) (7)
- **old** -> pass
  - summary: The owner or operator of each combustion control device must maintain it to prevent detectable emissions and operate it according to the manufacturer's written instructions, procedures, and maintenance schedule to ensure good air pollution control practices that minimize emissions.
- **new** -> pass
  - summary: The owner or operator of each combustion control device must maintain it to prevent detectable emissions and operate it according to the manufacturer's written instructions, procedures, and maintenance schedule to minimize emissions.

### sec-7-B-VI-D-3-a-(v) (7)
- **old** -> pass
  - summary: If you use a combustion device on a flowback vessel, you must keep records of the date and result of any EPA Method 22 test or investigation required by Section VI.D.2.a.(v). These records must be kept for two years and made available to the Division on request.
- **new** -> pass
  - summary: If you use a combustion device on a flowback vessel, you must keep records of the date and result of any EPA Method 22 (January 14, 2019) test or investigation done under Section VI.D.2.a.(v). These records must be kept for two years and made available to the Division upon request.

### sec-7-B-VIII-G-1 (7)
- **old** -> pass
  - summary: By September 30 of each year from 2024 through 2029, intensity operators who plan to use an operator-specific program (under Section VIII.F.3.b.) for the next calendar year must notify the Division and submit a summary of their measurement strategy that includes all information the Division identifies in the Intensity Verification Protocol. Operators who submitted such a notification may switch back to using the state-default intensity verification factor(s) or a Division-developed measurement strategy for a given year if the Division approves and the operator shows good cause.
- **new** -> corrected
  - summary: By September 30 of each year from 2024 through 2029, intensity operators who intend to use an operator-specific program under Section VIII.F.3.b. for the next calendar year must notify the Division and submit a summary of the measurement strategy that includes all information identified by the Division in the Intensity Verification Protocol. Operators who submitted a notification that they will use an operator-specific program may revert to using the state-default intensity verification factor(s) or a Division-developed measurement strategy for a given year, with Division approval, after showing good cause.
  - reason: Text requires all intensity operators to notify the Division of whether they intend to use the program; the summary is required only if they do.

### sec-7-B-II-J-1-c-(i) (7)
- **old** -> corrected
  - summary: When measuring the volumetric flow rate from a dry or wet seal centrifugal compressor's seal vent (to comply with Section II.J.1.a. or II.J.1.b.), you may use one of four methods: a flow meter meeting EPA Method 2D and calibrated annually; a high-volume sampler per 40 CFR Part 60, Subpart OOOOb, Section 60.5386b(c); an inspection under Section II.E. or II.I.2. where you measure flow only if emissions are detected by infrared camera, OGI, another Division-approved instrument monitoring method exceeding its repair threshold, or EPA Method 21 readings above 500 ppmv (if no emissions are detected, you may assume zero flow); or any other method validated under EPA Method 301 and approved by EPA.
  - reason: Text limits this to compressors in operating-mode or standby-pressurized-mode and refers to flow at standard conditions from each seal vent.
- **new** -> corrected
  - summary: When complying with the volumetric flow rate requirements in Section II.J.1.a. or II.J.1.b., the owner or operator may determine the volumetric flow rate at standard conditions from each dry or wet seal vent on a compressor in operating-mode or standby-pressurized-mode using any of four methods: a temporary or permanent flow meter meeting EPA Method 2D and calibrated annually; a high-volume sampler according to 40 CFR § 60.5386b(c); inspection of the seal vent during a Section II.E. or II.I.2. inspection (if emissions are detected by infrared camera, OGI, another Division-approved instrument monitoring method exceeding its repair threshold, or Method 21 readings greater than 500 ppmv, a volumetric flow rate measurement must be conducted using one of the other methods, but if no emissions are detected the flow rate may be assumed to be zero); or any other method validated under EPA Method 301 and approved by EPA.
  - reason: Text requires measurement per II.J.1.c.(i)(A), (B), (D) and II.J.1.c.(ii).

### sec-7-B-I-J-1-f-(iv) (7)
- **old** -> pass
  - summary: An owner or operator may delay inspecting or repairing a cover or closed vent system on a centrifugal compressor if the cover or closed vent system is buried, insulated, or blocked by equipment or piping that prevents access.
- **new** -> pass
  - summary: An owner or operator may delay inspection or repair of a cover or closed vent system if it is buried, insulated, or obstructed by equipment or piping that prevents access.

### sec-7-B-I-J-1-f-(iii) (7)
- **old** -> pass
  - summary: An owner or operator may delay inspection or repair of a cover or closed vent system if workers would need to be elevated more than 2 meters above a supported surface, or if the work cannot be done using a wheeled scissor-lift or hydraulic scaffold that reaches up to 7.6 meters (25 feet) above the ground.
- **new** -> pass
  - summary: An owner or operator may delay inspection or repair of a cover or closed vent system if personnel would need to be elevated more than 2 meters above a supported surface or cannot inspect or repair using a wheeled scissor-lift or hydraulic scaffold that reaches up to 7.6 meters (25 feet) above the ground.

### sec-7-B-IV-B-4-a-(i)-(A) (7)
- **old** -> corrected
  - summary: Owners or operators of compressor stations must inspect components for leaks using an approved instrument monitoring method at least quarterly, with at least one inspection in the first 90 days after the compressor station becomes subject to this requirement. Repairs, recordkeeping, and reporting must follow the leak detection and repair requirements in Regulation 7, Part B, Sections II.E.5 through II.E.9, except the first annual report is not due until June 30, 2028, or the year after the compressor station becomes subject to this requirement, whichever is later.
  - reason: The text does not say "whichever is later"; it gives the two dates without a rule for choosing between them.
- **new** -> pass
  - summary: Owners or operators of compressor stations must inspect components for leaks using an approved instrument monitoring method at least quarterly, with at least one inspection within the first 90 days after the compressor station becomes subject to Section IV.B.4.a.(i). They must complete repairs, recordkeeping, and reporting according to the leak detection and repair requirements in Regulation 7, Part B, Sections II.E.5. through II.E.9., except that the first annual report in Section II.E.9. is not required until June 30, 2028, or the year after the compressor station becomes subject to Section IV.B.4.a.(i).

### sec-7-B-I-K-2-h-(iii) (7)
- **old** -> pass
  - summary: Owners or operators may delay inspection or repair of a closed vent system if personnel would need to be elevated more than 2 meters above a supported surface or cannot reach the system with a wheeled scissor-lift or hydraulic scaffold that goes up to 7.6 meters (25 feet) above the ground.
- **new** -> pass
  - summary: The owner or operator may delay inspection or repair of a closed vent system if personnel would have to be elevated more than 2 meters above a supported surface or cannot inspect or repair using a wheeled scissor-lift or hydraulic scaffold that reaches up to 7.6 meters (25 feet) above the ground.

### sec-7-B-V-B-1-c-(i) (7)
- **old** -> pass
  - summary: Beginning with the June 2026 report covering calendar year 2025, a disproportionately impacted community is any census block group shown on the Disproportionately Impacted Community Map (November 2024) when the map is filtered to show mobile home communities, low-income population above 40%, people of color population above 40%, housing cost-burdened population above 50%, linguistically isolated population above 20%, and Colorado EnviroScreen percentile score above 80. The definition follows 24-4-109(2)(b)(II)(A)-(D) and (F)-(G), C.R.S. (2023).
- **new** -> pass
  - summary: Beginning with the June 2026 report for calendar year 2025, a disproportionately impacted community is defined by 24-4-109(2)(b)(II)(A)-(D) and (F)-(G), C.R.S. (2023). These communities are identified as any census block group shown on the Disproportionately Impacted Community Map (November 2024) after selecting the criteria for mobile home communities, low-income population above 40%, people of color population above 40%, housing cost-burdened population above 50%, linguistically isolated population above 20%, and Colorado EnviroScreen percentile score above 80.

### sec-7-A-II-A-1 (7)
- **old** -> pass
  - summary: The 8-Hour Ozone Control Area includes all of Adams, Arapahoe, Boulder, Douglas, Jefferson, Denver, and Broomfield counties, plus the southern portion of Larimer County (south of a line running roughly from 40°42'47.1"N latitude on its eastern border, jogging south partway across, then west to the Grand County line) and the southern portion of Weld County (south of 40°42'47.1"N latitude from its eastern border with Logan County west to its border with Larimer County). Parts of Rocky Mountain National Park in Boulder and Larimer counties are included.
- **new** -> pass
  - summary: The "8-Hour Ozone Control Area" is defined as Adams, Arapahoe, Boulder (including part of Rocky Mountain National Park), Douglas, and Jefferson counties; the Cities and Counties of Denver and Broomfield; the portion of Larimer County (including part of Rocky Mountain National Park) south of a line running from 40°42'47.1"N latitude at the Weld County border west to 105°29'40.0"W longitude, then south to 40°33'17.4"N latitude, then west to the Grand County border; and the portion of Weld County south of a line running from 40°42'47.1"N latitude at the Logan County border west to the Larimer County border.

### sec-7-B-II-I-2-h-(ii)-(C) (7)
- **old** -> pass
  - summary: Valves that need to be replaced with a low-emission valve or repacked with low-emission packing must be fixed before the end of the next process unit shutdown, with two exceptions: as allowed in Section II.I.2.h.(iii), or when two consecutive inspections under Section II.I.2.c. show emissions below the repair thresholds in Section II.I.2.g.
- **new** -> pass
  - summary: Valves that must be replaced with a low-e valve or repacked with low-e packing under sections II.I.2.h.(ii)(A) or (B) must be replaced or repacked before the end of the next process unit shutdown, except as provided in section II.I.2.h.(iii) or where two consecutive inspections under section II.I.2.c. show emissions are below the repair levels specified in section II.I.2.g.

### sec-oooob-60.5415b-(f)-(1)-(vii)-(A)-(4) (oooob)
- **old** -> pass
  - summary: For each enclosed combustion device (other than a catalytic vapor incinerator) and for each flare, after you bring the device back online from maintenance or repair, you must either pass a Method 22 visual observation as described in paragraph (f)(1)(vii)(A)(2) or monitor it according to § 60.5417b(h).
- **new** -> corrected
  - summary: Following maintenance or repair, each enclosed combustion device (other than a catalytic vapor incinerator) and each flare must pass a Method 22 visual observation as described in paragraph (f)(1)(vii)(A)(2) or be monitored according to § 60.5417b(h) before returning to operation.
  - reason: Text says 'Following return to operation from maintenance or repair activity'; it does not say the check occurs before returning to operation.

### sec-oooob-60.5401b-(c) (oooob)
- **old** -> pass
  - summary: This applies to pressure relief devices in gas or vapor service at onshore natural gas processing plants that choose the alternative standards in this section. You must monitor each pressure relief device quarterly using the methods in § 60.5403b, and a leak is an instrument reading of 500 ppmv or greater above background. After each pressure release you must monitor the device within 5 calendar days to detect leaks (same 500 ppmv threshold), but at nonfractionating plants monitored only by non-plant personnel you may wait until monitoring personnel are next onsite or 30 calendar days after the release, whichever is sooner, and no such device may operate more than 30 calendar days after a release without monitoring. Devices routed to a process or fuel gas system or equipped with a closed vent system to a control device are exempt from the quarterly and post-release monitoring, and devices with a rupture disk are exempt from the post-release monitoring if you install a new rupture disk as soon as practicable but no later than 5 calendar days after each release (except as provided in paragraph (i)(6)).
- **new** -> corrected
  - summary: You must monitor each pressure relief device in gas or vapor service quarterly using the methods in § 60.5403b; a leak is an instrument reading of 500 ppmv or greater above background. After each pressure release, you must monitor the device within 5 calendar days to detect leaks (same 500 ppmv threshold). At a nonfractionating plant monitored only by non-plant personnel, you may monitor after a pressure release the next time monitoring personnel are onsite or within 30 calendar days, whichever is sooner, but no device may operate more than 30 calendar days after a pressure release without monitoring. Pressure relief devices routed to a process or fuel gas system or equipped with a closed vent system capturing leakage to a control device (as described in paragraph (e)) are exempt from the quarterly and post-release monitoring. Pressure relief devices with a rupture disk are exempt from the post-release monitoring if you install a new rupture disk as soon as practicable but no later than 5 calendar days after each pressure release, except as provided in paragraph (i)(6).
  - reason: (c)(5) requires the new rupture disk to be installed upstream of the pressure relief device.

### sec-oooob-60.5415b-(f)-(1)-(ix)-(D)-(2) (oooob)
- **old** -> corrected
  - summary: If you start operating a condenser after the compliance date, you must calculate your average TOC emission reduction over the period from the compliance date to the current day once you have been operating for at least 120 days but no more than 364 days. You are in compliance with the 95.0 percent reduction requirement if that average is 95.0 percent or greater.
  - reason: Text sets the window as after 120 days and no more than 364 days of operation after the compliance date; it does not say the condenser starts operating after the compliance date.
- **new** -> pass
  - summary: After 120 to 364 days of operation following the compliance date in § 60.5370b(a), you must calculate the average TOC emission reduction by averaging the reduction over the number of days between the current day and the compliance date. You have demonstrated compliance with the 95.0 percent reduction requirement if the average TOC emission reduction is equal to or greater than 95.0 percent.

### sec-oooob-60.5420b-(b)-(4)-(iii) (oooob)
- **old** -> pass
  - summary: For each associated gas well that complies with § 60.5377b(f), your annual report must identify wells constructed between December 6, 2022, and May 7, 2026, and certify why it is infeasible to comply with § 60.5377b(a)(1), (2), (3), or (4) (this identification is required only in the initial annual report). The report must also identify each well modified or reconstructed during the reporting period that uses a control device achieving at least 95.0 percent VOC and methane reduction, and certify why the primary compliance options are infeasible. For wells from previous reporting periods using such a control device, you must re-certify annually why the primary compliance options remain infeasible. The report must also include the information specified in paragraphs (b)(11)(i) through (iv).
- **new** -> pass
  - summary: For each associated gas well that complies with § 60.5377b(f), the annual report must include the information in sub-items (A) through (E). The information in sub-items (A) and (B) is required only in the initial annual report. Those sub-items require identifying wells constructed in specified date ranges and certifying why it is infeasible to comply with certain requirements, identifying wells modified or reconstructed during the reporting period that use a control device achieving at least 95.0 percent VOC and methane reduction (with infeasibility certification), re-certifying infeasibility for wells from previous reporting periods using such control devices, and providing the information specified in paragraph (b)(11)(i) through (iv).

### sec-oooob-60.5410b-(e)-(4) (oooob)
- **old** -> corrected
  - summary: If you choose to route emissions from your reciprocating compressor to a control device, you must conduct an initial performance test within 180 days after startup or by May 7, 2024, whichever is later, or install a control device that was already tested and meets the criteria in § 60.5413b(d)(11) and (e). You must then comply with the ongoing monitoring requirements in § 60.5415b(f).
  - reason: The text states the condition as complying with § 60.5385b(d)(2) and does not describe it as routing emissions to a control device.
  - reason: The text says 'initial startup'.
  - reason: The text names the test provision, § 60.5413b(d).
  - reason: The text says 'continuous compliance requirements of § 60.5415b(f)'.
- **new** -> corrected
  - summary: If you comply with the reciprocating compressor standard by using a control device (under § 60.5385b(d)(2)), you must either conduct an initial performance test within 180 days after initial startup or by May 7, 2024, whichever is later, as required in § 60.5413b, or install a control device that was tested under § 60.5413b(d) and meets the criteria in § 60.5413b(d)(11) and (e). You must also comply with the continuous compliance requirements in § 60.5415b(f).
  - reason: The text does not describe § 60.5385b(d)(2) as a control device option.

### sec-oooob-60.5408b-(f) (oooob)
- **old** -> corrected
  - summary: This paragraph explains how to make the Tutwiler test for hydrogen sulfide more sensitive. If you use a 500 ml Tutwiler burette with a more dilute (0.001N) iodine solution, you can measure concentrations below 1.0 grains per 100 cubic feet. The starch-iodine end point will be less distinct, so you must run a blank determination using H2S-free gas or air.
  - reason: Text says "Usually, the starch-iodine end point is much less distinct" and requires a blank determination of end point.
- **new** -> pass
  - summary: For greater sensitivity when using the Tutwiler procedure to measure hydrogen sulfide in acid gas, you can use a 500 ml capacity Tutwiler burette with a more dilute (0.001N) iodine solution. This method can measure concentrations below 1.0 grains per 100 cubic feet. The starch-iodine end point is usually much less distinct with this approach, so a blank determination of the end point using H2S-free gas or air is required.

### sec-oooob-60.5412b-(c)-(2)-(iii) (oooob)
- **old** -> pass
  - summary: For each regenerative-type carbon adsorption system, you must measure and record the average carbon bed temperature during the entire steaming cycle and measure the actual temperature after regeneration within 15 minutes of finishing the cooling cycle. You must keep the average temperature above the limit established under § 60.5413b(c)(2) during steaming and below the temperature established under § 60.5413b(c)(2) after regeneration.
- **new** -> pass
  - summary: For each regenerative carbon adsorption system, you must measure and record the average carbon bed temperature during the entire steaming cycle and measure the actual temperature after regeneration within 15 minutes of finishing the cooling cycle. You must keep the average temperature above the limit established under § 60.5413b(c)(2) during steaming and below the temperature established under § 60.5413b(c)(2) after regeneration.

### sec-oooob-60.5420b-(c)-(6)-(v) (oooob)
- **old** -> pass
  - summary: If you have a process controller affected facility complying with § 60.5390b(b)(3), you must keep two types of records: an identification of each process controller whose emissions are routed to a control device, and the records specified in paragraphs (c)(8) and (10) through (13) of this section. If you comply with an alternative GHG and VOC standard under § 60.5398b, you must provide the information specified in § 60.5424b instead of the information in paragraph (c)(8).
- **new** -> pass
  - summary: For each process controller affected facility that complies with § 60.5390b(b)(3), you must keep records identifying each process controller whose emissions are routed to a control device and the records specified in paragraphs (c)(8) and (10) through (13) of this section. If you comply with an alternative GHG and VOC standard under § 60.5398b, you must provide the information specified in § 60.5424b instead of the information in paragraph (c)(8).

### sec-oooob-60.5410b-(f)-(2) (oooob)
- **old** -> corrected
  - summary: For process controllers at sites in Alaska without access to electrical power, you must meet one of several alternative compliance paths instead of the standard requirements. You can operate controllers with a bleed rate of 6 scfh or less and keep records showing that design, or use controllers with higher bleed rates if you document a specific functional need for the higher rate. For intermittent vent controllers you must conduct initial monitoring to show they don't emit during idle periods. Alternatively, you can route all controller emissions to a control device that achieves 95 percent reduction of methane and VOC through a closed vent system, conduct an initial performance test within 180 days of startup or by May 7, 2024 (whichever is later), and install continuous parameter monitoring systems.
  - reason: (f)(2)(iv)(C) makes the performance test or a pre-tested control device alternatives and also requires continuous compliance under § 60.5415b(f).
  - reason: (f)(2)(iv)(A) says 95.0 percent or greater.
- **new** -> pass
  - summary: For a process controller affected facility at an Alaska site without access to electrical power, you must demonstrate initial compliance with the alternative standards in § 60.5390b(b)(1) and (2) or (b)(3) instead of the main standard in § 60.5390b(a). For controllers with a bleed rate of 6 scfh or less, you must keep records showing the controller is designed and operated at or below that rate. For controllers with a bleed rate above 6 scfh, you must keep records showing a higher bleed rate is required based on a specific functional need. For intermittent vent controllers, you must conduct initial monitoring to show the controller does not emit to the atmosphere during idle periods. If you comply by reducing methane and VOC emissions from all controllers by 95.0 percent, you must route all emissions through a closed vent system to a control device, conduct an initial performance test within 180 days after startup or by May 7, 2024 (whichever is later) or install a control device already tested under § 60.5413b(d) that meets the criteria in § 60.5413b(d)(11) and (e), and install and operate continuous parameter monitoring systems.

### sec-oooob-60.5420b-(c)-(6)-(ii)-(B) (oooob)
- **old** -> pass
  - summary: If you use a self-contained natural gas-driven process controller to comply with § 60.5390b(a), you must keep records identifying each such controller, the dates of each inspection required under § 60.5416b(b), and each defect or leak found during inspection along with the repair date or anticipated repair date if repair is delayed.
- **new** -> pass
  - summary: If you are using a self-contained natural gas-driven process controller to comply with § 60.5390b(a), you must keep records identifying each such controller, the dates of each inspection required under § 60.5416b(b), and each defect or leak found during those inspections along with the repair date or expected repair date if repair is delayed.

### sec-oooob-60.5365b-(i) (oooob)
- **old** -> corrected
  - summary: This affected facility is the collection of fugitive emissions components at a well site, centralized production facility, or compressor station. For purposes of the fugitive emissions monitoring requirements in sections 60.5397b and 60.5398b, a well site is modified when a new well is drilled there, a well is hydraulically fractured, or a well is hydraulically refractured. A centralized production facility is modified when any of those well-site actions occur at the facility, when a well sending production to it is modified, or when a well site removes all major production and processing equipment to become a wellhead-only site and sends production to the facility. A compressor station is modified when an additional compressor is installed or when one or more compressors are replaced by compressor(s) of greater total horsepower (replacing with equal or smaller horsepower does not trigger a modification).
  - reason: Text does not characterize those sections as fugitive emissions monitoring requirements.
- **new** -> corrected
  - summary: Owners or operators of well sites, centralized production facilities, or compressor stations are subject to this subpart for their fugitive emissions components affected facility, which is the collection of all fugitive emissions components at that location. A modification to a well site (for purposes of the fugitive emissions monitoring requirements in § 60.5397b and § 60.5398b) occurs when a new well is drilled at an existing well site, a well at an existing well site is hydraulically fractured, or a well at an existing well site is hydraulically refractured. A modification to a centralized production facility occurs when any of those well-site actions happen at the facility itself, when a well sending production to the facility is modified in one of those ways, or when a well site subject to the monitoring requirements removes all major production and processing equipment (becoming a wellhead-only site) and sends production to the facility. A modification to a compressor station occurs when an additional compressor is installed or when one or more compressors is replaced by one or more compressors of greater total horsepower than the compressor(s) being replaced; replacing compressors with equal or smaller total horsepower does not trigger a modification.
  - reason: Text does not label these sections as fugitive emissions monitoring requirements.
  - reason: Text in (i)(2)(iii) says 'requirements of § 60.5397b or § 60.5398b', not monitoring requirements.

### sec-oooob-60.5397b-(l)-(3) (oooob)
- **old** -> pass
  - summary: After you finish all well closure activities in your well closure plan, you must survey the entire well site (including each closed well) using optical gas imaging (OGI). If the OGI camera shows any emissions, you must eliminate them and resurvey; repeat this process until the OGI shows no emissions. You must then update your well closure plan to include the OGI survey video that proves all wells at the site are closed.
- **new** -> pass
  - summary: After finishing all well closure activities in your well closure plan, you must survey the well site with optical gas imaging (OGI), including each closed well. If the OGI instrument images any emissions, you must eliminate those emissions and resurvey the source, repeating elimination and resurvey until the OGI images no emissions. You must update the well closure plan to include the OGI survey video showing closure of all wells at the site.

### sec-oooob-60.5406b-(b)-(1) (oooob)
- **old** -> pass
  - summary: The average sulfur feed rate (X) must be calculated using an equation (not shown in the available text) that incorporates the average volumetric flow rate of acid gas from the sweetening unit (Qa, in dscm/day or dscf/day), the average H₂S concentration in the acid gas feed (Y, expressed as a decimal), and a conversion constant (K) that equals 1.331 × 10⁻³ Mg/dscm for metric units or 3.707 × 10⁻⁵ long ton/dscf for English units. The result is expressed in Mg/D (metric tons per day) or LT/D (long tons per day).
- **new** -> pass
  - summary: The average sulfur feed rate (X) must be calculated using a specified equation. The equation itself is not shown in the available text, but the variables are: X is the average sulfur feed rate in megagrams per day (Mg/D) or long tons per day (LT/D); Qa is the average volumetric flow rate of acid gas from the sweetening unit in dry standard cubic meters per day (dscm/day) or dry standard cubic feet per day (dscf/day); Y is the average H₂S concentration in the acid gas feed from the sweetening unit, expressed as a decimal (percent by volume); and K is a conversion constant equal to 1.331 × 10⁻³ Mg/dscm for metric units or 3.707 × 10⁻⁵ long ton/dscf for English units.

### sec-oooob-60.5376b-(d) (oooob)
- **old** -> pass
  - summary: You must demonstrate initial compliance with the standards for well liquids unloading operations at your well affected facilities as required by § 60.5410b(b). (The specific compliance demonstration requirements are in that cross-referenced section.)
- **new** -> pass
  - summary: You must demonstrate initial compliance with the well liquids unloading standards by following the requirements in § 60.5410b(b).

### sec-oooob-60.5420b-(b)-(9)-(iii)-(B) (oooob)
- **old** -> pass
  - summary: If you are complying with an alternative fugitive emissions standard under § 60.5399b, you must submit the site-specific reports that the alternative standard requires, in the same format you submitted them to the state, local, or Tribal authority. If the report is a hard copy, you must scan it and attach it electronically to your annual report.
- **new** -> pass
  - summary: If you are complying with an alternative fugitive emissions standard under § 60.5399b, you must submit the site-specific reports required by that alternative standard in the same format you submitted them to the state, local, or Tribal authority. If the report is a hard copy, you must scan it and submit it as an electronic attachment to the annual report.

### sec-oooob-60.5398b-(c)-(5)-(ii) (oooob)
- **old** -> pass
  - summary: Before establishing a continuous monitoring system baseline, you must verify that all control devices (such as flares) on affected sources are operating in compliance with §§ 60.5415b and 60.5417b, and that all other methane emission sources at the site (such as reciprocating engines) are operating consistent with any applicable regulations. All these sources must be in compliance before you begin the period described in paragraph (b)(5)(iii) of this section.
- **new** -> pass
  - summary: Before establishing baseline emissions for a continuous monitoring system, you must verify that control devices (such as flares) on all affected sources are operating in compliance with § 60.5415b and § 60.5417b, and that all other methane emission sources (such as reciprocating engines) at the site are operating consistent with any applicable regulations. All control devices and these other sources must be in compliance with applicable regulations before beginning the period in paragraph (b)(5)(iii).

### sec-oooob-60.5417b-(d)-(8)-(ii)-(D) (oooob)
- **old** -> pass
  - summary: This is one method you can use to continuously determine the net heating value (NHV) of the inlet gas to an enclosed combustion device or flare. You must use a grab sampling system that collects an evacuated canister sample at least once every eight hours, then analyze the sample composition according to ASTM D1945-14 (R2019) or GPA 2261-19. To calculate the NHV, multiply each component's volume fraction by its net heating value, then add up all the products; use published net heating values per mole at 25 °C and 1 atmosphere, and use 20 °C as the standard temperature for determining the volume of one mole of vent gas.
- **new** -> corrected
  - summary: You must use a grab sampling system that can collect an evacuated canister sample at least once every eight hours for compositional analysis. The samples must be analyzed according to ASTM D1945-14 (R2019) or GPA 2261-19. To determine the net heating value (NHV) of the vent gas, multiply the volume fraction of each component by that component's net heating value, then add up the products for all components. Use any published net heating value per mole at 25 °C and 1 atmosphere, and use 20 °C as the standard temperature for determining the volume corresponding to one mole of vent gas.
  - reason: Parent (d)(8)(ii) says to use one of the following methods, so this is one option, not a sole requirement.

### sec-oooob-60.5377b-(g)-(2) (oooob)
- **old** -> corrected
  - summary: If you are demonstrating that it is technically infeasible to route, sell, or beneficially use associated gas from certain well affected facilities, a professional engineer or other qualified individual with expertise in associated gas uses must certify the analysis. The certification must be signed and dated and must state that the assessment was prepared under their direction or supervision, was conducted and reported pursuant to § 60.5377b(b), and that based on their professional knowledge, experience, and inquiry of personnel involved, the submitted certification is true, accurate, and complete.
  - reason: Parent (g) states infeasibility of complying with (a)(1) through (4); it does not list route, sell, or beneficially use.
- **new** -> pass
  - summary: The demonstration of technical infeasibility must be certified by a professional engineer or another qualified individual with expertise in the uses of associated gas. The certification must be signed and dated and must state: "I certify that the assessment of technical and safety infeasibility was prepared under my direction or supervision. I further certify that the assessment was conducted, and this report was prepared pursuant to the requirements of § 60.5377b(b). Based on my professional knowledge and experience, and inquiry of personnel involved in the assessment, the certification submitted herein is true, accurate, and complete."

### sec-oooob-60.5416b-(a)-(1)-(i) (oooob)
- **old** -> pass
  - summary: Within 30 calendar days after January 22, 2027, or upon startup of the affected facility routing emissions through the closed vent system (whichever is later), you must conduct an initial inspection to demonstrate that the closed vent system operates with no identifiable emissions. This applies to each permanently or semi-permanently sealed joint, seam, or other connection in the closed vent system (such as a welded joint between hard piping sections or a bolted and gasketed ducting flange). The inspection must follow the test methods and procedures in paragraph (b) of this section.
- **new** -> pass
  - summary: For each permanently or semi-permanently sealed joint, seam, or connection in a closed vent system (such as a welded joint or bolted and gasketed flange), you must conduct an initial inspection within 30 calendar days after January 22, 2027, or upon startup of the affected facility routing emissions through the closed vent system, whichever is later. The inspection must follow the test methods and procedures in paragraph (b) of this section to demonstrate that the closed vent system operates with no identifiable emissions.

### sec-oooob-60.5410b-(j)-(3) (oooob)
- **old** -> pass
  - summary: If you use a control device to reduce emissions from a storage vessel affected facility, you must equip each storage vessel with a cover meeting § 60.5411b(b), install a closed vent system meeting § 60.5411b(a) and (c) to capture all emissions, and route all emissions to a control device meeting § 60.5412b. If you route emissions to a process instead, you must equip each storage vessel with a cover meeting § 60.5411b(b), install a closed vent system meeting § 60.5411b(a) and (c) to capture all emissions, and route all emissions to that process.
- **new** -> pass
  - summary: If you use a control device to reduce emissions from a storage vessel affected facility, you must equip each storage vessel with a cover meeting § 60.5411b(b), install a closed vent system meeting § 60.5411b(a) and (c) to capture all emissions, and route all emissions to a control device meeting § 60.5412b. If you route emissions to a process instead, you must equip each storage vessel with a cover meeting § 60.5411b(b), install a closed vent system meeting § 60.5411b(a) and (c) to capture all emissions, and route all emissions to a process.

### sec-oooob-60.5398b-(c)-(4)-(ii) (oooob)
- **old** -> pass
  - summary: For affected facilities at well sites with major production and processing equipment (including small well sites), centralized production facilities, and compressor stations, the action level is 1.6 kg/hr (3.6 lb/hr) of methane over the site-specific baseline emissions as a 90-day rolling average. The action level is also 21 kg/hr (46 lb/hr) of methane over the site-specific baseline emissions as a 7-day rolling average.
- **new** -> pass
  - summary: At well sites with major production and processing equipment (including small well sites), centralized production facilities, and compressor stations, the action levels are 1.6 kg/hr (3.6 lb/hr) of methane over the site-specific baseline emissions as a 90-day rolling average and 21 kg/hr (46 lb/hr) of methane over the site-specific baseline emissions as a 7-day rolling average.

### sec-oooob-60.5375b-(f)-(3)-(ii) (oooob)
- **old** -> corrected
  - summary: If you operate a separator at a wildcat, delineation, or low-pressure well, you must route all flowback into one or more well completion vessels and start the separator unless it is technically infeasible for the separator to function. The separator must be onsite or otherwise available and ready for use during the entire flowback period. You must capture and send recovered gas to a completion combustion device, except when doing so would create a fire or explosion hazard or when high heat from the device would harm tundra, permafrost, or waterways. After January 22, 2027, completion combustion devices must have a reliable continuous pilot flame.
  - reason: Text uses "may result in" and "may negatively impact", not certainty.
- **new** -> pass
  - summary: For well affected facilities that choose the separator alternative, you must route all flowback into one or more well completion vessels and start operating a separator unless it is technically infeasible for a separator to function. The separator must be onsite or otherwise available at the wildcat well, delineation well, or low pressure well and must be available and ready for use during the entire flowback period. You must capture and direct recovered gas to a completion combustion device, except when doing so may cause a fire hazard or explosion, or where high heat from the device may negatively impact tundra, permafrost, or waterways. After January 22, 2027, completion combustion devices must be equipped with a reliable continuous pilot flame. Any gas present in the flowback before the separator can function is not subject to control under this section.

### sec-oooob-60.5413b-(b)-(3)-(iii) (oooob)
- **old** -> pass
  - summary: If a vent stream enters a boiler or process heater with a design capacity less than 44 megawatts and is introduced with the combustion air or as a secondary fuel, you must determine the weight-percent reduction of total TOC (total organic compounds) across the device by comparing the TOC in all combusted vent streams and primary and secondary fuels with the TOC exiting the device.
- **new** -> pass
  - summary: If a vent stream enters a boiler or process heater with a design capacity less than 44 megawatts as combustion air or secondary fuel, you must determine the weight-percent reduction of total TOC across the device by comparing the TOC in all combusted vent streams and primary and secondary fuels with the TOC exiting the device.

### sec-oooob-60.5412b-(d)-(5) (oooob)
- **old** -> pass
  - summary: If your alternative test method shows compliance with the metrics in paragraphs (d)(1)(i) and (ii) rather than demonstrating continuous 95.0 percent or greater combustion efficiency, you must still install the pilot or combustion flame monitoring system required by § 60.5417b(d)(8)(i) after January 22, 2027. If your alternative test method demonstrates continuous compliance with 95.0 percent or greater combustion efficiency, the § 60.5417b(d)(8)(i) monitoring requirement no longer applies.
- **new** -> pass
  - summary: If you use an alternative test method that shows compliance with the metrics in § 60.5412b(d)(1)(i) and (ii) instead of showing continuous 95.0 percent or greater combustion efficiency, you must still install the pilot or combustion flame monitoring system required by § 60.5417b(d)(8)(i) after January 22, 2027. If the alternative test method shows continuous compliance with 95.0 percent or greater combustion efficiency, the § 60.5417b(d)(8)(i) monitoring requirement no longer applies.

### sec-oooob-60.5397b-(d) (oooob)
- **old** -> pass
  - summary: Your fugitive emissions monitoring plan must include certain additional elements. If you use optical gas imaging (OGI), the plan must include procedures to ensure all fugitive emissions components (except buried yard piping and associated components like connectors) are monitored during each survey – for example, a sitemap with an observation path, a written narrative of where components are and how they will be monitored, or an inventory of components. If you use Method 21, the plan must include a list of components to be monitored, a method for determining their location in the field (such as tagging or identification on a process and instrumentation diagram), a written plan for components designated as difficult-to-monitor under paragraph (g)(2), and a written plan for components designated as unsafe-to-monitor under paragraph (g)(3).
- **new** -> pass
  - summary: The fugitive emissions monitoring plan must include certain additional elements depending on the monitoring method used. If using optical gas imaging (OGI), the plan must include procedures to ensure all fugitive emissions components are monitored during each survey, except buried yard piping and associated components such as connectors; example procedures include a sitemap with an observation path, a written narrative of component locations and how they will be monitored, or an inventory of components. If using Method 21 of appendix A-7, the plan must include a list of components to be monitored, a method for determining their location in the field (such as tagging or identification on a process and instrumentation diagram), a written plan for all components designated as difficult-to-monitor under paragraph (g)(2), and a written plan for components designated as unsafe-to-monitor under paragraph (g)(3).

### sec-oooob-60.5411b-(c)-(1)-(ii) (oooob)
- **old** -> pass
  - summary: This applies to owners or operators of affected facilities with covers and closed vent systems at oil and gas facilities that began construction, modification, or reconstruction after December 6, 2022. The assessment of the closed vent system's design and capacity must be prepared under the direction or supervision of a qualified professional engineer or an in-house engineer who signs the certification. This is part of the initial compliance demonstration for covers and closed vent systems.
- **new** -> pass
  - summary: The assessment of the closed vent system's design and capacity must be prepared under the direction or supervision of a qualified professional engineer or an in-house engineer who signs the certification required by paragraph (c)(1)(i).

### sec-oooob-60.5415b-(f)-(1)-(viii)-(A)-(2) (oooob)
- **old** -> corrected
  - summary: If you use a regenerative carbon adsorption system, you must keep the average carbon bed temperature above the limit you established under § 60.5413b(c)(2) during the steaming cycle and below that limit after the regeneration cycle is complete.
  - reason: Text names a temperature limit for the steaming cycle and a carbon bed temperature for after regeneration, not one single limit; it does not say "is complete".
- **new** -> corrected
  - summary: For a regenerative carbon adsorption system, you must keep the average carbon bed temperature above the limit set under § 60.5413b(c)(2) during the steaming cycle and below that limit after the regeneration cycle. This applies when you use the carbon adsorption system to meet the control device performance requirements of § 60.5412b(a)(2).
  - reason: The text names a temperature limit for the steaming cycle and a carbon bed temperature for after regeneration, not one single limit.

### sec-oooob-60.5417b-(g)-(5)-(i) (oooob)
- **old** -> corrected
  - summary: If a bypass line is subject to § 60.5411b(a)(4)(i)(A) and the flow indicator shows that flow has been detected and the stream has been diverted away from the control device to the atmosphere, a deviation has occurred. This applies to closed vent systems with bypass devices that could divert gases, vapors, or fumes from entering the control device. You must report this to the Administrator.
  - reason: No reporting requirement or mention of the Administrator appears in the provision or its ancestors.
- **new** -> pass
  - summary: A deviation occurs when a flow indicator on a bypass line subject to § 60.5411b(a)(4)(i)(A) shows that flow has been detected and the stream has been diverted away from the control device to the atmosphere.

### sec-oooob-60.5398b-(b)-(4)-(i) (oooob)
- **old** -> pass
  - summary: If you are required to conduct annual OGI (optical gas imaging) surveys, you must complete your first OGI survey within 12 calendar months after you finish the initial screening event. This deadline applies only if you fall under the annual OGI survey requirement.
- **new** -> pass
  - summary: If you are required to conduct annual OGI surveys under § 60.5398b(b)(1)(i) or (iii), you must conduct the first OGI survey no later than 12 calendar months after conducting the initial screening event in paragraph (b)(3).

### sec-oooob-60.5380b-(a)-(7)-(i)-(B)-(2) (oooob)
- **old** -> pass
  - summary: For manifolded groups of self-contained wet seal centrifugal compressor seals, you must measure the volumetric flow rate at standard conditions from the common stack using one of the methods specified in paragraph (a)(7)(i)(A)(1) through (3) of this section. This is one of two options for determining flow rate from these manifolded seal groups.
- **new** -> pass
  - summary: You must determine the volumetric flow rate at standard conditions from the common stack using one of the methods listed in paragraph (a)(7)(i)(A)(1) through (3) of this section. This applies when measuring manifolded groups of self-contained wet seal centrifugal compressor seals.

### sec-ecmc-417 (ecmc)
- **old** -> corrected
  - summary: A mechanical integrity test checks whether a well's casing, tubing, or isolation device has a significant leak or whether fluid is moving through vertical channels to other formations. All injection wells must pass a mechanical integrity test before starting injection and then at least once every 5 years (Class II UIC wells) or after any casing repairs or tubing resets; the Director must witness all injection well tests. Shut-in wells must be tested within 2 years of shut-in and then every 5 years thereafter, and operators must submit a Form 42 at least 48 hours before returning the well to service. Temporarily abandoned wells must be tested within 30 days of temporary abandonment and then every 5 years, with the same 48-hour Form 42 notice required before returning to service. Suspended operations wells and waiting on completion wells must be tested within 2 years of setting casing and then every 5 years. Operators must notify the Director with a Form 42 at least 10 days before performing any mechanical integrity test. All wells must maintain mechanical integrity; any well that fails a test must be repaired or plugged and abandoned within 6 months (or immediately if the operator missed the required testing deadline). A test passes if pressure loss or gain does not exceed 10% of the initial stabilized surface pressure over 15 minutes.
  - reason: 417.a.(3), a.(4).A-C: pre-injection test applies to new injection wells; 5-year rule is Class II only; simultaneous wells exempt.
  - reason: 417.f does not say 'immediately'; it denies an additional 6 months.
  - reason: 417.b.(4) and 417.c.(4) wording.
  - reason: 417.b.(2) applies as long as the well remains shut-in.
  - reason: 417.c.(2) and c.(4).
- **new** -> corrected
  - summary: Rule 417 defines a mechanical integrity test as a test to determine if there is a significant leak in a well's casing, tubing, or mechanical isolation device, or if there is significant fluid movement through vertical channels to other formations. All injection wells must pass a mechanical integrity test before injecting fluids, with Form 21 submitted and approved by the Director (oral approval may be granted for continuous injection after a successful test). Class II UIC wells must be tested at least once every 5 years as long as they are used for injection, and all injection well tests must be witnessed by the Director. Shut-in wells must be tested within 2 years of the initial shut-in date and then every 5 years thereafter; temporarily abandoned wells must be tested within 30 days of temporary abandonment and then every 5 years; suspended operations and waiting on completion wells must be tested within 2 years of setting casing and then every 5 years. At least 10 days before any mechanical integrity test, the person performing the test must notify the Director with a Form 42. All wells must maintain mechanical integrity; wells that lack it must be repaired or plugged and abandoned within 6 months (but if an operator has not performed a test within the required time frames for shut-in or temporarily abandoned wells, no additional 6 months is given after an unsuccessful test). Pressure loss or gain may not exceed 10% of the initial stabilized surface pressure over a 15-minute test period.
  - reason: 417.a and 417.a.(3): the pre-injection requirement applies to new injection wells.
  - reason: 417.d.(1)-(3) give different triggers and the 5-year retest only while in that status.

### sec-ecmc-903-e-(1)-B-iv (ecmc)
- **old** -> corrected
  - summary: If you plan to drill a Wildcat (Exploratory) Well or conduct a Production Evaluation or Productivity Test, your gas capture plan must describe the planned test and explain any issues that might prevent you from connecting to a gas gathering line.
  - reason: Text requires a description of any issues related to the ability to connect, not only issues that might prevent connection; the trigger is a Wildcat Well or an anticipated test.
- **new** -> pass
  - summary: For a wildcat (exploratory) well or if the operator anticipates conducting a production evaluation or productivity test, the gas capture plan must include a description of the planned production evaluation or productivity test and any issues related to the operator's ability to connect to a gas gathering line.

### sec-ecmc-614-e (ecmc)
- **old** -> pass
  - summary: Operators of coalbed methane (CBM) wells must follow Rule 419's bradenhead testing requirements, except as modified here. The operator does not have to conduct bradenhead testing if it shows the Director that annular cement extends more than 50 feet above the base of surface casing and zonal isolation is confirmed by reliable evidence (such as a cement bond log or cementing ticket) and by two consecutive bradenhead tests at least 12 months apart. Before starting a bradenhead test, the operator must shut in the bradenhead annulus for at least 7 days. The appropriate regulatory agency will determine what remedial action is required.
- **new** -> corrected
  - summary: The operator of a coalbed methane (CBM) well must follow Rule 419 for bradenhead testing, with the modifications in this rule. The appropriate regulatory agency will determine what remedial action is needed. The operator does not have to do bradenhead testing if it shows the Director that annular cement coverage is greater than 50 feet above the base of surface casing and zonal isolation is confirmed by reliable evidence such as a cement bond log or cementing ticket indicating the height of cement coverage is 50 feet above the base of the surface casing, and zonal isolation is confirmed by two consecutive bradenhead tests at least 12 months apart. Before starting a bradenhead test, the operator must shut in the bradenhead annulus for a minimum of 7 days.
  - reason: Text requires demonstration 'to the satisfaction of the Director'.
  - reason: Text says the tests are ones the Operator conducts.

### sec-ecmc-1415-a-(5)-B (ecmc)
- **old** -> corrected
  - summary: The geologic storage operator must submit updated information about its financial responsibility instrument(s) every year and whenever there are changes; the Director will then review the demonstration within a reasonable time to confirm the instrument(s) are still adequate. The operator must keep its financial responsibility in place at all times, even while the Director's review is ongoing.
  - reason: Text ties the annual information to the operator and the Director's evaluation to changes.
  - reason: Text says maintain financial responsibility requirements regardless of the status of the review; it has no "at all times" wording.
- **new** -> corrected
  - summary: The geologic storage operator must submit updated information about its financial responsibility instruments every year and whenever there are changes. If there are changes, the Director must evaluate the financial responsibility demonstration within a reasonable time to confirm the instruments remain adequate. The operator must continue to maintain financial responsibility requirements even while the Director's review is ongoing.
  - reason: Text requires updated information annually; changes trigger the Director's evaluation, not a separate operator submission.

### sec-ecmc-1312-i (ecmc)
- **old** -> pass
  - summary: If an operator wants to inject any fluid other than geothermal fluids, fresh water, or recycled water into a geothermal well, the operator must comply with Rule 803.g.(5).C. and D.
- **new** -> pass
  - summary: When an operator wants to inject any fluid other than geothermal fluids, fresh water, or recycled water under Rule 1312.h.(3), the operator must comply with Rule 803.g.(5).C. and D.

### sec-ecmc-303-a (ecmc)
- **old** -> corrected
  - summary: Before starting operations at an oil and gas location that meets Rule 304.a criteria, an operator must have an approved Oil and Gas Development Plan and submit an application to the Commission that includes a hearing request (and if spacing is needed, a drilling and spacing unit application), a Form 2A for each proposed location, the full filing fee, a Form 2B Cumulative Impacts Data Identification (unless the Commission granted preliminary siting approval in a Comprehensive Area Plan), and a Form 2C certification that all components have been submitted. The operator must also provide any other information the Director determines necessary to decide whether the operation meets Commission rules and protects public health, safety, welfare, the environment, and wildlife resources. If the operator is concurrently seeking a permit from a federal agency or Relevant Local Government, the operator may engage the Director in that process and must notify the Director on the Form 2A, identify any conflicts between agency standards, and promptly notify the Director of milestones like document submissions, inspections, comment deadlines, hearings, and final decisions; if a permit has already been obtained, the operator must submit the final decision documents with the Form 2A. If the Director determines that multiple proposed locations should be considered as a Comprehensive Area Plan instead, the Director may request a meeting with the operator to evaluate whether the application should be re-submitted under Rule 314.
  - reason: 303.a.(6).A: the operator's duties apply only if the Director's engagement is requested.
- **new** -> corrected
  - summary: Before starting operations at an oil and gas location that meets Rule 304.a criteria, an operator must have an approved Oil and Gas Development Plan and submit an application to the Commission that includes a hearing request (Rule 503.g.(1)), a Form 2A for each proposed location (Rule 304), the full filing fee (Rule 301.d), a Form 2B Cumulative Impacts Data Identification (Rule 315.a) unless the Commission has granted preliminary siting approval in a Comprehensive Area Plan (Rule 314.e.(11)), and a Form 2C certification that all components have been submitted. If the plan includes lands to be spaced, the application must also include a drilling and spacing unit application and hearing request (Rules 305 & 503.g.(2)), and the applicant must provide documentation showing owner status for at least one portion of a mineral tract (Rule 305.a.(2).L). The Director may request any other relevant information necessary to determine whether the proposed operation meets the Commission's rules and protects public health, safety, welfare, the environment, and wildlife resources, and must provide the reason in writing. If the operator is concurrently seeking a permit from a federal agency or Relevant Local Government, the operator may engage the Director in that process and must notify the Director on the Form 2A, identify any potential conflicts between agency standards, and promptly notify the Director of subsequent milestones including document submissions, on-site inspections, public comment deadlines, hearings and public meetings, or issuance of final decisions; if a permit has already been obtained, the operator must submit the final decision documents as an attachment to the Form 2A.
  - reason: 303.a.(1) requires the owner-status documentation for the plan's hearing application, not only when lands are to be spaced.
  - reason: The owner-status documentation was moved out of the spacing condition.
  - reason: 303.a.(4) says 'protects and minimizes adverse impacts to'.
  - reason: 303.a.(6).A makes the notification duties apply only once the Director's engagement is requested.

### sec-ecmc-811-b-(9) (ecmc)
- **old** -> corrected
  - summary: An application for a new enhanced recovery injection project must include a plat showing the unit area boundary and marking all Class II UIC wells, offset injection wells, production wells, plugged and abandoned wells, and dry and abandoned wells within that area.
  - reason: Parent 811.b. applies to hearing applications for new enhanced recovery injection projects.
  - reason: The text does not limit the wells shown to those within the unit area.
- **new** -> pass
  - summary: A hearing application for a new enhanced recovery injection project must include a plat showing the unit area boundary and all Class II UIC wells, offset injection wells, production wells, plugged and abandoned wells, and dry and abandoned wells.

### sec-ecmc-204 (ecmc)
- **old** -> pass
  - summary: The Director may inspect any oil and gas location, oil and gas facility, disposal facility, or transporter facility at any reasonable time, and may review associated records to check compliance with the Act, Commission rules, or special field rules. Any rule violations found during an inspection will be reported to the Commission.
- **new** -> pass
  - summary: The Director has the right at all reasonable times to go onto and inspect any Oil and Gas Location, Oil and Gas Facility, disposal facility, or transporter facility, and any associated records, to investigate or test for compliance with the Act, the Commission's Rules, or any special Field rules. Any findings of a Commission Rule violation will be reported to the Commission.

### sec-ecmc-201-c (ecmc)
- **old** -> pass
  - summary: Local governments retain all legal authority granted to them by Colorado statutes, and local regulations may be more protective or stricter than the Commission's rules.
- **new** -> corrected
  - summary: Nothing in the Commission's rules limits the legal authority that state law gives to local governments under §§ 29-20-104, 30-15-401, C.R.S., or any other statute. Local government regulations may be more protective or stricter than the Commission's requirements.
  - reason: The text compares local regulations to "state requirements", not to the Commission's requirements.

### sec-ecmc-603-o-(2) (ecmc)
- **old** -> corrected
  - summary: Operators must build secondary containment around crude oil, condensate, and produced water storage tanks out of steel or another engineered material that is designed and installed to stop leaks and hold up against erosion or normal day-to-day use.
  - reason: Parent 603.o. limits the duty to new and significantly modified tanks.
- **new** -> pass
  - summary: Operators must build secondary containment out of steel or another engineered material that is designed and installed to prevent leaks and resist damage from erosion or routine operation.

### sec-ecmc-1420-d-(2) (ecmc)
- **old** -> corrected
  - summary: For Class VI underground injection control wells, the operator must set the frequency and location of ground water monitoring wells based on the baseline geochemical data collected under Rule 1407.b.(6) and on modeling results from the Geologic Storage Area of Review evaluation required by Rule 1414.c. This monitoring is to detect whether injected carbon dioxide has moved through the confining zone(s) into ground water above.
  - reason: Text says 'any modeling results in the ... evaluation'.
  - reason: Parent 1420.d. describes monitoring of ground water quality and geochemical changes that may result from movement through the Confining Zone(s) or additional identified zones.
- **new** -> pass
  - summary: The geologic storage operator must set the frequency and location of groundwater monitoring wells based on the baseline geochemical data collected under Rule 1407.b.(6) and on any modeling results from the Geologic Storage Area of Review evaluation required by Rule 1414.c.

### sec-ecmc-1407-b-(5) (ecmc)
- **old** -> pass
  - summary: Before the Commission issues a permit for a new Class VI UIC Well or for converting an existing Class I, II, or V well to Class VI, the Geologic Storage Operator must submit maps and stratigraphic cross sections showing the vertical and lateral boundaries of all underground sources of drinking water (USDWs), water wells, and springs within the Geologic Storage Area of Review, their positions relative to the injection zone(s), and the direction of water movement where known.
- **new** -> pass
  - summary: Before the Commission issues a permit for a new Class VI UIC well or for converting an existing Class I, II, or V well to Class VI, the Geologic Storage Operator must submit maps and stratigraphic cross sections showing the general vertical and lateral limits of all underground sources of drinking water (USDWs), water wells, and springs within the Geologic Storage Area of Review, their positions relative to the injection zone(s), and the direction of water movement where known.

### sec-ecmc-903-c-(3)-B-i (ecmc)
- **old** -> corrected
  - summary: The operator must explain on the Form 4 why flaring is necessary to complete the well and how it will protect and minimize adverse impacts to public health, safety, welfare, the environment, and wildlife resources.
  - reason: Text makes protecting and minimizing impacts a separate duty, not something to be explained on the Form 4.
- **new** -> pass
  - summary: On Form 4 the operator must explain why flaring is necessary to complete the well and how it will protect and minimize adverse impacts to public health, safety, welfare, the environment, and wildlife resources.

### sec-ecmc-517-a (ecmc)
- **old** -> corrected
  - summary: The Colorado Rules of Civil Procedure apply to Commission proceedings unless they conflict with the Commission's own rules or the Act, or unless the Administrative Law Judge or Hearing Officer directs otherwise on the record or by written order.
  - reason: Text limits on-the-record direction to "during prehearing proceedings".
- **new** -> pass
  - summary: The Colorado Rules of Civil Procedure apply to Commission proceedings unless they conflict with the Commission's own rules or the Act, or unless the Administrative Law Judge or Hearing Officer directs otherwise on the record during prehearing proceedings or by written order.

### sec-ecmc-1304-h-(1)-B (ecmc)
- **old** -> pass
  - summary: The Director may ask the State Land Board (SLB) for consultation on any Deep Geothermal Operations permit application if the Director reasonably believes the consultation would help understand potential impacts to any surface estate, mineral estate, geothermal resources, pore space, or water rights that SLB owns or manages.
- **new** -> pass
  - summary: The Director may request consultation with the State Land Board (SLB) about any permit application for Deep Geothermal Operations if the Director reasonably believes the consultation would help the Director understand the potential impact to any surface estate, mineral estate, geothermal resources, pore space, or water rights owned or managed by SLB.

### sec-ecmc-904-a (ecmc)
- **old** -> pass
  - summary: The Director must submit an annual report to the Commission on cumulative impacts – the first one was due by January 15, 2022, and every year after that by May 15. The report covers data from the Cumulative Impacts Data Evaluation Repository (CIDER), including impacts to Wildlife Resources and High Priority Habitat; reclamation activity (wells plugged, final and interim reclamation); greenhouse gas reduction roadmap status and the role of oil and gas operations; emissions inventories and NOx and Greenhouse Gas Intensity Targets from approved development plans; air quality trends and contributions from oil and gas operations; innovative technologies used to reduce emissions or mitigate impacts; relevant reports from other agencies or academic institutions; and any recommendations for future rulemakings, guidance, or studies to address cumulative impacts. The Director consults with CDPHE, CPW, and the Department of Natural Resources to prepare the report.
- **new** -> corrected
  - summary: No later than January 15, 2022, and annually by May 15 thereafter, the Director will report to the Commission on cumulative impacts after consulting with CDPHE, CPW, and the Department of Natural Resources. The report covers data in the Cumulative Impacts Data Evaluation Repository (CIDER), including impacts to Wildlife Resources and High Priority Habitat and water volume comparisons; reclamation information (wells plugged, locations achieving final or interim reclamation); the status of the Greenhouse Gas Pollution Reduction Roadmap and oil and gas sector emission reduction initiatives; NOx and Greenhouse Gas Intensity Targets from approved development plans and forms; ambient air quality attainment, trends, and contributions from Oil and Gas Operations; innovative technologies or measures used by operators to reduce emissions or mitigate adverse Cumulative Impacts; relevant reports from other governmental agencies or academic institutions; any additional information requested by the Commission or deemed relevant by the Director; and recommendations for future rulemakings, guidance, work groups, or studies to address Cumulative Impacts.
  - reason: 904.a.(5) covers evolving or new technologies and measures, including those employed by Operators in the prior year, not only those used by operators.

### sec-ecmc-419-d-(2) (ecmc)
- **old** -> corrected
  - summary: If the Director finds a deficiency during bradenhead testing, the Director may require a remediation plan or pressure management plan; if one is imposed, the operator must carry it out and report results within 30 days or on whatever schedule the approved plan specifies.
  - reason: Text says the Director may impose a remediation plan if a deficiency exists; it does not say the Director imposes a pressure management plan or that the deficiency is found during testing.
  - reason: The text names the approved remediation plan or pressure management plan as what the Operator implements.
- **new** -> pass
  - summary: The Director may impose a remediation plan if a deficiency exists, and if the Director does impose one, the Operator must implement the approved remediation plan or pressure management plan and report results within 30 days or as required by the approved plan.

### sec-ecmc-1423-c-(1)-I (ecmc)
- **old** -> pass
  - summary: This applies to operators seeking approval of an alternative Post-Injection Site Care timeframe for a Class VI injection well. The demonstration must include a description of how all abandoned wells within the Geologic Storage Area of Review were constructed and an assessment of the quality of the plugs in those wells.
- **new** -> pass
  - summary: A demonstration of an alternative Post-Injection Site Care timeframe must include a description of the well construction and an assessment of the quality of plugs of all Abandoned Wells within the Geologic Storage Area of Review.

### sec-ecmc-100-DEF-LOCAL-GOVERNMENTAL-DESIGNEE (ecmc)
- **old** -> pass
  - summary: LOCAL GOVERNMENTAL DESIGNEE means the office designated to receive, on behalf of the local government, copies of all documents required to be filed with the local governmental designee under these rules.
- **new** -> pass
  - summary: A Local Governmental Designee (LGD) is the office designated by a local government to receive copies of all documents that these rules require to be filed with the LGD.

### sec-ecmc-100-DEF-DESIGNATED-SETBACK-LOCATION (ecmc)
- **old** -> corrected
  - summary: A Designated Setback Location is any Oil and Gas Location where a well or production facility is or will be within 1,000 feet of a Buffer Zone, within 500 feet of an Exception Zone, or within 1,000 feet of a High Occupancy Building Unit or Designated Outside Activity Area, as referenced in Rule 604. The distance is measured from the nearest edge or corner of the well or production facility to the nearest edge or corner of any Building Unit or High Occupancy Building Unit, or to the nearest boundary of any Designated Outside Activity Area.
  - reason: Text defines the Buffer Zone and Exception Zone Setbacks as 1,000 and 500 feet; the well or facility is situated within them.
  - reason: Text specifies the shortest distance from any existing or proposed well or facility; edge or corner applies only to the buildings.
- **new** -> pass
  - summary: A Designated Setback Location is an Oil and Gas Location where any well or production facility is or will be within a Buffer Zone Setback (1,000 feet), an Exception Zone Setback (500 feet), or within 1,000 feet of a High Occupancy Building Unit or a Designated Outside Activity Area, as referenced in Rule 604. The measurement is the shortest distance between any existing or proposed well or production facility on the Oil and Gas Location and the nearest edge or corner of any Building Unit, nearest edge or corner of any High Occupancy Building Unit, or nearest boundary of any Designated Outside Activity Area.

### sec-ecmc-1426-d (ecmc)
- **old** -> pass
  - summary: Upon receiving a recommendation under Rule 1426.c, the Commission will hold a hearing to decide whether the operator must obtain a Class VI UIC Permit or take other actions necessary and reasonable to protect underground sources of drinking water (USDWs). The operator may waive its right to that hearing.
- **new** -> pass
  - summary: Upon receiving a recommendation under Rule 1426.c, the Commission will hold a hearing to decide whether the operator must obtain a Class VI UIC Permit or take other actions necessary and reasonable to protect underground sources of drinking water (USDWs). The operator may waive its right to this hearing.

### sec-ecmc-503-g-(11) (ecmc)
- **old** -> corrected
  - summary: An operator may file an application for a Financial Assurance hearing to satisfy the requirements of any of the rules listed (Rules 218.b.(5).D, 218.i.(2), 434.d.(8), 701.b, 702.b, 703.b.(1).A, 703.d.(2).C, 704.b, 706.b, 706.c.(1), 706.e, 707.a, or 707.b). If the Commission or the Director initiates a Financial Assurance hearing on its own motion under the rules listed, the operator subject to the hearing must compile and submit into the docket any information those rules require.
  - reason: The text does not name the operator as the filer; it says the application will satisfy the rules.
  - reason: The text gives separate rule citations for the Commission and the Director, and 'own motion' applies only to the Commission.
- **new** -> pass
  - summary: An application for a Financial Assurance hearing satisfies the requirements of the listed rules (Rules 218.b.(5).D, 218.i.(2), 434.d.(8), 701.b, 702.b, 703.b.(1).A, 703.d.(2).C, 704.b, 706.b, 706.c.(1), 706.e, 707.a, and 707.b). If the Commission initiates a Financial Assurance hearing on its own motion under Rule 503.a and 707.b, or the Director initiates one under Rules 218.b.(5).D, 434.d.(8).B.ii, 706.b, or 707.a.(2), the Operator subject to the hearing must compile any information required by those rules and submit it into the docket for the proceeding.

### sec-ecmc-1423-b (ecmc)
- **old** -> corrected
  - summary: After injection stops, the geologic storage operator must monitor the site to track where the carbon dioxide plume and pressure front are and to show that underground sources of drinking water (USDWs) are not being harmed. Monitoring must continue for at least 50 years (or an alternative timeframe the Commission approves) unless the operator demonstrates to the Director's satisfaction that the project no longer endangers USDWs, public health, safety, welfare, the environment, or wildlife resources. If the operator makes that demonstration before 50 years, the Director may approve less-frequent monitoring or authorize site closure early. Before site closure can be authorized, the operator must submit a demonstration that no further monitoring is needed and must reclaim all remaining facilities at the location under Rule 1434 unless the Director approves otherwise. If the operator cannot make the required demonstration at the end of the monitoring period, they must submit a plan to continue post-injection site care until the demonstration can be made and approved.
  - reason: 1423.b.(1) requires continued monitoring until the demonstration is submitted and approved.
  - reason: Moves the 1423.b.(2) demonstration content to where it applies, keeping the Director's discretion.
  - reason: 1423.b.(4) also covers the Director not approving the demonstration.
  - reason: 1423.b.(4) names the Director as recipient.
- **new** -> corrected
  - summary: After injection stops, the Geologic Storage Operator must monitor the site to show where the Carbon Dioxide Plume and Pressure Front are and demonstrate that underground sources of drinking water (USDWs) are not being endangered. Monitoring must continue under the Director-approved Post-Injection Site Care and Site Closure plan for at least 50 years (or an alternative timeframe the Commission approved under Rule 1423.c) and until the operator demonstrates the project no longer endangers USDWs and the Director approves that demonstration. The Director may approve reducing monitoring frequency or authorizing Site Closure before 50 years if the operator demonstrates the project no longer poses a risk to public health, safety, welfare, the environment (including USDWs) or wildlife resources. Before Site Closure is authorized, the operator must submit a demonstration that no additional monitoring is needed, and if that cannot be made or is not approved at the end of the monitoring period, the operator must submit a plan to continue Post-Injection Site Care until an approvable demonstration can be made; the operator must also reclaim all remaining Geologic Storage Facilities at the location under Rule 1434 unless the Director approves otherwise.
  - reason: 1423.b.(1) makes the duration subject to a demonstration under 1423.b.(2).
  - reason: 1423.b.(2) covers the alternative timeframe, requires satisfaction of the Director, monitoring and site-specific data, and substantial evidence.

### sec-ecmc-1409-a-(1) (ecmc)
- **old** -> corrected
  - summary: An applicable requirement is any Colorado statute or rule that takes effect before the Commission or Director makes a final decision on the permit, and also any requirement that takes effect before a permit is modified or revoked and reissued (to the extent Rule 1413 allows).
  - reason: The text says "prior to final administrative disposition of the permit" and names no decision-maker there.
- **new** -> pass
  - summary: An applicable requirement is any state statutory or regulatory requirement that takes effect before the permit's final administrative disposition, and also any requirement that takes effect before a permit modification or revocation and reissuance, to the extent allowed under Rule 1413.

### sec-ecmc-100-DEF-SOLID-WASTE (ecmc)
- **old** -> corrected
  - summary: Solid waste means garbage, refuse, sludge, and other discarded material (solid, liquid, semisolid, or contained gas) from industrial, commercial, or community activities. It does not include domestic sewage, agricultural wastes, irrigation return flows, industrial discharges that are Energy and Carbon Management Commission point sources under the Colorado Water Quality Control Act (Title 25, Article 8, C.R.S.), materials at facilities licensed under Title 25, Article 11, C.R.S. (radiation control), excluded scrap metal being recycled, or shredded circuit boards being recycled. This is a definitional provision.
  - reason: Text names the sludge sources and applies the activities qualifier to the solid, liquid, semisolid, or gaseous material.
  - reason: Text excludes solid or dissolved materials in domestic sewage and irrigation return flows.
- **new** -> corrected
  - summary: Solid waste means garbage, refuse, sludge from treatment plants or pollution control facilities, and other discarded material (solid, liquid, semisolid, or contained gas) from industrial, commercial, or community activities. It does not include materials in domestic sewage, agricultural wastes, irrigation return flows, industrial discharges that are Commission point sources under permits issued under the Colorado Water Quality Control Act (Title 25, Article 8, C.R.S.), materials at facilities licensed under Title 25, Article 11, C.R.S. (radiation control), excluded scrap metal being recycled, or shredded circuit boards being recycled.
  - reason: The text lists sludge from a waste treatment plant, water supply plant, or air pollution control facility.

### sec-ecmc-913-e-(4) (ecmc)
- **old** -> corrected
  - summary: Each year, at least one of the operator's quarterly progress reports must confirm that the operator's general liability insurance under Rule 705 (or other financial assurance the operator has provided) is adequate to cover the expected costs of remediation.
  - reason: Text says the report will 'address the adequacy', not 'confirm' it is adequate.
  - reason: Text says 'each calendar year'.
- **new** -> pass
  - summary: Each year, at least one of the operator's quarterly reports must address whether the operator's general liability insurance under Rule 705 (or other financial assurance the operator has provided) is adequate to cover the expected costs of remediation.

### sec-ecmc-510-d-(2) (ecmc)
- **old** -> corrected
  - summary: An Administrative Law Judge or Hearing Officer may conduct an administrative hearing on an uncontested application in an informal meeting format, where the applicant presents exhibits and sworn witness testimony. At the end of the hearing, the ALJ or Hearing Officer will decide whether to approve or deny the application and inform the applicant, then issue a written report to the Commission with findings of fact, conclusions of law (if any), and a recommended order. If the recommended order denies the application or approves it with conditions, the applicant may file an exception.
  - reason: Text says the Applicant 'may present its case using exhibits and witnesses' and 'All witnesses will be sworn'.
  - reason: Text says the Applicant 'will be entitled to file an exception'.
- **new** -> pass
  - summary: An Administrative Law Judge or Hearing Officer may conduct an administrative hearing on an uncontested application in an informal meeting format. The applicant may present exhibits and witnesses (who must be sworn), and at the end of the hearing the ALJ or Hearing Officer will decide whether to approve or deny the application and inform the applicant. The ALJ or Hearing Officer will then issue a written report to the Commission with findings of fact, conclusions of law (if any), and a recommended order. If the recommended order denies or qualifies approval of the application, the applicant may file an exception.

### sec-ecmc-1304-e-(4)-B (ecmc)
- **old** -> pass
  - summary: If an operator has not made reasonable efforts to consult with Colorado Parks and Wildlife, the Director may delay a decision on a deep geothermal permit application to allow the consultation to happen, but only if the Director believes the information from that consultation is necessary to determine how to protect wildlife resources and avoid, mitigate, and minimize adverse impacts.
- **new** -> pass
  - summary: If the operator has not made a reasonable accommodation for consultation with Colorado Parks and Wildlife, the Director may postpone a decision on a Deep Geothermal Operations permit application to allow consultation to happen, if the Director believes the information from that consultation is necessary to determine how to protect and avoid, mitigate, and minimize adverse impacts to wildlife resources.

### sec-ecmc-703-b-(3) (ecmc)
- **old** -> pass
  - summary: Financial assurance posted for a remediation project under Rule 703.b will be held by the Director until the operator finishes remediating the soil and/or groundwater impacts according to the approved workplan and Rule 913.h.
- **new** -> pass
  - summary: Financial assurance required under Rule 703.b for remediation projects will be held by the Director until the required remediation of soil and/or groundwater impacts is completed according to the approved workplan and Rule 913.h.

### sec-ecmc-704-b-(2) (ecmc)
- **old** -> corrected
  - summary: If the Commission finds in favor of a surface owner who filed a financial assurance hearing application under Rule 503.g.(11), the Commission may order the operator to perform corrective or remedial action, pay a monetary award for unreasonable crop loss or land damage that cannot be remediated or corrected, or provide other appropriate relief. Any monetary award is not capped at the amount of the operator's surface owner protection bond under Rule 704.
  - reason: Text refers to the Operator's Financial Assurance provided pursuant to Rule 704.
- **new** -> pass
  - summary: If the Commission finds in favor of a Surface Owner in a Financial Assurance hearing under Rule 503.g.(11), the Commission may order the Operator to conduct corrective or remedial action, provide a monetary award for unreasonable crop loss or land damage that cannot be remediated or corrected, or other appropriate relief. Any monetary award is not limited to the amount of the Operator's Financial Assurance provided under Rule 704.
