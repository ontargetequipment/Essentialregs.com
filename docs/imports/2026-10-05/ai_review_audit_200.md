# Audit of approved summaries, 5 Oct 2026 (read-only)

The automated reviewer (`pipeline/review.py --audit 200 --seed 20261005`, claude-sonnet-5-5, effort low, prompt version 4c41cd5622, the same prompt and validation as the review pass) was run over a seeded random sample of 200 summaries that are already approved and whose `reviewed_by` does not contain "automated pipeline" (the hand second passes of Sept 2026), spread across 57 regulations. **Nothing was written to the database**; these rows are unchanged. Workflow run: https://github.com/ontargetequipment/Essentialregs.com/actions/runs/37251684243 (cost $0.7226).

| verdict | rows |
|---|---:|
| pass (no error found) | 117 |
| would correct | 82 |
| fail (could not verify or fix) | 1 (`sec-3-A-VIII-D-2-a`: Markdown-only correction changed more than the markers) |

Below: every row the reviewer would correct, with the current (live) summary and the reviewer's reasons; the text it would write is included for reference. The owner decides what to do with these.

## 1. `sec-ooooa-60.5415a-(f)`

**Current summary (live, unchanged):**

If you operate affected facilities at an onshore natural gas processing plant, you demonstrate continuous compliance with the methane and VOC requirements by complying with § 60.5400a. This cross-references the specific standards you must meet to stay in compliance.

**Reviewer's reasons:**

- The text only ties continuous compliance to complying with § 60.5400a and says nothing about what that section contains. ("This cross-references the specific standards you must meet to stay in compliance." -> "")

**Reviewer would write (not applied):**

If you operate affected facilities at an onshore natural gas processing plant, you demonstrate continuous compliance with the methane and VOC requirements by complying with § 60.5400a.

## 2. `sec-gp12-IX-E-1-b-(i)`

**Current summary (live, unchanged):**

When you permanently replace an existing registered engine with a like-kind engine, you cannot change the configuration in ways that would affect dispersion modeling – specifically, you must keep the same stack height, stack location, and exit velocity.

**Reviewer's reasons:**

- Text says 'includes but is not limited to' stack heights, stack locations, or exit velocity, so the list is not exhaustive. ("specifically, you must keep the same stack height, stack location, and exit velocity." -> "this includes but is not limited to changes to stack height, stack location, and exit velocity.")
- Text says changes that 'might impact a dispersion analysis'. ("would affect dispersion modeling" -> "might affect dispersion modeling")

**Reviewer would write (not applied):**

When you permanently replace an existing registered engine with a like-kind engine, you cannot change the configuration in ways that might affect dispersion modeling – this includes but is not limited to changes to stack height, stack location, and exit velocity.

## 3. `sec-4-C-APPENDIX-A-5.5.6`

**Current summary (live, unchanged):**

When building the test fuel crib for a masonry heater emissions test, you must space the wood pieces 0.625 inch (16 mm) apart vertically and horizontally by nailing small spacer blocks to alternating sides of each piece using finishing brads; the spacers are positioned at specific distances from the ends and edges of each fuel piece according to a formula (X = 0.15 × F pl, where F pl is defined elsewhere), and no spacers go on the outermost faces of the crib. Maximum spacing between any fuel pieces cannot exceed 0.625 inches.

**Reviewer's reasons:**

- The text does not say F pl is defined elsewhere; it gives the formula only. ("(X = 0.15 × F pl, where F pl is defined elsewhere)" -> "(X = 0.15 × F pl)")

**Reviewer would write (not applied):**

When building the test fuel crib for a masonry heater emissions test, you must space the wood pieces 0.625 inch (16 mm) apart vertically and horizontally by nailing small spacer blocks to alternating sides of each piece using finishing brads; the spacers are positioned at specific distances from the ends and edges of each fuel piece according to a formula (X = 0.15 × F pl), and no spacers go on the outermost faces of the crib. Maximum spacing between any fuel pieces cannot exceed 0.625 inches.

## 4. `sec-gp12-VI-G-6-c`

**Current summary (live, unchanged):**

The permit requires minor sources and synthetic minor sources whose facility-wide permitted NOx or CO emissions are below the thresholds in Table 4 to test each diesel-fired engine semi-annually using a portable analyzer. After two consecutive passing semi-annual tests, the operator may switch to annual testing. The thresholds vary by area classification: 80 tpy NOx and 80 tpy CO in attainment areas; 80 tpy NOx in marginal/moderate nonattainment; 40 tpy NOx in serious nonattainment; 15 tpy NOx in severe nonattainment; and 0 tpy NOx (meaning all sources must test) in extreme ozone nonattainment, with CO monitoring not applicable in any nonattainment area.

**Reviewer's reasons:**

- Table 4 gives no unit (tpy) and does not say what zero means for which sources must test. ("80 tpy NOx and 80 tpy CO in attainment areas; 80 tpy NOx in marginal/moderate nonattainment; 40 tpy NOx in serious nonattainment; 15 tpy NOx in severe nonattainment; and 0 tpy NOx (meaning all sources must test) in extreme ozone nonattainment" -> "80 for NOx and 80 for CO in attainment areas; 80 for NOx in marginal/moderate nonattainment; 40 for NOx in serious nonattainment; 15 for NOx in severe nonattainment; and zero for NOx in extreme ozone nonattainment")

**Reviewer would write (not applied):**

The permit requires minor sources and synthetic minor sources whose facility-wide permitted NOx or CO emissions are below the thresholds in Table 4 to test each diesel-fired engine semi-annually using a portable analyzer. After two consecutive passing semi-annual tests, the operator may switch to annual testing. The thresholds vary by area classification: 80 for NOx and 80 for CO in attainment areas; 80 for NOx in marginal/moderate nonattainment; 40 for NOx in serious nonattainment; 15 for NOx in severe nonattainment; and zero for NOx in extreme ozone nonattainment, with CO monitoring not applicable in any nonattainment area.

## 5. `sec-2-A-I-C-1`

**Current summary (live, unchanged):**

If you are a manufacturing process and someone claims you violated the general odor standards in Sections I.A. and I.B., you have an affirmative defense if you can show you are using the best practical treatment, maintenance, and control currently available to keep odorous gas emissions as low as possible. When deciding whether you've met that standard, you don't have to consider any control method that would amount to an arbitrary and unreasonable taking of property or would effectively force you to close your lawful business or activity if doing so would provide no corresponding public benefit.

**Reviewer's reasons:**

- The text names the sections but does not call them the general odor standards. ("the general odor standards in Sections I.A. and I.B." -> "Sections I.A. and I.B., Part A, of this Regulation Number 2")

**Reviewer would write (not applied):**

If you are a manufacturing process and someone claims you violated Sections I.A. and I.B., Part A, of this Regulation Number 2, you have an affirmative defense if you can show you are using the best practical treatment, maintenance, and control currently available to keep odorous gas emissions as low as possible. When deciding whether you've met that standard, you don't have to consider any control method that would amount to an arbitrary and unreasonable taking of property or would effectively force you to close your lawful business or activity if doing so would provide no corresponding public benefit.

## 6. `sec-26-A-I-C`

**Current summary (live, unchanged):**

New sources must use controls that represent Reasonably Available Control Technology (RACT) from the day they start operating, following the requirements in Regulation Numbers 3, 7, 24, 25, and 26.

**Reviewer's reasons:**

- The text uses only the abbreviation RACT and does not expand it. ("Reasonably Available Control Technology (RACT)" -> "RACT")
- The text cites Regulation Number 3 only at Part B, Section III.D., and refers to applicable provisions. ("following the requirements in Regulation Numbers 3, 7, 24, 25, and 26" -> "following the applicable provisions in Regulation Numbers 7, 24, 25, and 26, and Regulation Number 3, Part B, Section III.D.")

**Reviewer would write (not applied):**

New sources must use controls that represent RACT from the day they start operating, following the applicable provisions in Regulation Numbers 7, 24, 25, and 26, and Regulation Number 3, Part B, Section III.D.

## 7. `sec-iiii-60.4213-(a)`

**Current summary (live, unchanged):**

If you own or operate a stationary compression-ignition internal combustion engine (CI ICE) with a displacement of 30 liters per cylinder or larger, you must conduct each performance test following the requirements in § 60.8 and the specific conditions listed in Table 7 of this subpart. The test must be run at a load between 90 and 100 percent of peak load, or at the highest load the engine can achieve if 100 percent peak is not possible.

**Reviewer's reasons:**

- Text says 'within 10 percent of 100 percent peak (or the highest achievable) load', not a 90-100 percent range. ("The test must be run at a load between 90 and 100 percent of peak load, or at the highest load the engine can achieve if 100 percent peak is not possible." -> "The test must be conducted within 10 percent of 100 percent peak load (or the highest achievable load).")

**Reviewer would write (not applied):**

If you own or operate a stationary compression-ignition internal combustion engine (CI ICE) with a displacement of 30 liters per cylinder or larger, you must conduct each performance test following the requirements in § 60.8 and the specific conditions listed in Table 7 of this subpart. The test must be conducted within 10 percent of 100 percent peak load (or the highest achievable load).

## 8. `sec-9-II-W`

**Current summary (live, unchanged):**

"Unplanned ignition fire" means a prescribed fire started by natural causes (like lightning) or by military munitions, including wildland fires used for resource benefits and wildland fires ignited by military munitions.

**Reviewer's reasons:**

- The text says "natural phenomena" and gives no lightning example. ("started by natural causes (like lightning)" -> "started by natural phenomena")

**Reviewer would write (not applied):**

"Unplanned ignition fire" means a prescribed fire started by natural phenomena or by military munitions, including wildland fires used for resource benefits and wildland fires ignited by military munitions.

## 9. `sec-aqs-III-M`

**Current summary (live, unchanged):**

This is a heading for a map (not reproduced in the available text) showing the boundary of the Denver Metro Area/North Front Range 8-Hour Ozone Nonattainment Area under the 2008 Ozone NAAQS. The classification, effective date, and specific boundary description are not provided in this row.

**Reviewer's reasons:**

- Text only gives a title for an unreproduced map and does not say it shows a boundary; it also uses the full standard name, not the NAAQS abbreviation. ("showing the boundary of the Denver Metro Area/North Front Range 8-Hour Ozone Nonattainment Area under the 2008 Ozone NAAQS" -> "for the Denver Metro Area/North Front Range 8-Hour Ozone Nonattainment Area under the 2008 Ozone National Ambient Air Quality Standard")

**Reviewer would write (not applied):**

This is a heading for a map (not reproduced in the available text) for the Denver Metro Area/North Front Range 8-Hour Ozone Nonattainment Area under the 2008 Ozone National Ambient Air Quality Standard. The classification, effective date, and specific boundary description are not provided in this row.

## 10. `sec-ecmc-309-e-(1)-D`

**Current summary (live, unchanged):**

This is one factor CPW and the Director consider during consultation: whether the proposed oil and gas operations use technology and best management practices that protect wildlife resources, such as seasonal construction and drilling limits, noise limits, remote operations, equipment disinfection, and using pipelines and large tanks to reduce truck traffic.

**Reviewer's reasons:**

- Text frames the purpose as giving the Director information and says 'the extent to which', not whether. ("This is one factor CPW and the Director consider during consultation: whether the proposed oil and gas operations use" -> "This is one factor addressed in consultation with CPW, which provides the Director information for the Director's determinations: the extent to which the proposed oil and gas operations use")
- Text says 'including but not limited to'. ("such as seasonal construction and drilling limits" -> "including but not limited to seasonal construction and drilling limits")
- Text says traffic volumes, not truck traffic, and includes 'or other measures'. ("and using pipelines and large tanks to reduce truck traffic." -> "and transporting and storing liquids through pipelines and large tanks or other measures to reduce traffic volumes.")

