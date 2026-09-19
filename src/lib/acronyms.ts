/**
 * Colorado oil & gas / air-quality acronyms, expanded before a question is
 * embedded or keyword-matched. The embedding model has no idea that "ECD"
 * means enclosed combustion device; the corpus does. Expansion keeps the
 * acronym AND adds the phrase ("ECD (enclosed combustion device) testing"),
 * so both the keyword side and the meaning side of hybrid search benefit.
 *
 * Only whole-word, case-sensitive matches are expanded (so "apen" in a
 * sentence is left alone but "APEN" is expanded). Add entries freely; keep
 * the expansion to the phrase the regulations themselves use.
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

const PATTERN = new RegExp(
  "(^|[^A-Za-z0-9])(" +
    Object.keys(ACRONYMS)
      .sort((a, b) => b.length - a.length)
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|") +
    ")(?=$|[^A-Za-z0-9])",
  "g"
);

/** "ECD testing requirements" → "ECD (enclosed combustion device) testing requirements". */
export function expandAcronyms(text: string): string {
  // Permit numbers are typed every which way ("gp02", "Gp-02"); normalise to GP02.
  text = text.replace(/(^|[^A-Za-z0-9])gp-?(\d{2})(?=$|[^A-Za-z0-9])/gi, "$1GP$2");
  return text.replace(PATTERN, (_m, pre: string, key: string) => {
    const full = ACRONYMS[key];
    return full ? `${pre}${key} (${full})` : `${pre}${key}`;
  });
}
