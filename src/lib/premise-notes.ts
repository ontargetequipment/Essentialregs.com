import type { MapGroup, MapProvision, QuestionMap } from "@/lib/question-maps";

/**
 * Premise notes (Ask, 7 Oct 2026; review 4, item 1).
 *
 * The outside reviewer asked "When is a GP01 required?" and Ask answered
 * with the storage-tank map, never saying that GP01 is not required by
 * itself. A premise note is a short, fixed, curated text shown above the
 * results when a question matches a known misconception pattern. The first
 * pattern is "when is GP<nn> required" / "do I need a GP<nn>" / "is GP<nn>
 * mandatory" and close variants, for all eleven APCD general permits.
 *
 * Rules. The text is data, stored here, never generated at query time.
 * Every sentence carries the provision ids that support it, shown as links
 * beside it; a sentence the corpus cannot support is left out. Nothing here
 * is an applicability determination: the note says what the permit's own
 * text says it covers, that registration is voluntary, and that whether a
 * permit or an APEN is required at all is decided under Regulation 3.
 *
 * Each note also carries the map the question is answered with (the
 * "premise map"): the named permit's applicability provisions first, then
 * the Regulation 3 permit and APEN requirement provisions, then the
 * alternatives if that permit does not fit. matchQuestionMap() consults
 * the notes before the ordinary maps, so a GP01 premise question no longer
 * routes to the storage-tank map.
 *
 * Pure: no React, no Supabase. The eval, the API route and the page all
 * call matchPremiseNote(), so they never disagree.
 */

export type PremiseSentence = {
  /** The sentence as shown. */
  text: string;
  /** Provision ids that support it, shown as links after the sentence. Never empty. */
  cites: string[];
};

export type PremiseNote = {
  /** "gp01-required" */
  key: string;
  /** "GP01" */
  permit: string;
  /** Lower-case reg key, "gp01". */
  regKey: string;
  /** Heading of the note box. */
  title: string;
  sentences: PremiseSentence[];
  /** The map the question is answered with. */
  map: QuestionMap;
};

/** The eleven general permits a note exists for (GP04 is not active and has no document in the corpus). */
export const PREMISE_GP_NUMBERS: readonly string[] = ["01", "02", "03", "05", "06", "07", "08", "09", "10", "11", "12"];

/** Group names of a premise map, in the order the page shows them (they sit at the front of MAP_GROUP_ORDER). */
export const PREMISE_GROUP_APPLICABILITY: MapGroup = "Permit applicability";
export const PREMISE_GROUP_ALTERNATIVES: MapGroup = "Alternatives if the permit does not fit";

// ---- the Regulation 3 rows every note cites ----------------------------------

const REG3_APEN_REQUIRED = "sec-3-A-II-A-1";
const REG3_APEN_EXEMPTIONS = "sec-3-A-II-D-1";
const REG3_PERMIT_REQUIRED_PART_B = "sec-3-B-I-A";
const REG3_PERMIT_REQUIRED = "sec-3-B-II-A-1";
const REG3_PERMIT_EXEMPTIONS = "sec-3-B-II-D";
const REG3_GENERAL_PERMIT_DEFINITION = "sec-3-A-I-B-27";

/**
 * The sentence every note ends its first half with. Regulation 3 Part A
 * II.A.1: no emission, construction or modification without an APEN unless
 * exempt under II.D; Part B I.A and II.A.1: a construction permit except as
 * specified in Section II; Part B II.D: the permit exemptions.
 */
const REG3_SENTENCE: PremiseSentence = {
  text:
    "Whether a construction permit or an APEN is required at all is decided under Regulation 3: an Air Pollutant Emission Notice unless the source is exempt under Part A, Section II.D, and a construction permit unless the source is exempt under Part B, Section II.",
  cites: [REG3_APEN_REQUIRED, REG3_APEN_EXEMPTIONS, REG3_PERMIT_REQUIRED_PART_B, REG3_PERMIT_REQUIRED, REG3_PERMIT_EXEMPTIONS],
};

const REG3_ROWS: MapProvision[] = [
  { id: REG3_APEN_REQUIRED, group: "Colorado permitting and APEN", why: "Regulation 3 Part A II.A.1 — an APEN is required for any stationary source unless exempt under Section II.D" },
  { id: REG3_APEN_EXEMPTIONS, group: "Colorado permitting and APEN", why: "Regulation 3 Part A II.D.1 — the APEN exemptions, which do not remove other applicable requirements" },
  { id: REG3_PERMIT_REQUIRED_PART_B, group: "Colorado permitting and APEN", why: "Regulation 3 Part B I.A — a construction permit is required statewide except as specified in Section II" },
  { id: REG3_PERMIT_REQUIRED, group: "Colorado permitting and APEN", why: "Regulation 3 Part B II.A.1 — no construction, modification or operation without a valid construction permit" },
  { id: REG3_PERMIT_EXEMPTIONS, group: "Colorado permitting and APEN", why: "Regulation 3 Part B II.D — exemptions from the construction permit requirement" },
  { id: REG3_GENERAL_PERMIT_DEFINITION, group: "Colorado permitting and APEN", why: "Regulation 3 Part A I.B.27 — a general permit is a single permit issued to cover numerous similar sources" },
];

// ---- per-permit data -----------------------------------------------------------

type Alternative = { id: string; why: string };

type PermitSpec = {
  num: string;
  /** The sentences before the Regulation 3 sentence: what the permit is and covers, in its own words. */
  about: PremiseSentence[];
  /** The sentences after it: the alternatives. */
  alternatives: PremiseSentence[];
  /** The permit's Section I rows (applicability), with the reason each is listed. */
  applicability: { id: string; why: string }[];
  /** Rows listed under "Alternatives if the permit does not fit". */
  alternativeRows: Alternative[];
  /** The one-sentence factors line of the premise map. */
  factors: string;
  /** Sentence the closed permits open with (GP09, GP10). */
  closed?: PremiseSentence;
};

