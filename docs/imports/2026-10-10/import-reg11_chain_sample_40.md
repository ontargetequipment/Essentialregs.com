# import-reg11: 3-row spot-check sample

Drawn with seed 20261011 from the rows this chained run reviewed (`pipeline/run_chain.py`, reviewer prompt version 752b4f293e): 0 the reviewer passed and 3 it corrected. For each: the text above the provision as the reviewer saw it (every ancestor, first 700 characters each), the official text (provision plus descendants, first 1200 characters), the summary and, for a correction, the summary before with the reviewer's reasons. For the Cowork spot-check: check each live summary against the official text. Workflow run: https://github.com/ontargetequipment/Essentialregs.com/actions/runs/38109886870

## 1. `sec-11-H-APPENDIX-A-2.11` -- corrected

**Text above the provision:**

> [sec-11-top-REG-11] Code of Colorado Regulations · Regulation Number 11: MOTOR VEHICLE EMISSIONS INSPECTION PROGRAM 5 CCR 1001-13
> [sec-11-H-APPENDIX-A] Appendix A: Appendix A — Technical Specifications Revised Sept 09, 1994
> [sec-11-H-APPENDIX-A-2.0] 2.0.: 2.0. CONSTRUCTION DESIGN

**Official text (provision and descendants):**

> [sec-11-H-APPENDIX-A-2.11] 2.11. Automatic Calibrations The analyzer shall be designed to require an automatic two-point gas calibration for HC, CO, and CO2, and an automatic electrical zero and span check. (O2 shall be measured by ambient air.) The automatic gas calibration shall be conducted every 24 or 72 hours, activated by the internal clock. The option of 24 HOUR calibration will be software selectable, with the default @ 72 hours. Electrical zero and span check (automatic) shall be required prior to each test sequence. User-friendly prompts shall be provided to the inspector to indicate every step needed to properly perform the required gas calibration (including when it is necessary to turn the gas cylinder valve on and off). If the system is not calibrated, or the system fails the calibration or the zero and span check, an error message or fault indication shall be displayed and the analyzer shall be locked out to prevent the performance of an emissions inspection. Lockout will remain until the system is property calibrated and passes a calibration check and zero and span check. The calibration record will contain before and after calibration readings. The gas calibration …

**Summary before (as written):**

This is Appendix A, which sets technical specifications for emissions analyzer manufacturers, not requirements for inspection stations or vehicle owners.

The analyzer must perform an automatic two-point gas calibration for HC, CO and CO₂ and an automatic electrical zero and span check every 24 or 72 hours (software selectable, defaulting to 72 hours), triggered by the internal clock; O₂ is measured by ambient air. An electrical zero and span check must run before each test sequence. The analyzer must prompt the inspector through each calibration step, including when to turn the gas cylinder valve on and off. If the system is not calibrated or fails calibration or the zero and span check, it must display an error message and lock out until properly calibrated and passing both checks. The calibration record must contain before and after readings. Gas calibration and leak check together may take no more than five minutes. The analyzer must be able to print historical calibration data for specified date ranges for the AIR Program Auditor. For HC, CO and CO₂, manufacturers must limit gas usage during calibration to two liters per point and keep loss to less than 0.5 liters in 24 hours if the valve is not shut off; manufacturers must evaluate this capability with at least four analyzers in their certification application and demonstrate it during certification. The analyzer must have a gas calibration port for probe-to-port comparison audits. Span gases for calibration must be within two percent of the listed points (300 ppm propane HC / 1.0% CO / 6.0% CO₂ / balance N₂, and 1200 ppm propane HC / 4.0% CO / 12.0% CO₂ / balance N₂); ambient air may calibrate the O₂ sensor. Standard gases must satisfy the criteria in Clean Air Act Section 207(b) and 40 CFR part 85 subpart W, and all standard gases purchased by the inspection facility must conform to the requirements established in 1990 by the California BAR for Test Analyzer System Calibration Gases and must be purchased from a Division-approved vendor; these requirements include testing and certification of concentration, accuracy, precision and purity within the referenced limits and labeling of individual canisters. The pressure test system must be calibrated every 24 or 72 hours and zero/span checked before each inspection, performed simultaneously with gas calibration; calibration and zero/span checks must pass or the analyzer must lock out until corrected, all calibrations are stored to the Cal.Dat file, pressure calibrations must take no more than five minutes (calculated independently from gas calibration and leak check), and the optional 24-hour option is selectable and defaults to 72 hours.

The provision also introduces automatic leak check, automatic HC hang-up check, vehicle diagnostics, dilution limits and leak detection, engine tachometer, analytical bench accuracy, drift lockout, warm-up, system response time, optical correction factors and interference-effects requirements, detailed in the listed provisions.

**Summary after (live):**

This is Appendix A, which sets technical specifications for emissions analyzer manufacturers, not requirements for inspection stations or vehicle owners.

