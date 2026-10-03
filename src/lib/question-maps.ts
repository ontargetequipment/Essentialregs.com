import { expandAcronyms } from "@/lib/acronyms";

/**
 * Question maps (Ask Track B, 1 Oct 2026).
 *
 * A flat list of twenty provisions does not answer an applicability
 * question. "What regulations apply to a natural gas-fired engine?" has a
 * structure -- Colorado permitting, the general-permit options, the Colorado
 * standards, the federal NSPS, the federal NESHAP, the definitions -- and two
 * of its canonical rows (JJJJ § 60.4230 and ZZZZ § 63.6585, heading-only
 * applicability sections) never reach the top 10 by retrieval alone.
 *
 * A map is data: a trigger, one sentence naming what decides applicability,
 * and the canonical rows in display order, each with its group and the reason
 * it is there. Retrieval is unchanged; the map is additive. The page shows
 * the canonical rows first inside each group, then the retrieval hits that
 * groupForHit() puts in the same group, then everything else under "Other
 * matches". Adding a map is a data-only change to QUESTION_MAPS (plus
 * `npx tsx scripts/question-map-ids.ts` to regenerate the id list that
 * scripts/corpus_qa.sql check 20 verifies against the database).
 *
 * Pure: no React, no Supabase. The eval script and the page both call
 * matchQuestionMap() so the two never disagree about which map a question
 * takes.
 */

export type MapGroup =
  | "Colorado permitting and APEN"
  | "General Permit options"
  | "Colorado standards"
  | "Federal NSPS"
  | "Federal NESHAP"
  | "ECMC rules"
  | "Federal PHMSA"
  | "Definitions";

/**
 * The eight groups in display order. The first six were air-centric on
 * purpose for the first maps; "ECMC rules" and "Federal PHMSA" (maps batch
 * 4, 2 Oct 2026) sit after the federal air groups and before Definitions.
 */
export const MAP_GROUP_ORDER: MapGroup[] = [
  "Colorado permitting and APEN",
  "General Permit options",
  "Colorado standards",
  "Federal NSPS",
  "Federal NESHAP",
  "ECMC rules",
  "Federal PHMSA",
  "Definitions",
];

/** The heading for retrieval hits groupForHit() puts in no group. */
export const OTHER_GROUP = "Other matches";

/** 40 CFR Part 60 subparts in the corpus: NSPS rows go under "Federal NSPS". */
export const FEDERAL_NSPS_REG_KEYS: readonly string[] = ["ooooa", "oooob", "ooooc", "jjjj", "iiii"];

/** 40 CFR Part 63 subparts in the corpus: NESHAP rows go under "Federal NESHAP". */
export const FEDERAL_NESHAP_REG_KEYS: readonly string[] = ["zzzz"];

/** The ECMC 100-1200 Series rules (one reg_key): ECMC rows go under "ECMC rules". */
export const ECMC_REG_KEYS: readonly string[] = ["ecmc"];

/** 49 CFR Parts 190-199 in the corpus (reg_key p19x): PHMSA rows go under "Federal PHMSA". */
export const PHMSA_REG_KEYS: readonly string[] = ["p190", "p191", "p192", "p193", "p194", "p195", "p196", "p199"];

/**
 * AQCC regulation keys: the numbered regulations 1-31 plus the Common
 * Provisions ("cp") and the Air Quality Standards ("aqs"). A state row with
 * one of these keys goes under "Colorado standards" (Regulation 3, the
 * permitting regulation, is routed before this list is consulted). Keyed by
 * name, like ECMC_REG_KEYS and PHMSA_REG_KEYS above, so a group is a list
 * here plus one line in groupForHit().
 */
export const AQCC_REGULATION_KEYS: readonly string[] = [
  ...Array.from({ length: 31 }, (_, i) => String(i + 1)),
  "cp",
  "aqs",
];

/** Retrieval hits shown per group after the canonical rows. */
export const MAX_HITS_PER_GROUP = 3;
/** Retrieval hits shown under "Other matches". */
export const MAX_OTHER_HITS = 5;

export type MapProvision = {
  id: string;
  group: MapGroup;
  /** One line, shown as "Why it's here: …" on the card. */
  why: string;
};

export type QuestionMap = {
  key: string;
  name: string;
  /** Case-insensitive word-boundary patterns; any match routes the question here. */
  triggers: RegExp[];
  /** One sentence naming what decides applicability. Shown above the groups. */
  factors: string;
  /** Canonical rows, in display order. Every id must exist in provisions (corpus_qa.sql check 20). */
  provisions: MapProvision[];
};

/**
 * Matched first-match-wins in this order. The equipment maps come before the
 * APEN map on purpose: "do I need an APEN for my tank battery" routes to
 * storage-tanks (which carries the APEN rows for tanks), not to the generic
 * APEN map. Batch 2 (2 Oct 2026) added storage-tanks, pneumatic-controllers,
 * dehydrators and apen; every id was verified against the production
 * database on 1 Oct 2026.
 *
 * Two corpus gaps the tanks and dehydrator maps expose, left open on purpose
 * (the corpus roadmap owns the import; do not paper over them with a
 * look-alike row): 40 CFR 63 Subpart HH (the oil and natural gas production
 * NESHAP: glycol dehydrators and storage vessels with flash emissions) is
 * not in the corpus, so the Federal NESHAP group of both maps is empty; and
 * 40 CFR 60 Subpart Kb exists only as Regulation 6's adoption stub
 * (sec-6-A-SUBPART-Kb), which the tanks map lists under Colorado standards.
 *
 * Batch 3 (2 Oct 2026) added combustion-devices, ldar and general-permits,
 * and GP01 to the tanks map; every id was verified against the production
 * database on 2 Oct 2026. The equipment maps stay ahead of the two generic
 * ones, and general-permits sits after the equipment maps on purpose: a
 * GP02 question keeps routing to engines and a GP08 question to tanks, while
 * general-permits catches GP03, GP11 and "which general permit…" questions.
 * One more corpus gap, left open the same way: Regulation 7 Part B's
 * definition sections have no "Enclosed combustion device" or "Flare" row a
 * title search finds, so the combustion-devices map's Definitions group
 * uses the "Air pollution control equipment" and "Approved instrument
 * monitoring method" definitions instead.
 *
 * Batch 4 (2 Oct 2026) added enforcement, the first map that reaches past
 * the air rules, with the "ECMC rules" and "Federal PHMSA" groups; every id
 * was verified against the production database on 2 Oct 2026. It sits after
 * the equipment maps and before general-permits and apen so that "what is
 * the penalty for not filing an APEN" lands here, not on the generic APEN
 * map, while "LDAR enforcement" stays on ldar. The triggers are the
 * enforcement vocabulary (penalty, NOAV, OFV, AOC, compliance advisory,
 * cease and desist, consent order); a bare "violation" does not route, so
 * the odor-dilution eval question keeps taking no map. One more corpus gap,
 * left open the same way: the corpus has no row for the APCD
 * compliance-advisory process or for the Air Act's penalty procedure (CRS
 * §§ 25-7-115 and 25-7-122 are statute, not AQCC rules), so the map's
 * Colorado group leans on Common Provisions III and Procedural Rules
 * VI.D.1. Left open for the corpus roadmap, not papered over with a
 * look-alike row.
 */