const gp = (num: string, suffix: string) => `sec-gp${num}-${suffix}`;

/** The voluntary-registration sentence, per permit (the row that says "Registration under this general permit is voluntary"). */
function voluntary(num: string, row: string, maySentenceRow: string): PremiseSentence {
  return {
    text: `GP${num} is not automatically required: registration under it is voluntary, and an owner or operator who can meet its conditions may register for it.`,
    cites: [gp(num, row), gp(num, maySentenceRow)],
  };
}

const INDIVIDUAL_PERMIT_WHY = "the permit's own terms: a source may hold an individual construction permit under Regulation 3 Part B instead";

const PERMITS: PermitSpec[] = [
  {
    num: "01",
    about: [
      voluntary("01", "VIII-D-3", "I-A"),
      {
        text: "It is a general construction permit for condensate storage tank batteries (a single tank or a group of tanks of up to 10,000 barrels per tank) at oil and gas industry facilities, together with the combustion devices, vapor recovery units or other Division-approved control equipment that keep their emissions under the Section II limits, at true minor or synthetic minor sources.",
        cites: [gp("01", "I-A-1"), gp("01", "I-A-2"), gp("01", "I-A-3"), REG3_GENERAL_PERMIT_DEFINITION],
      },
      {
        text: "It applies only to that equipment when its uncontrolled actual emissions of sulfur oxides and particulate matter are below the APEN reporting thresholds of Regulation 3 Part A II.D.1.a; equipment subject to an NSPS other than Subparts OOOO, OOOOa and OOOOb, and equipment that is part of a project subject to nonattainment NSR or PSD permitting, may not register.",
        cites: [gp("01", "I-E"), gp("01", "I-F-1"), gp("01", "I-F-3")],
      },
      {
        text: "Other equipment at the same stationary source must be permitted separately under Regulation 3 Part B.",
        cites: [gp("01", "I-F-2")],
      },
    ],
    alternatives: [
      {
        text: "If a permit is needed and GP01 does not fit, the alternatives are an individual construction permit under Regulation 3 Part B, or another general permit whose applicability covers condensate storage tanks: GP08 (condensate, crude oil, intermediate hydrocarbon liquid and produced water storage tanks) or GP12 (the equipment of a well production facility, including its condensate storage tanks).",
        cites: [gp("01", "VIII-E-3"), gp("08", "I-B-1-a"), gp("12", "I-A-3-a")],
      },
    ],
    applicability: [
      { id: gp("01", "I-A"), why: "GP01 I.A — qualified sources: who may register, and the equipment the permit covers (I.A.1–I.A.3)" },
      { id: gp("01", "I-B"), why: "GP01 I.B — sources that became Title V or major on the 2020 reclassification of the 8-hour Ozone Control Area and may continue under the permit" },
      { id: gp("01", "I-C"), why: "GP01 I.C — the same for the serious-to-severe reclassification" },
      { id: gp("01", "I-D"), why: "GP01 I.D — the same for the 2024 reclassification of Northern Weld County" },
      { id: gp("01", "I-E"), why: "GP01 I.E — applies only to equipment with SOx and particulate emissions below the APEN reporting thresholds" },
      { id: gp("01", "I-F"), why: "GP01 I.F — excluded sources that may not register" },
    ],
    alternativeRows: [
      { id: gp("01", "VIII-E-3"), why: INDIVIDUAL_PERMIT_WHY },
      { id: gp("08", "I-B"), why: "GP08 — storage tanks: condensate, crude oil, intermediate hydrocarbon liquids, produced water" },
      { id: gp("12", "I-A-3"), why: "GP12 — storage tanks as one of the covered source types at a well production facility" },
    ],
    factors:
      "Whether a construction permit or an APEN is required is decided under Regulation 3; registration under GP01 is voluntary and open to condensate storage tank batteries that meet its Section I conditions.",
  },
  {
    num: "02",
    about: [
      voluntary("02", "XI-D-3", "I-A"),
      {
        text: "It is a general construction permit for natural gas fired reciprocating internal combustion engines at an oil and gas stationary source that is a true minor or synthetic minor source for the operating permit and New Source Review programs and under 40 CFR Part 63, and that meets the conditions of Section II.A.",
        cites: [gp("02", "I-A"), gp("02", "I-A-1"), gp("02", "I-A-2"), gp("02", "I-A-3"), REG3_GENERAL_PERMIT_DEFINITION],
      },
      {
        text: "A portable source, a petroleum refinery, equipment that is part of a project subject to nonattainment NSR or PSD permitting, and engines complying with the Regulation 26 alternative company-wide compliance plan or alternative emission standard may not use it.",
        cites: [gp("02", "I-E"), gp("02", "I-E-1"), gp("02", "I-E-2"), gp("02", "I-E-3"), gp("02", "I-E-4"), gp("02", "I-E-5")],
      },
      {
        text: "It covers only the registered equipment; other equipment at the same stationary source must be permitted separately under Regulation 3 Part B.",
        cites: [gp("02", "I-F")],
      },
    ],
    alternatives: [
      {
        text: "If a permit is needed and GP02 does not fit, the alternatives are an individual construction permit under Regulation 3 Part B, or GP12, whose covered equipment at a well production facility includes natural gas-fired reciprocating internal combustion engines.",
        cites: [gp("02", "XI-D-3"), gp("12", "I-A-1")],
      },
    ],
    applicability: [
      { id: gp("02", "I-A"), why: "GP02 I.A — the engines and sources the permit can be used for (I.A.1–I.A.3)" },
      { id: gp("02", "I-B"), why: "GP02 I.B — sources that became Title V or major on the 2020 reclassification of the 8-hour Ozone Control Area and may continue under the permit" },
      { id: gp("02", "I-C"), why: "GP02 I.C — the same for the serious-to-severe reclassification" },
      { id: gp("02", "I-D"), why: "GP02 I.D — the same for the 2024 reclassification of Northern Weld County" },
      { id: gp("02", "I-E"), why: "GP02 I.E — sources that may not use the permit" },
      { id: gp("02", "I-F"), why: "GP02 I.F — only the registered equipment; other equipment is permitted separately" },
    ],
    alternativeRows: [
      { id: gp("02", "XI-D-3"), why: INDIVIDUAL_PERMIT_WHY },
      { id: gp("12", "I-A-1"), why: "GP12 — natural gas-fired engines as one of the covered source types at a well production facility" },
    ],
    factors:
      "Whether a construction permit or an APEN is required is decided under Regulation 3; registration under GP02 is voluntary and open to natural gas fired engines at minor oil and gas sources that meet its Section I conditions.",
  },
  {
    num: "03",
    about: [
      voluntary("03", "IV-D-3", "I-A"),
      {
        text: "It is a general construction permit for land development: land clearing activities such as excavating or grading for residential, commercial or industrial development or for oil and gas exploration and production, but not mining or the disturbance of contaminated soils.",
        cites: [gp("03", "I-A"), gp("03", "I-B"), REG3_GENERAL_PERMIT_DEFINITION],
      },
      {
        text: "Land development of less than 25 contiguous acres and less than six months in duration is exempt from permitting and does not report emissions to the Division, though it must still control fugitive dust.",
        cites: [gp("03", "I-C")],
      },
    ],
    alternatives: [
      {
        text: "If a permit is needed and GP03 does not fit, the alternative is an individual construction permit under Regulation 3 Part B.",
        cites: [gp("03", "IV-E-3")],
      },
    ],
    applicability: [
      { id: gp("03", "I-A"), why: "GP03 I.A — who may register: a land development activity that can meet the permit's conditions" },
      { id: gp("03", "I-B"), why: "GP03 I.B — what land development means, and what it does not include" },
      { id: gp("03", "I-C"), why: "GP03 I.C — projects under 25 contiguous acres and six months are exempt from permitting" },
    ],
    alternativeRows: [{ id: gp("03", "IV-E-3"), why: INDIVIDUAL_PERMIT_WHY }],
    factors:
      "Whether a construction permit or an APEN is required is decided under Regulation 3; registration under GP03 is voluntary, and land development under 25 contiguous acres and six months is exempt from permitting by the permit's own terms.",
  },
  {
    num: "05",
    about: [
      voluntary("05", "VIII-D-3", "I-A"),
      {
        text: "It is a general construction permit for produced water storage tank batteries (a single tank or a group of tanks storing produced water), together with the combustion devices, vapor recovery units or other Division-approved control equipment that reduce their emissions by at least 95%, at true minor or synthetic minor sources.",
        cites: [gp("05", "I-A-1"), gp("05", "I-A-2"), gp("05", "I-A-3"), REG3_GENERAL_PERMIT_DEFINITION],
      },
      {
        text: "It applies only to that equipment when its uncontrolled actual emissions of sulfur oxides and particulate matter are below the APEN reporting thresholds of Regulation 3 Part A II.D.1.a; equipment subject to an NSPS other than Subparts OOOO, OOOOa and OOOOb, and equipment that is part of a project subject to nonattainment NSR or PSD permitting, may not register.",
        cites: [gp("05", "I-E"), gp("05", "I-F-1"), gp("05", "I-F-3")],
      },
      {
        text: "Other equipment at the same stationary source must be permitted separately under Regulation 3 Part B.",
        cites: [gp("05", "I-F-2")],
      },
    ],
    alternatives: [
      {
        text: "If a permit is needed and GP05 does not fit, the alternatives are an individual construction permit under Regulation 3 Part B, or another general permit whose applicability covers produced water storage tanks: GP08 or GP12 (at a well production facility).",
        cites: [gp("05", "VIII-E-3"), gp("08", "I-B-1-c"), gp("12", "I-A-3-d")],
      },
    ],
    applicability: [
      { id: gp("05", "I-A"), why: "GP05 I.A — qualified sources: who may register, and the equipment the permit covers (I.A.1–I.A.3)" },
      { id: gp("05", "I-B"), why: "GP05 I.B — sources that became Title V or major on the 2020 reclassification of the 8-hour Ozone Control Area and may continue under the permit" },
      { id: gp("05", "I-C"), why: "GP05 I.C — the same for the serious-to-severe reclassification" },
      { id: gp("05", "I-D"), why: "GP05 I.D — the same for the 2024 reclassification of Northern Weld County" },
      { id: gp("05", "I-E"), why: "GP05 I.E — applies only to equipment with SOx and particulate emissions below the APEN reporting thresholds" },
      { id: gp("05", "I-F"), why: "GP05 I.F — excluded sources that may not register" },
    ],
    alternativeRows: [
      { id: gp("05", "VIII-E-3"), why: INDIVIDUAL_PERMIT_WHY },
      { id: gp("08", "I-B"), why: "GP08 — storage tanks, including produced water storage tanks (I.B.1.c)" },
      { id: gp("12", "I-A-3"), why: "GP12 — storage tanks, including produced water storage tanks (I.A.3.d), at a well production facility" },
    ],
    factors:
      "Whether a construction permit or an APEN is required is decided under Regulation 3; registration under GP05 is voluntary and open to produced water storage tank batteries that meet its Section I conditions.",
  },
  {
    num: "06",
    about: [
      voluntary("06", "IX-E-3", "I-A"),
      {
        text: "It is a general construction permit for a diesel fuel-fired reciprocating internal combustion engine that is a stationary source, including a portable unit, at a true minor or synthetic minor source for the operating permit, PSD and New Source Review programs and under 40 CFR Part 63, that meets the requirements of NSPS Subpart IIII as applicable to the engine and the conditions of Section II.A.",
        cites: [gp("06", "I-A"), gp("06", "I-A-1"), gp("06", "I-A-2"), gp("06", "I-A-3"), gp("06", "I-A-4"), REG3_GENERAL_PERMIT_DEFINITION],
      },
      {
        text: "An engine that does not meet Subpart IIII, and equipment that is part of a project subject to nonattainment NSR or PSD permitting, may not use it; other equipment at the same stationary source must be permitted separately under Regulation 3 Part B.",
        cites: [gp("06", "I-E-1"), gp("06", "I-E-2"), gp("06", "I-F")],
      },
    ],
    alternatives: [
      {
        text: "If a permit is needed and GP06 does not fit, the alternatives are an individual construction permit under Regulation 3 Part B, or GP12, whose covered equipment at a well production facility includes diesel fuel-fired reciprocating internal combustion engines.",
        cites: [gp("06", "IX-E-3"), gp("12", "I-A-2")],
      },
    ],
    applicability: [
      { id: gp("06", "I-A"), why: "GP06 I.A — the diesel engines the permit can be used for (I.A.1–I.A.4)" },
      { id: gp("06", "I-B"), why: "GP06 I.B — sources that became Title V or major on the 2020 reclassification of the 8-hour Ozone Control Area and may continue under the permit" },
      { id: gp("06", "I-C"), why: "GP06 I.C — the same for the serious-to-severe reclassification" },
      { id: gp("06", "I-D"), why: "GP06 I.D — the same for the 2024 reclassification of Northern Weld County" },
      { id: gp("06", "I-E"), why: "GP06 I.E — sources that may not use the permit" },
      { id: gp("06", "I-F"), why: "GP06 I.F — only the registered equipment; other equipment is permitted separately" },
    ],
    alternativeRows: [
      { id: gp("06", "IX-E-3"), why: INDIVIDUAL_PERMIT_WHY },
      { id: gp("12", "I-A-2"), why: "GP12 — diesel engines as one of the covered source types at a well production facility" },
    ],
    factors:
      "Whether a construction permit or an APEN is required is decided under Regulation 3; registration under GP06 is voluntary and open to diesel engines at minor sources that meet NSPS Subpart IIII and its Section I conditions.",
  },
  {
    num: "07",
    about: [
      voluntary("07", "VIII-D-3", "I-A"),
      {
        text: "It is a general construction permit for hydrocarbon liquid loading operations (condensate, crude oil and dual-product loading with commingled produced water), together with the combustion devices, vapor recovery units, vapor balance or other Division-approved control equipment on the loading, at true minor or synthetic minor sources.",
        cites: [gp("07", "I-A-1"), gp("07", "I-A-2"), gp("07", "I-A-3"), REG3_GENERAL_PERMIT_DEFINITION],
      },
      {
        text: "It applies only to that equipment when its uncontrolled actual emissions of sulfur oxides and particulate matter are below the APEN reporting thresholds of Regulation 3 Part A II.D.1.a; equipment that is part of a project subject to nonattainment NSR or PSD permitting may not register, and other equipment at the same stationary source must be permitted separately under Regulation 3 Part B.",
        cites: [gp("07", "I-E"), gp("07", "I-F-2"), gp("07", "I-F-1")],
      },
    ],
    alternatives: [
      {
        text: "If a permit is needed and GP07 does not fit, the alternatives are an individual construction permit under Regulation 3 Part B, or GP12, whose covered equipment at a well production facility includes hydrocarbon liquid loading.",
        cites: [gp("07", "VIII-E-3"), gp("12", "I-A-4")],
      },
    ],
    applicability: [
      { id: gp("07", "I-A"), why: "GP07 I.A — qualified sources: who may register, and the loading operations the permit covers (I.A.1–I.A.3)" },
      { id: gp("07", "I-B"), why: "GP07 I.B — sources that became Title V or major on the 2020 reclassification of the 8-hour Ozone Control Area and may continue under the permit" },
      { id: gp("07", "I-C"), why: "GP07 I.C — the same for the serious-to-severe reclassification" },
      { id: gp("07", "I-D"), why: "GP07 I.D — the same for the 2024 reclassification of Northern Weld County" },
      { id: gp("07", "I-E"), why: "GP07 I.E — applies only to equipment with SOx and particulate emissions below the APEN reporting thresholds" },
      { id: gp("07", "I-F"), why: "GP07 I.F — excluded sources that may not register" },
    ],
    alternativeRows: [
      { id: gp("07", "VIII-E-3"), why: INDIVIDUAL_PERMIT_WHY },
      { id: gp("12", "I-A-4"), why: "GP12 — hydrocarbon liquid loading as one of the covered source types at a well production facility" },
    ],
    factors:
      "Whether a construction permit or an APEN is required is decided under Regulation 3; registration under GP07 is voluntary and open to hydrocarbon liquid loading operations that meet its Section I conditions.",
  },
  {
    num: "08",
    about: [
      voluntary("08", "VIII-D-3", "I-B"),
      {
        text: "It is a general construction permit for storage tanks at oil and gas industry operations: condensate, crude oil and intermediate hydrocarbon liquid storage tanks of up to 10,000 barrels per vessel, and produced water storage tanks, together with the combustion devices, vapor recovery units or other Division-approved control equipment that keep their emissions under the Section II limits, at true minor or synthetic minor sources.",
        cites: [gp("08", "I-B-1"), gp("08", "I-B-1-a"), gp("08", "I-B-1-b"), gp("08", "I-B-1-c"), gp("08", "I-B-1-d"), gp("08", "I-B-2"), gp("08", "I-B-3"), REG3_GENERAL_PERMIT_DEFINITION],
      },
      {
        text: "It applies only to that equipment when its uncontrolled actual emissions of sulfur oxides and particulate matter are below the APEN reporting thresholds of Regulation 3 Part A II.D.1.a.",
        cites: [gp("08", "I-F")],
      },
    ],
    alternatives: [
      {
        text: "If a permit is needed and GP08 does not fit, the alternatives are an individual construction permit under Regulation 3 Part B, or another general permit whose applicability covers the tank: GP01 (condensate storage tank batteries), GP05 (produced water storage tank batteries) or GP12 (storage tanks at a well production facility).",
        cites: [gp("08", "VIII-E-3"), gp("01", "I-A-1"), gp("05", "I-A-1"), gp("12", "I-A-3")],
      },
    ],
    applicability: [
      { id: gp("08", "I-A"), why: "GP08 I.A — the definition of a storage tank the permit uses" },
      { id: gp("08", "I-B"), why: "GP08 I.B — qualified sources: who may register, and the tanks the permit covers (I.B.1–I.B.3)" },
      { id: gp("08", "I-C"), why: "GP08 I.C — sources that became Title V or major on the 2020 reclassification of the 8-hour Ozone Control Area and may continue under the permit" },
      { id: gp("08", "I-D"), why: "GP08 I.D — the same for the serious-to-severe reclassification" },
      { id: gp("08", "I-E"), why: "GP08 I.E — the same for the 2024 reclassification of Northern Weld County" },
      { id: gp("08", "I-F"), why: "GP08 I.F — applies only to equipment with SOx and particulate emissions below the APEN reporting thresholds" },
    ],
    alternativeRows: [
      { id: gp("08", "VIII-E-3"), why: INDIVIDUAL_PERMIT_WHY },
      { id: gp("01", "I-A"), why: "GP01 — condensate storage tank batteries" },
      { id: gp("05", "I-A"), why: "GP05 — produced water storage tank batteries" },
      { id: gp("12", "I-A-3"), why: "GP12 — storage tanks as one of the covered source types at a well production facility" },
    ],
    factors:
      "Whether a construction permit or an APEN is required is decided under Regulation 3; registration under GP08 is voluntary and open to oil and gas storage tanks that meet its Section I conditions.",
  },
  {
    num: "09",
    closed: {
      text: "GP09 is closed to new registrations (July 15, 2026); existing registrations remain active, and GP12 replaced GP09 and GP10 for new applicants.",
      cites: [gp("09", "top-REG-gp09"), gp("12", "I-A")],
    },
    about: [
      voluntary("09", "IX-D-3", "I-B"),
      {
        text: "It is a general construction permit for oil and gas well production facilities as defined in Regulation 7 Part B II.A, in attainment areas and marginal or moderate nonattainment areas, covering natural gas-fired engines, storage tanks, hydrocarbon liquid loading, separator venting, fugitive component leaks, natural gas-driven pneumatic controllers and pumps, natural gas-fired turbines, routine or predictable emission activities and their control equipment.",
        cites: [gp("09", "I-A"), gp("09", "I-D"), gp("09", "I-A-1"), gp("09", "I-A-2"), gp("09", "I-A-3"), gp("09", "I-A-4"), gp("09", "I-A-5"), gp("09", "I-A-6"), gp("09", "I-A-7"), gp("09", "I-A-8"), gp("09", "I-A-9"), gp("09", "I-A-10"), REG3_GENERAL_PERMIT_DEFINITION],
      },
      {
        text: "It covers only the facility and equipment registered with the Division, and may not be used for new major stationary sources or modifications at existing major stationary sources subject to Regulation 3 Part D (PSD or nonattainment NSR).",
        cites: [gp("09", "I-C"), gp("09", "I-E")],
      },
    ],
    alternatives: [
      {
        text: "If a permit is needed, the alternatives are a construction permit under Regulation 3 Part B, or GP12 for a well production facility.",
        cites: [gp("09", "IX-D-3"), gp("12", "I-A"), gp("12", "I-B")],
      },
    ],
    applicability: [
      { id: gp("09", "I-A"), why: "GP09 I.A — well production facilities, and the equipment the permit covers (I.A.1–I.A.10)" },
      { id: gp("09", "I-B"), why: "GP09 I.B — who may register: a well production facility that can comply with every condition" },
      { id: gp("09", "I-C"), why: "GP09 I.C — only the facility and equipment registered with the Division" },
      { id: gp("09", "I-D"), why: "GP09 I.D — attainment areas and marginal or moderate nonattainment areas only" },
      { id: gp("09", "I-E"), why: "GP09 I.E — not for major sources subject to PSD or nonattainment NSR" },
      { id: gp("09", "I-F"), why: "GP09 I.F — sources that became Title V or major on the 2024 reclassification of Northern Weld County and may continue under the permit" },
    ],
    alternativeRows: [
      { id: gp("09", "IX-D-3"), why: "the permit's own terms: a source may apply for a construction permit under Regulation 3 Part B instead" },
      { id: gp("12", "I-A"), why: "GP12 — well production facilities; replaced GP09 and GP10 for new applicants" },
      { id: gp("12", "I-B"), why: "GP12 — who may register: a well production facility that can comply with every condition" },
    ],
    factors:
      "GP09 is closed to new registrations; whether a construction permit or an APEN is required is decided under Regulation 3, and GP12 is the general permit for a new well production facility.",
  },
  {
    num: "10",
    closed: {
      text: "GP10 is closed to new registrations (July 15, 2026); existing registrations remain active, and GP12 replaced GP09 and GP10 for new applicants.",
      cites: [gp("10", "top-REG-gp10"), gp("12", "I-A")],
    },
    about: [
      voluntary("10", "IX-D-3", "I-B"),
      {
        text: "It is a general construction permit for oil and gas well production facilities as defined in Regulation 7 Part B II.A in nonattainment areas, covering natural gas-fired engines, storage tanks, hydrocarbon liquid loading, separator venting, fugitive component leaks, natural gas-driven pneumatic controllers and pumps, natural gas-fired turbines, routine or predictable emission activities and their control equipment.",
        cites: [gp("10", "top-REG-gp10"), gp("10", "I-A"), gp("10", "I-A-1"), gp("10", "I-A-2"), gp("10", "I-A-3"), gp("10", "I-A-4"), gp("10", "I-A-5"), gp("10", "I-A-6"), gp("10", "I-A-7"), gp("10", "I-A-8"), gp("10", "I-A-9"), gp("10", "I-A-10"), REG3_GENERAL_PERMIT_DEFINITION],
      },
      {
        text: "It covers only the facility and equipment registered with the Division, and may not be used for new major stationary sources or modifications at existing major stationary sources subject to Regulation 3 Part D (PSD or nonattainment NSR).",
        cites: [gp("10", "I-C"), gp("10", "I-F")],
      },
    ],
    alternatives: [
      {
        text: "If a permit is needed, the alternatives are a construction permit under Regulation 3 Part B, or GP12 for a well production facility.",
        cites: [gp("10", "IX-D-3"), gp("12", "I-A"), gp("12", "I-B")],
      },
    ],
    applicability: [
      { id: gp("10", "I-A"), why: "GP10 I.A — well production facilities, and the equipment the permit covers (I.A.1–I.A.10)" },
      { id: gp("10", "I-B"), why: "GP10 I.B — who may register: a well production facility that can comply with every condition" },
      { id: gp("10", "I-C"), why: "GP10 I.C — only the facility and equipment registered with the Division" },
      { id: gp("10", "I-D"), why: "GP10 I.D — sources that became Title V or major on the serious-to-severe reclassification and may continue under the permit" },
      { id: gp("10", "I-E"), why: "GP10 I.E — the same for the 2024 reclassification of Northern Weld County" },
      { id: gp("10", "I-F"), why: "GP10 I.F — not for major sources subject to PSD or nonattainment NSR" },
    ],
    alternativeRows: [
      { id: gp("10", "IX-D-3"), why: "the permit's own terms: a source may apply for a construction permit under Regulation 3 Part B instead" },
      { id: gp("12", "I-A"), why: "GP12 — well production facilities; replaced GP09 and GP10 for new applicants" },
      { id: gp("12", "I-B"), why: "GP12 — who may register: a well production facility that can comply with every condition" },
    ],
    factors:
      "GP10 is closed to new registrations; whether a construction permit or an APEN is required is decided under Regulation 3, and GP12 is the general permit for a new well production facility.",
  },
  {
    num: "11",
    about: [
      voluntary("11", "VIII-D-3", "I-A"),
      {
        text: "It is a general construction permit for routine or predictable gas venting emissions at an oil and gas well production facility or centralized production facility and its wells: fixed-roof storage tank venting events, well-related venting such as liquids unloading and downhole maintenance, pigging and routine blowdowns that are not separately permitted, and their control equipment.",
        cites: [gp("11", "I-A"), gp("11", "I-A-1"), gp("11", "I-A-1-a"), gp("11", "I-A-1-b"), gp("11", "I-A-1-c"), gp("11", "I-A-1-d"), gp("11", "I-A-1-e"), REG3_GENERAL_PERMIT_DEFINITION],
      },
      {
        text: "A natural gas processing plant, a natural gas compressor station, a petroleum refinery, a major source or major stationary source (with the exceptions in I.A.3), storage-tank emissions not listed in I.A.1.a, venting prohibited by Regulation 7 Part B II.C.2.a, and equipment in a project subject to nonattainment NSR or PSD permitting may not register.",
        cites: [gp("11", "I-A-2"), gp("11", "I-A-2-a"), gp("11", "I-A-2-b"), gp("11", "I-A-2-c"), gp("11", "I-A-2-d"), gp("11", "I-A-2-e"), gp("11", "I-A-2-f"), gp("11", "I-A-2-g"), gp("11", "I-A-2-h")],
      },
      {
        text: "Registration is made on the APEN forms, and emission sources outside the listed activities at the same stationary source must be permitted separately under Regulation 3 Part B.",
        cites: [gp("11", "I-B")],
      },
    ],
    alternatives: [
      {
        text: "If a permit is needed and GP11 does not fit, the alternatives are a construction permit under Regulation 3 Part B, or GP12, whose covered activities at a well production facility include routine or predictable emissions.",
        cites: [gp("11", "VIII-D-3"), gp("12", "I-A-8")],
      },
    ],
    applicability: [
      { id: gp("11", "I-A"), why: "GP11 I.A — who may register, the included emission activities (I.A.1) and the excluded sources (I.A.2)" },
      { id: gp("11", "I-A-1"), why: "GP11 I.A.1 — the venting activities that may register" },
      { id: gp("11", "I-A-2"), why: "GP11 I.A.2 — facilities and activities that may not register" },
      { id: gp("11", "I-B"), why: "GP11 I.B — registration on the APEN forms; other sources are permitted separately" },
    ],
    alternativeRows: [
      { id: gp("11", "VIII-D-3"), why: "the permit's own terms: a source may apply for a construction permit under Regulation 3 Part B instead" },
      { id: gp("12", "I-A-8"), why: "GP12 — routine or predictable emissions as one of the covered activities at a well production facility" },
    ],
    factors:
      "Whether a construction permit or an APEN is required is decided under Regulation 3; registration under GP11 is voluntary and open to routine or predictable venting at well production and centralized production facilities that meet its Section I conditions.",
  },
  {
    num: "12",
    about: [
      voluntary("12", "XI-D-3", "I-B"),
      {
        text: "It is a general permit for oil and gas well production facilities as defined in Regulation 7 Part B, covering natural gas-fired and diesel fuel-fired reciprocating internal combustion engines, storage tanks for condensate, crude oil, intermediate hydrocarbon liquids and produced water, hydrocarbon liquid loading, separator venting, fugitive component leaks, control equipment and routine or predictable emission activities.",
        cites: [gp("12", "I-A"), gp("12", "I-A-1"), gp("12", "I-A-2"), gp("12", "I-A-3"), gp("12", "I-A-4"), gp("12", "I-A-5"), gp("12", "I-A-6"), gp("12", "I-A-7"), gp("12", "I-A-8"), REG3_GENERAL_PERMIT_DEFINITION],
      },
      {
        text: "It covers only the facility and equipment registered with the Division, applies only to equipment whose uncontrolled actual emissions of sulfur oxides and particulate matter are below the APEN reporting thresholds of Regulation 3 Part A II.D.1.a, and only at a true minor or synthetic minor source for the operating permit, NSR, PSD and MACT programs, with the exception in I.F for sources reclassified after registration.",
        cites: [gp("12", "I-C"), gp("12", "I-D"), gp("12", "I-E"), gp("12", "I-F")],
      },
    ],
    alternatives: [
      {
        text: "If a permit is needed and GP12 does not fit, the alternatives are a source-specific construction permit under Regulation 3 Part B, or the general permits for a single kind of equipment: GP01 (condensate tank batteries), GP05 (produced water tank batteries), GP08 (storage tanks), GP02 (natural gas fired engines), GP06 (diesel engines), GP07 (hydrocarbon liquid loadout) or GP11 (routine or predictable gas venting).",
        cites: [gp("12", "XI-D-3"), gp("01", "I-A"), gp("05", "I-A"), gp("08", "I-B"), gp("02", "I-A"), gp("06", "I-A"), gp("07", "I-A"), gp("11", "I-A")],
      },
    ],
    applicability: [
      { id: gp("12", "I-A"), why: "GP12 I.A — well production facilities, and the equipment the permit covers (I.A.1–I.A.8)" },
      { id: gp("12", "I-B"), why: "GP12 I.B — who may register: a well production facility that can comply with every condition" },
      { id: gp("12", "I-C"), why: "GP12 I.C — only the facility and equipment registered with the Division" },
      { id: gp("12", "I-D"), why: "GP12 I.D — applies only to equipment with SOx and particulate emissions below the APEN reporting thresholds" },
      { id: gp("12", "I-E"), why: "GP12 I.E — true minor or synthetic minor sources only, except as I.F provides" },
      { id: gp("12", "I-F"), why: "GP12 I.F — sources reclassified after registration may continue under the permit" },
    ],
    alternativeRows: [
      { id: gp("12", "XI-D-3"), why: "the permit's own terms: a source may apply for a source-specific construction permit under Regulation 3 Part B instead" },
      { id: gp("01", "I-A"), why: "GP01 — condensate storage tank batteries" },
      { id: gp("05", "I-A"), why: "GP05 — produced water storage tank batteries" },
      { id: gp("08", "I-B"), why: "GP08 — storage tanks (condensate, crude oil, intermediate hydrocarbon liquids, produced water)" },
      { id: gp("02", "I-A"), why: "GP02 — natural gas fired reciprocating internal combustion engines" },
      { id: gp("06", "I-A"), why: "GP06 — diesel fuel-fired reciprocating internal combustion engines" },
      { id: gp("07", "I-A"), why: "GP07 — hydrocarbon liquid loadout" },
      { id: gp("11", "I-A"), why: "GP11 — routine or predictable gas venting emissions" },
    ],
    factors:
      "Whether a construction permit or an APEN is required is decided under Regulation 3; registration under GP12 is voluntary and open to well production facilities that can comply with every condition of the permit.",
  },
];

