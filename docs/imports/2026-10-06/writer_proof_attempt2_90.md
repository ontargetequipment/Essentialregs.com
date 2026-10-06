# Writer proof, attempt 2 (read-only), 6 Oct 2026: the sharpened writer instructions on 90 of the same provisions

Workflow run: https://github.com/ontargetequipment/Essentialregs.com/actions/runs/37474537223 (Review workflow, input writer_proof=execute, new writer only, prompt as of commit bbd2b50). The 90 rows are the first 18 of each group of attempt 1 (same seed); on them the old writer's would-correct rate was 52.2% (47/90) and attempt 1's 28.9% (26/90). Nothing was written to the database.


- 90 provisions the reviewer corrected in October 2026 (seed 20261006; groups {'gp': 18, '3': 18, '7': 18, 'oooob': 18, 'ecmc': 18}; eligible {'3': 438, '7': 578, 'ecmc': 1122, 'gp': 347, 'oooob': 715}; 0 left out as over the old 6,000-word cap, outline mode or headings-only)
- Writer `claude-sonnet-4-5` (temperature 0, batch); reviewer `claude-sonnet-5-5` (effort low, prompt version 7f111afa89, audit mode: nothing written)
- Cost: writer $0.5214 + reviewer $0.2379 = **$0.7593** (estimate was $0.81; cap $0.88)

## Would-correct rate

| writer | reviewed | pass | corrected | fail | would-correct rate |
|---|---:|---:|---:|---:|---:|
| new | 90 | 70 | 20 | 0 | **22.2%** |

## By group

| group | new: would-correct |
|---|---:|
| gp | 16.7% (3/18) |
| 3 | 33.3% (6/18) |
| 7 | 16.7% (3/18) |
| oooob | 16.7% (3/18) |
| ecmc | 27.8% (5/18) |

## Most common remaining reasons (new writer, keyword tally over the reviewer's reasons)

- other: 75
- citation or cross-reference: 7
- party named differently: 6
- option presented as a duty: 5
- number, threshold or unit: 4
- wrong term or paraphrase: 4
- dropped condition or exception: 3
- statement the text does not make: 3
- date, deadline or timing: 2
- scope narrower: 2

## Most common reasons (old writer)


## Rows

### sec-gp02-VI-E-5 (gp)
- **new** -> pass
  - summary: The permit requires monthly recording of the pressure drop across the catalyst bed, and the monthly values must stay within +/- 2 inches of water column of the most recent baseline established under Section VI.E.5.b. If a reading is out of range, the owner or operator can take corrective action and document it, artificially load the engine to within +/- 10 percent of the most recent baseline load (and if the pressure drop is then in range, document the values with no further action needed), or skip maintenance and run a portable analyzer test to set a new baseline. The baseline pressure drop must be established by recording engine load and pressure drop during engine testing, and reestablished during each initial compliance test under Section V (or deferred to the first periodic performance test if historical test data without a baseline is used), during each periodic performance test under Section VI.E.5, and within the first 30 days of operation after the catalyst is cleaned, reconditioned, or replaced.

### sec-gp08-VI-C (gp)
- **new** -> pass
  - summary: In ozone nonattainment areas, control devices used to meet Regulation Number 7, Part B, Section I.D.3. and II.D.2. must be either a combustion device or a vapor recovery unit and must meet all requirements of Regulation Number 7, Part B, Section I.C.1 and II.B.2. Alternative control equipment must be approved through an individual permit as required by Regulation Number 7, Part B, Section I.D.4 or II.B.2.e.

### sec-gp09-I-C (gp)
- **new** -> pass
  - summary: The permit applies only to the well production facility and equipment described in Section I.A that the operator has registered under this general permit in the application materials submitted to the Division.

### sec-gp08-VIII-C-9 (gp)
- **new** -> pass
  - summary: The permit registration is approved based on the accuracy and completeness of the information the applicant provided and is valid only for the equipment and operations specifically identified in the registration. The registration is conditioned on operating the source in accordance with that information and the representations the applicant or the applicant's agents made.

### sec-gp12-VI-F-5 (gp)
- **new** -> corrected
  - summary: The permit requires that each natural gas-fired engine equipped with a catalytic emission control device meet monitoring, maintenance, and testing conditions. Engines subject to Regulation Number 26, Part B, Section I.D.5. or I.D.6. must comply with the monitoring requirements in those sections. The catalyst must be cleaned, reconditioned and replaced per the manufacturer's recommended maintenance or equivalent. Catalyst inlet temperature must be recorded weekly (750°F to 1250°F for rich burn engines with NSCR, 450°F to 1350°F for lean burn engines with oxidation catalyst), and corrective action must be taken and documented if the temperature is outside the specified range unless Regulation Number 26, Part B, Section I.D.5.e.(ii) requires more stringent monitoring. Pressure drop across the catalyst bed must be recorded monthly and must not deviate by more than +/- 2 inches of water column from the most recent baseline; if out of range, the owner or operator must take and document corrective action, may artificially load the engine to within +/- 10 percent of the most recent baseline load value and document the results if then in range, or may forego maintenance and perform a portable analyzer test to establish a new baseline. The baseline pressure drop must be established during engine testing and reestablished during each initial and periodic compliance test required by the permit and within 30 days of engine operation after the catalyst is cleaned, reconditioned, or replaced. Periodic performance tests for NOx and CO using a portable analyzer are required quarterly for major sources (remaining quarterly regardless of consecutive passing tests), quarterly for minor and synthetic minor sources with facility-wide permitted NOx or CO emissions at or above the Table 3 thresholds (reducing to semi-annually after four consecutive quarterly passing tests), and semi-annually for minor and synthetic minor sources below the Table 3 thresholds (reducing to annually after two consecutive semi-annual passing tests); Table 3 sets NOx monitoring thresholds of 80 tpy in attainment and marginal/moderate nonattainment areas, 40 tpy in serious nonattainment, 15 tpy in severe nonattainment, and zero in extreme ozone nonattainment, and CO monitoring thresholds of 80 tpy in attainment areas only. Each performance test should be performed with the engine operating at the highest load practicable, but artificially loading the engine is not required. All portable analyzer performance tests, including tests triggered by a replacement engine authorized by an AOS in this permit, must meet the requirements in the Portable Analyzer Monitoring Protocol or other Division approved protocol, and the owner or operator may use a performance test using a reference test method instead of a portable analyzer.
  - reason: Table 3 gives no unit; 'tpy' is not in the text.
  - reason: Table 3 gives no unit for the CO threshold and lists 'Not Applicable' for the other classifications.