export const QUESTION_MAPS: QuestionMap[] = [
  {
    key: "engines",
    name: "Natural gas-fired and diesel engines",
    // Not "compressor" alone: a centrifugal / reciprocating compressor
    // question is a different map.
    triggers: [/\b(?:engines?|rice|gen-?sets?|generators?|reciprocating|jjjj|iiii|zzzz|gp\s?0?2|gp\s?0?6|gp\s?12|gp\s?0?9|gp\s?10)\b/i],
    factors:
      "What applies depends on the fuel (natural gas or diesel), the site-rated horsepower, the date of manufacture, construction or modification, whether the engine is an emergency unit, whether the facility is a major or area source of hazardous air pollutants, and whether it sits in the 8-hour Ozone Control Area or Northern Weld County.",
    provisions: [
      // Colorado permitting and APEN
      { id: "sec-3-A-II-B", group: "Colorado permitting and APEN", why: "APEN filing: when a notice is required and the reporting thresholds" },
      { id: "sec-3-A-II-D-1", group: "Colorado permitting and APEN", why: "APEN exemptions — II.D.1.l exempts engines powering portable drilling rigs" },
      { id: "sec-3-B-II-A", group: "Colorado permitting and APEN", why: "Construction permit: general considerations" },
      { id: "sec-3-B-II-D-1-c", group: "Colorado permitting and APEN", why: "Construction-permit exemption for engines: drilling rigs, emergency generators ≤ 250 hr/yr, < 5 tpy uncontrolled or < 50 hp" },
      // General Permit options
      { id: "sec-gp12-I-A", group: "General Permit options", why: "GP12 — oil and gas well production facilities; natural gas-fired (I.A.1) and diesel (I.A.2) engines; replaced GP09/GP10 for new applicants" },
      { id: "sec-gp02-I-A", group: "General Permit options", why: "GP02 — natural gas-fired RICE at an oil and gas stationary source" },
      { id: "sec-gp06-I-A", group: "General Permit options", why: "GP06 — diesel fuel-fired reciprocating internal combustion engines" },
      { id: "sec-gp09-I-A", group: "General Permit options", why: "GP09 — closed to new registrations July 15, 2026; existing registrations remain active" },
      { id: "sec-gp10-I-A", group: "General Permit options", why: "GP10 — closed to new registrations July 15, 2026; existing registrations remain active" },
      // Colorado standards
      { id: "sec-26-B-I-D", group: "Colorado standards", why: "Reg 26 Part B I.D — natural gas-fired RICE: new, modified and relocated (I.D.3), existing (I.D.4), additional requirements (I.D.5, I.D.6)" },
      { id: "sec-26-B-I", group: "Colorado standards", why: "Reg 26 Part B I — control technology requirements for new and existing engines (I.A, I.B) and their exemptions (I.C)" },
      { id: "sec-26-B-II", group: "Colorado standards", why: "Reg 26 Part B II — stationary and portable combustion equipment in the 8-hour Ozone Control Area or Northern Weld County" },
      { id: "sec-26-C-FEDJJJJ", group: "Colorado standards", why: "Subpart JJJJ as incorporated into Regulation 26, Part C" },
      // Federal NSPS
      { id: "sec-jjjj-60.4230", group: "Federal NSPS", why: "Subpart JJJJ applicability — spark-ignition (natural gas) engines, by manufacture date and horsepower" },
      { id: "sec-jjjj-60.4233", group: "Federal NSPS", why: "Subpart JJJJ emission standards for owners and operators" },
      { id: "sec-iiii-60.4200", group: "Federal NSPS", why: "Subpart IIII applicability — compression-ignition (diesel) engines" },
      { id: "sec-iiii-60.4204", group: "Federal NSPS", why: "Subpart IIII standards — non-emergency engines" },
      { id: "sec-iiii-60.4205", group: "Federal NSPS", why: "Subpart IIII standards — emergency engines" },
      // Federal NESHAP
      { id: "sec-zzzz-63.6585", group: "Federal NESHAP", why: "Subpart ZZZZ applicability — stationary RICE at major and area sources of HAP" },
      { id: "sec-zzzz-63.6590", group: "Federal NESHAP", why: "Subpart ZZZZ — which engines are covered and which are exempt or deferred" },
      { id: "sec-zzzz-63.6595", group: "Federal NESHAP", why: "Subpart ZZZZ compliance dates" },
      // Definitions
      { id: "sec-jjjj-60.4248", group: "Definitions", why: "Subpart JJJJ definitions (emergency engine, rich/lean burn, maximum engine power, …)" },
      { id: "sec-3-A-I-B-36", group: "Definitions", why: "Regulation 3 definition of a non-road engine" },
    ],
  },
  {
    key: "storage-tanks",
    name: "Storage tanks and tank batteries",
    // Not a bare "tank": a tank truck at a bulk plant is Regulation 24, not
    // this map. GP01 (condensate storage tank batteries) already routes here
    // through its acronym expansion, as GP02 routes to engines through its
    // own; since batch 3 it is also an explicit trigger.
    triggers: [
      /\b(?:storage (?:tanks?|vessels?)|tank batter(?:y|ies)|(?:condensate|produced[- ]water|crude[- ]oil|oil|hydrocarbon liquid) tanks?|thief hatch(?:es)?|gp\s?0?1|gp\s?0?5|gp\s?0?8|gp\s?0?7)\b/i,
    ],
    factors:
      "What applies depends on the tank's uncontrolled and controlled VOC emissions, what it stores (condensate, crude oil, intermediate hydrocarbon liquids or produced water), its throughput, when it was built or modified, whether it sits at a well production facility or a midstream or E&P site, whether that site is in the 8-hour Ozone Control Area or Northern Weld County, and — federally — whether the tank battery was constructed, modified or reconstructed after December 6, 2022 (OOOOb) or before (OOOOc).",
    provisions: [
      // Colorado permitting and APEN
      { id: "sec-3-A-II-A", group: "Colorado permitting and APEN", why: "APENs are required for new, modified and existing sources unless exempt under II.D" },
      { id: "sec-3-A-II-B-3", group: "Colorado permitting and APEN", why: "APEN applicability: the uncontrolled actual emission thresholds" },
      { id: "sec-3-A-II-D-1-fff", group: "Colorado permitting and APEN", why: "APEN exemption for storage tanks under 400,000 gallons per year storing listed liquids" },
      { id: "sec-3-B-II-D", group: "Colorado permitting and APEN", why: "Construction permit exemptions — a permit exemption does not remove the APEN requirement" },
      // General Permit options
      { id: "sec-gp01-I-A", group: "General Permit options", why: "GP01 — condensate storage tank batteries" },
      { id: "sec-gp08-I-B", group: "General Permit options", why: "GP08 — oil and gas industry storage tanks (condensate, crude oil, intermediate hydrocarbon liquids, produced water)" },
      { id: "sec-gp05-I-A", group: "General Permit options", why: "GP05 — produced water storage tank batteries" },
      { id: "sec-gp12-I-A-3", group: "General Permit options", why: "GP12 — storage tanks at well production facilities, as one of the covered source types" },
      { id: "sec-gp07-I-A", group: "General Permit options", why: "GP07 — hydrocarbon liquid loadout from tanks" },
      // Colorado standards
      { id: "sec-7-B-I-D", group: "Colorado standards", why: "Reg 7 Part B I.D — storage tank emission controls (I.D.3 control strategy)" },
      { id: "sec-7-B-I-E", group: "Colorado standards", why: "Reg 7 Part B I.E — monitoring of storage tanks and their air pollution control equipment" },
      { id: "sec-7-B-I-F", group: "Colorado standards", why: "Reg 7 Part B I.F — storage tank recordkeeping and reporting" },
      { id: "sec-7-B-II-C", group: "Colorado standards", why: "Reg 7 Part B II.C — storage tanks at E&P operations, well production facilities, disposal wells and compressor stations: controls and monitoring" },
      { id: "sec-6-A-SUBPART-Kb", group: "Colorado standards", why: "NSPS Subpart Kb (volatile organic liquid storage vessels) as adopted by Regulation 6" },
      // Federal NSPS
      { id: "sec-oooob-60.5365b-(e)", group: "Federal NSPS", why: "OOOOb applicability — storage vessel affected facility (tank battery potential-to-emit test)" },
      { id: "sec-oooob-60.5395b", group: "Federal NSPS", why: "OOOOb — GHG and VOC standards for storage vessel affected facilities" },
      { id: "sec-ooooa-60.5365a-(e)", group: "Federal NSPS", why: "OOOOa applicability — storage vessel affected facility (built Sept 18, 2015 – Dec 6, 2022)" },
      { id: "sec-ooooa-60.5395a", group: "Federal NSPS", why: "OOOOa — VOC standards for storage vessel affected facilities" },
      { id: "sec-ooooc-60.5386c-(e)", group: "Federal NSPS", why: "OOOOc applicability — storage vessel designated facility (existing tank batteries)" },
      { id: "sec-ooooc-60.5396c", group: "Federal NSPS", why: "OOOOc — GHG standards for storage vessel designated facilities" },
      // Federal NESHAP: none. 40 CFR 63 Subpart HH is not in the corpus (see the note above QUESTION_MAPS).
      // Definitions
      { id: "sec-7-B-I-B-30", group: "Definitions", why: "Reg 7 Part B I.B — 'Storage tank'" },
      { id: "sec-7-B-I-B-9", group: "Definitions", why: "Reg 7 Part B I.B — 'Condensate storage tank'" },
      { id: "sec-7-B-II-A-43", group: "Definitions", why: "Reg 7 Part B II.A — 'Storage tank' (Section II)" },
      { id: "sec-7-B-I-B-34", group: "Definitions", why: "Reg 7 Part B I.B — 'Well production facility'" },
      { id: "sec-oooob-60.5430b", group: "Definitions", why: "OOOOb definitions (storage vessel, tank battery, potential for VOC emissions)" },
    ],
  },
  {
    key: "pneumatic-controllers",
    name: "Pneumatic controllers and pneumatic pumps",
    triggers: [
      /\b(?:pneumatic (?:controllers?|devices?|pumps?)|process controllers?|(?:high|low|no|zero)[- ]bleed|natural gas[- ](?:driven|actuated) controllers?|intermittent (?:vent )?controllers?)\b/i,
    ],
    factors:
      "What applies depends on whether the controller or pump is driven by natural gas, whether it is continuous-bleed (high or low) or intermittent, when the facility was built or modified (after December 6, 2022 → OOOOb; earlier → OOOOc and Colorado's 111(d) plan), whether the site has access to electrical power, whether it is a natural gas processing plant, and whether it sits in the 8-hour Ozone Control Area or Northern Weld County.",
    provisions: [
      // Colorado standards
      { id: "sec-7-B-III", group: "Colorado standards", why: "Reg 7 Part B III — natural gas-actuated pneumatic controllers and pumps (the section)" },
      { id: "sec-7-B-III-A", group: "Colorado standards", why: "Reg 7 Part B III.A — applicability" },
      { id: "sec-7-B-III-C", group: "Colorado standards", why: "Reg 7 Part B III.C — controller requirements (no-bleed, low-bleed, retrofit schedules)" },
      { id: "sec-7-B-III-D", group: "Colorado standards", why: "Reg 7 Part B III.D — monitoring" },
      { id: "sec-7-B-III-F", group: "Colorado standards", why: "Reg 7 Part B III.F — (State Only) inspection and enhanced response" },
      { id: "sec-7-B-I-K", group: "Colorado standards", why: "Reg 7 Part B I.K — pneumatic pumps" },
      // Federal NSPS
      { id: "sec-oooob-60.5365b-(d)", group: "Federal NSPS", why: "OOOOb applicability — process controller affected facility" },
      { id: "sec-oooob-60.5390b", group: "Federal NSPS", why: "OOOOb — GHG and VOC standards for process controllers (zero emissions; Alaska exception)" },
      { id: "sec-oooob-60.5393b", group: "Federal NSPS", why: "OOOOb — standards for pump affected facilities" },
      { id: "sec-ooooa-60.5365a-(d)", group: "Federal NSPS", why: "OOOOa applicability — pneumatic controller affected facility" },
      { id: "sec-ooooa-60.5390a", group: "Federal NSPS", why: "OOOOa — GHG and VOC standards for pneumatic controllers (bleed-rate limits)" },
      { id: "sec-ooooc-60.5386c-(d)", group: "Federal NSPS", why: "OOOOc applicability — process controller designated facility (existing)" },
      { id: "sec-ooooc-60.5394c", group: "Federal NSPS", why: "OOOOc — GHG standards for process controller designated facilities" },
      // Definitions
      { id: "sec-7-B-III-B-17", group: "Definitions", why: "Reg 7 Part B III.B — 'Pneumatic controller'" },
      { id: "sec-7-B-III-B-9", group: "Definitions", why: "Reg 7 Part B III.B — 'High-bleed pneumatic controller'" },
      { id: "sec-7-B-III-B-11", group: "Definitions", why: "Reg 7 Part B III.B — 'Low-bleed pneumatic controller'" },
      { id: "sec-7-B-III-B-10", group: "Definitions", why: "Reg 7 Part B III.B — 'Intermittent pneumatic controller'" },
      { id: "sec-7-B-III-B-14", group: "Definitions", why: "Reg 7 Part B III.B — 'No-bleed pneumatic controller'" },
      { id: "sec-7-B-III-B-12", group: "Definitions", why: "Reg 7 Part B III.B — 'Natural gas-driven pneumatic controller' (Colorado 111(d) plan)" },
    ],
  },
  {
    key: "dehydrators",
    name: "Glycol natural gas dehydrators",
    triggers: [/\b(?:dehydrators?|dehy|glycol|still vents?|reboilers?)\b/i],
    factors:
      "What applies depends on the dehydrator's uncontrolled actual VOC and benzene emissions from the still vent and flash tank against the Reg 7 thresholds (per unit and facility-wide), when it was built or modified, whether it sits in the 8-hour Ozone Control Area or Northern Weld County, its distance from occupied buildings, and — federally — whether the facility is a major or area source of hazardous air pollutants under 40 CFR 63 Subpart HH (not yet in this corpus).",
    provisions: [
      // Colorado permitting and APEN
      { id: "sec-3-A-II-A", group: "Colorado permitting and APEN", why: "APENs are required for new, modified and existing sources unless exempt under II.D" },
      { id: "sec-3-A-II-B-3", group: "Colorado permitting and APEN", why: "APEN applicability: the uncontrolled actual emission thresholds" },
      // Colorado standards
      { id: "sec-7-B-I-H", group: "Colorado standards", why: "Reg 7 Part B I.H — emission reductions from glycol natural gas dehydrators (statewide)" },
      { id: "sec-7-B-I-H-1", group: "Colorado standards", why: "Reg 7 Part B I.H.1 — still vent and flash tank control requirement since May 1, 2005" },
      { id: "sec-7-B-I-H-3", group: "Colorado standards", why: "Reg 7 Part B I.H.3 — the thresholds and locations where I.H.1 and I.H.2 apply" },
      { id: "sec-7-B-II-D", group: "Colorado standards", why: "Reg 7 Part B II.D — (State Only) dehydrator controls in the ozone nonattainment area" },
      { id: "sec-7-B-II-D-2", group: "Colorado standards", why: "Reg 7 Part B II.D.2 — where the II.D.1 control requirement applies" },
      { id: "sec-7-B-II-D-3", group: "Colorado standards", why: "Reg 7 Part B II.D.3 — control requirement since May 1, 2015" },
      // Federal NESHAP: none. 40 CFR 63 Subpart HH is not in the corpus (see the note above QUESTION_MAPS).
      // Definitions
      { id: "sec-7-B-I-B-17", group: "Definitions", why: "Reg 7 Part B I.B — 'Glycol natural gas dehydrator'" },
      { id: "sec-7-B-II-A-16", group: "Definitions", why: "Reg 7 Part B II.A — 'Glycol natural gas dehydrator' (Section II)" },
    ],
  },
  {
    key: "combustion-devices",
    name: "Flares and enclosed combustion devices",
    // After the equipment maps: "flare on my tank battery" is a tanks question
    // that happens to name its control device.
    triggers: [
      /\b(?:flares?|flaring|enclosed combustion devices?|ecds?|combustors?|vapor combust(?:ors?|ion)|thermal oxidi[sz]ers?|control devices?|destruction efficiency|auto-?igniters?)\b/i,
    ],
    factors:
      "What applies depends on the kind of device (open flare, enclosed combustion device or other control device), what it controls (tanks, dehydrators, pneumatics, compressors, well completions), the design destruction efficiency it must meet and how that is shown (manufacturer test or an initial and periodic performance test), the auto-igniter, continuous-pilot and monitoring requirements, when the device was installed (Reg 7 Part B II.B.2.h performance tests apply from February 14, 2022), and federally which subpart the controlled affected facility falls under.",
    provisions: [
      // Colorado standards
      { id: "sec-7-B-II-B-1", group: "Colorado standards", why: "Reg 7 Part B II.B.1 — good air pollution control practices and prevention of emissions" },
      { id: "sec-7-B-II-B-2", group: "Colorado standards", why: "Reg 7 Part B II.B.2 — general requirements for air pollution control equipment used to comply with Section II" },
      { id: "sec-7-B-II-B-2-h", group: "Colorado standards", why: "Reg 7 Part B II.B.2.h — performance tests for enclosed combustion devices (since February 14, 2022)" },
      { id: "sec-7-B-I-C-1", group: "Colorado standards", why: "Reg 7 Part B I.C.1 — general requirements for Section I control equipment" },
      { id: "sec-7-B-I-E-2", group: "Colorado standards", why: "Reg 7 Part B I.E.2 — monitoring requirements for storage-tank control equipment" },
      { id: "sec-7-B-I-E-3", group: "Colorado standards", why: "Reg 7 Part B I.E.3 — performance testing requirements" },
      // Federal NSPS
      { id: "sec-oooob-60.5412b", group: "Federal NSPS", why: "OOOOb — control device requirements for initial compliance (destruction efficiency, design)" },
      { id: "sec-oooob-60.5413b", group: "Federal NSPS", why: "OOOOb — performance testing procedures for control devices" },
      { id: "sec-oooob-60.5417b", group: "Federal NSPS", why: "OOOOb — continuous monitoring requirements for control devices" },
      { id: "sec-ooooa-60.5412a", group: "Federal NSPS", why: "OOOOa — control device requirements for initial compliance" },
      { id: "sec-ooooa-60.5413a", group: "Federal NSPS", why: "OOOOa — performance testing procedures for control devices" },
      { id: "sec-ooooc-60.5412c", group: "Federal NSPS", why: "OOOOc — control device requirements for existing designated facilities" },
      // Definitions: no "Enclosed combustion device" or "Flare" row in Reg 7 Part B's
      // definition sections (see the note above QUESTION_MAPS).
      { id: "sec-7-B-II-A-1", group: "Definitions", why: "Reg 7 Part B II.A — 'Air pollution control equipment' (combustion devices, VRUs)" },
      { id: "sec-7-B-II-A-2", group: "Definitions", why: "Reg 7 Part B II.A — 'Approved instrument monitoring method'" },
    ],
  },
  {
    key: "ldar",
    name: "Leak detection and repair at well production facilities and compressor stations",
    triggers: [
      /\b(?:ldar|leak detection|leak inspections?|leak surveys?|fugitive emissions?|fugitives|avo|audio,? visual|ogi|infra-?red camera|ir camera|method 21|component inspections?|compressor stations?)\b/i,
    ],
    factors:
      "What applies depends on the facility type (well production facility or natural gas compressor station), its estimated uncontrolled actual VOC emissions tier (which sets the Reg 7 inspection frequency), when it was constructed (October 15, 2014 for the state program; December 6, 2022 for OOOOb versus OOOOc), whether it sits in the 8-hour Ozone Control Area or within 1,000 feet of an occupied area, the monitoring method used (approved instrument monitoring method, OGI, Method 21 or AVO), and federally whether the site is an OOOOa or OOOOb affected facility or an OOOOc designated facility.",
    provisions: [
      // General Permit options
      { id: "sec-gp12-I-A", group: "General Permit options", why: "GP12 — well production facilities (replaced GP09/GP10 for new applicants)" },
      { id: "sec-gp11-I-A", group: "General Permit options", why: "GP11 — routine or predictable gas venting at well production and centralized production facilities" },
      { id: "sec-gp09-I-A", group: "General Permit options", why: "GP09 — well production facilities, attainment areas; closed to new registrations July 15, 2026" },
      { id: "sec-gp10-I-A", group: "General Permit options", why: "GP10 — well production facilities, nonattainment areas; closed to new registrations July 15, 2026" },
      // Colorado standards
      { id: "sec-7-B-I-L", group: "Colorado standards", why: "Reg 7 Part B I.L — statewide leak detection and repair program for well production facilities and compressor stations" },
      { id: "sec-7-B-I-L-2", group: "Colorado standards", why: "Reg 7 Part B I.L.2 — well production facilities" },
      { id: "sec-7-B-I-L-1", group: "Colorado standards", why: "Reg 7 Part B I.L.1 — natural gas compressor stations" },
      { id: "sec-7-B-I-L-4", group: "Colorado standards", why: "Reg 7 Part B I.L.4 — leaks requiring repair" },
      { id: "sec-7-B-II-E", group: "Colorado standards", why: "Reg 7 Part B II.E — (State Only) LDAR program" },
      { id: "sec-7-B-II-E-4", group: "Colorado standards", why: "Reg 7 Part B II.E.4 — well production facility requirements: inspection frequency by emissions tier" },
      { id: "sec-7-B-II-E-6", group: "Colorado standards", why: "Reg 7 Part B II.E.6 — leaks requiring repair and the approved methods" },
      { id: "sec-7-B-II-F", group: "Colorado standards", why: "Reg 7 Part B II.F — well operation and maintenance at well production facilities" },
      { id: "sec-7-B-II-G", group: "Colorado standards", why: "Reg 7 Part B II.G — (State Only) downhole maintenance and liquids unloading" },
      // Federal NSPS
      { id: "sec-oooob-60.5365b-(i)", group: "Federal NSPS", why: "OOOOb applicability — fugitive emissions components affected facility" },
      { id: "sec-oooob-60.5397b", group: "Federal NSPS", why: "OOOOb — fugitive emissions standards (monitoring frequency, repair)" },
      { id: "sec-oooob-60.5398b", group: "Federal NSPS", why: "OOOOb — alternative fugitive emissions standards (advanced methods)" },
      { id: "sec-ooooa-60.5365a-(i)", group: "Federal NSPS", why: "OOOOa applicability — collection of fugitive emissions components" },
      { id: "sec-ooooa-60.5397a", group: "Federal NSPS", why: "OOOOa — fugitive emissions standards" },
      { id: "sec-ooooc-60.5386c-(h)", group: "Federal NSPS", why: "OOOOc applicability — fugitive emissions components designated facility (existing)" },
      { id: "sec-ooooc-60.5397c", group: "Federal NSPS", why: "OOOOc — fugitive emissions standards for designated facilities" },
      // Definitions
      { id: "sec-7-B-I-B-34", group: "Definitions", why: "Reg 7 Part B I.B — 'Well production facility'" },
      { id: "sec-7-B-I-B-21", group: "Definitions", why: "Reg 7 Part B I.B — 'Natural gas compressor station'" },
      { id: "sec-7-B-I-B-3", group: "Definitions", why: "Reg 7 Part B I.B — 'Approved instrument monitoring method'" },
      { id: "sec-7-B-II-A-10", group: "Definitions", why: "Reg 7 Part B II.A — 'Component'" },
      { id: "sec-3-A-I-B-56", group: "Definitions", why: "Regulation 3 — 'Well production facility'" },
    ],
  },
  {
    key: "enforcement",
    name: "Enforcement and penalties: APCD, ECMC and PHMSA",
    // After the equipment maps (an "LDAR enforcement" question stays on
    // ldar) and before general-permits and apen ("the penalty for not filing
    // an APEN" is an enforcement question). No bare "violation": an odor
    // violation measured in dilutions is a Regulation 2 question, not this.
    triggers: [
      /\b(?:civil penalt(?:y|ies)|penalt(?:y|ies)|noavs?|notices? of (?:alleged|probable) violation|enforcement(?: actions?| matters?| proceedings?)?|compliance advisor(?:y|ies)|orders? finding violation|ofvs?|cease[- ]and[- ]desist|consent orders?|administrative orders? on consent|aocs?)\b/i,
    ],
    factors:
      "What applies depends on whose rule was broken: an AQCC regulation, the SIP or an APCD permit (Common Provisions III — a civil penalty per day of violation up to the CPI-adjusted maximum, with the Division carrying the burden of proof in the hearing); an ECMC rule, order or permit (Rule 523 enforcement process, then Rule 525's penalty schedule by rule class and degree of harm, adjusted for aggravating and mitigating factors, days of violation and voluntary disclosure); or a PHMSA pipeline-safety regulation (49 CFR Part 190 Subpart B — notice of probable violation, response options, assessment considerations and the § 190.223 maximums).",
    provisions: [
      // General Permit options
      { id: "sec-gp12-XI-C-8", group: "General Permit options", why: "GP12 General Terms — violating a permit condition, the Act or an AQCC regulation can bring administrative, civil or criminal enforcement" },
      { id: "sec-gp01-VIII-C-8", group: "General Permit options", why: "GP01 General Terms — the same enforcement clause every general permit carries" },
      // Colorado standards (AQCC Common Provisions and Procedural Rules)
      { id: "sec-cp-III", group: "Colorado standards", why: "Common Provisions III — (State Only) Civil Penalties" },
      { id: "sec-cp-III-A", group: "Colorado standards", why: "Common Provisions III.A — who is liable and the civil penalty per day of violation (CRS § 25-7-122)" },
      { id: "sec-cp-III-B-1", group: "Colorado standards", why: "Common Provisions III.B.1 — the maximum is adjusted annually by the CPI" },
      { id: "sec-cp-III-B-3", group: "Colorado standards", why: "Common Provisions III.B.3 — the current maximum per day of violation" },
      { id: "sec-proc-A-VI-D-1", group: "Colorado standards", why: "AQCC Procedural Rules VI.D.1 — the Division has the burden of proof in enforcement adjudications" },
      // ECMC rules
      { id: "sec-ecmc-523-a", group: "ECMC rules", why: "Rule 523.a — the Director's Notice of Alleged Violation (NOAV)" },
      { id: "sec-ecmc-523-c", group: "ECMC rules", why: "Rule 523.c — when the Director seeks penalties: the enforcement action" },
      { id: "sec-ecmc-525-a", group: "ECMC rules", why: "Rule 525.a — the Commission's authority to impose penalties and other remedies" },
      { id: "sec-ecmc-525-b", group: "ECMC rules", why: "Rule 525.b — days of violation and continuing violations" },
      { id: "sec-ecmc-525-c", group: "ECMC rules", why: "Rule 525.c — the Penalty Schedule: rule class × degree of harm, aggravating and mitigating factors" },
      { id: "sec-ecmc-525-e", group: "ECMC rules", why: "Rule 525.e — voluntary disclosure" },
      { id: "sec-ecmc-525-g", group: "ECMC rules", why: "Rule 525.g — paying the penalty (30 days, certified funds)" },
      // Federal PHMSA
      { id: "sec-p190-190.207", group: "Federal PHMSA", why: "49 CFR § 190.207 — notice of probable violation" },
      { id: "sec-p190-190.208", group: "Federal PHMSA", why: "49 CFR § 190.208 — the operator's response options" },
      { id: "sec-p190-190.221", group: "Federal PHMSA", why: "49 CFR § 190.221 — civil penalties generally" },
      { id: "sec-p190-190.223", group: "Federal PHMSA", why: "49 CFR § 190.223 — maximum penalties" },
      { id: "sec-p190-190.225", group: "Federal PHMSA", why: "49 CFR § 190.225 — assessment considerations" },
      { id: "sec-p196-196.205", group: "Federal PHMSA", why: "49 CFR § 196.205 — administrative civil penalties for excavation-damage violations" },
      { id: "sec-p196-196.207", group: "Federal PHMSA", why: "49 CFR § 196.207 — the maximum administrative civil penalties under Part 196" },
    ],
  },
  {
    key: "general-permits",
    name: "APCD general permits: which one fits",
    // After the equipment maps on purpose: a GP02 question keeps routing to
    // engines and a GP08 question to tanks; this map catches GP03, GP11 and
    // "which general permit…" questions. The gp\d\d catch-all is reached only
    // when no earlier map claimed the number.
    triggers: [/\b(?:general permits?|which (?:gp|general permit)|gp\s?0?1|gp\s?0?3|gp\s?11|gp\s?\d\d|register(?:ing|ed)? under)\b/i],
    factors:
      "Which general permit fits depends on the equipment (condensate or produced-water tank batteries, other storage tanks, natural gas or diesel engines, liquid loadout, routine gas venting, a whole well production facility, or land-development dust), whether the facility can meet every condition of the permit including its emission caps and the Section I.B exclusion for Title V and major sources, where it sits (attainment areas versus the 8-hour Ozone Control Area), and whether the permit is still open to new registrations — GP09 and GP10 closed on July 15, 2026 and GP12 replaces them.",
    provisions: [
      // Colorado permitting and APEN
      { id: "sec-3-B-II-A", group: "Colorado permitting and APEN", why: "Regulation 3 Part B II.A — construction permits: general considerations (a general permit is one route to one)" },
      { id: "sec-3-A-II-A", group: "Colorado permitting and APEN", why: "Regulation 3 Part A II.A — an APEN is still required under a general permit" },
      // General Permit options
      { id: "sec-gp01-I-A", group: "General Permit options", why: "GP01 — condensate storage tank batteries" },
      { id: "sec-gp05-I-A", group: "General Permit options", why: "GP05 — produced water storage tank batteries" },
      { id: "sec-gp08-I-B", group: "General Permit options", why: "GP08 — storage tanks (condensate, crude oil, intermediate hydrocarbon liquids, produced water)" },
      { id: "sec-gp02-I-A", group: "General Permit options", why: "GP02 — natural gas-fired reciprocating internal combustion engines" },
      { id: "sec-gp06-I-A", group: "General Permit options", why: "GP06 — diesel fuel-fired reciprocating internal combustion engines" },
      { id: "sec-gp07-I-A", group: "General Permit options", why: "GP07 — hydrocarbon liquid loadout" },
      { id: "sec-gp11-I-A", group: "General Permit options", why: "GP11 — routine or predictable gas venting emissions" },
      { id: "sec-gp12-I-A", group: "General Permit options", why: "GP12 — well production facilities (natural gas and diesel engines, tanks, loading, separator venting)" },
      { id: "sec-gp12-I-B", group: "General Permit options", why: "GP12 — who may register: a well production facility that can comply with every condition" },
      { id: "sec-gp03-I-A", group: "General Permit options", why: "GP03 — land development projects (fugitive dust), not an oil and gas permit" },
      { id: "sec-gp09-I-A", group: "General Permit options", why: "GP09 — well production facilities, attainment areas; closed to new registrations July 15, 2026" },
      { id: "sec-gp10-I-A", group: "General Permit options", why: "GP10 — well production facilities, nonattainment areas; closed to new registrations July 15, 2026" },
    ],
  },
  {
    key: "apen",
    name: "APEN filing: when a notice is required",
    // Last on purpose: an APEN question that names equipment with a map of
    // its own (a tank battery, an engine) routes to that map first.
    triggers: [/\b(?:apens?|air pollutant emission notices?|emission notices?)\b/i],
    factors:
      "Whether an APEN is required turns on each emission point's uncontrolled actual emissions against the reporting thresholds (which differ between attainment and nonattainment areas), whether the unit is on the Regulation 3 Part A II.D.1 exemption list, whether the source is new, modified or existing, and — for a revised APEN — whether emissions changed by more than the II.C thresholds. A construction-permit exemption is not an APEN exemption.",
    provisions: [
      // Colorado permitting and APEN
      { id: "sec-3-A-II-A", group: "Colorado permitting and APEN", why: "APENs for new, modified and existing sources — the basic requirement (II.A.1)" },
      { id: "sec-3-A-II-B-3", group: "Colorado permitting and APEN", why: "APEN applicability — the uncontrolled actual emission thresholds" },
      { id: "sec-3-A-II-B-1", group: "Colorado permitting and APEN", why: "What the APEN must include — the annual actual emission estimate" },
      { id: "sec-3-A-II-B-2", group: "Colorado permitting and APEN", why: "APEN term — valid for no more than five years" },
      { id: "sec-3-A-II-B-4", group: "Colorado permitting and APEN", why: "Source grouping on one APEN" },
      { id: "sec-3-A-II-C", group: "Colorado permitting and APEN", why: "Revised APENs — when a change requires a new filing" },
      { id: "sec-3-A-II-D", group: "Colorado permitting and APEN", why: "Exemptions from APEN requirements" },
      { id: "sec-3-A-II-D-1", group: "Colorado permitting and APEN", why: "The list of exempt emission units (II.D.1.a – II.D.1.dddd)" },
      { id: "sec-3-A-II-D-3", group: "Colorado permitting and APEN", why: "Emergency and backup generators still need an APEN" },
      { id: "sec-3-B-II-D", group: "Colorado permitting and APEN", why: "Construction permit exemptions — separate from APEN exemptions" },
      { id: "sec-3-B-II-D-2", group: "Colorado permitting and APEN", why: "Facility-wide permit exemption thresholds in nonattainment areas" },
      { id: "sec-3-B-II-D-3", group: "Colorado permitting and APEN", why: "Facility-wide permit exemption thresholds in attainment / maintenance areas" },
      // Definitions
      { id: "sec-3-A-I-B-55", group: "Definitions", why: "Regulation 3 — 'Uncontrolled actual emissions'" },
      { id: "sec-3-A-I-B-56", group: "Definitions", why: "Regulation 3 — 'Well production facility'" },
      { id: "sec-3-A-I-B-15", group: "Definitions", why: "Regulation 3 — 'Commencement of operation'" },
    ],
  },
];