function buildNote(spec: PermitSpec): PremiseNote {
  const permit = `GP${spec.num}`;
  const sentences: PremiseSentence[] = [
    ...(spec.closed ? [spec.closed] : []),
    ...spec.about,
    REG3_SENTENCE,
    ...spec.alternatives,
  ];
  const provisions: MapProvision[] = [
    ...spec.applicability.map((p) => ({ ...p, group: PREMISE_GROUP_APPLICABILITY })),
    ...REG3_ROWS,
    ...spec.alternativeRows.map((p) => ({ ...p, group: PREMISE_GROUP_ALTERNATIVES })),
  ];
  return {
    key: `gp${spec.num}-required`,
    permit,
    regKey: `gp${spec.num}`,
    title: `Is ${permit} required?`,
    sentences,
    map: {
      key: `premise-gp${spec.num}`,
      name: `${permit}: when it applies, and what decides whether a permit is required`,
      triggers: [],
      factors: spec.factors,
      provisions,
      permitRegKey: `gp${spec.num}`,
    },
  };
}

/** The eleven notes, in permit order. Every id is verified against the database by corpus_qa.sql check 20 (scripts/question-map-ids.sql). */
export const PREMISE_NOTES: PremiseNote[] = PERMITS.map(buildNote);

// ---- matching ------------------------------------------------------------------