### sec-gp12-III-A-1 (gp)
- **new** -> pass
  - summary: The permit requires that VOC, NOx, and CO emissions from each registered emission point not exceed the annual emission limits (in tons per year) listed in the registration approval letter, or if no approval letter has been issued, the limits the owner or operator certified in the APEN submitted with the registration. This condition cites Regulation Number 3, Part B, Sections II.A.4. and II.A.7.

### sec-gp10-IV-B-7-g (gp)
- **new** -> pass
  - summary: The permit requires monthly measurement and recording of the pressure drop across the catalyst bed. The monthly pressure drop values must not deviate by more than +/- 2 inches of water column from the most recent baseline value. If the pressure drop is out of range, corrective action must be taken and documented within 15 days, which may include artificially loading the engine to within +/- 10 percent of the most recent baseline load value, performing a portable analyzer test to establish a new baseline, or other corrective action the owner or operator deems appropriate. The baseline pressure drop must be established during engine testing and reestablished during each initial and periodic compliance test and within the first 30 days of engine operation after the catalyst is cleaned, reconditioned, or replaced (though if historical compliance test data is used and no baseline was recorded, the operator may defer establishing the baseline until the first periodic performance test).

### sec-gp01-VI-C (gp)
- **new** -> pass
  - summary: The permit requires that control devices used to meet Regulation Number 7, Part B, Sections I.D.3. and II.D.2. must be either a combustion device or a vapor recovery unit and must meet all requirements of Regulation Number 7, Part B, Section I.C.1. and II.B.2. Alternative control equipment must be approved through an individual permit as required by Regulation Number 7, Part B, Section I.D.4. or II.B.2.e.

