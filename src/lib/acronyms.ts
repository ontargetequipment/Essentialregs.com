/**
 * Colorado oil & gas / air-quality acronyms, expanded before a question is
 * embedded or keyword-matched. The embedding model has no idea that "ECD"
 * means enclosed combustion device; the corpus does. Expansion keeps the
 * acronym AND adds the phrase ("ECD (enclosed combustion device) testing"),
 * so both the keyword side and the meaning side of hybrid search benefit.
 *
 * Whole-word matches in any case are expanded ("ecd", "ECD"); see
 * CASE_SENSITIVE for the two exceptions. Add entries freely; keep the
 * expansion to the phrase the regulations themselves use.
 */
export const ACRONYMS: Record<string, string> = {
  // CDPHE / AQCC
  APEN: "Air Pollutant Emission Notice",
  AQCC: "Air Quality Control Commission",
  APCD: "Air Pollution Control Division",
  CDPHE: "Colorado Department of Public Health and Environment",
  AIMM: "approved instrument monitoring method",
  AVO: "audio, visual, olfactory inspection",
  BACT: "best available control technology",
  BMP: "best management practice",
  CEMS: "continuous emission monitoring system",
  CPMS: "continuous parameter monitoring system",
  ECD: "enclosed combustion device",
  ECDs: "enclosed combustion devices",
  FIP: "federal implementation plan",
  GHG: "greenhouse gas",
  HAP: "hazardous air pollutant",
  HAPs: "hazardous air pollutants",
  LDAR: "leak detection and repair",
  MACT: "maximum achievable control technology",
  MFCE: "midstream fuel combustion equipment",
  NAAQS: "national ambient air quality standards",
  NESHAP: "national emission standards for hazardous air pollutants",
  NSPS: "new source performance standards",
  NSR: "new source review",
  OGI: "optical gas imaging",
  PSD: "prevention of significant deterioration",
  PTE: "potential to emit",
  RACT: "reasonably available control technology",
  SIP: "state implementation plan",
  STEM: "storage tank emission management",
  TAC: "toxic air contaminant",
  VOC: "volatile organic compound",
  VOCs: "volatile organic compounds",
  VRU: "vapor recovery unit",
  LACT: "lease automatic custody transfer",
  // APCD general permits (Reg 3 Part B III.J / Part C VIII). The permit
  // conditions themselves are not in the corpus, so the expansion names the
  // equipment the permit covers plus "general permit" to land on Reg 3.
  GP01: "Air Pollution Control Division general permit for condensate storage tank batteries",
  GP02: "Air Pollution Control Division general permit for natural gas fired reciprocating internal combustion engines (RICE) at oil and gas operations",
  GP03: "Air Pollution Control Division general permit for land development and earthmoving",
  GP04: "Air Pollution Control Division general permit (not active)",
  GP05: "Air Pollution Control Division general permit for produced water storage tank batteries",
  GP06: "Air Pollution Control Division general permit for diesel reciprocating internal combustion engines (RICE)",
  GP07: "Air Pollution Control Division general permit for hydrocarbon liquid loadout and truck loading",
  GP08: "Air Pollution Control Division general permit for oil and gas storage tanks (condensate, crude oil, produced water)",
  GP09: "Air Pollution Control Division general permit for oil and gas well production facilities in attainment areas",
  GP10: "Air Pollution Control Division general permit for oil and gas well production facilities in nonattainment areas",
  GP11: "Air Pollution Control Division general permit for routine or predictable (ROPE) natural gas venting",
  GP12: "Air Pollution Control Division general permit for facility-wide oil and gas well production facilities",
  RICE: "reciprocating internal combustion engine",
  ROPE: "routine or predictable emissions from gas venting",
  // ECMC
  ECMC: "Energy and Carbon Management Commission",
  COGCC: "Colorado Oil and Gas Conservation Commission",
  OGDP: "oil and gas development plan",
  CAP: "comprehensive area plan",
  RBU: "residential building unit",
  HOB: "high occupancy building",
  MIT: "mechanical integrity test",
  APD: "application for permit to drill",
  SUA: "surface use agreement",
  // Federal
  EPA: "Environmental Protection Agency",
  CFR: "Code of Federal Regulations",
  OOOO: "Subpart OOOO",
  OOOOa: "Subpart OOOOa",
  OOOOb: "Subpart OOOOb",
  OOOOc: "Subpart OOOOc",
  CEDRI: "Compliance and Emissions Data Reporting Interface",
  EG: "emission guidelines",
  // Equipment / operations
  LEL: "lower explosive limit",
  PRV: "pressure relief valve",
  SCADA: "supervisory control and data acquisition",
  ESD: "emergency shutdown",
  H2S: "hydrogen sulfide",
  NOx: "nitrogen oxides",
  SO2: "sulfur dioxide",
  PM10: "particulate matter 10 microns",
  "PM2.5": "fine particulate matter",
  tpy: "tons per year",
  bbl: "barrels",
  MMBtu: "million British thermal units",
  scf: "standard cubic feet",
};