/**
 * Strips the acronym expansion expandAcronyms() adds after a permit number
 * ("GP01 (Air Pollution Control Division general permit for …)"), so a
 * caller may pass the raw or the expanded question. Permit numbers are
 * normalised to GP<nn> the way acronyms.ts normalises them.
 */
function normaliseQuestion(q: string): string {
  return q
    .replace(/\s*\(Air Pollution Control Division general permit[^)]*\)/g, "")
    .replace(/(^|[^A-Za-z0-9])gp[\s-]?0?(\d{1,2})(?=$|[^A-Za-z0-9])/gi, (_m, pre: string, n: string) => `${pre}GP${n.padStart(2, "0")}`);
}

const GP = String.raw`GP(\d{2})`;
const ART = String.raw`(?:(?:a|an|the|my|our|this|that|another|any|one)\s+)?`;
const QUAL = String.raw`(?:(?:ever|always|still|actually|really|legally|even|also)\s+)?`;
const REQ_ADJ = String.raw`(?:required|needed|necessary|mandatory|compulsory|obligatory|a\s+requirement|a\s+must)`;

/**
 * The requirement patterns, on the normalised question. Each captures the
 * permit number. Written for how people type the misconception: "when is
 * a GP01 required", "is GP01 mandatory", "GP01 required?", "do I need a
 * GP12", "does my tank battery need a GP01", "do I have to register under
 * GP01", "am I required to get a GP08", "my engine requires a GP02". Not
 * matched on purpose: "GP01 requirements", "what does GP01 require",
 * "requirements under GP01" (questions about the permit's conditions).
 */