### sec-gp12-VII-C-2 (gp)
- **new** -> corrected
  - summary: When using events-based processes, within 180 days after starting operation under this permit and then periodically following Table 5's schedule, the owner or operator must analyze all equipment associated with these activities and indicate for each piece of equipment: the actual unique physical volume between isolation valves (as built, may use engineering calculations), the absolute pressure at actual conditions in that volume (may use engineering calculations), and either a site-specific extended gas analysis of the vented gas to verify VOC and HAP content (benzene, toluene, ethylbenzene, xylenes, n-hexane, and 2,2,4-trimethylpentane weight fractions) or a site-specific sampling and compositional analysis of pre-flash pressurized condensate, crude oil, intermediate hydrocarbons, or produced water routed to storage tanks (and if needed for emission factors, a sales oil analysis for RVP and API gravity) to verify the same pollutants' content and calculate site-specific emission factors using Division-approved methods. If site-specific emission factors exceed those in the registration approval letter or certified in the APEN, the owner or operator must use the new factors to calculate actual emissions and demonstrate compliance starting the calendar month after sampling, report initial and periodic emission factors per Regulation Number 7 Part B Section V, and keep sampling records for at least five years and make them available to the Division on request; owners or operators using state-default emission factors are not required to comply with this condition. Table 5 sets sampling frequency based on area classification and facility-wide permitted VOC emissions, ranging from every five years (attainment areas with less than 90 TPY) to annually (extreme ozone nonattainment or facilities at or above the area's threshold), with storage tanks having actual uncontrolled VOC emissions ≥ 80 TPY sampled every two years or annually depending on the area and facility emissions.
  - reason: Reporting and recordkeeping are separate duties, not conditioned on factors exceeding the approval-letter values.
  - reason: Table 5 gives every five years for below-threshold facilities in those areas, not only attainment.

### sec-gp05-II-A-2 (gp)
- **new** -> corrected
  - summary: The permit requires that for new or modified GP05 registrations deemed complete on or after July 23, 2025, the maximum allowable NOx and CO emissions from all tank batteries and their controls owned and operated by the same person and co-located at the same stationary source must not exceed the requested annual emission limitations (tons per year) listed on the general permit registration approval letter, or if no approval letter has been issued, as certified by the owner or operator in the APEN included with the registration (Regulation Number 3, Part B, Sections II.A.4. and II.A.7.).
  - reason: The text uses the effective date of Issuance 5 and does not state that date as July 23, 2025.

### sec-gp03-I-A (gp)
- **new** -> pass
  - summary: The owner or operator of any land development activity may register for this permit if it can comply with all the operating conditions in Section II and meets all the requirements of Section I.

### sec-gp12-XI-E-5 (gp)
- **new** -> pass
  - summary: The Division may require a well production facility authorized by this general permit to apply for and obtain a source-specific construction permit if circumstances have changed since the original general permit application so that the facility is no longer appropriately controlled or permitted under the general construction permit.

### sec-gp09-IX-B (gp)
- **new** -> pass
  - summary: The permit states that some or all of its monitoring requirements will be incorporated as specific conditions in the source's Title V Operating Permit (if applicable), in accordance with Colorado Regulation Number 3, Part C, Section V.C.5. Additional monitoring not listed in this general permit may be included in the Operating Permit to satisfy the periodic monitoring requirements of Section V.C.5.b.

### sec-gp09-IV-J-2 (gp)
- **new** -> pass
  - summary: The permit requires the owner or operator to use best management practices to minimize hydrocarbon emissions during routine or predictable gas venting events, or to reduce how often those events occur. The owner and operator must develop and maintain a description of the best management practices they use, including how they implement and perform them.

### sec-gp10-IV-A-3-h (gp)
- **new** -> pass
  - summary: The permit requires the owner or operator to maintain documentation of applicable MACT HH requirements (National Emissions Standards for Hazardous Air Pollutants for Source Categories from Oil and Natural Gas Production Facilities, 40 CFR part 63, subparts A and HH, and Regulation Number 8, Part E, Subparts A and HH). This documentation must be kept on-site or at a local field office with well production facility responsibility, in either electronic or hard copy format, and must be promptly supplied to the Division upon request.

### sec-gp12-IX-C-1-a (gp)
- **new** -> pass
  - summary: Under the AOS provisions for gas venting from separators, the permit allows the owner or operator to replace an existing control device with control equipment of the same make and model, with no configuration changes that would impact a dispersion analysis, without modifying the GP12 registration, provided there are no emission increases and the permit's emission limits are still met.

### sec-gp07-VIII-C-9 (gp)
- **new** -> pass
  - summary: The permit registration is approved based on the accuracy and completeness of the information the applicant provided, and the permit condition requires the source to operate according to that information and the applicant's representations. The registration is valid only for the equipment and operations specifically identified on the general permit registration.

### sec-gp02-VII-A-2-f (gp)
- **new** -> pass
  - summary: The permit requires that a permanent replacement engine not include changes to the configuration that might impact a dispersion analysis, including stack heights, stack locations, or exit velocity.

### sec-3-D-II-A-21-b (3)
- **new** -> pass
  - summary: LAER (Lowest Achievable Emissions Rate) for a source can be the most stringent emission limit actually achieved in practice by that class or category of source. However, applying this definition cannot allow a proposed new or modified stationary source to emit any pollutant above the amount allowed under an applicable new source performance standard in Regulation Number 6.

### sec-3-C-V-B-6 (3)
- **new** -> pass
  - summary: The Administrator may object to issuing an operating permit if the proposed permit will not comply with applicable requirements or 40 CFR part 70. Any objection must include the Administrator's reasons and describe the terms and conditions needed to address the objection. The Administrator may also object if the Division fails to submit copies of applications and permits to the Administrator (Section V.F.), fails to comply with affected-state review (Section IX.), fails to submit information the Administrator needs to review the proposed permit, or fails to comply with public participation requirements (Section VI.).

### sec-3-D-VI-A-3-b (3)
- **new** -> pass
  - summary: For a regulated pollutant that has no national ambient air quality standard but does have an acceptable monitoring method, the analysis must include whatever air quality monitoring data the Division determines are necessary to assess ambient air quality for that pollutant in any area the emissions would affect.

### sec-3-B-II-D-1-g (3)
- **new** -> pass
  - summary: Surface mining activities that mine 70,000 tons or fewer of product material per year are exempt from construction permit requirements, but a fugitive dust control plan is required. Crushers, screens, and other processing equipment are not covered by this exemption.

### sec-3-B-III-D-1-g (3)
- **new** -> corrected
  - summary: Permit approval does not relieve the owner or operator of the responsibility to comply fully with the state implementation plan and any other requirements under local, state, or federal law.
  - reason: Text limits the duty to 'applicable provisions of the state implementation plan'.

### sec-3-D-II-A-35 (3)
- **new** -> pass
  - summary: A Plant-wide Applicability Limitation (PAL) is an emission limit for a pollutant at a major stationary source or GHG-only source, expressed in tons per year (or tons per year CO2e for greenhouse gases). The limit must be enforceable as a practical matter and established source-wide according to Section XV of this Part D.

### sec-3-C-XIII-A (3)
- **new** -> corrected
  - summary: A Part C operating permit must be reopened and revised when any of seven circumstances occur: (1) new applicable requirements take effect for a major source with at least three years left on its permit (must be completed within 18 months of the requirement's promulgation, with exceptions for requirements effective after permit expiration or when a general permit addresses the requirement); (2) new requirements, including excess emissions requirements, apply to an affected source under the acid rain program (excess emissions offset plans approved by the Administrator are treated as incorporated into the permit); (3) the Division or the Administrator finds the permit contains a material mistake or was based on inaccurate statements; (4) the Division or the Administrator determines revision or revocation is needed to ensure compliance with applicable requirements; (5) reopening follows the same procedures as initial permit issuance and renewal under Sections III, IV, and V; (6) reopening affects only the parts of the permit for which cause exists; and (7) the Division must give the source at least 30 days' advance notice before reopening (may be shorter in an emergency).
  - reason: Only XIII.A.1 to A.4 are triggering circumstances; A.5 to A.7 are procedural.
  - reason: A.5 to A.7 are procedures, not circumstances; text says procedures for permit issuance and renewal, not 'initial'.
  - reason: XIII.A.1 conditions the expiration exception on no extension and cites VIII.A.2.

### sec-3-A-V-D-2-b (3)
- **new** -> pass
  - summary: Emission reductions from an emission unit that is violating an emission limit for a nonattainment pollutant at the time the application is reviewed and continuing until the emission reduction credit is certified do not qualify for emission reduction credits.

### sec-3-D-VIII-B-3 (3)
- **new** -> pass
  - summary: Lands administered by the Federal Bureau of Land Management in the Gunnison Gorge Recreation Area as of October 27, 1977 are designated Class II, but the increase allowed in sulfur dioxide concentrations over baseline must be the same as the increase established for Class I areas under Section 163(b) of the Federal Act. The allowable increases may not be allowed if a Federal Land Manager makes an adverse impact determination under Section XIII.C. with which the Division concurs, and the increases may be exceeded by complying with Sections XIII.D., XIII.E., or XIII.F. These areas may be redesignated as provided in Section IX.

### sec-3-C-X-F (3)
- **new** -> pass
  - summary: Within five working days of receiving a complete minor permit modification application, the Division must send a copy of the notice (completed under Section X.D.4.) to the Administrator.

### sec-3-C-V-C-5-d-(i)-(A) (3)
- **new** -> pass
  - summary: For operating permit renewals submitted on or after July 15, 2024, if a source in a Cumulatively Impacted Community has had permit modifications or permits issued since its last renewal that increased its nitrogen oxides or direct PM2.5 emissions above the Affected Construction Source thresholds (defined in Part A, Section I.B.4), the Division will require a source-specific monitoring plan. The source must design the plan and implement it within three months of permit issuance (or another Division-approved timeline), following the outline in Section III.J.2.b. of Part B. Sources already operating Division-approved monitoring for those pollutants do not need additional monitoring under this provision.

### sec-3-C-VIII-H (3)
- **new** -> pass
  - summary: A general operating permit cannot be issued to a major source if doing so would violate any applicable requirement in another operating permit the source already holds, or if issuing the general permit would let the source avoid a modification under Title I of the Federal Act.

### sec-3-A-V-D-1-b (3)
- **new** -> corrected
  - summary: To be certified as an emission reduction credit (ERC), the emission reductions must be surplus (as defined in Section V.C.9.), permanent, quantifiable, and federally enforceable at the time of certification.
  - reason: Text places 'at the time of ERC certification' only after 'surplus'.

### sec-3-B-III-J-2-b (3)
- **new** -> corrected
  - summary: A source-specific monitoring plan required under Section III.J.2. or Section V.C.5.d.(i) must identify how the selected monitoring is the best available monitoring technology that is reasonably available and capable of detecting or monitoring the pollutants that triggered source-specific monitoring. The plan must also identify how the monitoring will inform how the emissions of the monitored pollutant will impact ambient air concentrations in the Disproportionately Impacted Community where the source is located. Source-specific monitoring must be implemented using one of three options: a Division-approved fenceline monitoring network; air quality monitors within 0.25 miles of the area of highest annual average modeled concentration (if that area is within 0.25 miles of an Occupied Area) or the nearest logistically practical location, with Division-approved monitor locations; or monitoring technologies operated under a Division-approved detailed description of existing or new monitoring for the relevant pollutant(s), including type and frequency, with a demonstration of how it informs impacts on ambient air concentrations in the Disproportionately Impacted Community (which may include dispersion modeling data or other relevant information), and monitoring can include CEMS, performance testing, Division-approved parametric monitoring, source-specific sampling, and real or near real-time process monitoring systems such as SCADA.
  - reason: III.J.2.b.(ii) begins 'If accessible to the source's owner/operator'.

### sec-3-A-I-B-30-a (3)
- **new** -> pass
  - summary: A stationary source or group of sources under common control is a major source if it directly emits or has the potential to emit (considering enforceable controls) 10 tons per year or more of any single hazardous air pollutant, or 25 tons per year or more of any combination of hazardous air pollutants, or a lesser quantity if established under the Federal Act. Emissions from oil or gas exploration or production wells (with associated equipment) and from pipeline compressor or pump stations cannot be aggregated with emissions from other similar units to determine major-source status, and for oil or gas exploration or production wells (with associated equipment) such emissions cannot be aggregated for any purpose under this provision. Fugitive emissions must be considered when determining whether a stationary source of hazardous air pollutants is a major source.

### sec-3-A-II-D-1-zzz (3)
- **new** -> pass
  - summary: Venting natural gas lines for safety purposes is exempt from filing an Air Pollutant Emission Notice. This exemption does not cover routine or predictable emissions at or associated with a stationary source.

### sec-3-F-I-AAA (3)
- **new** -> corrected
  - summary: This is a statement of basis, statutory authority, and purpose adopted October 12, 2016, explaining why the Commission revised three definitions in Regulation Number 3, Part D: "major stationary source," "major emission unit," and "significant." The revisions added ozone nonattainment area major source thresholds that step down based on the area's classification (serious, severe, or extreme) to match federal requirements, so that Colorado can maintain its permitting authority if the state's ozone nonattainment area is ever reclassified to a more stringent level. The Commission also removed an unnecessary example from the "major emissions unit" definition and corrected typographical, grammatical, and formatting errors.
  - reason: The text ties the ozone thresholds to the major stationary source definition and the serious/severe/extreme emission rates to the significant definition.

### sec-3-C-V-C-5-d-(iv)-(B)-(1) (3)
- **new** -> corrected
  - summary: For sources that meet the conditions in the parent paragraph (those that increased certain emissions since their last permit renewal), the estimated annual actual emissions of benzene, toluene, ethylbenzene, and/or xylenes and/or the requested permitted emissions of volatile organic compounds, nitrogen oxides, and/or direct PM2.5 shown on the Air Pollutant Emission Notice(s) and information submitted under Section III.C. of Part C will be used to calculate the Disproportionately Impacted Community Monitoring Fee.
  - reason: The text says the emissions "shall be used for ... Fee assessment" and gives no calculation.

### sec-7-B-I-H-5 (7)
- **new** -> pass
  - summary: For purposes of the glycol dehydrator emission-reduction requirements in Section I.H., emissions from still vents and from any flash separator or flash tank on a glycol natural gas dehydrator must be calculated using a method the Division has approved in advance.

### sec-7-B-III-C-4-g-(i) (7)
- **new** -> pass
  - summary: Records must be kept of the date a well production facility completes retrofit or all wells flowing to it are plugged and abandoned, or the date natural gas compressor station pneumatic controllers were retrofit or the station is taken out of service. These records must be kept for five years and made available to the Division upon request.

### sec-7-B-II-I-2-c-(i) (7)
- **new** -> corrected
  - summary: Each pump in light liquid service, pressure relief device in gas/vapor service, valve in gas/vapor or light liquid service, and connector in gas/vapor or light liquid service must be inspected for leaks. The owner or operator can meet this by conducting bimonthly optical gas imaging (OGI) inspections under 40 CFR Part 60, Appendix K (May 7, 2024), or by using Method 21 (August 3, 2017) monthly for pumps, quarterly for pressure relief devices and valves, and annually for connectors (with certain connectors exempt from the annual inspection, including inaccessible, ceramic, ceramic-lined, and instrumentation-system connectors, where inaccessible is defined by specific access limitations such as burial, insulation, obstruction, height above 7.6 meters or 2 meters above a permanent support surface, or safety hazards).
  - reason: Matches the text's wording of the height-related inaccessibility criteria in II.I.2.c.(i).(B).(4).

### sec-7-B-III-B-11 (7)
- **new** -> pass
  - summary: "Low-Bleed Pneumatic controller" means a continuous bleed pneumatic controller designed to emit 6 scfh of natural gas or less to the atmosphere.

### sec-7-B-VII-F-3-c (7)
- **new** -> pass
  - summary: When an existing midstream facility is transferred to a midstream company that has no assigned company cap, the acquiring company is not treated as a new entrant.

### sec-7-B-III-C-4-a-(ii) (7)
- **new** -> pass
  - summary: Well production facilities that receive production from a well that first begins production or is recompleted or refractured on or after May 1, 2021 must use only non-emitting controllers, except as provided in Section III.C.4.e.(i).

### sec-7-B-II-B-3-d (7)
- **new** -> pass
  - summary: Starting February 14, 2022, rod packing on any reciprocating compressor at a natural gas processing plant must be replaced every 26,000 hours of operation or every 36 months, unless the compressor is subject to the reciprocating compressor emission control, monitoring, recordkeeping, and reporting requirements of Section I.J.2., 40 CFR Part 60 Subpart OOOO, Subpart OOOOa, Subpart OOOOb, or Part B Section II.I.2. The counting of the 26,000 hours or 36 months begins on February 14, 2022.

### sec-7-B-III-G-2-b (7)
- **new** -> pass
  - summary: Owners or operators of natural gas-driven diaphragm and piston pumps at facilities without electrical power and with fewer than three natural gas-driven pumps must do one of the following starting May 1, 2026: route pump emissions to a process if a vapor recovery unit is on site; if no vapor recovery unit is on site, reduce methane emissions by 95% by routing to a control device; if no vapor recovery unit is on site and no control device can achieve 95% reduction, route emissions to an on-site control device and certify that no vapor recovery unit or 95%-capable control device is on site; or certify that no vapor recovery unit or control device is on site (and if one is later installed, route pump emissions to it within 30 days of its startup). This applies only to pumps not already subject to Section I.K.1.

### sec-7-B-VII-F-1-b-(i) (7)
- **new** -> pass
  - summary: A midstream company's compliance deadline will be extended if the company needs a construction permit or permit modification to comply with Section VII., submitted a complete application at least 12 months before planned construction or modification (but no later than December 31, 2028), and has not received the permit by December 31, 2029.

### sec-7-B-VII-G-2-f (7)
- **new** -> pass
  - summary: Midstream companies must include in their annual report (due June 30 each year starting in 2025) a description of completed projects that identifies the affected midstream fuel combustion equipment by location name and AIRS ID, states whether the equipment is in a disproportionately impacted community or in the FRPA, gives the project completion date(s), and reports the achieved reductions in CO2e and harmful air pollutants.

### sec-7-B-I-E-2-c-(iii) (7)
- **new** -> pass
  - summary: The owner or operator of tanks controlled under Section I.D. that have installed combustion devices may use a surveillance system to keep records on combustion device operation, in addition to complying with Sections I.E.2.c.(i) and I.E.2.c.(ii).

### sec-7-B-III-C-5-b-(vi)-(A)-(1) (7)
- **new** -> corrected
  - summary: By December 1, 2025, owners or operators must determine the total liquids production (total barrels of hydrocarbon liquids plus water produced through the well production facility) for calendar year 2023 for each well production facility identified in the total facility count calculated in Section III.C.5.b.(iii)(A)(2), as reported under Regulation Number 7, Part B, Section V.
  - reason: Parent III.C.5.b.(vi).(A) applies these requirements only to owners or operators of well production facilities outside the 8-hour Ozone Control Area and northern Weld County.

### sec-7-B-II-E-9-g (7)
- **new** -> pass
  - summary: Each annual leak detection and repair report must include a certification by a responsible official stating that, based on information and belief formed after reasonable inquiry, the statements and information in the document are true, accurate, and complete.

### sec-7-B-III-G-1-a (7)
- **new** -> pass
  - summary: This section applies to natural gas-driven diaphragm and piston pumps at well production facilities, natural gas compressor stations upstream of natural gas processing plants, and at natural gas processing plants.

### sec-7-B-II-C-2-b-(i) (7)
- **new** -> pass
  - summary: STEM plans must include the control technologies, monitoring practices, operational practices, and/or other strategies selected; an analysis of the engineering design of the storage tank and air pollution control equipment; procedures for evaluating ongoing storage tank emission capture performance; and monitoring in accordance with approved instrument monitoring methods following the schedule in Section II.C.2.b.(ii).

### sec-7-C-J (7)
- **new** -> corrected
  - summary: This is a statement of basis, statutory authority, and purpose for December 17, 2006 revisions to Sections I.A.1.b. and XVII. of Regulation 7. The Commission adopted state-only provisions to reduce air emissions from oil and gas operations throughout Colorado because emissions from these operations have rapidly increased and are expected to continue increasing. The revisions establish emission control requirements for condensate storage tanks, glycol dehydrators, and natural gas-fired reciprocating internal combustion engines, requiring that condensate tank and dehydrator controls meet a 95% control efficiency. For condensate tanks, applicability is based on emissions during the preceding twelve-month period (or actual emissions multiplied out to twelve months for tanks in service less than twelve months), and for tanks serving newly drilled, recompleted, or restimulated wells, the owner or operator has 90 days to determine anticipated production and install controls if necessary. The engine provisions apply only to engines constructed or relocated into Colorado after the applicability date. The Commission directed the Division to provide an annual update on emission growth trends, environmental impacts, modeling and monitoring efforts, the adequacy of emission controls to protect the NAAQS, and health impacts of emissions from the oil and gas sector.
  - reason: Text says applicability for tanks in service under twelve months is based on uncontrolled actual emissions.

### sec-7-B-II-C-5-a-(iii)-(E) (7)
- **new** -> pass
  - summary: The owner or operator must inspect onsite loading equipment to make sure hoses, couplings, and valves are maintained to prevent dripping, leaking, or other liquid or vapor loss during loadout. These inspections must occur at least monthly, unless loadout happens less often, in which case they must happen as often as loadout occurs.

### sec-7-B-III-C-1-f-(ii) (7)
- **new** -> pass (hedging)
  - summary: For high-bleed pneumatic controllers in the 8-Hour Ozone Control Area that are placed in service on or after February 1, 2009, the owner/operator must submit justification for installing them due to safety and/or process purposes 30 days prior to installation. The text does not say to whom the justification must be submitted.

### sec-oooob-60.5415b-(f)-(1)-(vii)-(A)-(4) (oooob)
- **new** -> corrected
  - summary: Following maintenance or repair, each enclosed combustion device (other than a catalytic vapor incinerator) and each flare must pass a Method 22 visual observation as described in paragraph (f)(1)(vii)(A)(2) or be monitored according to § 60.5417b(h) before returning to operation.
  - reason: Text says 'Following return to operation from maintenance or repair activity'; it does not require the check before returning to operation.

### sec-oooob-60.5401b-(c) (oooob)
- **new** -> corrected
  - summary: You must monitor each pressure relief device in gas or vapor service quarterly using the methods in § 60.5403b; a leak is an instrument reading of 500 ppmv or greater above background. After each pressure release, you must monitor the device within 5 calendar days to detect leaks (same 500 ppmv threshold). At a nonfractionating plant monitored only by non-plant personnel, you may monitor after a pressure release the next time monitoring personnel are onsite or within 30 calendar days, whichever is sooner, but no device may operate more than 30 calendar days after a pressure release without monitoring. Pressure relief devices routed to a process or fuel gas system or equipped with a closed vent system capturing leakage to a control device (as described in paragraph (e)) are exempt from the quarterly and post-release monitoring. Pressure relief devices with a rupture disk are exempt from the post-release monitoring if you install a new rupture disk as soon as practicable but no later than 5 calendar days after each pressure release, except as provided in paragraph (i)(6).
  - reason: (c)(5) requires the new rupture disk to be installed upstream of the pressure relief device.

### sec-oooob-60.5415b-(f)-(1)-(ix)-(D)-(2) (oooob)
- **new** -> pass
  - summary: After 120 to 364 days of operation following the compliance date in § 60.5370b(a), you must calculate the average TOC emission reduction by averaging the reduction over the number of days between the current day and the compliance date. You have demonstrated compliance with the overall 95.0 percent reduction requirement if the average TOC emission reduction is equal to or greater than 95.0 percent.

### sec-oooob-60.5420b-(b)-(4)-(iii) (oooob)
- **new** -> pass
  - summary: For each associated gas well that complies with § 60.5377b(f), the annual report must include identification of wells constructed in specified date ranges (May 7, 2024 to May 7, 2026, and December 6, 2022 to May 7, 2024) with certification of why compliance with § 60.5377b(a)(1), (2), (3), or (4) is infeasible; identification of wells modified or reconstructed during the reporting period that route gas to a control device achieving at least 95.0 percent VOC and methane reduction, with the same infeasibility certification; re-certification of infeasibility for wells from previous reporting periods using such control devices; and the information specified in paragraphs (b)(11)(i) through (iv). The information about wells constructed in the two date ranges is required only in the initial annual report.

### sec-oooob-60.5410b-(e)-(4) (oooob)
- **new** -> pass
  - summary: If you comply with the reciprocating compressor standard by using § 60.5385b(d)(2), you must conduct an initial performance test as required in § 60.5413b within 180 days after initial startup or by May 7, 2024, whichever date is later, or install a control device tested under § 60.5413b(d) that meets the criteria in § 60.5413b(d)(11) and (e). You must also comply with the continuous compliance requirements of § 60.5415b(f).

### sec-oooob-60.5408b-(f) (oooob)
- **new** -> pass
  - summary: Greater sensitivity can be attained if a 500 ml capacity Tutwiler burette is used with a more dilute (0.001N) iodine solution, and concentrations less than 1.0 grains per 100 cubic feet can be determined this way. Usually, the starch-iodine end point is much less distinct, and a blank determination of end point with H₂S-free gas or air is required.

### sec-oooob-60.5412b-(c)-(2)-(iii) (oooob)
- **new** -> pass
  - summary: For each regenerative-type carbon adsorption system, you must measure and record the average carbon bed temperature for the entire steaming cycle and measure the actual carbon bed temperature after regeneration and within 15 minutes of completing the cooling cycle. You must keep the average carbon bed temperature above the temperature limit established under § 60.5413b(c)(2) during the steaming cycle and below the carbon bed temperature established under § 60.5413b(c)(2) after the regeneration cycle.

### sec-oooob-60.5420b-(c)-(6)-(v) (oooob)
- **new** -> pass
  - summary: For each process controller affected facility that complies with § 60.5390b(b)(3), you must maintain two types of records: an identification of each process controller whose emissions are routed to a control device, and the records specified in paragraphs (c)(8) and (10) through (13) of this section. If you comply with an alternative GHG and VOC standard under § 60.5398b, you must provide the information specified in § 60.5424b instead of the information in paragraph (c)(8).

### sec-oooob-60.5410b-(f)-(2) (oooob)
- **new** -> pass
  - summary: For process controller affected facilities at Alaska sites without access to electrical power, you must demonstrate initial compliance with § 60.5390b(b)(1) and (2) or with § 60.5390b(b)(3) instead of complying with § 60.5390b(a). Compliance is shown by meeting the requirements for each process controller as follows: controllers with a bleed rate of 6 scfh or less must maintain records showing they are designed and operated at that rate; controllers with a bleed rate greater than 6 scfh must maintain records showing a higher rate is required based on a specific functional need; intermittent vent controllers must demonstrate they do not emit to the atmosphere during idle periods through initial monitoring; and controllers that reduce methane and VOC emissions by 95.0 percent must achieve that reduction as demonstrated by § 60.5413b, route emissions through a closed vent system to a control device meeting § 60.5412b, conduct an initial performance test within 180 days after startup or by May 7, 2024 (whichever is later) or install a control device tested under § 60.5413b(d) meeting specified criteria, and install and operate continuous parameter monitoring systems according to § 60.5417b(a) through (i).

### sec-oooob-60.5420b-(c)-(6)-(ii)-(B) (oooob)
- **new** -> pass
  - summary: If you are using a self-contained natural gas-driven process controller to comply with § 60.5390b(a), you must keep records identifying each such controller, the dates of each inspection required under § 60.5416b(b), and each defect or leak found during those inspections along with the repair date or anticipated repair date if repair is delayed.

### sec-oooob-60.5365b-(i) (oooob)
- **new** -> corrected
  - summary: You are subject to this subpart if you own or operate a fugitive emissions components affected facility, which is the collection of fugitive emissions components at a well site, centralized production facility, or compressor station. For purposes of the fugitive emissions monitoring requirements in §§ 60.5397b and 60.5398b, a modification to a well site occurs when a new well is drilled at an existing well site, a well at an existing well site is hydraulically fractured, or a well at an existing well site is hydraulically refractured. A modification to a centralized production facility occurs when any of those well-site actions occur at an existing centralized production facility, when a well sending production to an existing centralized production facility is modified in one of those ways, or when a well site subject to §§ 60.5397b or 60.5398b removes all major production and processing equipment so that it becomes a wellhead only well site and sends production to an existing centralized production facility. A modification to a compressor station occurs when an additional compressor is installed at a compressor station or when one or more compressors at a compressor station is replaced by one or more compressors of greater total horsepower than the compressor(s) being replaced; when one or more compressors is replaced by one or more compressors of equal or smaller total horsepower than the compressor(s) being replaced, installation of the replacement compressor(s) does not trigger a modification of the compressor station for purposes of §§ 60.5397b and 60.5398b.
  - reason: The text does not call §§ 60.5397b and 60.5398b the fugitive emissions monitoring requirements.

### sec-oooob-60.5397b-(l)-(3) (oooob)
- **new** -> pass
  - summary: After finishing all well closure activities in the closure plan, you must survey the well site with optical gas imaging (OGI), including each closed well. If the OGI instrument images any emissions, you must eliminate those emissions and resurvey the source, repeating elimination steps and resurveys until the OGI images no emissions. You must update the well closure plan to include the OGI survey video showing closure of all wells at the site.

### sec-oooob-60.5406b-(b)-(1) (oooob)
- **new** -> pass
  - summary: The average sulfur feed rate (X) must be calculated using a formula that is not shown in the available text. The text defines the variables: X is the average sulfur feed rate in Mg/D or LT/D, Qa is the average volumetric flow rate of acid gas from the sweetening unit in dscm/day or dscf/day, Y is the average H₂S concentration in the acid gas feed from the sweetening unit as a decimal, and K is a conversion constant (1.331 × 10⁻³ Mg/dscm for metric units or 3.707 × 10⁻⁵ long ton/dscf for English units).

### sec-oooob-60.5376b-(d) (oooob)
- **new** -> pass
  - summary: You must demonstrate initial compliance with the standards for well liquids unloading operations at your well affected facilities by complying with § 60.5410b(b).

### sec-oooob-60.5420b-(b)-(9)-(iii)-(B) (oooob)
- **new** -> pass
  - summary: For a fugitive emissions components affected facility complying with an alternative fugitive emissions standard under § 60.5399b, you must submit the site-specific reports required by that specific alternative standard in the same format you submitted them to the state, local, or Tribal authority. If the report is a hard copy, you must scan it and submit it as an electronic attachment to the annual report.

### sec-oooob-60.5398b-(c)-(5)-(ii) (oooob)
- **new** -> pass
  - summary: Before establishing a baseline for continuous monitoring, you must verify that all control devices (such as flares) on affected sources are operating in compliance with § 60.5415b and § 60.5417b, and that all other methane emission sources at the site (such as reciprocating engines) are operating consistent with any applicable regulations. All control devices and these other sources must be in compliance with applicable regulations before beginning the period in paragraph (b)(5)(iii).

### sec-oooob-60.5417b-(d)-(8)-(ii)-(D) (oooob)
- **new** -> pass
  - summary: You must use a grab sampling system that can collect an evacuated canister sample at least once every eight hours for compositional analysis. The samples must be analyzed according to ASTM D1945-14 (R2019) or GPA 2261-19. To determine the net heating value (NHV) of the vent gas, multiply the volume fraction of each component by that component's net heating value, then add up the products for all components; use any published net heating value per mole at 25 °C and 1 atmosphere, and use 20 °C as the standard temperature for determining the volume corresponding to one mole of vent gas.

### sec-oooob-60.5377b-(g)-(2) (oooob)
- **new** -> pass
  - summary: The demonstration of technical infeasibility must be certified by a professional engineer or another qualified individual with expertise in the uses of associated gas. The certification must be signed and dated and must state: "I certify that the assessment of technical and safety infeasibility was prepared under my direction or supervision. I further certify that the assessment was conducted, and this report was prepared pursuant to the requirements of § 60.5377b(b). Based on my professional knowledge and experience, and inquiry of personnel involved in the assessment, the certification submitted herein is true, accurate, and complete."

### sec-ecmc-417 (ecmc)
- **new** -> corrected (cut off)
  - summary: Rule 417 defines a mechanical integrity test as a test to determine if there is a significant leak in a well's casing, tubing, or mechanical isolation device, or if there is significant fluid movement through vertical channels to other formations.

**Injection Wells:** All injection wells must pass a mechanical integrity test before fluids can be injected, and the Director must approve the Form 21 (oral approval may be granted for continuous injection after a successful test). The test includes one method to check for leaks in casing, tubing, or mechanical isolation devices (such as isolating the tubing-casing annulus with a packer set at 100 feet or less above the highest open injection zone perforation and pressure testing at not less than 300 psi or the average injection pressure, whichever is greater) and one method to check for fluid movement in vertical channels (such as cementing records for wells existing before July 1, 1986, tracer surveys, cement bond logs, or temperature surveys). After the initial test, Class II UIC wells must be tested at least once every 5 years; simultaneous injection wells require no additional tests after the initial test; and all injection wells must be retested after any casing repairs, resetting of tubing or mechanical isolation device, or whenever the tubing or device is moved during workover operations. All injection well mechanical integrity tests must be witnessed by the Director.

**Shut-in Wells:** All shut-in wells must pass a mechanical integrity test within 2 years of the initial shut-in date, then every 5 years thereafter as long as the well remains shut-in. The test is performed after isolating the wellbore with a bridge plug or similar device set 100 feet or less above the highest open perforation, with a pressure test using liquid or gas at not less than 300 psi surface pressure. At least 48 hours before returning an inactive shut-in well to production or injection, the operator must submit a Form 42 – Notice of Return to Service to the Director.

**Temporarily Abandoned Wells:** All temporarily abandoned wells must pass a mechanical integrity test within 30 days of temporary abandonment, then every 5 years thereafter as long as the well remains temporarily abandoned. The test is performed after isolating the wellbore with a bridge plug or similar device set 100 feet or less above the highest open perforation, with a pressure test using liquid or gas at not less than 300 psi surface pressure. At least 48 hours before returning an inactive temporarily abandoned well to production or injection, the operator must submit a Form 42 – Notice of Return to Service to the Director.

**Suspended Operations and Waiting on Completion Wells:** Suspended operations wells must be tested within 2 years of setting any casing string and suspending operations prior to reaching permitted total depth; waiting on completion wells must be tested within 2 years of setting production casing. Subsequently, both types must be tested every 5 years from the date of the initial test as long as the well remains in that status. The test verifies integrity of the casing string being tested, with a pressure test using liquid or gas at not less than 300 psi surface pressure.

**General Requirements:**
  - reason: Rule 417.a and 417.a.(3): the pre-injection test and Form 21 approval apply to new injection wells.
  - reason: The heading was empty; Rules 417.e, 417.f and 417.g state the notice, repair/plugging and pressure criteria.
  - reason: stray Markdown markers removed

### sec-ecmc-903-e-(1)-B-iv (ecmc)
- **new** -> pass
  - summary: For a wildcat (exploratory) well or if the operator anticipates conducting a production evaluation or productivity test, the gas capture plan must include a description of the planned production evaluation or productivity test and any issues related to the operator's ability to connect to a gas gathering line.

### sec-ecmc-614-e (ecmc)
- **new** -> pass
  - summary: An operator of a coalbed methane (CBM) well must comply with Rule 419 bradenhead testing requirements, except as modified here. The bradenhead testing requirement does not apply if the operator demonstrates to the Director's satisfaction annular cement coverage greater than 50 feet above the base of surface casing and zonal isolation is confirmed by reliable evidence such as a cement bond log or cementing ticket indicating that the height of cement coverage is 50 feet above the base of the surface casing, and zonal isolation is confirmed by two consecutive bradenhead tests conducted at least 12 months apart. Before beginning a bradenhead test, the operator must shut in the bradenhead annulus for a minimum of 7 days. The appropriate regulatory agency will determine remedial requirements.

### sec-ecmc-1415-a-(5)-B (ecmc)
- **new** -> corrected
  - summary: The Geologic Storage Operator must submit updated information about its financial responsibility instrument(s) every year and whenever there are changes; the Director must then evaluate the demonstration within a reasonable time to confirm the instrument(s) remain adequate. The operator must keep meeting the financial responsibility requirements even while the Director's review is ongoing.
  - reason: Text ties the changes to the Director's evaluation, not to an extra submission duty for the operator.

### sec-ecmc-1312-i (ecmc)
- **new** -> pass
  - summary: When an operator wants to inject any fluid other than geothermal fluids, fresh water, or recycled water under Rule 1312.h.(3), the operator must comply with Rule 803.g.(5).C. and D.

### sec-ecmc-303-a (ecmc)
- **new** -> corrected
  - summary: Before starting operations at an oil and gas location that meets Rule 304.a criteria, an operator must have an approved Oil and Gas Development Plan and submit an application to the Commission that includes a hearing request (Rule 503.g.(1)), a Form 2A for each proposed location (Rule 304), the full filing fee (Rule 301.d), a Form 2B Cumulative Impacts Data Identification (Rule 315.a) unless the Commission granted preliminary siting approval in a Comprehensive Area Plan (Rule 314.e.(11)), and a Form 2C certification that all components have been submitted. If the plan includes lands to be spaced, the application must also include a drilling and spacing unit application and hearing request (Rules 305 & 503.g.(2)), and for at least one portion of a mineral tract the applicant must provide documentation showing its status as an Owner (Rule 305.a.(2).L). The Director may request any other relevant information necessary to determine whether the proposed operation meets the Commission's rules and protects and minimizes adverse impacts to public health, safety, welfare, the environment, and wildlife resources, and will provide the reason in writing. When an operator is concurrently seeking a permit from a federal agency or Relevant Local Government for locations within the plan, the operator may engage the Director in that process and must notify the Director on the Form 2A, identify any potential conflicts between agency standards, and promptly notify the Director in writing of subsequent milestones including document submissions, on-site inspections, public comment deadlines, hearings and public meetings, or issuance of final decisions; if a permit has already been obtained, the operator must submit the final decision documents as an attachment to the Form 2A. If the Director determines that the number of proposed locations, geographic scope, or high number of adjacent or nearby Oil and Gas Development Plans submitted by the same operator would be more appropriately considered as a CAP, the Director may request a meeting to evaluate whether the plan(s) should be re-submitted as a CAP application pursuant to Rule 314.
  - reason: Rule 303.a.(6).A makes the notice, conflict and milestone duties conditional on a request for the Director's engagement.

### sec-ecmc-811-b-(9) (ecmc)
- **new** -> pass
  - summary: Under Rule 811, a hearing application for a new enhanced recovery injection project must include a Unit Area Well Plat showing the boundary of the unit area and the Class II UIC well(s), all offset injection wells, production wells, plugged and abandoned wells, and dry and abandoned wells.

### sec-ecmc-204 (ecmc)
- **new** -> pass
  - summary: The Director has the right at all reasonable times to go onto and inspect any Oil and Gas Location, Oil and Gas Facility, disposal facility, or transporter facility, and any associated records, to investigate or test for compliance with the Act, the Commission's Rules, or any special Field rules. Any findings of a Commission Rule violation will be reported to the Commission.

### sec-ecmc-201-c (ecmc)
- **new** -> pass
  - summary: Nothing in the Commission's rules limits the legal authority that state law gives to local governments under §§ 29-20-104, 30-15-401, C.R.S., or any other statute. Local government regulations may be more protective or stricter than state requirements.

### sec-ecmc-603-o-(2) (ecmc)
- **new** -> pass
  - summary: Operators must build secondary containment out of steel or another engineered material that is designed and installed to prevent leaks and resist damage from erosion or routine operation.

### sec-ecmc-1420-d-(2) (ecmc)
- **new** -> pass
  - summary: The geologic storage operator must set the monitoring frequency and where monitoring wells are placed based on the baseline geochemical data collected under Rule 1407.b.(6) and on any modeling results from the Geologic Storage Area of Review evaluation required by Rule 1414.c.

### sec-ecmc-1407-b-(5) (ecmc)
- **new** -> pass
  - summary: Before a permit is issued for a new Class VI UIC well or for converting an existing Class I, II, or V well to Class VI, the Geologic Storage Operator must submit maps and stratigraphic cross sections showing the general vertical and lateral limits of all underground sources of drinking water (USDWs), water wells and springs within the Geologic Storage Area of Review, their positions relative to the injection zone(s), and the direction of water movement where known.

### sec-ecmc-903-c-(3)-B-i (ecmc)
- **new** -> corrected
  - summary: On Form 4 the operator must explain why flaring is necessary to complete the well and how it will protect and minimize adverse impacts to public health, safety, welfare, the environment, and wildlife resources.
  - reason: Text makes protecting and minimizing impacts a separate duty of the Operator, not part of what the Form 4 must explain.

### sec-ecmc-517-a (ecmc)
- **new** -> pass
  - summary: The Colorado Rules of Civil Procedure apply to Commission proceedings unless they conflict with the Commission's own rules or the Act, or unless the Administrative Law Judge or Hearing Officer directs otherwise on the record during prehearing proceedings or by written order.

### sec-ecmc-1304-h-(1)-B (ecmc)
- **new** -> pass
  - summary: The Director may request consultation with the State Land Board (SLB) about any deep geothermal permit application if the Director reasonably believes the consultation would help the Director understand potential impacts to any surface estate, mineral estate, geothermal resources, pore space, or water rights owned or managed by SLB.

### sec-ecmc-904-a (ecmc)
- **new** -> corrected
  - summary: The Director must report to the Commission by January 15, 2022, and then annually by May 15, after consulting with CDPHE, Colorado Parks and Wildlife (CPW), and the Department of Natural Resources. The report covers data from the Cumulative Impacts Data Evaluation Repository (CIDER) on impacts to Wildlife Resources and High Priority Habitat, water volume comparisons, reclamation activity (wells plugged, final and interim reclamation), greenhouse gas reduction initiatives and the role of oil and gas operations, emissions inventories and intensity targets from approved plans and forms, ambient air quality trends and oil and gas contributions, innovative technologies used by operators to reduce emissions or mitigate Cumulative Impacts, relevant reports from other agencies or research institutions, and any recommendations for future rulemakings or studies to address Cumulative Impacts.
  - reason: 904.a.(1).A says 'including but not limited to' wildlife data.
  - reason: 904.a.(5) covers evolving or new technologies or measures, including operator-employed ones.
  - reason: 904.a.(8) lists guidance and work groups too.

### sec-ecmc-419-d-(2) (ecmc)
- **new** -> pass
  - summary: The Director may impose a remediation plan if a deficiency exists, and if the Director does impose one, the Operator must implement the approved remediation plan or pressure management plan and report results within 30 days or as required by the approved plan.

### sec-ecmc-1423-c-(1)-I (ecmc)
- **new** -> pass
  - summary: A demonstration of an alternative Post-Injection Site Care timeframe must include a description of the well construction and an assessment of the quality of plugs of all Abandoned Wells within the Geologic Storage Area of Review.