The analyzer must perform an automatic two-point gas calibration for HC, CO and CO₂ every 24 or 72 hours (software selectable, defaulting to 72 hours), triggered by the internal clock, and an automatic electrical zero and span check; O₂ is measured by ambient air. An electrical zero and span check must run before each test sequence. The analyzer must prompt the inspector through each calibration step, including when to turn the gas cylinder valve on and off. If the system is not calibrated or fails calibration or the zero and span check, it must display an error message and lock out until properly calibrated and passing both checks. The calibration record must contain before and after readings. Gas calibration and leak check together may take no more than five minutes. The analyzer must be able to print historical calibration data for specified date ranges for the AIR Program Auditor. For HC, CO and CO₂, manufacturers must limit gas usage during calibration to two liters per point and keep loss to less than 0.5 liters in 24 hours if the valve is not shut off; manufacturers must evaluate this capability with at least four analyzers in their certification application and demonstrate it during certification. The analyzer must have a gas calibration port for probe-to-port comparison audits. Span gases for calibration must be within two percent of the listed points (300 ppm propane HC / 1.0% CO / 6.0% CO₂ / balance N₂, and 1200 ppm propane HC / 4.0% CO / 12.0% CO₂ / balance N₂); ambient air may calibrate the O₂ sensor. Standard gases must satisfy the criteria in Clean Air Act Section 207(b) and 40 CFR part 85 subpart W, and all standard gases purchased by the inspection facility must conform to the requirements established in 1990 by the California BAR for Test Analyzer System Calibration Gases and must be purchased from a Division-approved vendor; these requirements include testing and certification of concentration, accuracy, precision and purity within the referenced limits and labeling of individual canisters. The pressure test system must be calibrated every 24 or 72 hours and zero/span checked before each inspection, and pressure calibration checks should be performed simultaneously with gas calibration; calibration and zero/span checks must pass or the analyzer must lock out until corrected, all calibrations are stored to the Cal.Dat file, pressure calibrations must take no more than five minutes (calculated independently from gas calibration and leak check), and the optional 24-hour option is selectable and defaults to 72 hours.

The provision also introduces automatic leak check, automatic HC hang-up check, vehicle diagnostics, dilution limits and leak detection, engine tachometer, analytical bench accuracy, drift lockout, warm-up, system response time, optical correction factors and interference-effects requirements, detailed in the listed provisions.

**Reviewer's reasons:**

- The 24/72 hour interval and clock activation apply to the gas calibration; the electrical zero and span check is required prior to each test sequence. ("an automatic two-point gas calibration for HC, CO and CO₂ and an automatic electrical zero and span check every 24 or 72 hours (software selectable, defaulting to 72 hours), triggered by the internal clock;" -> "an automatic two-point gas calibration for HC, CO and CO₂ every 24 or 72 hours (software selectable, defaulting to 72 hours), triggered by the internal clock, and an automatic electrical zero and span check;")
- The text says 'should', not 'must', for simultaneous performance. ("performed simultaneously with gas calibration;" -> "and pressure calibration checks should be performed simultaneously with gas calibration;")

## 2. `sec-11-top-REG-11` -- corrected

**Text above the provision:**

> (none: a top-level row)

**Official text (provision and descendants):**

> [sec-11-top-REG-11] MOTOR VEHICLE EMISSIONS INSPECTION PROGRAM 5 CCR 1001-13  [sec-11-P-A] PART A — General Provisions, Area of Applicability, Schedules for Obtaining Certification of Emissions Control, Definitions, Exemptions, and Clean Screening/Remote Sensing  [sec-11-A-I] APPLICABILITY Subject to the provisions described in Sections I.A and I.B of this Part A and pursuant to the schedule in Section I.C. and V.B. of this Part A , all non-diesel fueled motor vehicles which are registered in the AIR Program area or which motor vehicle is owned or operated by a non-resident who meets the requirements of Section, 42-4-310(1)(c)(I), C.R.S., will be subject to On-Board Diagnostics and/or an exhaust and evaporative emissions, and smoke opacity inspection as a prerequisite to initial or renewal of the vehicle registration. Any person owning or operating a business and any post- secondary educational institution located in the program area as defined in Section I.A. shall annually inform by written notice all persons employed by such business or attending classes that they are required to comply with the provisions of this regulation. The provisions of this regulation applicable to Larim…

**Summary before (as written):**

Colorado Regulation Number 11 establishes the state's motor vehicle emissions inspection program, covering inspection procedures, emissions limits, equipment standards, and licensing requirements for inspection stations, mechanics, and inspectors. The regulation applies to vehicle owners subject to emissions testing, licensed inspection and repair facilities, emissions inspectors and mechanics, fleets, motor vehicle dealers operating test facilities, and analyzer manufacturers. It sets maximum allowable emissions limits for light-duty and heavy-duty vehicles, prescribes test procedures for exhaust, evaporative and visible emissions and on-board diagnostics, defines program areas (basic and enhanced) and exemptions, and establishes prohibited acts and penalties to ensure proper inspections and repairs.