/**
 * The first map whose trigger matches the acronym-expanded question, or
 * null. Expands acronyms itself (so "GP02 limits" routes on the spelled-out
 * "reciprocating internal combustion engines"); passing an already-expanded
 * string is harmless, expansion only adds words.
 */
export function matchQuestionMap(question: string): QuestionMap | null {
  const expanded = expandAcronyms(question);
  for (const map of QUESTION_MAPS) {
    if (map.triggers.some((t) => t.test(expanded))) return map;
  }
  return null;
}

/** The fields of a hit groupForHit() reads (a subset of SemanticHit). */
export type GroupableHit = {
  id: string;
  reg_key: string | null;
  jurisdiction_level: string;
  path?: string | null;
  title: string;
};

const DEFINITIONS_PATH = /\bdefinitions?\b/i;
const DEFINITIONS_TITLE = /what definitions apply/i;

/**
 * The group for a retrieval hit that is not one of the map's canonical rows,
 * or "Other". Tested in this order:
 *   1. a path or title under a Definitions heading, or a "What definitions
 *      apply" section (the same tests the ranking SQL uses) → Definitions;
 *   2. a general permit (reg_key gp..) → General Permit options;
 *   3. Regulation 3 → Colorado permitting and APEN;
 *   4. a FEDERAL_NESHAP_REG_KEYS row → Federal NESHAP;
 *   5. a FEDERAL_NSPS_REG_KEYS row → Federal NSPS;
 *   6. an ECMC_REG_KEYS row → ECMC rules;
 *   7. a PHMSA_REG_KEYS row (49 CFR Parts 190-199) → Federal PHMSA;
 *   8. a state row keyed by an AQCC regulation (AQCC_REGULATION_KEYS) →
 *      Colorado standards;
 *   9. everything else (proc, sip, county) → "Other".
 */