**Reviewer would write (not applied):**

This is one factor addressed in consultation with CPW, which provides the Director information for the Director's determinations: the extent to which the proposed oil and gas operations use technology and best management practices that protect wildlife resources, including but not limited to seasonal construction and drilling limits, noise limits, remote operations, equipment disinfection, and transporting and storing liquids through pipelines and large tanks or other measures to reduce traffic volumes.

## 11. `sec-ooooc-60.5417c-(d)-(5)-(ii)`

**Current summary (live, unchanged):**

If you operate a control device with a carbon bed (such as a carbon adsorber), your continuous parameter monitoring system must measure and record the average temperature during the entire steaming cycle and must measure the actual temperature after regeneration within 15 minutes of finishing the cooling cycle. The temperature monitoring device must be accurate to within ±1 percent of the measured temperature in degrees Celsius, or ±2.5 °C, whichever is greater.

**Reviewer's reasons:**

- Parent paragraph (d)(5) limits this to a regenerative-type carbon adsorption system; broader scope is not in the text. ("If you operate a control device with a carbon bed (such as a carbon adsorber)" -> "If you operate a regenerative-type carbon adsorption system")

**Reviewer would write (not applied):**

If you operate a regenerative-type carbon adsorption system, your continuous parameter monitoring system must measure and record the average temperature during the entire steaming cycle and must measure the actual temperature after regeneration within 15 minutes of finishing the cooling cycle. The temperature monitoring device must be accurate to within ±1 percent of the measured temperature in degrees Celsius, or ±2.5 °C, whichever is greater.

## 12. `sec-3-B-III-I-7`

**Current summary (live, unchanged):**

If you want your facility to operate under a general construction permit, you must submit your application during the time window announced in the statewide public notice for that permit. All general construction permits go through a statewide public-notice process before sources can apply for coverage under them.

**Reviewer's reasons:**

- The text states no sequencing: it says only that permits undergo statewide public notice and that sources must apply within the period specified in the notice. ("All general construction permits go through a statewide public-notice process before sources can apply for coverage under them." -> "All general construction permits go through a statewide public-notice process.")

**Reviewer would write (not applied):**

If you want your facility to operate under a general construction permit, you must submit your application during the time window announced in the statewide public notice for that permit. All general construction permits go through a statewide public-notice process.

## 13. `sec-p191-191.23-(a)-(9)`

**Current summary (live, unchanged):**

Each operator must report any safety-related condition that could lead to an imminent hazard and that causes – either directly or because the operator took remedial action – a 20% or more reduction in operating pressure or a shutdown of a pipeline, underground natural gas storage facility (UNGSF), or LNG facility (for reasons other than abandonment). This applies to facilities in service that contain or process gas or LNG.

**Reviewer's reasons:**

- The text only abbreviates UNGSF and never expands it. ("underground natural gas storage facility (UNGSF)" -> "UNGSF")

**Reviewer would write (not applied):**

Each operator must report any safety-related condition that could lead to an imminent hazard and that causes – either directly or because the operator took remedial action – a 20% or more reduction in operating pressure or a shutdown of a pipeline, UNGSF, or LNG facility (for reasons other than abandonment). This applies to facilities in service that contain or process gas or LNG.

## 14. `sec-26-B-IV-A-6`

**Current summary (live, unchanged):**

Breweries in the 8-hour ozone control area that use land application of wastewater to destroy VOCs through microbial and vegetative processes must apply the wastewater only to areas covered with vegetation. The only exception is when vegetation is temporarily absent due to tilling, seeding, crop rotation, or field work that follows standard agricultural practices.

**Reviewer's reasons:**

- Text excepts only what is required following tilling and seeding for crop rotation and field work per standard agricultural practices; 'temporarily absent' is not in the text. ("The only exception is when vegetation is temporarily absent due to tilling, seeding, crop rotation, or field work that follows standard agricultural practices." -> "The only exception is as required following tilling and seeding for crop rotation and field work per standard agricultural practices.")
- Text requires vegetation cover at all times when wastewater is applied. ("only to areas covered with vegetation." -> "only to areas covered with vegetation at all times when wastewater is applied.")

**Reviewer would write (not applied):**

Breweries in the 8-hour ozone control area that use land application of wastewater to destroy VOCs through microbial and vegetative processes must apply the wastewater only to areas covered with vegetation at all times when wastewater is applied. The only exception is as required following tilling and seeding for crop rotation and field work per standard agricultural practices.

## 15. `sec-gp03-IV-B-1`

**Current summary (live, unchanged):**

The permit requires that a complete registration request (including the APEN fee, general permit registration fee, and an impact analysis showing the project will not violate any state or national ambient air quality standard) be submitted to the Division. Conditional certification is effective the date the Division receives the complete registration, and the owner or operator may begin construction and operation immediately upon submission. If the project later turns out not to qualify for the general permit or is shown to violate an ambient air quality standard, the owner or operator accepts liability for having started those activities.

**Reviewer's reasons:**

- Text allows commencement 'as represented in the registration' upon submission and does not say 'immediately'. ("may begin construction and operation immediately upon submission" -> "may begin construction and operation of the project as represented in the registration upon submission")

**Reviewer would write (not applied):**

The permit requires that a complete registration request (including the APEN fee, general permit registration fee, and an impact analysis showing the project will not violate any state or national ambient air quality standard) be submitted to the Division. Conditional certification is effective the date the Division receives the complete registration, and the owner or operator may begin construction and operation of the project as represented in the registration upon submission. If the project later turns out not to qualify for the general permit or is shown to violate an ambient air quality standard, the owner or operator accepts liability for having started those activities.

## 16. `sec-p195-195.402-(e)-(6)`

**Current summary (live, unchanged):**

Applies to pipeline operators. The emergency procedures manual must include steps to minimize public exposure to injury and the chance of accidental ignition by helping evacuate residents, stopping traffic on roads and railroads in the affected area, or taking other appropriate action when an emergency occurs.

**Reviewer's reasons:**

- The text does not name pipeline operators; it only requires the manual to include these procedures. ("Applies to pipeline operators." -> "")
- The text says "assisting with halting traffic". ("stopping traffic on roads and railroads" -> "helping halt traffic on roads and railroads")

**Reviewer would write (not applied):**

The emergency procedures manual must include steps to minimize public exposure to injury and the chance of accidental ignition by helping evacuate residents, helping halt traffic on roads and railroads in the affected area, or taking other appropriate action when an emergency occurs.

## 17. `sec-27-D-IV-F`

**Current summary (live, unchanged):**

When you submit a bid to buy GHG credits in the auction, that bid is a binding commitment to purchase if accepted under the auction rules. When you submit an offer to sell GHG credits in the auction, that offer is a binding commitment to sell if accepted, and by offering credits for sale you are warranting that the credits were generated based on accurate GHG emissions reporting for the relevant year.

**Reviewer's reasons:**

- Text has no 'if accepted' condition; bids are considered binding under the auction rules. ("that bid is a binding commitment to purchase if accepted under the auction rules" -> "that bid is considered a binding commitment to purchase under the auction rules")
- Text has no 'if accepted' condition; offers are considered binding under the auction rules. ("that offer is a binding commitment to sell if accepted" -> "that offer is considered a binding commitment to sell under the auction rules")

**Reviewer would write (not applied):**

When you submit a bid to buy GHG credits in the auction, that bid is considered a binding commitment to purchase under the auction rules. When you submit an offer to sell GHG credits in the auction, that offer is considered a binding commitment to sell under the auction rules, and by offering credits for sale you are warranting and representing that the credits were generated based on accurate reporting of GHG emissions for the relevant year.

## 18. `sec-20-B-IV-B-1`

**Current summary (live, unchanged):**

For 2022 through 2025 model years, each manufacturer must report to CDPHE its fleet average non-methane organic gas plus oxides of nitrogen (NMOG+NOx) and greenhouse gas emissions for vehicles delivered for sale in Colorado, using the same format used for CARB. If the manufacturer chooses the pooling option in 13 CCR 1961.2 or the fleet-average CO₂ calculation option in 13 CCR 1961.3(5)(D), it must report data for the entire pool as well as the Colorado-specific portion. NMOG+NOx reports are due by March 1 of the calendar year after the model year ends; CO₂ reports are due by May 1 of the calendar year after the model year ends.

**Reviewer's reasons:**

- The text says "the Department" and does not expand it as CDPHE. ("report to CDPHE" -> "report to the Department")
- The text names "option number two" for both provisions. ("chooses the pooling option in 13 CCR 1961.2 or the fleet-average CO₂ calculation option in 13 CCR 1961.3(5)(D)" -> "chooses option number two of the Pooling Provision in 13 CCR 1961.2 or option number two of the Calculation of Fleet Average Carbon Dioxide Value in 13 CCR 1961.3(5)(D)")

**Reviewer would write (not applied):**

For 2022 through 2025 model years, each manufacturer must report to the Department its fleet average non-methane organic gas plus oxides of nitrogen (NMOG+NOx) and greenhouse gas emissions for vehicles delivered for sale in Colorado, using the same format used for CARB. If the manufacturer chooses option number two of the Pooling Provision in 13 CCR 1961.2 or option number two of the Calculation of Fleet Average Carbon Dioxide Value in 13 CCR 1961.3(5)(D), it must report data for the entire pool as well as the Colorado-specific portion. NMOG+NOx reports are due by March 1 of the calendar year after the model year ends; CO₂ reports are due by May 1 of the calendar year after the model year ends.

## 19. `sec-gp02-XI-C-10`

**Current summary (live, unchanged):**

The permit requires that all GP02 terms and conditions applying to your equipment be treated as Applicable Requirements if you later obtain a different permit for the same engine(s). This means future permits must account for and incorporate the obligations you accepted under GP02.

**Reviewer's reasons:**

- Text says only that the terms are considered Applicable Requirements for any future permit; it does not say future permits must incorporate the obligations. ("if you later obtain a different permit for the same engine(s). This means future permits must account for and incorporate the obligations you accepted under GP02." -> "for the purposes of any future permit issued for the engine(s).")

**Reviewer would write (not applied):**

The permit requires that all GP02 terms and conditions applying to your equipment be treated as Applicable Requirements for the purposes of any future permit issued for the engine(s).

## 20. `sec-oooob-60.5422b-(c)-(1)-(iii)`

**Current summary (live, unchanged):**