**Summary after (live):**

Colorado Regulation Number 11 establishes the state's motor vehicle emissions inspection program, covering inspection procedures, emissions limits, equipment standards, and licensing requirements for inspection stations, mechanics, and inspectors. The regulation applies to vehicle owners subject to emissions testing, licensed inspection and repair facilities, emissions inspectors and mechanics, fleets, and motor vehicle dealers operating test facilities. It sets maximum allowable emissions limits for light-duty and heavy-duty vehicles, prescribes test procedures for exhaust, evaporative and visible emissions and on-board diagnostics, defines program areas (basic and enhanced) and exemptions, and establishes prohibited acts and penalties to ensure proper inspections and repairs.

**Reviewer's reasons:**

- The text names no analyzer manufacturers as a regulated party; Part B covers analyzer system standards only. ("fleets, motor vehicle dealers operating test facilities, and analyzer manufacturers." -> "and fleets, and motor vehicle dealers operating test facilities.")

## 3. `sec-11-H-APPENDIX-A-2.11-F` -- corrected

**Text above the provision:**

> [sec-11-top-REG-11] Code of Colorado Regulations · Regulation Number 11: MOTOR VEHICLE EMISSIONS INSPECTION PROGRAM 5 CCR 1001-13
> [sec-11-H-APPENDIX-A] Appendix A: Appendix A — Technical Specifications Revised Sept 09, 1994
> [sec-11-H-APPENDIX-A-2.0] 2.0.: 2.0. CONSTRUCTION DESIGN
> [sec-11-H-APPENDIX-A-2.11] 2.11.: 2.11. Automatic Calibrations The analyzer shall be designed to require an automatic two-point gas calibration for HC, CO, and CO2, and an automatic electrical zero and span check. (O2 shall be measured by ambient air.) The automatic gas calibration shall be conducted every 24 or 72 hours, activated by the internal clock. The option of 24 HOUR calibration will be software selectable, with the default @ 72 hours. Electrical zero and span check (automatic) shall be required prior to each test sequence. User-friendly prompts shall be provided to the inspector to indicate every step needed to properly perform the required gas calibration (including when it is nec…

**Official text (provision and descendants):**

> [sec-11-H-APPENDIX-A-2.11-F] 2.11.F. Analytical Bench Accuracy Each analyzer shall meet the following analytical accuracy requirement: Analytical bench accuracy requirements (Channel / Range / Accuracy) Channel | Range | Accuracy HC ppm | 0-400 | ±12ppm (blank) | 401-1000 | ±30ppm (blank) | 1001- 2000 | ±80ppm CO% | 0-2.00 | ±0.15% (blank) | 2.01-5.00 | 2.040% CO2% | 04.0% | ±0.6 (blank) | 4.1-14.0 | ±0.5% (blank) | 14.1-16.0 | ±0.6% O2% | 0-10.0 | ±0.5% (blank) | 0-10 | ±1.3% The analyzer display resolution electronics shall have sufficient resolution and accuracy to achieve the following: HC 1 ppm HC CO 0.01% CO CO2 0.1% CO2 O2 0.1% O2

**Summary before (as written):**

Appendix A sets analytical accuracy requirements for emissions analyzers. Each analyzer must meet specified accuracy tolerances for HC (±12 to ±80 ppm depending on range), CO (±0.15% to ±0.40%), CO₂ (±0.5% to ±0.6%), and O₂ (±0.5% to ±1.3%), as shown in the table. The analyzer display must resolve to 1 ppm HC, 0.01% CO, 0.1% CO₂, and 0.1% O₂. This is a technical specification for analyzer manufacturers.

**Summary after (live):**

Appendix A sets analytical accuracy requirements for emissions analyzers. Each analyzer must meet specified accuracy tolerances for HC (±12 to ±80 ppm depending on range), CO (±0.15% for the 0-2.00 range; the printed entry for the 2.01-5.00 range is unclear), CO₂ (±0.5% to ±0.6%), and O₂ (±0.5% to ±1.3%), as shown in the table. The analyzer display must resolve to 1 ppm HC, 0.01% CO, 0.1% CO₂, and 0.1% O₂.

**Reviewer's reasons:**

- The text prints "2.040% CO2%" for the 2.01-5.00 range, not ±0.40%. ("CO (±0.15% to ±0.40%)" -> "CO (±0.15% for the 0-2.00 range; the printed entry for the 2.01-5.00 range is unclear)")
- The text says each analyzer must meet the requirement and does not name manufacturers. ("This is a technical specification for analyzer manufacturers." -> "")