const PATTERNS: RegExp[] = [
  // "is (a) GP01 (ever) required / mandatory / a requirement"
  new RegExp(String.raw`\b(?:is|are|was|were|be|being|become|becomes)\s+${ART}${GP}\s+(?:permit\s+|registration\s+|coverage\s+)?${QUAL}${REQ_ADJ}\b`, "i"),
  // "GP01 (is) required", "GP01 required?", "when GP01 becomes mandatory"
  new RegExp(String.raw`\b${GP}\s+(?:permit\s+|registration\s+|coverage\s+)?(?:(?:is|are|was|be|being|becomes?|would\s+be|will\s+be)\s+)?${QUAL}${REQ_ADJ}\b`, "i"),
  // "do I need a GP12", "does my tank battery need a GP01", "would we have to get a GP08", "should I register under GP01"
  new RegExp(
    String.raw`\b(?:do|does|did|would|will|should|must|shall|can|could|am|is|are)\s+(?:i|we|you|they|he|she|it|one|my\s+[\w-]+(?:\s+[\w-]+)?|our\s+[\w-]+(?:\s+[\w-]+)?|an?\s+[\w-]+(?:\s+[\w-]+)?|the\s+[\w-]+(?:\s+[\w-]+)?)\s+${QUAL}(?:(?:going\s+to\s+|supposed\s+to\s+|required\s+to\s+|obligated\s+to\s+|obliged\s+to\s+)?(?:need|require|get|obtain|have|hold|carry|use|file|pull|register\s+(?:for|under)|apply\s+for|sign\s+up\s+for)|have\s+to\s+(?:get|have|obtain|hold|carry|use|file|pull|register\s+(?:for|under)|apply\s+for|sign\s+up\s+for)|need\s+to\s+(?:get|have|obtain|hold|register\s+(?:for|under)|apply\s+for))\s+${ART}${GP}\b`,
    "i"
  ),
  // "(I) need a GP01", "my tank battery requires a GP01", "required to have a GP01", "mandatory to register under GP01"
  new RegExp(
    String.raw`\b(?:needs?|needed|requires?|required|mandatory|necessary|obligated|obliged|have\s+to|has\s+to|had\s+to|must|supposed)\s+(?:to\s+(?:get|have|obtain|hold|carry|use|file|pull|register\s+(?:for|under)|apply\s+for|sign\s+up\s+for)\s+)?${ART}${GP}\b`,
    "i"
  ),
  // "GP01 or not", "GP01 vs an individual permit" are not misconceptions; left alone.
];