When you submit a report for process unit equipment, a certifying official must sign a statement certifying that the information in the report is true, accurate, and complete based on reasonable inquiry. If you submit the report through CEDRI (the EPA's electronic reporting system), your electronic signature during that submission counts as this certification and you don't need a separate signed statement.

**Reviewer's reasons:**

- The text only abbreviates CEDRI and does not expand it. ("CEDRI (the EPA's electronic reporting system)" -> "CEDRI")
- The text refers to the certifier's electronic signature replacing the requirement. ("your electronic signature during that submission" -> "the certifier's electronic signature during that submission")

**Reviewer would write (not applied):**

When you submit a report for process unit equipment, a certifying official must sign a statement certifying that the information in the report is true, accurate, and complete based on reasonable inquiry. If you submit the report through CEDRI, the certifier's electronic signature during that submission counts as this certification and you don't need a separate signed statement.

## 21. `sec-ecmc-1403-a-(2)`

**Current summary (live, unchanged):**

A Geologic Storage Operator planning to drill a Geologic Storage Science Well or Geologic Storage Monitoring Well must notify any Relevant and Proximate Local Governments at least 30 days before submitting the Form 50A application. Relevant Local Government and Proximate Local Government are distinct defined terms in this regulation.

**Reviewer's reasons:**

- The text does not say these are distinct defined terms; it only uses "Relevant and Proximate Local Governments". ("Relevant Local Government and Proximate Local Government are distinct defined terms in this regulation." -> "")

**Reviewer would write (not applied):**

A Geologic Storage Operator planning to drill a Geologic Storage Science Well or Geologic Storage Monitoring Well must notify any Relevant and Proximate Local Governments at least 30 days before submitting the Form 50A application.

## 22. `sec-25-B-I-Q-3-a-(ii)`

**Current summary (live, unchanged):**

If more than one VOC limit in Table 5 applies to the same aerospace specialty coating material, you must meet the lowest (most stringent) limit. Table 5 lists VOC content limits in grams per liter of coating, less water and exempt solvents, for dozens of aerospace specialty coating types ranging from 60 g/L for structural autoclavable adhesive to 1230 g/L for bonding maskant and seal coat maskant.

**Reviewer's reasons:**

- The text refers to any emission limitation applying to a specific material, not only VOC limits in Table 5. ("If more than one VOC limit in Table 5 applies to the same aerospace specialty coating material, you must meet the lowest (most stringent) limit." -> "If more than one emission limitation applies to a specific material, the most stringent emission limitation applies.")

**Reviewer would write (not applied):**

If more than one emission limitation applies to a specific material, the most stringent emission limitation applies. Table 5 lists VOC content limits in grams per liter of coating, less water and exempt solvents, for dozens of aerospace specialty coating types ranging from 60 g/L for structural autoclavable adhesive to 1230 g/L for bonding maskant and seal coat maskant.

## 23. `sec-ecmc-204`

**Current summary (live, unchanged):**

The Director has the right to inspect any oil and gas location, oil and gas facility, disposal facility, or transporter facility – and their associated records – at any reasonable time to check compliance with the Act or Commission rules. Any rule violations found during an inspection will be reported to the Commission.

**Reviewer's reasons:**

- Text lists 'any special Field rules' alongside the Act and the Commission's Rules. ("to check compliance with the Act or Commission rules" -> "to check compliance with the Act, Commission rules, or any special Field rules")

**Reviewer would write (not applied):**

The Director has the right to inspect any oil and gas location, oil and gas facility, disposal facility, or transporter facility – and their associated records – at any reasonable time to check compliance with the Act, Commission rules, or any special Field rules. Any rule violations found during an inspection will be reported to the Commission.

## 24. `sec-21-A-VI-XX-1`

**Current summary (live, unchanged):**

On or after 60 days after EPA finds that Colorado failed to attain by the severe ozone attainment date or meet an applicable milestone under the 2008 ozone NAAQS, "dry cleaning fluid" means any non-aqueous solvent used in dry cleaning machines at commercial dry cleaners or by commercial businesses that clean fabrics such as draperies at the customer's residence or workplace, and that is designed and labeled exclusively for use on "dry clean only" or "S-coded" fabrics. It does not include spot remover or carpet/upholstery cleaner.

**Reviewer's reasons:**

- Text counts 60 days from the effective date of the EPA finding. ("On or after 60 days after EPA finds that Colorado failed" -> "On or after 60 days after the effective date of a finding by EPA that Colorado failed")

**Reviewer would write (not applied):**

On or after 60 days after the effective date of a finding by EPA that Colorado failed to attain by the severe ozone attainment date or meet an applicable milestone under the 2008 ozone NAAQS, "dry cleaning fluid" means any non-aqueous solvent used in dry cleaning machines at commercial dry cleaners or by commercial businesses that clean fabrics such as draperies at the customer's residence or workplace, and that is designed and labeled exclusively for use on "dry clean only" or "S-coded" fabrics. It does not include spot remover or carpet/upholstery cleaner.

## 25. `sec-8-D-V-G-5`

**Current summary (live, unchanged):**

This is one condition under which the owner or operator may use data other than EPA-approved source-test results to establish base-year or post-reduction emissions. It applies when the emissions from one or a set of emission points are small compared to the source's total emissions and any errors in measuring those points won't significantly affect the accuracy of the source's total emissions.

**Reviewer's reasons:**

- Parent text V.G. lists the three accepted test methods, including the owner's or operator's validated method, not just EPA-approved ones. ("data other than EPA-approved source-test results" -> "data other than documented source-test results (using an EPA Reference Method, EPA Conditional Method, or a Method 301-validated source test method)")

**Reviewer would write (not applied):**

This is one condition under which the owner or operator may use data other than documented source-test results (using an EPA Reference Method, EPA Conditional Method, or a Method 301-validated source test method) to establish base-year or post-reduction emissions. It applies when the emissions from one or a set of emission points are small compared to the source's total emissions and any errors in measuring those points won't significantly affect the accuracy of the source's total emissions.

## 26. `sec-p194-194.5-onshore-oil-pipeline-facilities`

**Current summary (live, unchanged):**

**Onshore oil pipeline facilities** means new and existing pipe, rights-of-way, and any equipment, facility, or building used to transport oil that is located in, on, or under any land in the United States except submerged land. This is a definitional provision.

**Reviewer's reasons:**

- stray Markdown markers removed ("**Onshore oil pipeline facilities**" -> "Onshore oil pipeline facilities")

**Reviewer would write (not applied):**

Onshore oil pipeline facilities means new and existing pipe, rights-of-way, and any equipment, facility, or building used to transport oil that is located in, on, or under any land in the United States except submerged land. This is a definitional provision.

## 27. `sec-ooooa-60.5395a-(b)-(1)`

**Current summary (live, unchanged):**

If you use a control device (like a combustor or flare) to reduce VOC emissions from a storage vessel covered by this rule, you must install a cover on the tank that meets the requirements in § 60.5411a(b), connect it to a closed vent system meeting § 60.5411a(c) and (d), and send the emissions to a control device meeting § 60.5412a(c) or (d). Instead of routing to a control device, you can route the closed vent system directly to a process. This requirement is subject to an exception in paragraph (b)(2) of this section.

**Reviewer's reasons:**

- The text names no example control devices; the examples were added. ("a control device (like a combustor or flare)" -> "a control device")

**Reviewer would write (not applied):**

If you use a control device to reduce VOC emissions from a storage vessel covered by this rule, you must install a cover on the tank that meets the requirements in § 60.5411a(b), connect it to a closed vent system meeting § 60.5411a(c) and (d), and send the emissions to a control device meeting § 60.5412a(c) or (d). Instead of routing to a control device, you can route the closed vent system directly to a process. This requirement is subject to an exception in paragraph (b)(2) of this section.

## 28. `sec-ooooa-60.5413a-(b)-(4)-(iii)-(B)`

**Current summary (live, unchanged):**

This provision gives you the formula to adjust your measured total organic compound (TOC) concentration to a standardized 3 percent oxygen level when testing a control device. You take your measured TOC concentration (as propane, excluding methane and ethane if applicable) and your measured oxygen percentage, plug them into the formula, and calculate the corrected TOC concentration. This standardized number is what you use to show compliance.

**Reviewer's reasons:**

- Text lists variables (Cc, Cm, %O2m) without a formula; it only abbreviates TOC and never expands it. ("This provision gives you the formula to adjust your measured total organic compound (TOC) concentration to a standardized 3 percent oxygen level when testing a control device." -> "This provision sets out how to correct your measured TOC concentration to 3 percent oxygen when testing a control device. The text defines the variables but does not show the equation itself.")
- No formula is shown in the text. ("plug them into the formula, and calculate the corrected TOC concentration." -> "and use them to get the corrected TOC concentration.")
- The text does not state the use of the corrected value. ("This standardized number is what you use to show compliance." -> "")

**Reviewer would write (not applied):**

This provision sets out how to correct your measured TOC concentration to 3 percent oxygen when testing a control device. The text defines the variables but does not show the equation itself. You take your measured TOC concentration (as propane, excluding methane and ethane if applicable, parts per million by volume on a wet basis) and your measured oxygen percentage (percent by volume, wet), and use them to get the corrected TOC concentration.

## 29. `sec-7-B-III-C-4-d-(ii)-(A)`

**Current summary (live, unchanged):**

This provision applies to owners or operators of natural gas compressor stations that commenced operation before May 1, 2021. It requires them to determine a Total Controller Count that includes all pneumatic controllers and all non-emitting controllers at all of their compressor stations, except for pneumatic controllers excluded under Sections III.C.4.e.(i)(A) through (C). The Total Controller Count is used as part of the regulatory framework for managing controllers at these facilities.

**Reviewer's reasons:**

- The text limits the count to natural gas compressor stations that commenced operation before May 1, 2021. ("at all of their compressor stations" -> "at all of their natural gas compressor stations that commenced operation before May 1, 2021")
- The text does not say how the count is used; the sentence is unsupported. ("The Total Controller Count is used as part of the regulatory framework for managing controllers at these facilities." -> "")

**Reviewer would write (not applied):**

This provision applies to owners or operators of natural gas compressor stations that commenced operation before May 1, 2021. It requires them to determine a Total Controller Count that includes all pneumatic controllers and all non-emitting controllers at all of their natural gas compressor stations that commenced operation before May 1, 2021, except for pneumatic controllers excluded under Sections III.C.4.e.(i)(A) through (C).

## 30. `sec-6-B-VIII-C-4-e-(ii)`

**Current summary (live, unchanged):**

If the Division decides that a coal-fired power plant unit cannot meet either the Best Available Mercury Control Technology Standard or something stricter than the Alternative Emission Standard, the owner or operator must submit a permit application to modify the permit to incorporate the Alternative Emission Standard as the unit's emission limit, including public notice and comment.

**Reviewer's reasons:**

- The text says only "the unit" and does not describe it as a coal-fired power plant unit. ("a coal-fired power plant unit" -> "the unit")

**Reviewer would write (not applied):**

If the Division decides that the unit cannot meet either the Best Available Mercury Control Technology Standard or something stricter than the Alternative Emission Standard, the owner or operator must submit a permit application to modify the permit to incorporate the Alternative Emission Standard as the unit's emission limit, including public notice and comment.

## 31. `sec-6-A-SUBPART-VVa`

**Current summary (live, unchanged):**

Colorado adopts by reference the federal standards in 40 CFR Part 60, Subpart VVa, as published in the July 1, 2025 edition of the Code of Federal Regulations. That subpart sets performance standards for equipment leaks of volatile organic compounds (VOC) at synthetic organic chemical manufacturing facilities that began construction, reconstruction, or modification after November 7, 2006.

**Reviewer's reasons:**

- The text only abbreviates VOC and does not expand it. ("equipment leaks of volatile organic compounds (VOC)" -> "equipment leaks of VOC")

**Reviewer would write (not applied):**

Colorado adopts by reference the federal standards in 40 CFR Part 60, Subpart VVa, as published in the July 1, 2025 edition of the Code of Federal Regulations. That subpart sets performance standards for equipment leaks of VOC at synthetic organic chemical manufacturing facilities that began construction, reconstruction, or modification after November 7, 2006.

## 32. `sec-oooob-60.5399b-(c)-(1)-(iii)`

**Current summary (live, unchanged):**

If you want EPA to approve an alternative emission detection technology, you must submit data showing the method detection limit (the smallest leak or emission it can reliably detect) and explain how you determined that limit. You must collect and verify field data covering different seasons to support your detection-limit claim; you can supplement the field data with modeling, controlled test-site results, or other documentation, but field data across seasons is required at a minimum.

**Reviewer's reasons:**

- Text refers to an applicant for an alternative means of emission limitation, names no EPA approval, and does not define the method detection limit. ("If you want EPA to approve an alternative emission detection technology, you must submit data showing the method detection limit (the smallest leak or emission it can reliably detect) and explain how you determined that limit." -> "If you apply for an alternative means of emission limitation, the application must include the method detection limit of the technology, technique, or process and a description of the procedures used to determine it.")
- Text requires collecting, verifying, and submitting field data encompassing seasonal variations. ("You must collect and verify field data covering different seasons" -> "You must collect, verify, and submit field data covering seasonal variations")
- Matches the text's wording. ("modeling, controlled test-site results" -> "modeling analyses, controlled test site data")

**Reviewer would write (not applied):**

If you apply for an alternative means of emission limitation, the application must include the method detection limit of the technology, technique, or process and a description of the procedures used to determine it. You must collect, verify, and submit field data covering seasonal variations to support your detection-limit determination; you can supplement the field data with modeling analyses, controlled test site data, or other documentation, but field data across seasons is required at a minimum.

## 33. `sec-p192-192.201-(a)-(2)-(ii)`

**Current summary (live, unchanged):**

In pipelines other than low-pressure distribution systems, if the maximum allowable operating pressure (MAOP) is 12 psig or more but less than 60 psig, the pressure-relieving or limiting station must prevent the pressure from exceeding MAOP plus 6 psig.

**Reviewer's reasons:**

- The text spells out the term and never uses the acronym MAOP. ("maximum allowable operating pressure (MAOP)" -> "maximum allowable operating pressure")
- Follows from removing the acronym; the text uses the full term. ("exceeding MAOP plus 6 psig" -> "exceeding the maximum allowable operating pressure plus 6 psig")

**Reviewer would write (not applied):**

In pipelines other than low-pressure distribution systems, if the maximum allowable operating pressure is 12 psig or more but less than 60 psig, the pressure-relieving or limiting station must prevent the pressure from exceeding the maximum allowable operating pressure plus 6 psig.

## 34. `sec-ooooc-60.5410c-(b)-(4)-(ii)`

**Current summary (live, unchanged):**

If you have associated gas at a designated facility, you must install a closed vent system that meets the requirements in § 60.5411c(a) and (c) to capture that gas and send it to a control device that meets the conditions in § 60.5412c. This is one way to demonstrate initial compliance with the standards.

**Reviewer's reasons:**

- Parent paragraph (b)(4) sets the condition as complying with § 60.5391c(b) or (c). ("If you have associated gas at a designated facility, you must install" -> "If you comply with § 60.5391c(b) or (c), you must install")
- Wording follows the provision text. ("to capture that gas" -> "to capture the associated gas")
- Parent text requires compliance with (b)(4)(i) through (vi); it does not describe this as one option among alternatives. ("This is one way to demonstrate initial compliance with the standards." -> "This is one of the paragraphs (b)(4)(i) through (vi) that you must comply with in that case.")

**Reviewer would write (not applied):**

If you comply with § 60.5391c(b) or (c), you must install a closed vent system that meets the requirements in § 60.5411c(a) and (c) to capture the associated gas and send it to a control device that meets the conditions in § 60.5412c. This is one of the paragraphs (b)(4)(i) through (vi) that you must comply with in that case.

## 35. `sec-ooooa-60.5375a-(a)-(3)`

**Current summary (live, unchanged):**

If you cannot route recovered gas from a well completion or modification to a sales line or for beneficial use on-site (as normally required), you must send it to a flare or other combustion device instead – unless doing so would create a fire or explosion risk, or the heat could damage tundra, permafrost, or waterways. Any combustion device you use must have a continuous pilot flame that stays lit reliably.

**Reviewer's reasons:**

- Text sets the trigger as technical infeasibility under (a)(1)(ii) and does not mention modification, a sales line or on-site use. ("If you cannot route recovered gas from a well completion or modification to a sales line or for beneficial use on-site (as normally required)" -> "If it is technically infeasible to route recovered gas from a well completion operation with hydraulic fracturing as required in § 60.5375a(a)(1)(ii)")
- Text says completion combustion device, not flare, and states the exceptions in these terms. ("you must send it to a flare or other combustion device instead – unless doing so would create a fire or explosion risk, or the heat could damage tundra, permafrost, or waterways." -> "you must capture and direct it to a completion combustion device instead, except in conditions that may result in a fire hazard or explosion, or where high heat emissions from a completion combustion device may negatively impact tundra, permafrost or waterways.")
- Text applies the pilot flame requirement to completion combustion devices. ("Any combustion device you use must have a continuous pilot flame that stays lit reliably." -> "Completion combustion devices must be equipped with a reliable continuous pilot flame.")

**Reviewer would write (not applied):**

If it is technically infeasible to route recovered gas from a well completion operation with hydraulic fracturing as required in § 60.5375a(a)(1)(ii), you must capture and direct it to a completion combustion device instead, except in conditions that may result in a fire hazard or explosion, or where high heat emissions from a completion combustion device may negatively impact tundra, permafrost or waterways. Completion combustion devices must be equipped with a reliable continuous pilot flame.

## 36. `sec-sip-V`

**Current summary (live, unchanged):**

**Canon City area:** This is a Statement of Basis – rulemaking history, not a requirement. It explains that on November 20, 2008 the Commission repealed the Canon City PM-10 contingency measures because the area was redesignated to attainment in July 2001 and continued to maintain the standard through 2020, so federal law no longer required those measures.

**Reviewer's reasons:**

- stray Markdown markers removed ("**Canon City area:**" -> "Canon City area:")
- Text says the amendments repeal the measures and does not name the Commission as actor. ("on November 20, 2008 the Commission repealed the Canon City PM-10 contingency measures" -> "the November 20, 2008 amendments repeal the Canon City contingency measures")
- Text says the area 'shows continued maintenance of the standard through 2020' and that the measures 'are no longer required'. ("redesignated to attainment in July 2001 and continued to maintain the standard through 2020, so federal law no longer required those measures" -> "redesignated to an attainment area for particulate matter in July 2001 and shows continued maintenance of the standard through 2020, so federal law no longer requires those measures")

**Reviewer would write (not applied):**

Canon City area: This is a Statement of Basis – rulemaking history, not a requirement. It explains that the November 20, 2008 amendments repeal the Canon City contingency measures because the area was redesignated to an attainment area for particulate matter in July 2001 and shows continued maintenance of the standard through 2020, so federal law no longer requires those measures.

## 37. `sec-22-B-I-C-2-a`

**Current summary (live, unchanged):**

If you bought a product or piece of equipment containing a prohibited substance before the prohibition date kicked in, you don't have to stop using it. You can also still sell, import, export, distribute, install, service, and use products or equipment (including spray foam systems not yet applied) that were manufactured before the prohibition date, even after that date has passed. The exception is if you retrofit an existing system after the prohibition date – then the normal prohibition rules apply.

**Reviewer's reasons:**

- Text attaches the retrofit exception to the no-cessation-of-use sentence. ("you don't have to stop using it." -> "you don't have to stop using it, except where an existing system is retrofit after the prohibition date.")
- Text does not say 'normal prohibition rules apply'; the exception is moved to the first sentence. ("The exception is if you retrofit an existing system after the prohibition date – then the normal prohibition rules apply." -> "")
- Text says 'not yet applied on site'. ("not yet applied)" -> "not yet applied on site)")
- Text refers to the date specified in Table 1 of Section I.E.1. ("before the prohibition date, even after" -> "before the prohibition date specified in Table 1 of Section I.E.1, even after")

**Reviewer would write (not applied):**

If you bought a product or piece of equipment containing a prohibited substance before the prohibition date kicked in, you don't have to stop using it, except where an existing system is retrofit after the prohibition date. You can also still sell, import, export, distribute, install, service, and use products or equipment (including spray foam systems not yet applied on site) that were manufactured before the prohibition date specified in Table 1 of Section I.E.1, even after that date has passed.

## 38. `sec-30-B-III-B-3-i`

**Current summary (live, unchanged):**

"Protected opening method" is defined as any method that stops air from escaping a building enclosure, including an automatically closing door, overlapping plastic strip curtains covering the entire opening, a vestibule, or an airlock system.

**Reviewer's reasons:**

- Text says "any of the methods listed below that restricts air from escaping", not any method that stops air. ("any method that stops air from escaping" -> "any of the listed methods that restricts air from escaping")

**Reviewer would write (not applied):**

"Protected opening method" is defined as any of the listed methods that restricts air from escaping a building enclosure, including an automatically closing door, overlapping plastic strip curtains covering the entire opening, a vestibule, or an airlock system.

## 39. `sec-p190-190.201-(a)`

**Current summary (live, unchanged):**

This subpart explains the enforcement powers the Associate Administrator for Pipeline Safety can use to achieve and maintain pipeline safety and compliance, and lays out the procedures for using those powers and imposing penalties.

**Reviewer's reasons:**

- The text says only "the Associate Administrator"; the added title is not stated. ("the Associate Administrator for Pipeline Safety" -> "the Associate Administrator")

**Reviewer would write (not applied):**

This subpart explains the enforcement powers the Associate Administrator can use to achieve and maintain pipeline safety and compliance, and lays out the procedures for using those powers and imposing penalties.

## 40. `sec-23-A-IV-A-3`

**Current summary (live, unchanged):**

Sources listed in the tables must meet their limits and averaging times no later than January 30, 2018 (five years after EPA approved Colorado's regional haze SIP), except Craig Unit 1. They must maintain the control equipment or operational practices needed to comply with those limits and set up procedures to ensure that equipment or those practices are properly operated and maintained.

**Reviewer's reasons:**

- Text gives January 30, 2013 as the approval date, not a 2018 deadline; it also requires compliance as expeditiously as practicable and the exception covers Craig Unit 1 or a relevant component. ("no later than January 30, 2018 (five years after EPA approved Colorado's regional haze SIP), except Craig Unit 1." -> "as expeditiously as practicable, but no later than five years after EPA approved Colorado's regional haze SIP (which was January 30, 2013), except Craig Unit 1, or relevant component thereof.")

**Reviewer would write (not applied):**

Sources listed in the tables must meet their limits and averaging times as expeditiously as practicable, but no later than five years after EPA approved Colorado's regional haze SIP (which was January 30, 2013), except Craig Unit 1, or relevant component thereof. They must maintain the control equipment or operational practices needed to comply with those limits and set up procedures to ensure that equipment or those practices are properly operated and maintained.

## 41. `sec-23-A-II-E`

**Current summary (live, unchanged):**

Average Cost Effectiveness is the total annualized cost of a control divided by the annual emissions reduction (baseline emissions minus estimated emissions after controls). Baseline annual emissions should realistically depict what the source is expected to emit annually; the source or the Division may use enforceable permit limits or estimate anticipated emissions based on actual emissions from a representative baseline period.

**Reviewer's reasons:**

- Text specifies "state or federally enforceable permit limits". ("may use enforceable permit limits" -> "may use state or federally enforceable permit limits")

**Reviewer would write (not applied):**

Average Cost Effectiveness is the total annualized cost of a control divided by the annual emissions reduction (baseline emissions minus estimated emissions after controls). Baseline annual emissions should realistically depict what the source is expected to emit annually; the source or the Division may use state or federally enforceable permit limits or estimate anticipated emissions based on actual emissions from a representative baseline period.

## 42. `sec-11-H-APPENDIX-A-ATT-IV-1.5-F`

**Current summary (live, unchanged):**

**Appendix A, Attachment IV, § 1.5.F (Colorado 97 Analyzer certification documentation)**

Before a Colorado 97 emissions analyzer can be certified for sale in Colorado, the manufacturer must give the Division all software source codes, working codes, schematics, drawings, and other technical information needed to operate, maintain, calibrate, and repair the analyzer in case the manufacturer or its agent stops providing adequate service in Colorado. The manufacturer must keep this information current and send the Division any changes. As long as the manufacturer or its agent continues to provide adequate maintenance, calibration, and repair services, the Division will treat the information as confidential commercial data if clearly marked as such. If the manufacturer becomes insolvent or stops providing adequate service in Colorado, all the information becomes the Division's property and may be released to a third party as necessary to repair, calibrate, and maintain the analyzers. The manufacturer must also submit file layouts showing file names, types, security, field names, types, sizes, and editing criteria; CDPHE will treat this documentation as proprietary information.

**Reviewer's reasons:**

- stray Markdown markers removed ("**Appendix A, Attachment IV, § 1.5.F (Colorado 97 Analyzer certification documentation)**" -> "Appendix A, Attachment IV, § 1.5.F (Colorado 97 Analyzer certification documentation)")

**Reviewer would write (not applied):**

Appendix A, Attachment IV, § 1.5.F (Colorado 97 Analyzer certification documentation)

## 43. `sec-gp07-VIII-F-2`

**Current summary (live, unchanged):**

The Division has 60 days from receiving a GP07 registration request to decide whether it is complete and notify the applicant in writing. If the applicant does not hear from the Division within 60 days, the registration request is automatically deemed complete for purposes of the registration-approval process.

**Reviewer's reasons:**

- The text limits deemed completeness to Conditions VIII.F.1. and VIII.F.2. and does not say "automatically". ("is automatically deemed complete for purposes of the registration-approval process" -> "is deemed complete for the purpose of Conditions VIII.F.1. and VIII.F.2.")

**Reviewer would write (not applied):**

The Division has 60 days from receiving a GP07 registration request to decide whether it is complete and notify the applicant in writing. If the applicant does not hear from the Division within 60 days, the registration request is deemed complete for the purpose of Conditions VIII.F.1. and VIII.F.2.

## 44. `sec-proc-B-VI-C-12`

**Current summary (live, unchanged):**

The Commission's monthly meetings are usually held at CDPHE, 4300 Cherry Creek Drive South, Denver. Any party or member of the public may ask the Commission to hold a hearing virtually or in another location (including near the affected source), but the request must be submitted to the Commission Office at least five days before the regular monthly meeting that precedes the scheduled hearing and served on all parties and applicants for party status by the same deadline; everyone will have a chance to respond before the Commission decides. If the Commission changes the hearing location, notice will be published in a newspaper of general circulation in the area where the affected source or activity is located at least twenty days before the hearing.

**Reviewer's reasons:**

- The text does not use the abbreviation CDPHE; it names the department in full. ("CDPHE" -> "the Colorado Department of Public Health Environment")

**Reviewer would write (not applied):**

The Commission's monthly meetings are usually held at the Colorado Department of Public Health Environment, 4300 Cherry Creek Drive South, Denver. Any party or member of the public may ask the Commission to hold a hearing virtually or in another location (including near the affected source), but the request must be submitted to the Commission Office at least five days before the regular monthly meeting that precedes the scheduled hearing and served on all parties and applicants for party status by the same deadline; everyone will have a chance to respond before the Commission decides. If the Commission changes the hearing location, notice will be published in a newspaper of general circulation in the area where the affected source or activity is located at least twenty days before the hearing.

## 45. `sec-1-VI-E-1`

**Current summary (live, unchanged):**

For purposes of this regulation, all oxidized forms of sulfur – including sulfur trioxide, thionyl chloride, and sulfuric acid mist – are treated as sulfur dioxide. This means the sulfur dioxide limits and requirements apply to these compounds as well.

**Reviewer's reasons:**

- The text names "trionyl chloride (SOCl2)". ("thionyl chloride" -> "trionyl chloride")
- The text says "including, but not restricted to", so the list is not exhaustive. ("including sulfur trioxide" -> "including, but not limited to, sulfur trioxide")
- The text states no such consequence; it only says these forms are considered sulfur dioxide. ("This means the sulfur dioxide limits and requirements apply to these compounds as well." -> "")

**Reviewer would write (not applied):**

For purposes of this regulation, all oxidized forms of sulfur – including, but not limited to, sulfur trioxide, trionyl chloride, and sulfuric acid mist – are treated as sulfur dioxide.

## 46. `sec-ecmc-703-b-(3)`

**Current summary (live, unchanged):**

This applies to operators who have posted financial assurance for a remediation project under Rule 703.b. The Director will hold that financial assurance until the operator finishes remediating soil and/or groundwater impacts according to the approved workplan and Rule 913.h. Only then will the financial assurance be released.

**Reviewer's reasons:**

- The text only says the Director holds the assurance until remediation is completed; it does not say release occurs only then. ("Only then will the financial assurance be released." -> "")

**Reviewer would write (not applied):**

This applies to operators who have posted financial assurance for a remediation project under Rule 703.b. The Director will hold that financial assurance until the operator finishes remediating soil and/or groundwater impacts according to the approved workplan and Rule 913.h.

## 47. `sec-1-III-D-2-e-(iii)`

**Current summary (live, unchanged):**

For on-site haul roads (those on property owned or controlled by the haul road owner or operator), the no off-property transport emission limitation guideline applies. For off-site haul roads (those bordered on both sides by property not owned or controlled by the haul road owner or operator), the nuisance guideline applies. Abatement and control plans submitted for haul roads must comply with Section III.D. of this regulation.

**Reviewer's reasons:**

- Text defines on-site as 'located on and abutted by' the owner's or operator's property. ("those on property owned or controlled by the haul road owner or operator" -> "those located on and abutted by property owned or controlled by the haul road owner or operator")
- Text says plans 'shall be evaluated for compliance with' Section III.D. ("must comply with Section III.D. of this regulation" -> "are evaluated for compliance with the requirements of Section III.D. of this regulation")

**Reviewer would write (not applied):**

For on-site haul roads (those located on and abutted by property owned or controlled by the haul road owner or operator), the no off-property transport emission limitation guideline applies. For off-site haul roads (those bordered on both sides by property not owned or controlled by the haul road owner or operator), the nuisance guideline applies. Abatement and control plans submitted for haul roads are evaluated for compliance with the requirements of Section III.D. of this regulation.

## 48. `sec-ecmc-304-b-B-viii`

**Current summary (live, unchanged):**

This applies to operators proposing an oil and gas location inside High Priority Habitat who did not get a waiver from Colorado Parks and Wildlife (CPW) during pre-application consultation. When those two conditions are met, the operator must perform an alternative location analysis as part of the Form 2A application.

**Reviewer's reasons:**

- The text only abbreviates CPW and never expands it. ("Colorado Parks and Wildlife (CPW)" -> "CPW")
- The text does not say the analysis is part of the Form 2A application. ("the operator must perform an alternative location analysis as part of the Form 2A application." -> "the operator must perform an alternative location analysis.")

**Reviewer would write (not applied):**

This applies to operators proposing an oil and gas location inside High Priority Habitat who did not get a waiver from CPW during pre-application consultation. When those two conditions are met, the operator must perform an alternative location analysis.

## 49. `sec-oooob-60.5420b-(b)-(8)-(ix)`

**Current summary (live, unchanged):**

If you have a storage vessel that was previously complying with the lower-emitting option (§ 60.5395b(a)(3)) but now must comply with the control-device option (§ 60.5395b(a)(2)) instead, you must report that change. You need to explain whether the change happened because of fracturing/refracturing operations or because the vessel's monthly emissions went up. If emissions increased, you must provide documentation showing the new emissions rate. You must also report the date you started complying with § 60.5395b(a)(2) and submit the information required in subsections (b)(8)(iii) through (vii).

**Reviewer's reasons:**

- The text gives only the citations and does not characterize them as 'lower-emitting' or 'control-device' options. ("the lower-emitting option (§ 60.5395b(a)(3)) but now must comply with the control-device option (§ 60.5395b(a)(2)) instead" -> "§ 60.5395b(a)(3) but now complies with § 60.5395b(a)(2) instead")

**Reviewer would write (not applied):**

If you have a storage vessel that was previously complying with § 60.5395b(a)(3) but now complies with § 60.5395b(a)(2) instead, you must report that change. You need to explain whether the change happened because of fracturing/refracturing operations or because the vessel's monthly emissions went up. If emissions increased, you must provide documentation showing the new emissions rate. You must also report the date you started complying with § 60.5395b(a)(2) and submit the information required in subsections (b)(8)(iii) through (vii).

## 50. `sec-zzzz-63.6650-(c)-(9)-(i)`

**Current summary (live, unchanged):**

If you own or operate a stationary reciprocating internal combustion engine for a federal agency responsible for national defense, you may claim an exemption from reporting the engine's latitude and longitude coordinates through CEDRI (the EPA's Compliance and Emissions Data Reporting Interface). This exemption applies only during the reporting period when the engine is owned by or operated by or for such an agency.

**Reviewer's reasons:**

- The text only abbreviates CEDRI and does not expand it. ("CEDRI (the EPA's Compliance and Emissions Data Reporting Interface)" -> "CEDRI")
- The provision ends with 'and', so it is one condition among several, not sufficient alone. ("This exemption applies only during the reporting period when the engine is owned by or operated by or for such an agency." -> "This is one of the conditions for the exemption, and it applies to the reporting period in which the engine is owned by or operated by or for such an agency.")

**Reviewer would write (not applied):**

If you own or operate a stationary reciprocating internal combustion engine for a federal agency responsible for national defense, you may claim an exemption from reporting the engine's latitude and longitude coordinates through CEDRI. This is one of the conditions for the exemption, and it applies to the reporting period in which the engine is owned by or operated by or for such an agency.

## 51. `sec-gp08-VIII-D-2`

**Current summary (live, unchanged):**

The permit may be transferred to a new owner or reissued under a new company name if the owner or operator requests the transfer or name change, submits a revised APEN, and pays the required fees. The Division will process the reissuance according to Regulation Number 3, Part B, Section II.B.

**Reviewer's reasons:**

- Text says the Division may reissue the registration and does not name the owner or operator as the requester. ("The permit may be transferred to a new owner or reissued under a new company name if the owner or operator requests the transfer or name change, submits a revised APEN, and pays the required fees." -> "A registration under this general permit may be reissued by the Division to a new owner or in a new company name if there is a request for transfer of ownership or a company name change, a revised APEN is submitted, and the required fees are paid.")
- Text says 'may be reissued ... as provided in' the section, not that the Division 'will process' it. ("The Division will process the reissuance according to Regulation Number 3, Part B, Section II.B." -> "The reissuance is as provided in Regulation Number 3, Part B, Section II.B.")

**Reviewer would write (not applied):**

A registration under this general permit may be reissued by the Division to a new owner or in a new company name if there is a request for transfer of ownership or a company name change, a revised APEN is submitted, and the required fees are paid. The reissuance is as provided in Regulation Number 3, Part B, Section II.B.

## 52. `sec-p190-190.13-(c)`

**Current summary (live, unchanged):**

When the Associate Administrator receives a complete petition for a declaratory order, PHMSA will publish a notice in the Federal Register acknowledging the petition and asking for public comment.

**Reviewer's reasons:**

- The text names the Associate Administrator as the publisher and does not mention PHMSA. ("PHMSA will publish a notice in the Federal Register" -> "the Associate Administrator will publish a notice in the Federal Register")
- The text conditions the notice on a petition that satisfies the requirements of this section. ("a complete petition for a declaratory order" -> "a petition for a declaratory order that satisfies the requirements of § 190.13")

**Reviewer would write (not applied):**

When the Associate Administrator receives a petition for a declaratory order that satisfies the requirements of § 190.13, the Associate Administrator will publish a notice in the Federal Register acknowledging the petition and asking for public comment.

## 53. `sec-oooob-60.5410b-(c)-(2)-(i)`

**Current summary (live, unchanged):**

If you operate an affected facility under this subpart and cannot route recovered associated gas to a sales line, use it as fuel onsite, use it for another purpose that would otherwise require purchased fuel or raw material, or re-inject it into a well, you must document the technical reasons why those options are infeasible. You must keep that documentation according to § 60.5377(g) and submit it in your initial annual report as required by paragraph (c)(4) of this section.

**Reviewer's reasons:**

- Parent paragraph limits this to associated gas wells complying under § 60.5377b(f) via technical infeasibility certification; text also includes injecting into another well and gathering flow line or collection system. ("If you operate an affected facility under this subpart and cannot route recovered associated gas to a sales line, use it as fuel onsite, use it for another purpose that would otherwise require purchased fuel or raw material, or re-inject it into a well, you must document the technical reasons why those options are infeasible." -> "If you have an associated gas well that complies with § 60.5377b(f) based on a demonstration and certification that it is not feasible to comply with the otherwise applicable requirements for technical reasons, you must document the technical reasons why it is infeasible to route recovered associated gas to a sales line, use it as fuel onsite, use it for another purpose that would otherwise require purchased fuel or raw material, or re-inject it into the well or inject it into another well.")

**Reviewer would write (not applied):**

If you have an associated gas well that complies with § 60.5377b(f) based on a demonstration and certification that it is not feasible to comply with the otherwise applicable requirements for technical reasons, you must document the technical reasons why it is infeasible to route recovered associated gas to a sales line, use it as fuel onsite, use it for another purpose that would otherwise require purchased fuel or raw material, or re-inject it into the well or inject it into another well. You must keep that documentation according to § 60.5377(g) and submit it in your initial annual report as required by paragraph (c)(4) of this section.

## 54. `sec-7-B-II-J-1-h`

**Current summary (live, unchanged):**

This provision applies to owners or operators of wet and dry seal centrifugal compressors in Colorado oil and gas operations. It allows them to comply with the federal emission control, monitoring, recordkeeping, and reporting requirements under 40 CFR Part 60, Subpart OOOOb (effective December 3, 2025) as an alternative to the state requirements specified in Section II.J.1.i.

**Reviewer's reasons:**

- The text gives December 3, 2025 as the version date of Subpart OOOOb and does not call it an effective date. ("(effective December 3, 2025)" -> "(December 3, 2025)")
- The text names the specific provisions of II.J.1.i. that the alternative replaces. ("the state requirements specified in Section II.J.1.i." -> "the emission control, inspection, repair, and recordkeeping provisions described in Section II.J.1.i.")

**Reviewer would write (not applied):**

This provision applies to owners or operators of wet and dry seal centrifugal compressors in Colorado oil and gas operations. It allows them to comply with the federal emission control, monitoring, recordkeeping, and reporting requirements under 40 CFR Part 60, Subpart OOOOb (December 3, 2025) as an alternative to the emission control, inspection, repair, and recordkeeping provisions described in Section II.J.1.i.

## 55. `sec-19-A-V-E-1-b`

**Current summary (live, unchanged):**

When abating windows from the outside of a pre-1978 home or child-occupied facility, you must seal at least two layers of 6-mil polyethylene sheeting to the inside wall around the window to stop dust from getting into the building during the work.

**Reviewer's reasons:**

- Text says sheeting is sealed to the inside wall covering the window. ("to the inside wall around the window" -> "to the inside wall covering the window")

**Reviewer would write (not applied):**

When abating windows from the outside of a pre-1978 home or child-occupied facility, you must seal at least two layers of 6-mil polyethylene sheeting to the inside wall covering the window to stop dust from getting into the building during the work.

## 56. `sec-zzzz-TABLE-7`

**Current summary (live, unchanged):**

**Row 1:** If you own certain existing non-emergency engines (100–500 HP at major sources, CI engines over 500 HP at major sources, 4SRB engines over 500 HP at major sources, CI engines over 300 HP at area sources) or certain new/reconstructed non-emergency engines (over 500 HP at major sources, or 4SLB engines 250–500 HP at major sources), you must submit a compliance report semiannually (or annually if the engine is limited-use and subject to numerical emission limits). The report must state either that there were no deviations from emission or operating limits and no periods when your continuous monitoring system (CMS, including CEMS and CPMS) was out-of-control, or if there were deviations or out-of-control periods, include the information required by § 63.6650(d) and (e); if you had a malfunction, include the information in § 63.6650(c)(4).

**Row 2:** If you own a new or reconstructed non-emergency engine that combusts landfill gas or digester gas equivalent to 10 percent or more of the gross heat input on an annual basis, you must submit an annual report. The report must include the fuel flow rate of each fuel and the heating values used in your calculations demonstrating that landfill or digester gas provides at least 10 percent of gross heat input annually, the operating limits in your federally enforceable permit and any deviations from them, and any problems or errors suspected with the meters.

**Row 3:** If you own an existing non-emergency, non-black start 4SLB or 4SRB engine over 500 HP at an area source of HAP that is not a remote engine and operates more than 24 hours per calendar year, you must submit a compliance report semiannually under § 63.6650(b)(1)-(5) and (i) containing the results of the annual compliance demonstration, if one was conducted during the reporting period.

**Row 4:** If you own an emergency engine that operates for the purposes specified in § 63.6640(f)(4)(ii), you must submit an annual report containing the information in § 63.6650(h)(1), according to § 63.6650(h)(2)-(3) and (i).

**Reviewer's reasons:**

- stray Markdown markers removed ("**Row 1:**" -> "Row 1:")
- stray Markdown markers removed ("**Row 2:**" -> "Row 2:")
- stray Markdown markers removed ("**Row 3:**" -> "Row 3:")
- stray Markdown markers removed ("**Row 4:**" -> "Row 4:")

**Reviewer would write (not applied):**

Row 1: If you own certain existing non-emergency engines (100–500 HP at major sources, CI engines over 500 HP at major sources, 4SRB engines over 500 HP at major sources, CI engines over 300 HP at area sources) or certain new/reconstructed non-emergency engines (over 500 HP at major sources, or 4SLB engines 250–500 HP at major sources), you must submit a compliance report semiannually (or annually if the engine is limited-use and subject to numerical emission limits). The report must state either that there were no deviations from emission or operating limits and no periods when your continuous monitoring system (CMS, including CEMS and CPMS) was out-of-control, or if there were deviations or out-of-control periods, include the information required by § 63.6650(d) and (e); if you had a malfunction, include the information in § 63.6650(c)(4).

## 57. `sec-3-A-I-B-48`

**Current summary (live, unchanged):**

This defines "significant" emission rates (in tons per year) that trigger certain permitting or reporting requirements under Colorado's air-quality rules. The thresholds vary by pollutant: for example, 100 tons per year for carbon monoxide, 40 for nitrogen oxides or sulfur dioxide, 25 for particulate matter, 15 for PM10, 10 for direct PM2.5, 0.6 for lead, and 50 for municipal solid waste landfill gases (measured as non-methane organic compounds). In serious or severe ozone nonattainment areas the threshold is 25 tons per year of volatile organic compounds or nitrogen oxides; in extreme ozone nonattainment areas any increase of those pollutants is significant.

**Reviewer's reasons:**

- The text defines significant rates only and does not state that they trigger permitting or reporting requirements. ("that trigger certain permitting or reporting requirements under Colorado's air-quality rules" -> "under Colorado's air-quality rules")

**Reviewer would write (not applied):**

This defines "significant" emission rates (in tons per year) under Colorado's air-quality rules. The thresholds vary by pollutant: for example, 100 tons per year for carbon monoxide, 40 for nitrogen oxides or sulfur dioxide, 25 for particulate matter, 15 for PM10, 10 for direct PM2.5, 0.6 for lead, and 50 for municipal solid waste landfill gases (measured as non-methane organic compounds). In serious or severe ozone nonattainment areas the threshold is 25 tons per year of volatile organic compounds or nitrogen oxides; in extreme ozone nonattainment areas any increase of those pollutants is significant.

## 58. `sec-p195-195.585-(b)`

**Current summary (live, unchanged):**

If you find pipe with localized corrosion pitting severe enough that it might leak, you must replace or repair that pipe – unless you lower the maximum operating pressure to match the actual remaining wall thickness in the pits.

**Reviewer's reasons:**

- Text says pressure reduction is commensurate with the strength of the pipe based on actual remaining wall thickness in the pits. ("unless you lower the maximum operating pressure to match the actual remaining wall thickness in the pits" -> "unless you lower the maximum operating pressure to a level commensurate with the strength of the pipe, based on the actual remaining wall thickness in the pits")

**Reviewer would write (not applied):**

If you find pipe with localized corrosion pitting severe enough that it might leak, you must replace or repair that pipe – unless you lower the maximum operating pressure to a level commensurate with the strength of the pipe, based on the actual remaining wall thickness in the pits.

## 59. `sec-jjjj-60.4236-(b)`

**Current summary (live, unchanged):**

After July 1, 2009, you may not install a stationary spark-ignition engine rated at 500 HP or more unless it meets the emission standards in § 60.4233. Lean-burn engines between 500 HP and 1,349 HP that don't meet § 60.4233 have until January 1, 2010 before they too are prohibited from installation.

**Reviewer's reasons:**

- Text says greater than or equal to 500 HP and less than 1,350 HP, not 1,349 HP. ("Lean-burn engines between 500 HP and 1,349 HP" -> "Lean-burn engines of 500 HP or more and less than 1,350 HP")

**Reviewer would write (not applied):**

After July 1, 2009, you may not install a stationary spark-ignition engine rated at 500 HP or more unless it meets the emission standards in § 60.4233. Lean-burn engines of 500 HP or more and less than 1,350 HP that don't meet § 60.4233 have until January 1, 2010 before they too are prohibited from installation.

## 60. `sec-16-I-F`

**Current summary (live, unchanged):**

If a governmental entity, contractor, or supplier in the AIR program area wants to use a different test method to measure percent fines or durability index than the ones specified in this regulation, the Air Pollution Control Division and EPA may approve it if they determine the alternative method gives results equivalent to the required test procedures.

**Reviewer's reasons:**

- Text names no applicant parties or program area and does not expand 'the Division'. ("If a governmental entity, contractor, or supplier in the AIR program area wants to use a different test method to measure percent fines or durability index than the ones specified in this regulation, the Air Pollution Control Division and EPA may approve it if they determine" -> "Alternative test procedures for percent fines and durability index may be approved by the Division and EPA if they determine")
- Matches the wording of the text. ("equivalent to the required test procedures" -> "equivalent to the test procedures of this regulation")

**Reviewer would write (not applied):**

Alternative test procedures for percent fines and durability index may be approved by the Division and EPA if they determine the alternative method gives results equivalent to the test procedures of this regulation.

## 61. `sec-24-A-II-C-1-b`

**Current summary (live, unchanged):**

If an existing source in the 1-hour ozone nonattainment or attainment maintenance area or the 8-Hour Ozone Control Area was already using emission controls on or within the six months before this regulation took effect, it cannot reduce its level of VOC control below what it was actually achieving at that time, even if the regulation would otherwise allow less stringent control. However, no existing source has to control emissions beyond what reasonably available control technology (RACT) would achieve.

**Reviewer's reasons:**

- The text only abbreviates RACT and does not expand it. ("what reasonably available control technology (RACT) would achieve" -> "what RACT would achieve")

**Reviewer would write (not applied):**

If an existing source in the 1-hour ozone nonattainment or attainment maintenance area or the 8-Hour Ozone Control Area was already using emission controls on or within the six months before this regulation took effect, it cannot reduce its level of VOC control below what it was actually achieving at that time, even if the regulation would otherwise allow less stringent control. However, no existing source has to control emissions beyond what RACT would achieve.

## 62. `sec-3-C-II-E-3-i-(i)`

**Current summary (live, unchanged):**

Research laboratories at a manufacturing or industrial facility are exempt from operating permit requirements if they are noncommercial (in-house) and use bench-scale experimental and analytical equipment, including quality control/quality assurance labs, process support labs, environmental labs, and research and development labs.

**Reviewer's reasons:**

- Text does not limit all labs to manufacturing or industrial facilities; only environmental labs are described that way. ("Research laboratories at a manufacturing or industrial facility are exempt" -> "Research laboratories are exempt")
- Text qualifies environmental laboratories as those supporting a manufacturing or industrial facility. ("environmental labs," -> "environmental labs supporting a manufacturing or industrial facility,")

**Reviewer would write (not applied):**

Research laboratories are exempt from operating permit requirements if they are noncommercial (in-house) and use bench-scale experimental and analytical equipment, including quality control/quality assurance labs, process support labs, environmental labs supporting a manufacturing or industrial facility, and research and development labs.

## 63. `sec-p192-192.933-(d)-(3)-(vi)`

**Current summary (live, unchanged):**

A gas transmission pipeline operator does not have to schedule immediate remediation of a crack or crack-like defect if the predicted failure pressure (calculated per § 192.712(d)) is at least 1.39 times the MAOP in Class 1 locations or in Class 2 locations containing uprated Class 1 pipe, or at least 1.50 times the MAOP in all other Class 2, Class 3, and Class 4 locations. The operator must record and monitor these conditions during later risk and integrity assessments for any change that might require remediation.

**Reviewer's reasons:**

- Text says the operator is not required to schedule remediation of these conditions; 'immediate' is not in the text. ("does not have to schedule immediate remediation" -> "does not have to schedule remediation")

**Reviewer would write (not applied):**

A gas transmission pipeline operator does not have to schedule remediation of a crack or crack-like defect if the predicted failure pressure (calculated per § 192.712(d)) is at least 1.39 times the MAOP in Class 1 locations or in Class 2 locations containing uprated Class 1 pipe, or at least 1.50 times the MAOP in all other Class 2, Class 3, and Class 4 locations. The operator must record and monitor these conditions during later risk and integrity assessments for any change that might require remediation.

## 64. `sec-20-E-IV-A`

**Current summary (live, unchanged):**

For 2027 and later model-year heavy-duty engines and vehicles that are subject to a recall in California, manufacturers must conduct the same recall campaign in Colorado under 13 CCR 2109–2135 (incorporated by reference), unless the manufacturer shows CDPHE that the recall does not apply to vehicles registered in Colorado.

**Reviewer's reasons:**

- Text says recall campaigns pursuant to those sections; no 'same' campaign or incorporation by reference is stated. ("conduct the same recall campaign in Colorado under 13 CCR 2109–2135 (incorporated by reference)" -> "undertake recall campaigns in Colorado under California Code of Regulations, Title 13, Sections 2109–2135")
- Text names 'the Department' and does not expand it to CDPHE. ("shows CDPHE that the recall does not apply" -> "demonstrates to the Department that the recall is not applicable")

**Reviewer would write (not applied):**

For 2027 and later model-year heavy-duty engines and vehicles that are subject to a recall in California, manufacturers must undertake recall campaigns in Colorado under California Code of Regulations, Title 13, Sections 2109–2135, unless the manufacturer demonstrates to the Department that the recall is not applicable to vehicles registered in Colorado.

## 65. `sec-p191-191.23-(a)-(11)`

**Current summary (live, unchanged):**

Pipeline operators must report any malfunction or operating error that causes the pressure in an underground natural gas storage facility (UNGSF) using a salt cavern to drop below its minimum allowable operating pressure set by the facility's state or federal operating permit or certificate, whichever is higher.

**Reviewer's reasons:**

- The text only abbreviates UNGSF and does not expand it. ("an underground natural gas storage facility (UNGSF)" -> "a UNGSF")

**Reviewer would write (not applied):**

Pipeline operators must report any malfunction or operating error that causes the pressure in a UNGSF using a salt cavern to drop below its minimum allowable operating pressure set by the facility's state or federal operating permit or certificate, whichever is higher.

## 66. `sec-proc-B-V-B-11`

**Current summary (live, unchanged):**

The Commission or the Hearing Officer may cancel, continue, or reschedule a rulemaking hearing on their own or after a written motion from the Division or a Party, if they find good cause under § 24-4-103(13), C.R.S. When a hearing is rescheduled, the new date, time, and place may be announced through an amended notice under Section V.B.10. or by a statement at the original hearing. Cancellations may be announced on the Commission's website or at the original hearing time and place.

**Reviewer's reasons:**

- Text says the order is issued in accordance with the statute, to a later date, with good cause in their discretion. ("may cancel, continue, or reschedule a rulemaking hearing on their own or after a written motion from the Division or a Party, if they find good cause under § 24-4-103(13), C.R.S." -> "may, in accordance with § 24-4-103(13), C.R.S., cancel, continue, or reschedule a rulemaking hearing to a later date on their own or after a written motion from the Division or a Party, if they find good cause.")

**Reviewer would write (not applied):**

The Commission or the Hearing Officer may, in accordance with § 24-4-103(13), C.R.S., cancel, continue, or reschedule a rulemaking hearing to a later date on their own or after a written motion from the Division or a Party, if they find good cause. When a hearing is rescheduled, the new date, time, and place may be announced through an amended notice under Section V.B.10. or by a statement at the original hearing. Cancellations may be announced on the Commission's website or at the original hearing time and place.

## 67. `sec-gp09-VII-A-2`

**Current summary (live, unchanged):**

The permit requires owners or operators of new or modified sources in Disproportionately Impacted Communities to pay community monitoring fees under Regulation Number 3, Part B, Section III.J.3., or to comply with well production facility monitoring under Section III.J.4. of Part B. You must follow whichever monitoring method you selected on your registration form.

**Reviewer's reasons:**

- Parent paragraph VII.A. requires a notification at registration indicating compliance by one of the two options. ("The permit requires owners or operators of new or modified sources in Disproportionately Impacted Communities to pay community monitoring fees under Regulation Number 3, Part B, Section III.J.3., or to comply with well production facility monitoring under Section III.J.4. of Part B." -> "The permit requires owners or operators of new or modified sources in Disproportionately Impacted Communities to submit a notification at the time of registration indicating the source will comply with the monitoring requirements, either by paying community monitoring fees under Regulation Number 3, Part B, Section III.J.3., or by complying with well production facility monitoring under Section III.J.4. of Part B.")

**Reviewer would write (not applied):**

The permit requires owners or operators of new or modified sources in Disproportionately Impacted Communities to submit a notification at the time of registration indicating the source will comply with the monitoring requirements, either by paying community monitoring fees under Regulation Number 3, Part B, Section III.J.3., or by complying with well production facility monitoring under Section III.J.4. of Part B. You must follow whichever monitoring method you selected on your registration form.

## 68. `sec-7-B-VIII-B-5`

**Current summary (live, unchanged):**

This provision applies to intensity operators subject to Section VIII.B.1. and requires them to achieve a greenhouse gas intensity in calendar years 2026, 2028, and 2029 that is less than or equal to the target set for the immediately preceding year under Sections VIII.B.2. and VIII.B.3. (for example, in 2026 they must meet the 2025 target). This effectively gives operators an additional year to meet certain annual targets in those specified years.

**Reviewer's reasons:**

- The text says nothing about giving operators an additional year; this is an added characterization. ("This effectively gives operators an additional year to meet certain annual targets in those specified years." -> "")

**Reviewer would write (not applied):**

This provision applies to intensity operators subject to Section VIII.B.1. and requires them to achieve a greenhouse gas intensity in calendar years 2026, 2028, and 2029 that is less than or equal to the target set for the immediately preceding year under Sections VIII.B.2. and VIII.B.3. (for example, in 2026 they must meet the 2025 target).

## 69. `sec-p195-195.9`

**Current summary (live, unchanged):**

Operators of pipelines on the Outer Continental Shelf must identify the specific points where their operating responsibility transfers to a producing operator. If a transfer point is above water and can't be durably marked, the operator must show it on a schematic kept near the transfer point. If a transfer point is subsea, the operator must identify it on a schematic kept at the nearest upstream facility and provide it to PHMSA on request. If adjoining operators cannot agree on a transfer point, the PHMSA Regional Director and the Bureau of Ocean Energy Management Regional Supervisor will jointly determine it.

**Reviewer's reasons:**

- Text sets the September 15, 1998 date, says 'Regional Director' without PHMSA, and gives the full bureau name. ("If adjoining operators cannot agree on a transfer point, the PHMSA Regional Director and the Bureau of Ocean Energy Management Regional Supervisor will jointly determine it." -> "If adjoining operators have not agreed on a transfer point by September 15, 1998, the Regional Director and the Bureau of Ocean Energy Management, Regulation and Enforcement Regional Supervisor will jointly determine it.")

**Reviewer would write (not applied):**

Operators of pipelines on the Outer Continental Shelf must identify the specific points where their operating responsibility transfers to a producing operator. If a transfer point is above water and can't be durably marked, the operator must show it on a schematic kept near the transfer point. If a transfer point is subsea, the operator must identify it on a schematic kept at the nearest upstream facility and provide it to PHMSA on request. If adjoining operators have not agreed on a transfer point by September 15, 1998, the Regional Director and the Bureau of Ocean Energy Management, Regulation and Enforcement Regional Supervisor will jointly determine it.

## 70. `sec-ecmc-806-b`

**Current summary (live, unchanged):**

An operator must collect a representative sample of injection fluid at the injection facility and analyze it every 5 years after the initial analysis, or every 5 years after the most recent change-of-source analysis, whichever is later.

**Reviewer's reasons:**

- The text states no 'whichever is later' rule; it says 5 years after the initial analysis or after the most recent change of source analysis. (", whichever is later." -> ".")

**Reviewer would write (not applied):**

An operator must collect a representative sample of injection fluid at the injection facility and analyze it every 5 years after the initial analysis, or every 5 years after the most recent change-of-source analysis.

## 71. `sec-31-A-IV-L`

**Current summary (live, unchanged):**

"Designated Representative" means the individual chosen by a binding agreement between the owner and operator who acts according to the certification statement in Part H, Section II.A.

**Reviewer's reasons:**

- Text says "an individual selected by an agreement binding on the owner or operator", not an agreement between the owner and operator. ("the individual chosen by a binding agreement between the owner and operator" -> "an individual selected by an agreement binding on the owner or operator")

**Reviewer would write (not applied):**

"Designated Representative" means an individual selected by an agreement binding on the owner or operator who acts according to the certification statement in Part H, Section II.A.

## 72. `sec-9-IV-D-5`

**Current summary (live, unchanged):**

The agency issuing the general open burning permit (either the Division or an Authorized Local Agency) may set limits on how fast the wind can be blowing when you burn, in order to keep smoke away from sensitive areas.

**Reviewer's reasons:**

- Text says only "the authority granting the permit"; it names neither the Division nor an Authorized Local Agency. ("The agency issuing the general open burning permit (either the Division or an Authorized Local Agency)" -> "The authority granting the general open burning permit")

**Reviewer would write (not applied):**

The authority granting the general open burning permit may set limits on how fast the wind can be blowing when you burn, in order to keep smoke away from sensitive areas.

## 73. `sec-ooooc-60.5420c-(b)-(9)-(vi)`

**Current summary (live, unchanged):**

If you operate a pump and comply with the emission rules by routing emissions to a process (rather than a control device or flare), you must report the information listed in paragraphs (b)(10)(i) through (iv) of this same section. (Note: the specific items you must report are in those cross-referenced paragraphs, which are not shown here.)

**Reviewer's reasons:**

- Text names pump designated facilities and § 60.5395c(a) or (b)(2); it says nothing about control devices or flares. ("If you operate a pump and comply with the emission rules by routing emissions to a process (rather than a control device or flare)" -> "If you operate a pump designated facility and comply with the requirements of § 60.5395c(a) or (b)(2) by routing emissions to a process")

**Reviewer would write (not applied):**

If you operate a pump designated facility and comply with the requirements of § 60.5395c(a) or (b)(2) by routing emissions to a process, you must report the information listed in paragraphs (b)(10)(i) through (iv) of this same section. (Note: the specific items you must report are in those cross-referenced paragraphs, which are not shown here.)

## 74. `sec-ooooc-60.5412c-(a)-(1)-(ii)`

**Current summary (live, unchanged):**

If you use an enclosed combustion device (like a thermal oxidizer or incinerator) and you prove during your performance test that combustion zone temperature reliably indicates destruction efficiency, you must operate at or above the minimum temperature you established during that test. During the performance test you must continuously record the combustion zone temperature and average it for each test run; the minimum temperature limit you must meet going forward is the average of those test-run averages.

**Reviewer's reasons:**

- Parent paragraph lists these examples; thermal oxidizer is not named. ("(like a thermal oxidizer or incinerator)" -> "(like a thermal vapor incinerator, catalytic vapor incinerator, boiler, or process heater)")
- Text refers to the most recent performance test. ("the minimum temperature you established during that test" -> "the minimum temperature established during the most recent performance test")

**Reviewer would write (not applied):**

If you use an enclosed combustion device (like a thermal vapor incinerator, catalytic vapor incinerator, boiler, or process heater) and you prove during your performance test that combustion zone temperature reliably indicates destruction efficiency, you must operate at or above the minimum temperature established during the most recent performance test. During the performance test you must continuously record the combustion zone temperature and average it for each test run; the minimum temperature limit you must meet going forward is the average of those test-run averages.

## 75. `sec-ecmc-912-b-(1)-G`

**Current summary (live, unchanged):**

If you discover a spill or release and cannot immediately figure out how much spilled – including any amount that comes up to the surface from underground – you must report it to the Director within 24 hours of discovery (verbally, by email, or on Form 19). This applies even if the volume turns out to be small once you measure it.

**Reviewer's reasons:**

- The provision covers a suspected or actual Spill or Release. ("If you discover a spill or release and cannot" -> "If you discover a suspected or actual spill or release and cannot")
- The text says nothing about the volume turning out small after measurement; this sentence adds scope not stated. ("This applies even if the volume turns out to be small once you measure it." -> "")

**Reviewer would write (not applied):**

If you discover a suspected or actual spill or release and cannot immediately figure out how much spilled – including any amount that comes up to the surface from underground – you must report it to the Director within 24 hours of discovery (verbally, by email, or on Form 19).

## 76. `sec-gp08-I-A-1`

**Current summary (live, unchanged):**

"Storage Tank" means any fixed-roof storage vessel or series of storage vessels manifolded together by liquid line, with "storage vessel" defined the same way as in the federal NSPS OOOO and OOOOa standards (40 CFR Part 60).

**Reviewer's reasons:**

- Text does not use the acronym NSPS; it names Subpart OOOO and OOOOa, Standards of Performance for Crude Oil and Natural Gas Facilities. ("the federal NSPS OOOO and OOOOa standards (40 CFR Part 60)" -> "the Standards of Performance for Crude Oil and Natural Gas Facilities, 40 CFR Part 60, Subparts OOOO and OOOOa")

**Reviewer would write (not applied):**

"Storage Tank" means any fixed-roof storage vessel or series of storage vessels manifolded together by liquid line, with "storage vessel" defined the same way as in the Standards of Performance for Crude Oil and Natural Gas Facilities, 40 CFR Part 60, Subparts OOOO and OOOOa.

## 77. `sec-gp05-VIII-C-1-a-(iii)`

**Current summary (live, unchanged):**

The permit requires you to submit a new APEN if emissions of any non-criteria reportable pollutant increase by 50% or by five tons per year (whichever is less) above what you reported on your last APEN.

**Reviewer's reasons:**

- Parent paragraph VIII.C.1.a. sets the April 30th annual deadline for the year after the increase; the text does not say 'submit a new APEN'. ("The permit requires you to submit a new APEN if emissions of any non-criteria reportable pollutant increase by 50% or by five tons per year (whichever is less) above what you reported on your last APEN." -> "The permit requires you to report annually by April 30th of the year following a significant increase in emissions, which includes an increase in emissions of any non-criteria reportable pollutant by 50% or by five tons per year (whichever is less) above what you reported on your last APEN.")

**Reviewer would write (not applied):**

The permit requires you to report annually by April 30th of the year following a significant increase in emissions, which includes an increase in emissions of any non-criteria reportable pollutant by 50% or by five tons per year (whichever is less) above what you reported on your last APEN.

## 78. `sec-ecmc-100-DEF-SEQUESTRATION-ESTATE-OWNER`

**Current summary (live, unchanged):**

A sequestration estate owner is anyone who owns all or part of the subsurface estate used for geologic storage operations, as shown in the county records where that estate is located, or anyone who has rights to purchase it under a recorded contract.

**Reviewer's reasons:**

- Text uses the term Sequestration Estate, not subsurface estate. ("the subsurface estate used for geologic storage operations" -> "the Sequestration Estate used for geologic storage operations")
- Text refers to Commission records as well as the county's. ("as shown in the county records where that estate is located" -> "as shown in the records of the Energy and Carbon Management Commission and the county in which that estate is located")
- Text says 'such rights under a recorded contract to purchase'. ("anyone who has rights to purchase it under a recorded contract" -> "anyone who has such rights under a recorded contract to purchase")

**Reviewer would write (not applied):**

A sequestration estate owner is anyone who owns all or part of the Sequestration Estate used for geologic storage operations, as shown in the records of the Energy and Carbon Management Commission and the county in which that estate is located, or anyone who has such rights under a recorded contract to purchase.

## 79. `sec-oooob-60.5420b-(b)-(11)-(v)-(P)`

**Current summary (live, unchanged):**

If your control device had no deviations during the annual report period under the two immediately preceding paragraphs (N and O), you must include a statement in your annual report saying there were no deviations for that control device.

**Reviewer's reasons:**

- Text cites paragraphs (b)(11)(v)(N) or (O) and does not call them the two immediately preceding paragraphs. ("under the two immediately preceding paragraphs (N and O)" -> "under paragraph (b)(11)(v)(N) or (O)")

**Reviewer would write (not applied):**

If your control device had no deviations during the annual report period under paragraph (b)(11)(v)(N) or (O), you must include a statement in your annual report saying there were no deviations for that control device.

## 80. `sec-7-A-II-A-1-a`

**Current summary (live, unchanged):**

This defines the southern portion of Larimer County that falls within the 8-Hour Ozone Control Area by drawing a specific boundary line using latitude and longitude coordinates. If your oil and gas operations are in Larimer County, you need to check if you're south of this boundary line to know if you're in the ozone control area and subject to its requirements.

**Reviewer's reasons:**

- Text only defines the area; it states no requirements or instruction to check, so the advice and scope were removed. ("If your oil and gas operations are in Larimer County, you need to check if you're south of this boundary line to know if you're in the ozone control area and subject to its requirements." -> "The portion of Larimer County (which includes part of Rocky Mountain National Park) that lies south of this line is in the ozone control area.")

**Reviewer would write (not applied):**

This defines the southern portion of Larimer County that falls within the 8-Hour Ozone Control Area by drawing a specific boundary line using latitude and longitude coordinates. The portion of Larimer County (which includes part of Rocky Mountain National Park) that lies south of this line is in the ozone control area.

## 81. `sec-cp-I-G-34`

**Current summary (live, unchanged):**

**DESIGNATED REPRESENTATIVE** means a responsible natural person authorized by the owners and operators of an affected source and all affected units at that source to represent and legally bind them in matters related to the acid rain program, as shown by a certificate of representation submitted under 40 CFR Part 72, Subpart B. Whenever the term "responsible official" is used, it refers to the designated representative for all acid rain program matters.

**Reviewer's reasons:**

- stray Markdown markers removed ("**DESIGNATED REPRESENTATIVE**" -> "DESIGNATED REPRESENTATIVE")

**Reviewer would write (not applied):**

DESIGNATED REPRESENTATIVE means a responsible natural person authorized by the owners and operators of an affected source and all affected units at that source to represent and legally bind them in matters related to the acid rain program, as shown by a certificate of representation submitted under 40 CFR Part 72, Subpart B. Whenever the term "responsible official" is used, it refers to the designated representative for all acid rain program matters.

## 82. `sec-10-III-C-1-d`

**Current summary (live, unchanged):**

The review team must determine whether past obstacles to implementing transportation control measures (TCMs) have been identified and are being overcome, and whether state and local agencies with influence over TCM approvals or funding are giving them maximum priority, as required by 40 CFR Section 93.113(c)(1). The LPA and the Division provide the MPO with information to develop a list of TCMs, and the LPA may ask the MPO, CDOT, the public transit agency, or any other responsible agency to reaffirm its commitment to implement a TCM on the SIP schedule. After consulting with the review team, the MPO determines whether obstacles are being overcome and whether agencies are giving maximum priority to TCMs, identifying the past obstacles, steps taken, the agencies involved, the basis for its finding, and a revised implementation schedule. If the MPO finds that obstacles are not being overcome or that agencies are not giving maximum priority to TCMs, it reports that to the sponsoring agency, the Division, the Commission, and the Governor, and the Commission may schedule a hearing on enforcement or replacement of the TCMs.

**Reviewer's reasons:**

- III.C.1.d.(2) gives the determination to the MPO after consultation with the review team; the text never expands TCM. ("The review team must determine whether past obstacles to implementing transportation control measures (TCMs) have been identified" -> "The review team must address the determination of whether past obstacles to implementing TCMs have been identified")

**Reviewer would write (not applied):**

The review team must address the determination of whether past obstacles to implementing TCMs have been identified and are being overcome, and whether state and local agencies with influence over TCM approvals or funding are giving them maximum priority, as required by 40 CFR Section 93.113(c)(1). The LPA and the Division provide the MPO with information to develop a list of TCMs, and the LPA may ask the MPO, CDOT, the public transit agency, or any other responsible agency to reaffirm its commitment to implement a TCM on the SIP schedule. After consulting with the review team, the MPO determines whether obstacles are being overcome and whether agencies are giving maximum priority to TCMs, identifying the past obstacles, steps taken, the agencies involved, the basis for its finding, and a revised implementation schedule. If the MPO finds that obstacles are not being overcome or that agencies are not giving maximum priority to TCMs, it reports that to the sponsoring agency, the Division, the Commission, and the Governor, and the Commission may schedule a hearing on enforcement or replacement of the TCMs.