export function groupForHit(hit: GroupableHit): MapGroup | "Other" {
  if (DEFINITIONS_PATH.test(hit.path ?? "") || DEFINITIONS_PATH.test(hit.title) || DEFINITIONS_TITLE.test(hit.title)) {
    return "Definitions";
  }
  const key = (hit.reg_key ?? "").toLowerCase();
  if (key.startsWith("gp")) return "General Permit options";
  if (key === "3") return "Colorado permitting and APEN";
  if (FEDERAL_NESHAP_REG_KEYS.includes(key)) return "Federal NESHAP";
  if (FEDERAL_NSPS_REG_KEYS.includes(key)) return "Federal NSPS";
  if (ECMC_REG_KEYS.includes(key)) return "ECMC rules";
  if (PHMSA_REG_KEYS.includes(key)) return "Federal PHMSA";
  if (hit.jurisdiction_level === "state" && AQCC_REGULATION_KEYS.includes(key)) return "Colorado standards";
  return "Other";
}

export type GroupedHits<T extends GroupableHit> = {
  /**
   * Non-empty groups: first the ones with at least one canonical row, then
   * the ones with retrieval hits only, each run in MAP_GROUP_ORDER. Within a
   * group the canonical rows lead, then at most MAX_HITS_PER_GROUP hits, in
   * retrieval order.
   */
  groups: { group: MapGroup; canonical: MapProvision[]; hits: T[] }[];
  /** Hits groupForHit() put in no group, at most MAX_OTHER_HITS, in retrieval order. */
  other: T[];
};

