/**
 * Acceptance questions for Ask search (Phase 3/5 of the semantic-search
 * plan). Each is a question a Colorado oil & gas compliance person would
 * actually type, with the provision(s) that should appear in the top 5,
 * given as id prefixes — any hit whose id starts with one of them passes.
 * Prefixes point at the *section* that governs the topic (e.g. Reg 7 Part B
 * I.D = storage tank emission controls), not one exact paragraph, because
 * several paragraphs in that section are legitimate answers.
 *
 * Target from the plan: ≥ 17 of 20 pass. Run at /admin/semantic-eval.
 */
export type EvalQuestion = {
  q: string;
  expect: string[];
  note: string;
};

export const EVAL_QUESTIONS: EvalQuestion[] = [
  {
    q: "Do I need emission controls on a condensate storage tank at a well site?",
    expect: ["sec-7-B-I-D", "sec-7-B-II-C", "sec-oooob-60.5395b"],
    note: "Reg 7 Part B I.D / II.C storage tank controls; OOOOb storage vessel standard",
  },
  {
    q: "How often do I have to do leak inspections at a well production facility?",
    expect: ["sec-7-B-II-E", "sec-oooob-60.5397b"],
    note: "Reg 7 Part B II.E LDAR frequency; OOOOb fugitive components",
  },
  {
    q: "Can I install a natural gas driven pneumatic controller at a new facility?",
    expect: ["sec-7-B-III", "sec-oooob-60.5390b"],
    note: "Reg 7 Part B III pneumatic controllers; OOOOb process controllers",
  },
  {
    q: "When do I have to file an APEN for a new source and what is the threshold?",
    expect: ["sec-3-A-II"],
    note: "Reg 3 Part A II APEN requirements",
  },
  {
    q: "What notice do I have to give before removing asbestos from a building?",
    expect: ["sec-8-B-III"],
    note: "Reg 8 Part B III abatement/renovation/demolition notifications",
  },
  {
    q: "How is an odor violation measured with dilutions?",
    expect: ["sec-2-A-I", "sec-2-A-II"],
    note: "Reg 2 Part A odor dilution standard",
  },
  {
    q: "Do I need to notify the Commission before abandoning a flowline?",
    expect: ["sec-ecmc-1105"],
    note: "ECMC Rule 1105 flowline abandonment",
  },
  {
    q: "How far does a new well pad have to be from a house or a school?",
    expect: ["sec-ecmc-604"],
    note: "ECMC Rule 604 setbacks",
  },
  {
    q: "Do I need a permit to burn slash piles on a lease?",
    expect: ["sec-9-III", "sec-9-IV", "sec-9-II", "sec-9-I"],
    note: "Reg 9 open burning permits (Sept 18 miss: vocabulary — 'slash' vs 'open burning')",
  },
  {
    q: "Which oil and gas operators have to report annual greenhouse gas emissions to the state?",
    expect: ["sec-22-A-III", "sec-22-A-IV", "sec-7-B-VIII"],
    note: "Reg 22 GHG reporting; Reg 7 Part B VIII intensity reporting",
  },
  {
    q: "What are the noise limits at an oil and gas location near residences?",
    expect: ["sec-ecmc-423"],
    note: "ECMC Rule 423 noise",
  },
  {
    q: "What do I have to do after a spill of produced water?",
    expect: ["sec-ecmc-912"],
    note: "ECMC Rule 912 spills and releases",
  },
  {
    q: "What are the emission standards for a new natural gas fired compressor engine?",
    expect: ["sec-26-A", "sec-26-B-I", "sec-26-B-II", "sec-26-C-FEDJJJJ"],
    note: "Reg 26 engines (Part A/B) and incorporated Subpart JJJJ",
  },
  {
    q: "What controls are required for a glycol dehydrator?",
    expect: ["sec-7-B-I-H", "sec-7-B-II-D"],
    note: "Reg 7 Part B I.H / II.D glycol dehydrators",
  },
  {
    q: "What venting and control requirements apply to a centrifugal compressor with wet seals?",
    expect: ["sec-7-B-II-J", "sec-oooob-60.5380b"],
    note: "Reg 7 Part B II.J; OOOOb centrifugal compressors",
  },
  {
    q: "What do I have to do with the flowback during well completion?",
    expect: ["sec-7-B-VI-D", "sec-oooob-60.5375b", "sec-ooooa-60.5375a"],
    note: "Reg 7 Part B VI.D pre-production flowback; OOOOa/OOOOb well completions",
  },
  {
    q: "When does a source need a construction permit versus just an APEN?",
    expect: ["sec-3-B-I", "sec-3-B-II", "sec-3-A-II"],
    note: "Reg 3 Part B construction permit applicability",
  },
  {
    q: "How does the Division assess civil penalties for a violation?",
    expect: ["sec-cp-III"],
    note: "Common Provisions III civil penalties",
  },
  {
    q: "Am I subject to the federal OOOOb rules if I modified a well after December 2022?",
    expect: ["sec-oooob-60.5365b", "sec-oooob-60.5370b"],
    note: "OOOOb applicability and compliance dates",
  },
  {
    q: "ECD testing requirements",
    expect: ["sec-7-B-II-B-2-h", "sec-7-B-I-E"],
    note: "Reg 7 Part B II.B.2.h enclosed combustion device requirements (acronym expansion + keyword side)",
  },
  {
    q: "flare testing",
    expect: ["sec-7-B-II-B-2-h", "sec-oooob-60.5412b", "sec-ooooa-60.5412a", "sec-oooob-60.5417b"],
    note: "Reg 7 combustion devices / OOOO flare control-device requirements — a two-word keyword-style query",
  },
  {
    q: "APEN exemptions for small sources",
    expect: ["sec-3-A-II"],
    note: "Reg 3 Part A II.D APEN exemptions",
  },
  {
    q: "What are the requirements for loading gasoline into a tank truck at a bulk plant?",
    expect: ["sec-24-B-IV", "sec-24-B-APPENDIX"],
    note: "Reg 24 Part B IV petroleum liquid storage and transfer",
  },
];