/** The permit numbers a question names (two-digit, normalised), in order of appearance, without repeats. */
function permitNumbers(q: string): string[] {
  const out: string[] = [];
  for (const m of q.matchAll(/\bGP(\d{2})\b/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/**
 * The permit number ("01") a requirement question is about, or null: the
 * question must name exactly one general permit that has a note and match
 * one of PATTERNS for that permit. A question naming two permits ("GP01
 * or GP08?") takes no note: the note would have to pick one.
 */
export function premisePermitNumber(question: string): string | null {
  const q = normaliseQuestion(question);
  const named = permitNumbers(q);
  if (named.length !== 1 || !PREMISE_GP_NUMBERS.includes(named[0])) return null;
  for (const re of PATTERNS) {
    const m = re.exec(q);
    if (m && m[1] === named[0]) return named[0];
  }
  return null;
}

/** The premise note a question matches (raw or expanded question), or null. */
export function matchPremiseNote(question: string): PremiseNote | null {
  const num = premisePermitNumber(question);
  if (!num) return null;
  return PREMISE_NOTES.find((n) => n.regKey === `gp${num}`) ?? null;
}

/** The note whose map has this key ("premise-gp01"), or null. */
export function premiseNoteForMapKey(mapKey: string | null | undefined): PremiseNote | null {
  if (!mapKey) return null;
  return PREMISE_NOTES.find((n) => n.map.key === mapKey) ?? null;
}

/**
 * A short label for a cited provision id, for the links beside a note's
 * sentence: "GP01 I.A.1", "Regulation 3 Part A II.A.1", "GP09 (document)".
 * Pure string work on the id (the page has no row for every cite).
 */
export function citeLabel(id: string): string {
  const m = id.match(/^sec-([^-]+)-(.+)$/);
  if (!m) return id;
  const [, reg, rest] = m;
  if (rest.startsWith("top-REG-")) return `${reg.toUpperCase()} (document)`;
  const regName = /^gp\d\d$/.test(reg) ? reg.toUpperCase() : /^\d+$/.test(reg) ? `Regulation ${reg}` : reg.toUpperCase();
  const part = rest.match(/^([A-Z])-(.+)$/);
  if (/^\d+$/.test(reg) && part) return `${regName} Part ${part[1]} ${part[2].replace(/-/g, ".")}`;
  return `${regName} ${rest.replace(/-/g, ".")}`;
}

/** The "{reg}" of a cited id, for the reader link. */
export function citeRegKey(id: string): string | null {
  return id.match(/^sec-([^-]+)-/)?.[1] ?? null;
}