/**
 * Lays the retrieval hits out under a matched map: canonical rows first in
 * each group, then the hits groupForHit() routes there that are not already
 * canonical (at most MAX_HITS_PER_GROUP per group), empty groups omitted,
 * the rest under "Other matches" (at most MAX_OTHER_HITS). `canonicalIds`
 * limits the canonical rows to the ones the caller could fetch (RLS, the
 * visitor's filters); when omitted every row of the map is listed.
 *
 * Groups that carry a canonical row come before groups that only collected
 * retrieval hits, each run in MAP_GROUP_ORDER (3 Oct 2026): a stray
 * Regulation 3 hit on the enforcement map used to open "Colorado permitting
 * and APEN" above the groups that answer the question.
 */
export function groupHits<T extends GroupableHit>(map: QuestionMap, hits: T[], canonicalIds?: Set<string>): GroupedHits<T> {
  const canonical = canonicalIds ? map.provisions.filter((p) => canonicalIds.has(p.id)) : map.provisions;
  const canonicalSet = new Set(map.provisions.map((p) => p.id));
  const byGroup = new Map<MapGroup, T[]>();
  const other: T[] = [];
  for (const hit of hits) {
    if (canonicalSet.has(hit.id)) continue;
    const g = groupForHit(hit);
    if (g === "Other") {
      if (other.length < MAX_OTHER_HITS) other.push(hit);
      continue;
    }
    const list = byGroup.get(g) ?? [];
    if (list.length < MAX_HITS_PER_GROUP) list.push(hit);
    byGroup.set(g, list);
  }
  const withCanonical: GroupedHits<T>["groups"] = [];
  const hitsOnly: GroupedHits<T>["groups"] = [];
  for (const group of MAP_GROUP_ORDER) {
    const rows = canonical.filter((p) => p.group === group);
    const extra = byGroup.get(group) ?? [];
    if (rows.length === 0 && extra.length === 0) continue;
    (rows.length > 0 ? withCanonical : hitsOnly).push({ group, canonical: rows, hits: extra });
  }
  return { groups: [...withCanonical, ...hitsOnly], other };
}

/** The `map` field of /api/search/semantic: the matched map and its groups as id lists. */
export type QuestionMapSummary = {
  key: string;
  name: string;
  factors: string;
  groups: { group: MapGroup | "Other"; provisions: string[] }[];
};

export function summariseGroups<T extends GroupableHit>(map: QuestionMap, grouped: GroupedHits<T>): QuestionMapSummary {
  const groups: QuestionMapSummary["groups"] = grouped.groups.map((g) => ({
    group: g.group,
    provisions: [...g.canonical.map((p) => p.id), ...g.hits.map((h) => h.id)],
  }));
  if (grouped.other.length > 0) groups.push({ group: "Other", provisions: grouped.other.map((h) => h.id) });
  return { key: map.key, name: map.name, factors: map.factors, groups };
}