/**
 * Everything matches in any case ("ecd", "Ecd", "ECD"). The only exceptions
 * are keys that are ordinary English words a person might type for their
 * plain meaning: "cap" (a cap on emissions) and "eg" (e.g.). Those expand
 * only when typed in capitals.
 */
const CASE_SENSITIVE = new Set(["CAP", "EG"]);

const BY_LOWER: Record<string, string> = Object.fromEntries(
  Object.keys(ACRONYMS).map((k) => [k.toLowerCase(), k])
);

const PATTERN = new RegExp(
  "(^|[^A-Za-z0-9])(" +
    Object.keys(ACRONYMS)
      .sort((a, b) => b.length - a.length)
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|") +
    ")(?=$|[^A-Za-z0-9])",
  "gi"
);

/** Canonical dictionary key for a typed token, or null when it shouldn't expand. */
function keyFor(token: string): string | null {
  const key = ACRONYMS[token] ? token : BY_LOWER[token.toLowerCase()];
  if (!key) return null;
  if (CASE_SENSITIVE.has(key) && token !== key) return null;
  return key;
}

function normalise(text: string): string {
  // Permit numbers are typed every which way ("gp02", "Gp-02"); normalise to GP02.
  return text.replace(/(^|[^A-Za-z0-9])gp-?(\d{2})(?=$|[^A-Za-z0-9])/gi, "$1GP$2");
}

/** "ecd testing requirements" → "ecd (enclosed combustion device) testing requirements". */
export function expandAcronyms(text: string): string {
  return normalise(text).replace(PATTERN, (_m, pre: string, token: string) => {
    const key = keyFor(token);
    return key ? `${pre}${token} (${ACRONYMS[key]})` : `${pre}${token}`;
  });
}

/**
 * Keyword-side phrase for an acronym when the full expansion is descriptive
 * rather than the words the regulations use (the general permits: the corpus
 * says "general permit", never "GP02 for diesel engines").
 */
const KEYWORD_PHRASE: Record<string, string> = Object.fromEntries(
  Object.keys(ACRONYMS).filter((k) => /^GP\d\d$/.test(k)).map((k) => [k, "general permit"])
);

/**
 * Extra keyword alternatives: how the regulations refer to the same thing.
 * Reg 7 Part B I.B.2 defines "air pollution control equipment" as "a
 * combustion device or vapor recovery unit", and the text says "combustion
 * device" far more often than "enclosed combustion device"; "ECD" itself
 * appears nowhere in the corpus.
 */
const KEYWORD_ALTS: Record<string, string[]> = {
  ECD: ["combustion device", "air pollution control equipment"],
  ECDs: ["combustion devices", "air pollution control equipment"],
  VRU: ["vapor recovery", "air pollution control equipment"],
  LDAR: ["leak detection", "leak inspection"],
  APEN: ["emission notice"],
  OGI: ["infrared camera"],
  AIMM: ["instrument monitoring"],
};

const STOP = new Set(["a", "an", "the", "of", "for", "and", "or", "to", "in", "on", "at", "is", "are", "do", "i", "my", "we", "our", "what", "when", "how", "does", "need", "with", "by", "from", "that", "this", "it", "be", "can", "any"]);

/**
 * Builds the full-text query for match_provisions_hybrid in to_tsquery
 * syntax. Plain words are ANDed; an acronym becomes an OR-group of the
 * acronym and its spelled-out phrase, so "ecd testing" searches for
 * (ecd | enclosed<->combustion<->device) & testing — Postgres's websearch
 * parser can't express that grouping. Returns "" when nothing is left.
 */
export function keywordQuery(text: string): string {
  const parts: string[] = [];
  const tokens = normalise(text).match(/[A-Za-z0-9][A-Za-z0-9.]*[A-Za-z0-9]|[A-Za-z0-9]/g) ?? [];
  for (const raw of tokens) {
    const key = keyFor(raw);
    if (key) {
      const acr = raw.replace(/\./g, "");
      const alts = [KEYWORD_PHRASE[key] ?? ACRONYMS[key], ...(KEYWORD_ALTS[key] ?? [])]
        .map((ph) => ph.replace(/\([^)]*\)/g, " ").match(/[A-Za-z0-9]+/g)?.filter((w) => !STOP.has(w.toLowerCase())) ?? [])
        .filter((ws) => ws.length > 0)
        .map((ws) => (ws.length === 1 ? ws[0] : `(${ws.join(" <-> ")})`));
      parts.push(alts.length ? `(${[acr, ...alts].join(" | ")})` : acr);
    } else {
      const w = raw.replace(/\./g, "");
      if (w && !STOP.has(w.toLowerCase())) parts.push(w);
    }
  }
  return parts.join(" & ");
}
