#!/usr/bin/env python3
"""AI plain-English summary generation for essentialregs.com provisions.

Reads rows from the Supabase `provisions` table whose `ai_summary` is NULL
(or every row in scope, with --force), builds a citation-aware prompt for
each from the regulation root, the parent chain, and the provision's own
sanitized text, and generates a 2-5 sentence plain-English summary with
Claude. Writes `ai_summary`, `summary_model`, and `summary_generated_at`
back to the row.

Designed to run in GitHub Actions (see .github/workflows/summarize.yml),
where both Supabase and api.anthropic.com are reachable. Uses the
Anthropic Message Batches API by default (50% cheaper, no rate-limit
juggling); pass --sync for small interactive test runs.

Examples:
    # See what would be sent, without calling the API or writing anything.
    python pipeline/summarize.py --dry-run --limit 5

    # Spot-check: summarize the first 25 unsummarized rows of Reg 7.
    python pipeline/summarize.py --reg 7 --limit 25

    # Full run, every regulation, resumable (already-summarized rows are
    # skipped automatically).
    python pipeline/summarize.py

    # Regenerate every summary in Reg 3 from scratch.
    python pipeline/summarize.py --reg 3 --force

    # --reg takes any regulation id prefix: 1, 2, 3, 6, 7, 8, 22, 26, ecmc,
    # ooooa, oooob, ooooc. Regs listed in REG_PROMPT_HINTS get an extra
    # regulation-specific paragraph appended to the system prompt per row.

Required environment variables (all three, unless --dry-run — see below):
    ANTHROPIC_API_KEY
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY

--dry-run still needs SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (it reads
real rows to print real prompts/estimates) but never needs, and never
requires, ANTHROPIC_API_KEY — no Anthropic call is made in dry-run mode.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

PIPELINE_DIR = Path(__file__).resolve().parent
FAILED_LOG_PATH = PIPELINE_DIR / "failed.jsonl"

DB_PAGE_SIZE = 200          # rows fetched per Supabase page while scanning candidates
META_PAGE_SIZE = 1000       # rows fetched per page when building the id->citation/parent map
MIN_WORDS = 25              # tag-stripped word count below this = headings-only, skip
MAX_PROMPT_WORDS = 6000     # cap on the provision's own text included in the prompt
PARENT_TEXT_CHARS = 400     # chars of the immediate parent paragraph shown for scoping
MAX_TOKENS = 700            # 400 cut four wide ZZZZ table summaries mid-sentence (batch 4)
TEMPERATURE = 0
DEFAULT_MODEL = "claude-sonnet-4-5"
BATCH_MAX_REQUESTS = 1000   # Anthropic Message Batches API limit per batch
POLL_INTERVAL_SECONDS = 20
MAX_POLL_SECONDS = 6 * 60 * 60  # matches the workflow's 6h job timeout

# Published per-million-token USD rates (standard, non-batch pricing).
# The Message Batches API is 50% off both numbers -- applied in estimate_cost().
# Update this table if Anthropic changes pricing or you pass a new --model.
MODEL_RATES = {
    "claude-sonnet-4-5": {"in": 3.00, "out": 15.00},
    "claude-sonnet-4-5-20250929": {"in": 3.00, "out": 15.00},
    "claude-sonnet-4-20250514": {"in": 3.00, "out": 15.00},
    "claude-3-7-sonnet-20250219": {"in": 3.00, "out": 15.00},
    "claude-haiku-4-5": {"in": 1.00, "out": 5.00},
    "claude-haiku-4-5-20251001": {"in": 1.00, "out": 5.00},
    "claude-3-5-haiku-20241022": {"in": 0.80, "out": 4.00},
}
FALLBACK_RATE = {"in": 3.00, "out": 15.00}

TAG_RE = re.compile(r"<[^>]+>")
NBSP_RE = re.compile(r"&nbsp;")
WS_RE = re.compile(r"\s+")

DEFAULT_AUDIENCE = (
    "an EHS or compliance person at a Colorado oil & gas operator"
)

# Per-regulation override of the audience clause in SYSTEM_PROMPT, keyed by
# the row's own regulation key (see REG_PROMPT_HINTS below for the same
# keying). Regs with no entry get DEFAULT_AUDIENCE -- this is the hook for a
# future non-oil-and-gas regulation to swap in its own reader description;
# ECMC is still oil & gas, so it gets no entry here.
REG_AUDIENCE: dict[str, str] = {
    # Reg 11 is the motor-vehicle emissions inspection (AIR) program: its
    # readers run or work at inspection stations and repair shops, or manage
    # fleets -- not oil and gas operators.
    "11": (
        "an owner or licensed inspector/mechanic at a Colorado emissions "
        "inspection station or repair facility, or a fleet manager"
    ),
    # Reg 12: diesel fleet self-certification and opacity inspection.
    "12": (
        "a fleet manager, diesel opacity inspector, or vehicle owner in "
        "Colorado's diesel emissions programs"
    ),
    # Reg 25: surface coating, solvent, printing and pharmaceutical VOC rules.
    "25": (
        "an environmental or plant manager at a Colorado surface coating, "
        "printing, degreasing, asphalt or pharmaceutical facility"
    ),
    # Reg 27: greenhouse-gas requirements for manufacturing facilities.
    "27": (
        "an environmental or energy manager at a Colorado manufacturing "
        "facility subject to the GEMM 2 or EITE greenhouse gas rules"
    ),
    # Batch 6: Air Quality Standards, Designations and Emission Budgets
    # (5 CCR 1001-14) -- ambient standards, area designations and motor
    # vehicle emissions budgets: read by planners and permit engineers.
    "aqs": (
        "an air-quality planner or permit engineer checking Colorado's "
        "ambient standards, nonattainment/maintenance area designations "
        "and motor vehicle emissions budgets"
    ),
    # Batch 6 (Sept 20 2026). Reg 16 (street sanding) and the SIP Local
    # Elements document (per-area street sanding, sweeping and woodburning
    # measures) are read by the public-works side of local government, not
    # by oil and gas operators.
    "16": (
        "a municipal public-works or street-maintenance manager in a Colorado "
        "PM10 area"
    ),
    "sip": (
        "a municipal public-works or street-maintenance manager in a Colorado "
        "PM10 area"
    ),
    # Reg 18 adopts the federal Acid Rain Program (40 CFR Parts 72 and 76)
    # for Colorado's Title IV utility units.
    "18": (
        "an environmental manager at a Colorado electric utility or large "
        "combustion source"
    ),
    # Reg 19 (Batch 6): Colorado's lead-based paint program -- training,
    # certification and work practices for abatement, and pre-renovation
    # education. Its readers are the certified trades, not oil and gas.
    "19": (
        "a lead-based-paint contractor, inspector, risk assessor or renovator "
        "in Colorado"
    ),
    # Reg 20 (Batch 6): Colorado Clean Cars and Trucks -- LEV/ZEV/ACT vehicle
    # standards adopted from California; its readers sell, certify, register
    # or run fleets of vehicles, not oil and gas equipment.
    "20": (
        "a vehicle manufacturer, dealer or fleet compliance manager selling "
        "or registering vehicles in Colorado"
    ),
    # Reg 21: VOC content limits for consumer products and AIM coatings --
    # its readers make, distribute or sell those products, not operate
    # stationary sources.
    "21": (
        "a manufacturer, distributor or retailer of consumer products or "
        "architectural coatings sold in Colorado"
    ),
    # Batch 7. Reg 4 (wood-burning appliances): its readers sell, install or
    # own stoves, fireplaces and masonry heaters -- not oil and gas
    # equipment. Appendix A is written for a test laboratory, but the
    # regulation as a whole is read by the trade and by homeowners in the
    # areas where high-pollution-day burning restrictions apply.
    "4": (
        "a stove and fireplace retailer, installer or homeowner in a "
        "Colorado high-pollution area"
    ),
    # Batch 7. Reg 10 is the transportation conformity rule: its readers
    # are MPO / CDOT / Division planners running conformity analyses and
    # the interagency consultation process, not stationary-source
    # operators.
    "10": (
        "a transportation planner at a Colorado metropolitan planning "
        "organization or state agency doing conformity analysis"
    ),
    # Reg 15 is the ozone-depleting-compound refrigerant rule: registration,
    # notification and recordkeeping for the people who service air
    # conditioning and refrigeration equipment.
    "15": (
        "a motor-vehicle air-conditioning or refrigeration service "
        "technician in Colorado"
    ),
    # Batch 7: Reg 23 (Regional Haze Limits) sets unit-by-unit NOx/SO2/
    # particulate limits and closure dates for named Colorado power plants,
    # cement kilns, a steel mill and a refinery -- read by the people who
    # have to meet them, not by oil and gas operators.
    "23": (
        "an environmental manager at a Colorado power plant or large "
        "industrial source subject to regional haze limits"
    ),
    # Reg 28 (Batch 7): building benchmarking and performance standards --
    # read by the people who own or run the buildings (50,000 sq ft and up,
    # commercial and multifamily), not by oil and gas operators.
    "28": (
        "an owner or property manager of a large commercial or multifamily "
        "building in Colorado"
    ),
    # Reg 29 restricts gasoline-powered lawn and garden equipment used BY
    # (or under contract to) public entities -- its readers run government
    # grounds and fleets, not industrial sources.
    "29": (
        "a public-entity fleet or grounds manager buying or using lawn and "
        "garden equipment in Colorado"
    ),
    # Reg 31 (Batch 7): methane from municipal solid waste landfills -- gas
    # collection and control systems, surface emissions monitoring, cover and
    # reporting. Its readers run landfills; they are not oil and gas
    # operators and not stationary combustion sources.
    "31": (
        "an operator of a municipal solid waste landfill in Colorado"
    ),
    # Batch 7: the AQCC Procedural Rules (5 CCR 1001-1) -- how to appear
    # before the Commission, not what to emit. Its readers are the people in
    # the hearing room: proponents, parties, petitioners and members of the
    # public, not operators of any particular kind of source.
    "proc": (
        "anyone appearing before the Colorado Air Quality Control Commission "
        "in a rulemaking or adjudication"
    ),
}

SYSTEM_PROMPT_TEMPLATE = (
    "You are explaining a legal/regulatory provision to {audience} who is NOT a lawyer and does "
    "not want to wade through legal language. Write 2-5 short sentences in "
    "plain, everyday English, the way you'd explain it out loud to a "
    "coworker: who it applies to, what it requires or prohibits, and any "
    "key thresholds, dates, or numbers. Avoid legal jargon and formal "
    "throat-clearing like 'this provision' or 'this is a definitional "
    "provision' -- just say what it means. Spell out an acronym the first "
    "time you use it, but ONLY expand an acronym the way this regulation "
    "itself defines it -- never from general knowledge or what the acronym "
    "usually means elsewhere. Two you will see often in this regulation: "
    "MFCE means midstream fuel combustion equipment; AIMM means approved "
    "instrument monitoring method. \"The Division\" means the Colorado Air "
    "Pollution Control Division (part of CDPHE), not any other agency (e.g. "
    "not COGCC) unless the text itself says otherwise.\n\n"
    "Never state a date, deadline, number, threshold, percentage, or "
    "geographic qualifier (e.g. a specific county) that is not literally "
    "present in the text given to you -- not from context, not from what "
    "the rest of the regulation usually says, not from general knowledge of "
    "this regulation. If the text says a duty or deadline continues "
    "'thereafter' or similar open-ended language, say that -- do not invent "
    "an end date. Never assert a cross-reference, exception, or \"state-only\" "
    "designation that is not explicitly stated in the text.\n\n"
    "If the text you are given appears to start mid-sentence or mid-clause "
    "(e.g. it opens with a lowercase word, a dangling clause, or a fragment "
    "that doesn't stand alone), do not guess at what the missing opening "
    "words might be from context or general knowledge. Say plainly that the "
    "provision's beginning (e.g. its applicability or effective-date clause) "
    "is not shown in the available text, and summarize only what is "
    "actually present.\n\n"
    "Scope the summary by the paragraph's OWN words plus its immediate "
    "parent paragraph -- nothing wider. Never carry an equipment list, an "
    "applicability date, or a scope qualifier down from the section heading "
    "or the subpart title into a sub-paragraph. For example, a paragraph "
    "under \"(c) storage vessel affected facilities\" is about storage "
    "vessels only, even when the section heading above it also lists "
    "compressors and pumps. The \"Under:\" lines and \"Parent paragraph "
    "text:\" are there to tell you what this paragraph hangs off of, not to "
    "be folded into it.\n\n"
    "In 40 CFR text ONLY (e.g. the OOOO subparts), the body that approves, "
    "receives, or is notified is \"the Administrator\" (the EPA "
    "Administrator) unless the text itself names someone else -- this does "
    "NOT hold for any other CFR title (e.g. 49 CFR), where \"the "
    "Administrator\" means whatever that title's own regulation-specific "
    "guidance below says it means. Never write \"the Division\" in a "
    "federal CFR summary -- that term belongs to the Colorado regulations "
    "-- and never mention Colorado, CDPHE, or any state or state agency "
    "unless the text you were given mentions it.\n\n"
    "Do not invent illustrative examples for a defined term -- if the text "
    "defines something without examples, don't supply your own. Do not "
    "expand an acronym unless the text in front of you expands it; leave "
    "CEDRI, subpart letters, and anything else the text only abbreviates "
    "exactly as written.\n\n"
    "eCFR equations are images and do not survive text extraction, so a "
    "provision may say something like \"calculated as follows:\" and then "
    "list only the variable definitions with no formula. When that happens, "
    "say the equation itself is not shown in the available text and "
    "describe only what the variables represent -- never reconstruct or "
    "recite an equation that isn't there.\n\n"
    "Never add requirements that are not in the text. If a section is "
    "purely a definition or administrative detail, say that plainly in one "
    "sentence. No preamble, no markdown, no bullet lists -- output only the "
    "summary."
)

# The one sentence in SYSTEM_PROMPT_TEMPLATE that names "the EPA
# Administrator" -- scoped to 40 CFR text ONLY in its own wording, but
# system_prompt_for() strips it entirely (rather than relying on the reader
# to honor the parenthetical) for regs from a different CFR title, i.e.
# 49 CFR Parts 190-196/199 (PHMSA) -- see _REG_49_CFR_KEYS below. Every other
# reg (Colorado and the existing 40 CFR subparts alike) keeps it, so
# SYSTEM_PROMPT itself, and every hint/test built on it, is unchanged.
_EPA_ADMINISTRATOR_SENTENCE = (
    "In 40 CFR text ONLY (e.g. the OOOO subparts), the body that approves, "
    "receives, or is notified is \"the Administrator\" (the EPA "
    "Administrator) unless the text itself names someone else -- this does "
    "NOT hold for any other CFR title (e.g. 49 CFR), where \"the "
    "Administrator\" means whatever that title's own regulation-specific "
    "guidance below says it means. "
)

# Regs whose CFR title is NOT 40 -- system_prompt_for() strips
# _EPA_ADMINISTRATOR_SENTENCE from their rendered base prompt so a 49 CFR
# row's summary is never told, even conditionally, that "the Administrator"
# might be the EPA Administrator; their own REG_PROMPT_HINTS entry supplies
# the correct (PHMSA) meaning instead.
_REG_49_CFR_KEYS = frozenset({"p190", "p191", "p192", "p193", "p194", "p195", "p196", "p199"})

# The rendered prompt for the default (oil & gas) audience -- every existing
# call site and test refers to this literal string, so it must stay
# byte-identical to the pre-audience-hook wording.
SYSTEM_PROMPT = SYSTEM_PROMPT_TEMPLATE.format(audience=DEFAULT_AUDIENCE)

# Regulation-specific guidance appended to SYSTEM_PROMPT per ROW, keyed by
# the row's own regulation key (the "<regkey>" in an id like
# "sec-<regkey>-..."), so it applies in full-corpus runs (no --reg) and
# --ids/--ids-file runs alike. Distilled from the importer agents' warnings
# (SUMMARIZER_WARNINGS.md). Regs with no entry get SYSTEM_PROMPT unchanged.
_COLORADO_AREA_SCOPE_HINT = (
    "Many sections of this Colorado regulation are scoped to a specific area "
    "-- the 8-hour Ozone Control Area, a named nonattainment or "
    "attainment-maintenance area, or a listed set of counties -- while others "
    "apply statewide. Do not infer either. Never write \"in Colorado\", "
    "\"statewide\", or \"anywhere in the state\" for a provision unless the "
    "text in front of you (its own words or the parent paragraph shown) says "
    "so, and never name an area or county it does not name. If the text "
    "states the area, repeat it exactly; if it says nothing about where it "
    "applies, say nothing about where it applies."
)

REG_PROMPT_HINTS: dict[str, str] = {
    "1": (
        "This row is from Colorado Regulation Number 1 (particulates, smoke, "
        "carbon monoxide, sulfur oxides). Reg 1 applies statewide unless a "
        "provision names attainment, attainment-maintenance, or nonattainment "
        "areas -- if the text names an area, say so; if it doesn't, don't add "
        "one. Sections VII and VIII set unit-level limits for named facilities "
        "(e.g. Public Service Company of Colorado stations); never generalize "
        "them to all sources. Section X and its subsections (X.A-X.Q) are "
        "rulemaking history, not current requirements. Appendices A and B are "
        "test methods -- describe them as methods, not as history. Federal "
        "methods (EPA Method 9, Methods 1-8, 40 CFR Part 60 appendices and "
        "subparts) are incorporated by reference with a fixed edition date; do "
        "not describe their contents. In formulas a caret is an exponent "
        "((FI)^-0.26 is FI raised to the negative 0.26 power) and 10^6 BTU "
        "means one million BTU. PE is the particulate emission variable "
        "(pounds per hour or pounds per million BTU, as the text says), not "
        "\"professional engineer\"; FI is fuel input; P is process weight "
        "rate. \"Commission\" is the Air Quality Control Commission; "
        "\"Division\" is the Air Pollution Control Division."
    ),
    "2": (
        "This row is from Colorado Regulation Number 2 (odor). Part A is the "
        "general odor standard for sources statewide; Part B applies only to "
        "housed commercial swine feeding operations, so never generalize a "
        "Part B row to other sources. In Part B, \"the Division\" means the "
        "Division of Environmental Health and Sustainability of CDPHE, not "
        "the Air Pollution Control Division; in Part A it is the Air "
        "Pollution Control Division. Many Part B rows open with a bare "
        "heading or defined term followed by the body -- treat that first "
        "line as the heading, not a sentence. Section IX.B lists recommended "
        "practices the Division may require, even where a sub-row says "
        "\"shall\"; do not present them as blanket mandates unless the text "
        "says so. Part C rows are statements of basis: rulemaking history, "
        "not requirements, and sections they describe as removed no longer "
        "exist. Leave SB 06-114, C.A.R.E., USPHS Pub. #999-AP-32, BOD, FTE, "
        "and WQCC/Regulation 61 as written unless the text expands them; "
        "cross-references to Regulation Number 6 or the Common Provisions "
        "point outside this regulation."
    ),
    "6": (
        "This row is from Colorado Regulation Number 6 (standards of "
        "performance for new stationary sources). Part A rows are "
        "adoption-by-reference records: a row that reads \"<title>. 40 CFR "
        "Part 60, Subpart Xx (July 1, 2025).\" means Colorado adopts that "
        "federal subpart by reference as of that CFR edition -- say exactly "
        "that, and do not invent or summarize the subpart's requirements. The "
        "date in parentheses is the incorporated CFR edition, not a "
        "compliance date. If a row adds Colorado-specific deviations, "
        "summarize only those. In Part 60-adopted text, \"Administrator\" "
        "means the Colorado Air Pollution Control Division except where the "
        "text or Table 1 says otherwise; in Part 75 text it means EPA. "
        "Statement-of-basis rows (Part A Sections I-XXXII, Part B Section IX) "
        "are rulemaking history, not requirements. Part B Section VIII is "
        "Colorado's state-only mercury program for coal-fired power plants; "
        "do not conflate it with the federal MATS rule (40 CFR 63 Subpart "
        "UUUUU). Quote numeric limits and equations as written (a caret is an "
        "exponent); never recompute them. Subparts Cb, Cc, Cf, DDDD, FFFF, "
        "HHHH, and MMMM are emission guidelines for existing sources, not "
        "new-source performance standards."
    ),
    "8": (
        "This row is from Colorado Regulation Number 8 (hazardous air "
        "pollutants, including asbestos). Parts A and E list 40 CFR Part 61 "
        "and Part 63 subparts incorporated by reference with a CFR edition "
        "date -- say the subpart is incorporated as of that version and do "
        "not summarize or invent the subpart's requirements (an inline Title "
        "V exemption stated in the row may be reported). Entries marked "
        "\"Repealed\" or \"Reserved\" are placeholders. Part C "
        "is repealed apart from its statement-of-basis entries. In Part B, "
        "keep the distinction between school buildings (Section IV), other "
        "facilities, and single-family residential dwellings, and mention "
        "\"areas of public access\" or \"trigger levels\" only when the text "
        "does. Reg 8 acronyms: AMS is Air Monitoring Specialist, GAC is "
        "General Abatement Contractor, LEA is local education agency, MAAL is "
        "Maximum Allowable Asbestos Level, NAM is negative air machine, LCF "
        "is large contiguous facility, SFRD is single-family residential "
        "dwelling; in Part D, \"source\" and \"base year\" carry Part D's own "
        "definitions. Statement-of-basis rows are rulemaking history, not "
        "requirements. Refer to fee and weighting tables rather than "
        "restating every row. Ignore any trailing Editor's Notes revision "
        "history."
    ),
    "cp": (
        "This row is from the Common Provisions Regulation (5 CCR 1001-2). Section "
        "I.G defines terms used across every AQCC regulation -- \"Commission\" means "
        "the Air Quality Control Commission; \"Division\" means the Air Pollution "
        "Control Division (APCD). Each Section I.G row is a single defined term "
        "(kind \"definition\") -- summarize it as a definition of that one term, "
        "never generalize it into a broader rule. Where a term carries its own "
        "internal a./b./c. sub-items -- e.g. \"SOURCE DEFINTIONS\", printed exactly "
        "that way, a verbatim source typo and not an error to fix -- treat those "
        "sub-items as part of that one term's definition, not separate provisions. "
        "Section III's title, \"(State Only) Civil Penalties\", keeps \"(State "
        "Only)\" as printed. Section IV is Reserved -- a genuine heading with no "
        "body text, not a parsing gap. Section V (V.A-V.V) is rulemaking history "
        "(Statement of Basis), not a current requirement. Table 1 under III.B.3 "
        "lists civil-penalty CPI adjustment figures -- quote dollar amounts and "
        "percentages exactly as printed, never round or recompute them."
    ),
    "9": (
        "This row is from Colorado Regulation Number 9 (open burning, prescribed "
        "fire, and permitting). \"The Division\" means the Air Pollution Control "
        "Division; an \"Authorized Local Agency\" is a local agency the Division "
        "has delegated permitting authority to -- a distinct actor, not the "
        "Division itself. Ordinary open burning, planned ignition (prescribed) "
        "fire, and unplanned ignition fire are three separate permit tracks with "
        "their own rules -- never merge or substitute one for another in a "
        "summary. Section VIII's fee provisions are written as prose, not a fee "
        "table -- describe them as such. Section IX rows are rulemaking history "
        "(Statement of Basis), not current requirements. Appendix A and Appendix "
        "B thresholds, and the PM10 example calculations, are specific to named "
        "Colorado fuel types -- quote acreage, tonnage, and emission numbers "
        "exactly as written, never generalize them to other fuels. \"Land "
        "Manager\" and \"Significant User of Prescribed Fire\" are this "
        "regulation's own defined terms -- use only what the text says they mean, "
        "not an everyday reading of the phrase."
    ),
    "24": (
        "This row is from Colorado Regulation Number 24 (volatile organic "
        "compounds and petroleum liquid storage, processing, and refining). "
        "Several Part B provisions apply only inside the ozone nonattainment or "
        "attainment-maintenance areas listed in Appendix A (e.g. northern Weld "
        "County, the 8-hour Ozone Control Area) -- state exactly the area the "
        "text names, and never generalize a scoped provision to statewide. "
        "\"(State Only)\" markers are kept as printed. Quote Reid vapor pressure, "
        "temperatures, torr/psia pressure values, and tank capacities (given in "
        "both liters and gallons) exactly as written, in both units, never "
        "rounded or converted. Table 1's cargo-tank pressure/vacuum values are "
        "plain numbers -- report them as such. Appendices B and C are engineering "
        "criteria (drop-tube specs, vapor-hose sizing), not general-applicability "
        "rules. Part C rows are rulemaking history -- the 2026 reorganization of "
        "former Regulation 7 into Regulations 24/25/26/27 is history, not a "
        "current requirement of Reg 24. A \"40 CFR Part 60\" reference "
        "incorporates that federal standard by name -- name it, don't describe or "
        "invent its contents."
    ),
    "30": (
        "This row is from Colorado Regulation Number 30 (toxic air contaminants). "
        "A toxic air contaminant (TAC) is the general term; a priority toxic air "
        "contaminant (PTAC) is the narrower Commission-designated subset that "
        "Part B controls -- keep the two distinct, never conflate "
        "them. Appendix A lists the PTACs; Appendix B lists health-protective "
        "benchmarks -- state whether the text itself calls a given benchmark "
        "approved or still pending, don't assume either. Quote compliance dates "
        "verbatim, never paraphrased into relative time. Expand HQ, IUR, RfC, "
        "AIRS ID, and HEPA only the way this regulation's own text defines them, "
        "never from general knowledge -- AIRS ID names a specific facility, not a "
        "general identifier. \"The Division\" means the Air Pollution Control "
        "Division. Part B's Section I heading row has no text in the source -- "
        "that is a genuine omission, not a parsing error. Point to a table for "
        "its numeric thresholds rather than restating every cell. Part C rows are "
        "rulemaking history. Mention section 25-7-109.5, C.R.S. only if the text "
        "in front of you actually references it."
    ),
    "11": (
        "This row is from Colorado Regulation Number 11 (the motor vehicle "
        "emissions inspection, or AIR, program). Two different agencies appear: "
        "\"the Division\" is the Air Pollution Control Division of CDPHE "
        "(analyzer approval, technical specifications, program design), while "
        "licensing, enforcement and the field program are run by the "
        "\"Department of Revenue\" / \"Executive Director\" -- keep them "
        "apart and never merge them into one agency. \"Program area\", "
        "\"enhanced\" and \"basic\" program areas, the \"North Front Range "
        "Area\" and the \"Clean Screen Program\" mean only what Part A's "
        "definitions and the cited C.R.S. sections say; never generalize a "
        "provision scoped to one area to the whole state. Emissions limits "
        "(percent CO, ppm HC, grams/mile HC/CO/NOx, opacity, gas-cap decay) "
        "apply by model year and vehicle class exactly as the Part F tables "
        "print them -- point to the table rather than restating it, and never "
        "invent or round a cutpoint, model-year split, or pass/fail threshold. "
        "OBD, MIL, DLC, IM 240, TSI, BAR 90/97, Colorado 94/97, TAS and VIN "
        "expand only as this regulation defines them. Part H rows are "
        "rulemaking history, not current requirements; Appendix A rows are "
        "analyzer technical specifications for manufacturers (say so), and "
        "Appendix B is repealed."
    ),
    "12": (
        "This row is from Colorado Regulation Number 12 (reduction of diesel "
        "vehicle emissions -- a State-Only program, not part of the SIP). It has "
        "two separate programs: Part A, the Diesel Fleet Self-Certification "
        "Program (fleets of nine or more diesel vehicles over 14,000 lb GVWR, "
        "inspected by the fleet's own certified inspectors), and Part B, the "
        "Diesel Opacity Inspection Program (licensed stations inspecting "
        "individual vehicles); never merge their requirements. \"The "
        "Division\" means the Air Pollution Control Division (CDPHE); "
        "\"Department\" in Part B means the Colorado Department of Revenue, which "
        "licenses stations and inspectors. \"Fleet\", \"fleet owner\", \"Excessive "
        "Violation\", \"program area\" and \"Certification of Emissions Control "
        "(CEC)\" mean only what Section I.B. of each part defines. Quote opacity "
        "percentages, averaging times (e.g. \"twenty percent (20%) opacity measured "
        "over five (5) seconds\"), model-year cutoffs (\"1991 and later\", \"model "
        "year 2014 or newer\"), weight thresholds, fees and test-step numbers "
        "exactly as printed -- never invent a cutpoint or convert units. Part C "
        "is the roadside visible-emissions standard. Part D rows are rulemaking "
        "history, not current requirements. SAE J1667 and 40 "
        "C.F.R. Part 85, Subpart V are incorporated by name -- name them, don't "
        "describe their contents. \"Reserved\" is a placeholder, not a gap."
    ),
    "25": (
        "This row is from Colorado Regulation Number 25 (surface coating, "
        "solvents, cutback asphalt, graphic arts and printing, pharmaceutical "
        "synthesis -- VOC RACT). Part A, Section I.A.1. scopes the regulation "
        "to the Denver 1-hour ozone attainment/maintenance area, the 8-hour "
        "Ozone Control Area, northern Weld County and (State Only) any ozone "
        "nonattainment area -- Appendix A lists them; state exactly the area "
        "the text names, never generalize to statewide. \"(State Only)\" is "
        "kept as printed. Quote every VOC limit in the units printed (lb "
        "VOC/gal coating, lb VOC/gal solids, kg VOC/l, g/L, Kg/lc, Lb/gc, "
        "lb/day, tons per year, torr/psia, degrees C and F), never converted, "
        "rounded or restated on another basis -- \"less water and exempt "
        "solvents\" and \"per volume solids\" limits are different numbers. "
        "Point to a table for its cell values instead of restating them. An "
        "EPA Control Techniques Guideline (CTG), EPA method or guidance "
        "document (e.g. EPA-450/3-84/019) is incorporated by name and date -- "
        "name it, never describe its contents. \"The Division\" is the Air "
        "Pollution Control Division (defined in the Common Provisions, not "
        "here); \"Commission\" is the AQCC. Appendices D and E are engineering "
        "data, not applicability rules. Part C rows are rulemaking history, "
        "not current requirements."
    ),
    "27": (
        "This row is from Colorado Regulation Number 27 (GHG emissions and "
        "energy management for manufacturing, GEMM 2). The operative rule "
        "(Part B, Tables 1-5) sets requirements by TIER (percent reduction "
        "since 2015, percent contribution to the group), never by facility "
        "name: never name a facility or state a tonnage for a Part B row. "
        "Facility names, baselines and per-facility targets appear only in "
        "the October 2023 statement of basis entry (Part E, IV) -- quote those "
        "numbers verbatim or not at all. \"GHG credit\", \"GEMM 2 facility\", "
        "\"2015 GHG emissions\", \"EITE stationary source\", \"GHG BAECT\" (not "
        "Reg 3 BACT), \"energy BMP\", \"audit\" and \"auction settlement price\" "
        "mean only what Part A, Section II defines; \"Division\" is the APCD, "
        "\"Commission\" the AQCC. Numbers as printed, never converted: $89/mt "
        "CO2 social cost, the 25,000 metric tons CO2e/yr applicability "
        "threshold, the 5 % EITE reduction, Table 5 tiers, the 50 % CHP credit "
        "cap. Auction, plan, report, certification dates as printed. "
        "Statement-of-basis entries I and II cite pre-2023 Regulation Number "
        "22 numbering -- history, not current sections. Reporting is under "
        "Regulation Number 22, Part A and credit trading under Regulation "
        "Number 7, Part B, Section VII -- name them, do not describe them."
    ),
    # Batch 6 (Sept 20 2026): Reg 16, the SIP Local Elements document, Reg 18.
    "16": (
        "This row is from Colorado Regulation Number 16 (street sanding "
        "emissions, 5 CCR 1001-18), a short part-less regulation. Section I "
        "sets street sanding material specifications and applies to "
        "governmental entities, their contractors and suppliers in the AIR "
        "program area (Section 42-4-307(8) C.R.S.); Section II applies only in "
        "the Denver PM10 attainment/maintenance area -- never generalize "
        "either to the whole state. Quote the standards exactly as printed: "
        "less than 2% fines and less than 45% durability index, OR less than "
        "4% fines, less than 33% durability index and a high degree of "
        "angularity; the 30%, 20%, 72%, 54% and 50% reductions, measured "
        "against uncontrolled 1989 levels, for the named areas (foothills, "
        "CBD, I-25, the Federal/Downing/38th/Louisiana box). \"Percent "
        "Fines\", \"Durability Index\", \"Base Sanding Amount\" and \"Foothills "
        "Area\" mean only what Sections I.B and II.B define. \"Division\" is "
        "the Air Pollution Control Division; RAQC is the Regional Air Quality "
        "Council; CDOT is the Colorado Department of Transportation. The "
        "source print has typos (\"sand ;d during c :h\" means sanded during "
        "each) -- read through them, do not reproduce them. Section III rows "
        "(III.A, III.B) are statements of basis: rulemaking history, not "
        "requirements."
    ),
    "sip": (
        "This row is from the Colorado SIP Local Elements document (State "
        "Implementation Plan, Specific Regulations for Nonattainment-"
        "Attainment/Maintenance Areas (Local Elements), 5 CCR 1001-20). Each "
        "top-level section is ONE area -- I Pagosa Springs, II Telluride, III "
        "Aspen/Pitkin County, IV Lamar, V Canon City, VI Fort Collins "
        "(repealed), VII Colorado Springs, VIII Steamboat Springs -- and "
        "every row applies only in its own area's named highways, streets or "
        "boundaries: always name the area, never write \"statewide\". Quote "
        "the standards as printed (1% fines, 2% fines, 30% durability index, "
        "the 10%/15% sand reductions, 2-year record retention, sweeping "
        "within four days or at least twice) and the effective dates. "
        "Definitions differ by area (\"Percent Fines\" is a #200 sieve here, "
        "\"Division\" is the Colorado Department of Health or CDPHE Air "
        "Pollution Control Division as printed). Named ordinances and "
        "resolutions are local law incorporated by reference with an as-of "
        "date -- name them, do not describe their contents. Rows headed "
        "\"Statement of Basis\" (I.D, II.C, III.D, IV, V, VI.A, VII.A, VIII.F) "
        "are rulemaking history, not requirements; \"Reserved\" and "
        "\"Repealed\" rows have no requirements. \"Commission\" is the AQCC."
    ),
    "18": (
        "This row is from Colorado Regulation Number 18 (control of emissions "
        "of acid deposition precursors, 5 CCR 1001-22). Section I is the whole "
        "operative rule: the Commission incorporates by reference 40 CFR Part "
        "72 and Part 76 (the July 1, 2011 editions) to implement the Title IV "
        "Acid Rain Program -- say exactly that, and do not summarize or invent "
        "the federal rules' contents (permits, allowances, NOx limits, "
        "monitoring). The incorporated edition date is not a compliance date; "
        "later federal amendments are not included. \"Permitting authority\" "
        "means the Colorado Air Pollution Control Division and "
        "\"Administrator\" means the EPA Administrator, as Section I defines "
        "them; where Parts 72/76 conflict with Regulation Number 3 the federal "
        "provisions take precedence. Title IV is a delegated program; these "
        "adoptions are not SIP revisions. Section II rows (II.A-II.G) are "
        "statements of basis -- rulemaking history that describes which "
        "federal amendments each adoption picked up (e.g. May 2005 CEMS "
        "definitions, March 2011 Protocol Gas Verification Program) -- not "
        "current requirements. \"Commission\" is the Air Quality Control "
        "Commission."
    ),
    "19": (
        "This row is from Colorado Regulation Number 19 (The Control of Lead "
        "Hazards, 5 CCR 1001-23): Part A covers lead-based paint activities -- "
        "training-program accreditation, individual and firm certification, "
        "and work practices for inspections, lead-hazard screens, risk "
        "assessments and abatement in target housing and child-occupied "
        "facilities; Part B is pre-renovation education (the lead hazard "
        "pamphlet). \"Division\" is CDPHE's Air Pollution Control Division "
        "(Part A, II.B.28.), \"Commission\" the AQCC; \"Department\" is "
        "not a defined term (Part A, VI. delegates to local departments). Use "
        "target housing, child-occupied facility, abatement "
        "(not renovation), lead-based paint, lead-based paint hazard, LAF/LEF "
        "and the disciplines (inspector, risk assessor, supervisor, worker, "
        "project designer) only as Part A, Section II defines them. Quote "
        "course hours, certification periods (every 3 or 5 years), fees ($180 "
        "per year, $600, $1,500, the notification fee bands), lead levels with "
        "their units (ug/ft2, ug/g, ug/dL) and the Appendix A units-to-test "
        "counts exactly as printed -- never round, convert or interpolate. 40 "
        "CFR Part 745 is EPA's federal program: name it, do not describe it. "
        "Part B, V. prints SAMPLE acknowledgment wording, not mandatory text. "
        "Part C is rulemaking history; its \"PART A.\"/\"PART B.\" headings are "
        "history, and III.B.4. is Reserved (removed 2021)."
    ),
    "20": (
        "This row is from Colorado Regulation Number 20 (Colorado Clean Cars "
        "and Trucks). Its standards are California Code of Regulations, Title "
        "13 sections incorporated by reference in the versions listed in Part "
        "H, Table 1: name the section (e.g. \"13 CCR 1962.4\") and say it is "
        "incorporated; never describe or guess the California text, and never "
        "invent a percentage, credit value or test procedure it contains. In the "
        "incorporated sections \"California\" means Colorado, \"CARB\"/\"Air "
        "Resources Board\" means CDPHE and \"Executive Officer\" means the "
        "Executive Director of CDPHE; \"Department\" is CDPHE (Part A, "
        "Section II). Keep every model-year window (\"2022 through 2025 and "
        "2027 through 2032\"), GVWR threshold (8,500 lbs; 14,001 lbs), "
        "percentage (\"36 percent\", \"23 percent\"), date and deadline exactly "
        "as printed; do not merge Part B (LEV), Part D (ZEV credits and "
        "deficits), Part E (HD Low NOx, 2027 and later), Part F (ACT) or Part G "
        "(one-time Large Entity Reporting) requirements into each other. ZEV, "
        "TZEV, NZEV, PHEV, BEVx, FCEV, NEV, LEV, ACT, LER and APU expand only "
        "as Part A or Part G, Section VI defines them. Part H rows list "
        "incorporated sections with their amendment dates; Part I rows are "
        "rulemaking history, not current requirements."
    ),
    "21": (
        "This row is from Colorado Regulation Number 21 (VOC content limits "
        "for consumer products, Part A, and architectural and industrial "
        "maintenance (AIM) coatings, Part B). Each part applies in the 8-hour "
        "Ozone Control Area and northern Weld County and, \"(State Only)\", "
        "statewide -- say which the row names. Quote every limit in the "
        "units printed: percent VOC by weight for consumer "
        "products (Part A, Table 1: manufactured on or after May 1, 2020, and "
        "the lower limits that apply 60 days after an EPA finding that "
        "Colorado missed the severe ozone deadline), grams per liter for AIM "
        "coatings (Part B, Table 1, manufactured on or after May 1, 2020); "
        "FIFRA-registered products start May 1, 2021. Point to a table for "
        "its values rather than restating them. A product category means only "
        "what the same part's Section VI defines -- Parts A and B define terms "
        "separately; \"LVP-VOC\", \"Table B compound\", \"HVOC\"/\"MVOC\" and "
        "\"ACP\" only as defined here. CARB Method 310, EPA Method 24, "
        "ASTM/SCAQMD/BAAQMD methods and California Title 17 sections are "
        "incorporated by name and date -- name them, never describe them. "
        "\"Division\" is the Air Pollution Control Division, \"Commission\" "
        "the AQCC. Part C rows are rulemaking history, not requirements."
    ),
    # Batch 7: Regulation Number 4 (wood-burning appliances, 5 CCR 1001-6).
    # Applicability lives in ONE place in this document -- Part A, Section I
    # -- and nowhere else, so the hint says so explicitly and forbids
    # restating or inferring it on any other row. (Batch 6's Reg 21 hint
    # asked the model to "state applicability per part"; it read that as
    # licence to prepend a guessed scope tag to ~60% of rows and 186 had to
    # be corrected by hand. The same trap is live here: Part A is state-only
    # for carbon monoxide, Section IV and its children are "(State Only)"
    # masonry-heater provisions, and Sections VII/IX are scoped to the
    # high-pollution-day areas and the listed jurisdictions -- three
    # different scopes that a model would happily average into one.)
    "4": (
        "This row is from Colorado Regulation Number 4 (sale and "
        "installation of wood-burning appliances, 5 CCR 1001-6). Part A, "
        "Section I states the applicability -- as of October 15, 2024 Reg 4 "
        "is implemented on a state-only basis for carbon monoxide. Do not "
        "repeat or infer applicability, scope, geography or an effective "
        "date on any other row: name an area, county or date only when that "
        "row's own text names it. Keep a printed \"(State Only)\" prefix. "
        "\"Commission\" is the Air Quality Control Commission; "
        "\"Division\" is the Air Pollution Control Division. Use Phase III "
        "Certified wood-burning stove, exempt device, approved pellet stove, "
        "approved masonry heater, high pollution day, burn down time and "
        "primary source of heat only as Section I.A defines them. 40 CFR "
        "Part 60 Subpart AAA and Methods 5G, 5H, 28 and 28A are incorporated "
        "by name and date -- name them, never describe what they require. "
        "Quote emission standards and burn-down periods exactly (4.1 grams "
        "per hour; three hours). Give exemptions only as listed. Section IX "
        "is a table of local ordinances; Section X and Part C are rulemaking "
        "history; Appendix A is a laboratory test protocol."
    ),
    # Batch 7: Reg 23 (Regional Haze Limits, 5 CCR 1001-27). Deliberately does
    # NOT tell the model to restate applicability or scope per row: Section I
    # carries the whole applicability statement (BART-eligible sources plus RP
    # sources) AND the SIP-vs-State-Only split, and the Reg 21 experience in
    # Batch 6 showed that "state applicability per part" gets read as licence
    # to prepend a guessed scope tag to every row. Reg 23's own per-unit rows
    # name their source; nothing else should be added.
    "23": (
        "This row is from Colorado Regulation Number 23 (Regional Haze "
        "Limits). Section I states applicability and which sections are "
        "incorporated into Colorado's Regional Haze State Implementation Plan "
        "rather than being State-Only; do not repeat or infer applicability, "
        "scope, geography, the SIP/State-Only split or an effective date on "
        "any other row. Section II defines BART, Reasonable Progress (RP), "
        "BART Alternative, Existing Stationary Facility and deciview -- use "
        "them only as defined there. Section IV sets "
        "limits for named units in tables: quote the unit, the number, its "
        "units (lb/MMBtu, tons per year, ppmvd, lb/ton of clinker, "
        "grains/dscf), the averaging period and the closure or compliance date "
        "exactly as printed, and never carry one unit's limit, date or "
        "shutdown across to another unit or to sources in general; an empty "
        "table cell means no printed limit, and *, ** and + are footnote "
        "markers explained in the same row. 40 CFR Parts 51, 60, 63, 64 and 75 "
        "and the EPA test methods are incorporated by reference -- name them, "
        "never describe them. \"Commission\" is the Air Quality Control "
        "Commission, \"Division\" the Air Pollution Control Division, \"PUC\" "
        "the Colorado Public Utilities Commission. Part B rows are rulemaking "
        "history, not current requirements."
    ),
    # Batch 7. Written against the Batch 6 Reg 21 lesson (START_HERE.md):
    # the hint must never invite the model to restate applicability, scope or
    # coverage on a row that does not state it -- Reg 28's applicability
    # lives in Part A, Section II and its definitions in Part A, Section III,
    # and nowhere else.
    "28": (
        "This row is from Colorado Regulation Number 28 (building "
        "benchmarking and performance standards, 5 CCR 1001-32). \"CEO\" is "
        "the Colorado Energy Office (Part A, Section III.N.), never a chief "
        "executive officer; \"Division\" is the Air Pollution Control "
        "Division and \"Commission\" the AQCC. Part A, Section II states "
        "applicability and Part A, Section III defines every term: do not "
        "repeat or infer applicability, coverage, an exemption or a "
        "definition on any other row -- describe only what the row in front "
        "of you says. \"Covered building\", \"public building\", "
        "\"under-resourced building\", \"building owner\", \"gross floor "
        "area\", \"benchmarking tool\", \"site EUI\" and "
        "\"weather-normalized\" mean only what Section III says. Quote every "
        "square-footage threshold, fee, civil-penalty amount, percentage, "
        "deadline and calendar year exactly as printed; never round or "
        "convert. Part C, Table 1 sets site EUI and greenhouse gas intensity "
        "targets by property type -- point to the table rather than restating "
        "a value, and never apply one property type's target to another. "
        "ENERGY STAR Portfolio Manager and its Building Emissions Calculator "
        "are named tools: name them, do not describe them. Part F rows are "
        "rulemaking history, not current requirements."
    ),
    # Batch 7: Regulation Number 31 (Control of Methane Emissions from
    # Municipal Solid Waste Landfills, 5 CCR 1001-35). Deliberately says
    # NOTHING that invites the model to restate applicability, scope or an
    # effective date on rows that do not state them -- the Batch 6 Reg 21
    # lesson (an audience hint that said "state applicability per part"
    # produced ~186 hand-corrected rows). Reg 31's applicability lives in
    # exactly two places (Part A, Sections II and III) and stays there.
    "31": (
        "This row is from Colorado Regulation Number 31 (methane from "
        "municipal solid waste landfills). Part A, Section II states "
        "applicability and Section III the exemptions; do not repeat or infer "
        "applicability, scope or a date on any other row; if a row does not "
        "say whom or where it covers, say nothing about that. Terms mean only "
        "what Part A, Section IV defines: active, inactive, closed and "
        "controlled MSW landfill; GCCS; gas collection and gas control "
        "device; component leak; intermediate and final cover; waste-in-place; "
        "ppmv and ppm-m (never convert one into the other). Quote every "
        "threshold, reading, spacing and deadline exactly as printed (450,000 "
        "short tons, 500 ppm, 200 ppmv, 25-foot and 100-foot spacing, "
        "quarterly); never carry one landfill's or well's figure onto "
        "another. Duties belong to whoever the text names, usually \"the owner "
        "or operator\". \"Commission\" is the AQCC and \"Division\" the APCD; "
        "the Hazardous Materials and Waste Management Division is another "
        "agency. 40 CFR Part 60 Subparts Cf and XXX, 40 CFR Part 63 Subpart "
        "AAAA, 40 CFR Part 98 and EPA Methods 3A, 3C, 18, 21 and 25C are "
        "incorporated by name and date: name them, never describe them. Part "
        "K is rulemaking history, not requirements."
    ),
    "3": _COLORADO_AREA_SCOPE_HINT,
    "7": _COLORADO_AREA_SCOPE_HINT,
    "22": _COLORADO_AREA_SCOPE_HINT,
    "26": _COLORADO_AREA_SCOPE_HINT,
    "ecmc": (
        "This row is from the Colorado ECMC rules (2 CCR 404-1). \"Commission\" "
        "means the Energy and Carbon Management Commission (ECMC, formerly "
        "COGCC), never the AQCC; there is no APCD \"Division\". Attribute "
        "approvals, notices and decisions to whoever the text names -- "
        "usually the Director or LGD (Local Governmental Designee) -- and if "
        "it names nobody, say so instead of writing \"the Commission\". "
        "\"Relevant Local Government\" and \"Proximate Local Government\" are "
        "distinct defined terms. Use Disproportionately Impacted Community, "
        "Cumulative Impacts, Working Pad Surface, Oil and Gas Location and "
        "High Priority Habitat only as defined; \"operations regulated by the "
        "Commission\" includes geothermal and geologic storage, not only oil "
        "and gas. A \"Form N\" is an ECMC form -- name it, don't describe its "
        "contents. Quote setback distances and deadlines exactly. Never "
        "expand an abbreviation the text does not (OFV is Order Finding "
        "Violation, AOC is Administrative Order by Consent, FV is Fired "
        "Vessel). 1300 Series and 1400 Series rules incorporate 200-1200 "
        "Series rules by cross-reference -- say so. 100 Series rows are "
        "definitions. Table 423-1 and 423-2 are plain text. The History tail "
        "ending Appendix IX is a changelog, not Form 41."
    ),
    # Batch 6: Air Quality Standards, Designations and Emission Budgets
    # (5 CCR 1001-14, key "aqs") -- a part-less AQCC document, not a
    # numbered regulation.
    # -- Batch 7 ---------------------------------------------------------
    # Reg 10 (Criteria for Analysis of Transportation Conformity, 5 CCR
    # 1001-12). Deliberately says NOTHING about restating scope: Reg 10 is
    # a part-less document whose Section I is the only place the
    # regulation's reach is stated, and the Batch 6 Reg 21 post-mortem
    # (186 hand-corrected rows) showed that telling the model to "state
    # applicability" makes it guess a scope tag onto rows that carry none.
    "10": (
        "This row is from Colorado Regulation Number 10 (criteria for "
        "analysis of transportation conformity). Section I is the only "
        "section that states which federal provisions this rule addresses "
        "and what it requires compliance with -- do not repeat or infer "
        "that on any other row, and never add a nonattainment or "
        "maintenance area, a county or an effective date a row does not "
        "itself name. 40 CFR Part 93 Subpart A (and Sections 93.105, "
        "93.122(a)(4)(ii), 93.125(c), 51.390) is adopted by reference: name "
        "the citation, never describe what the federal rule requires. When "
        "a row cites another section, say it cites it. Section II's defined "
        "terms -- CDOT, Commission (the Air Quality Control Commission), "
        "Division (the Air Pollution Control Division), Lead Planning "
        "Agency (LPA), metropolitan planning organization (MPO), "
        "Transportation Planning Region (TPR), Hot Spot Analysis, Regional "
        "Transportation Conformity, routine conformity determination -- "
        "mean only what Section II says. Section III assigns duties agency "
        "by agency; never move one agency's duty to another. Keep TCM, TIP, "
        "SIP, FHWA, FTA and EPA as written. Section VI rows are rulemaking "
        "history, not current requirements; ignore the trailing Editor's "
        "Notes revision history on the last of them."
    ),
    # Reg 15 (Control of Emissions of Ozone-Depleting Compounds, 5 CCR
    # 1001-19). Same discipline: this regulation states no geographic scope
    # anywhere, so the hint forbids inventing one rather than asking for
    # applicability to be restated.
    "15": (
        "This row is from Colorado Regulation Number 15 (control of "
        "emissions of ozone-depleting compounds). Nothing in this "
        "regulation states a geographic scope, an area or an effective "
        "date on a per-provision basis -- never write \"statewide\", name "
        "an area or county, or add a date a row does not itself print. "
        "Section I defines Air Conditioning and Refrigeration Service "
        "Facility, Facility, Product Refrigeration System, Refrigerated "
        "Food Appliance, Refrigerated Food Facility, Site and Stationary "
        "Appliance; use those terms only as Section I defines them (a "
        "stationary appliance is 100 horsepower or greater and is NOT a "
        "refrigerated food appliance). 40 CFR Part 82 Subparts B and F, 42 "
        "USC 7671g and 62 Fed. Reg. 68026 are incorporated by reference as "
        "of the edition dates printed -- name them, never describe their "
        "contents. Quote every fee, cap, pound threshold and filing window "
        "exactly as printed. \"Division\" is the Air Pollution Control "
        "Division; \"Commission\" is the Air Quality Control Commission. "
        "Section VI rows are rulemaking history, not requirements; ignore "
        "the trailing Editor's Notes revision history on the last of them."
    ),
    # Reg 29 (Emission Reduction Requirements for Lawn and Garden
    # Equipment, 5 CCR 1001-33). Section I states applicability and the
    # exemptions; the hint says so explicitly and forbids repeating it
    # elsewhere -- the START_HERE lesson from Reg 21.
    "29": (
        "This row is from Colorado Regulation Number 29 (emission reduction "
        "requirements for lawn and garden equipment). Part A Section I "
        "states applicability and the Section I.B exemptions; do not repeat "
        "or infer applicability, scope or an exemption on any other row, "
        "and never add \"statewide\", the ozone nonattainment area, a "
        "county or a date a row does not itself print. Section II defines "
        "federal government, landscaping, lawn and garden equipment, lawn "
        "and garden services, local government, municipality, ozone "
        "nonattainment area, special district and state government agency "
        "-- use them only as defined. Section III's two restrictions are "
        "NOT interchangeable: III.A covers state government agencies and "
        "engines smaller than 19 kW (25 horsepower); III.B covers the "
        "federal government and local governments and engines smaller than "
        "7 kW (10 horsepower) in the ozone nonattainment area. Quote every "
        "kW/horsepower figure, June 1 - August 31 window and reporting date "
        "exactly. Part B is rulemaking history, not requirements; ignore the "
        "trailing Editor's Notes revision history at its end."
    ),
    "aqs": (
        "This row is from Colorado's Air Quality Standards, Designations and "
        "Emission Budgets document (5 CCR 1001-14) -- not a numbered "
        "regulation. \"Commission\" means the Air Quality Control Commission "
        "(AQCC); \"Division\" means the Air Pollution Control Division. "
        "Section I.A only points to the federal NAAQS in 40 CFR Part 50; the "
        "Section I.B SO2 standard, the Section IV visibility standard and the "
        "Section VI Eisenhower Tunnel carbon monoxide standard are State Only "
        "-- say so, and quote every level, averaging time and unit exactly as "
        "printed (700 micrograms per cubic meter, three-hour maximum; "
        ".076/km, four hours; 100 parts per million, 15 minute average), "
        "never converted. Section III lists designated areas: give each "
        "area's classification, effective date and boundary only as printed, "
        "name no county or date the row omits; a map row is a heading whose "
        "map is not reproduced. Section V budgets: quote tons/day, tons per "
        "summer day (tpsd) and lbs./day figures and their years verbatim, and "
        "name a budget's NAAQS or SIP only when the row does; \"Repealed\" and "
        "\"Reserved\" rows have no content. Bracketed [1]-[5] are footnote "
        "markers. Section VII is rationale and Section VIII rulemaking "
        "history -- not current requirements."
    ),
}

# Batch 7: the AQCC Procedural Rules (5 CCR 1001-1, key "proc") -- the
# Commission's own procedure, not a pollution-control rule.
#
# The Batch 6 Reg 21 lesson applies here with force: this document prints
# TWO complete alternative procedures (Part A for proceedings before August
# 1, 2025 and for petitions/hearing requests filed before that date, Part B
# for everything on or after it) whose section numbering is nearly
# identical. An instruction to "state which part applies" would invite the
# model to stamp a guessed date window onto hundreds of rows that say
# nothing about one. The hint therefore says the opposite, explicitly: the
# cutover is stated on the two PART rows and nowhere else, so no other row
# may repeat it or name a part.
REG_PROMPT_HINTS["proc"] = (
    "This row is from the Colorado AQCC Procedural Rules (5 CCR 1001-1) -- "
    "the Commission's own procedure for meetings, rulemakings, adjudications "
    "and permit comment hearings, not a pollution-control rule. "
    "\"Commission\" is the Air Quality Control Commission (AQCC); "
    "\"Division\" is the Air Pollution Control Division (APCD). Use "
    "\"Party\", \"Proponent\", \"Redline(s)\", \"Alternate Proposal\", "
    "\"Interested Person\" and \"Good Cause\" only as Section III of this "
    "same part defines them; Parts A and B word several differently. \"Hearing Officer\" is never defined here -- "
    "describe it only as the row does. Name \u00a7 24-4-101 et seq., C.R.S. "
    "(the State Administrative Procedure Act) and \u00a7 25-7-101 et seq., "
    "C.R.S. (the Act); never describe what they require. Quote every "
    "deadline, day count (days or working days, as printed), page limit, "
    "copy count and time allotment exactly as printed. The August 1, 2025 "
    "split between Part A and Part B is stated on the two PART rows and "
    "nowhere else: never repeat it, name a part, or add a date window on any "
    "other row. A cross-reference may point to a section this document no "
    "longer prints: say the row cites it, do not describe the target. "
    "Section XII rows are rulemaking history, not current requirements."
)


# APCD general permits GP01-GP12 all share one hint (Division-issued permit
# terms, not regulation text). Registered under all eleven keys so
# REG_PROMPT_HINTS[key] and system_prompt_for() work unchanged for each --
# this is a no-op for every other reg.
_GP_HINT = (
    "This row is from an APCD-issued Colorado general permit (GP01-GP12) for "
    "oil & gas sources -- permit terms, not regulation text. Say \"the "
    "permit requires\" or \"permit condition\", never \"the regulation "
    "requires\". \"Division\" = Air Pollution Control Division (APCD); "
    "\"Commission\" = Air Quality Control Commission (AQCC); \"the owner "
    "or operator\" is the registrant. Quote emission limits (tpy, g/hp-hr, "
    "ppmvd), record-retention periods and deadlines exactly as written; "
    "never add a retention period, notice period or deadline this row's own "
    "text does not state, even if another condition sets one. \"Condition "
    "X\" cross-references this same permit; when the row only cites a "
    "regulation or condition, say it cites it -- do not describe what the "
    "cited provision requires. Use AOS (Alternative Operating Scenario), NOS "
    "(Notice of Startup), RICE, PSD/NANSR and Disproportionately Impacted "
    "(DI) Communities only as this permit defines them. GP09 covers "
    "attainment areas, GP10 nonattainment areas; both closed to new "
    "registrations July 15, 2026 and GP12 replaces them -- state that only "
    "when the text says so. For an emission-limit table row, point to the "
    "table and its numbers rather than restating every cell. Add no rationale "
    "or examples."
)
for _gp_key in (
    "gp01", "gp02", "gp03", "gp05", "gp06", "gp07",
    "gp08", "gp09", "gp10", "gp11", "gp12",
):
    REG_PROMPT_HINTS[_gp_key] = _GP_HINT

REG_PROMPT_HINTS["jjjj"] = (
    "This row is from 40 CFR Part 60, Subpart JJJJ (spark ignition "
    "stationary internal combustion engines). \"Administrator\" means the "
    "EPA Administrator, not a state official; \"you\" means the owner or "
    "operator, second person throughout. JJJJ covers spark-ignition (SI) "
    "engines only -- never describe it as covering compression-ignition "
    "engines (Subpart IIII) or conflate it with ZZZZ's NESHAP requirements. "
    "Emergency and non-emergency engines are regulated separately, often in "
    "adjacent similarly-titled sections -- do not merge their requirements. "
    "Model-year, horsepower/kW, and displacement thresholds and the "
    "g/hp-hr, ppmvd, and other numeric limits live in the Tables (1-4) -- "
    "quote them verbatim and point to the table rather than restating every "
    "cell. RICE, 2SLB/4SLB/4SRB, NSCR, and oxidation catalyst are defined "
    "terms of art -- expand on first use, don't reword afterward. Engines "
    "certify to named EPA certification parts (e.g. 40 CFR Part 1048, "
    "1054, 1060, 1065, 1068) -- name the part, don't describe its "
    "contents. \"This subpart\" means Subpart JJJJ itself, never Part 60's "
    "General Provisions (Subpart A). Say nothing about Colorado or any "
    "state agency unless the text itself mentions it."
)

REG_PROMPT_HINTS["iiii"] = (
    "This row is from 40 CFR Part 60, Subpart IIII (compression ignition "
    "stationary internal combustion engines). \"Administrator\" means the "
    "EPA Administrator, not a state official; \"you\" means the owner or "
    "operator, second person throughout. IIII covers compression-ignition "
    "(CI) engines only -- never describe it as covering spark-ignition "
    "engines (Subpart JJJJ) or conflate it with ZZZZ's NESHAP "
    "requirements. Emergency and non-emergency engines are regulated "
    "separately, often in adjacent similarly-titled sections (e.g. section "
    "60.4201 non-emergency vs. 60.4202 emergency) -- do not merge their "
    "requirements. Model-year, horsepower/kW, and displacement thresholds "
    "and the g/hp-hr and other numeric limits live in the Tables (1-8) -- "
    "quote them verbatim and point to the table rather than restating every "
    "cell. RICE is a defined term of art -- expand on first use, don't "
    "reword afterward. Engines certify to named EPA certification parts "
    "(e.g. 40 CFR Part 1039, 1042, 1068) -- name the part, don't describe "
    "its contents. \"This subpart\" means Subpart IIII itself, never Part "
    "60's General Provisions (Subpart A). Say nothing about Colorado or "
    "any state agency unless the text itself mentions it."
)

REG_PROMPT_HINTS["zzzz"] = (
    "This row is from 40 CFR Part 63, Subpart ZZZZ (NESHAP, stationary "
    "reciprocating internal combustion engines). \"Administrator\" means "
    "the EPA Administrator, not a state official; \"you\" means the owner "
    "or operator, second person throughout. ZZZZ covers both "
    "spark-ignition (SI, Subpart JJJJ) and compression-ignition (CI, "
    "Subpart IIII) engines -- never conflate ZZZZ with JJJJ's or IIII's "
    "standards, and keep SI and CI distinct within ZZZZ. Emergency and "
    "non-emergency engines are regulated separately. Area vs. major source "
    "of HAP is load-bearing (Tables 2c vs. 2d) -- name the source type "
    "only when the text specifies one. RICE, HAP, 2SLB/4SLB/4SRB, NSCR, "
    "and oxidation catalyst are terms of art -- expand on first use only. "
    "ZZZZ allows CO as a surrogate for formaldehyde in some tables -- say "
    "so only when the text states it; otherwise treat them as independent. "
    "Numeric limits live in Tables 1a-8 -- quote verbatim, point to the "
    "table. Engines certify to named EPA parts (40 CFR Part 1039, 1042, "
    "1048, 1054, 1060, 1065, 1068) -- name, don't describe. \"This "
    "subpart\" means ZZZZ, never Part 63's General Provisions. Say nothing "
    "about Colorado unless the text says so."
)

REG_PROMPT_HINTS["p191"] = (
    "This row is from 49 CFR Part 191 (PHMSA, US DOT) -- Transportation of "
    "Natural and Other Gas by Pipeline; Annual, Incident, and Other "
    "Reporting. \"Administrator\" means the PHMSA Administrator (or a "
    "delegate) -- NEVER EPA and never \"the Division\" or any Colorado "
    "agency. \"Operator\" means the pipeline operator (a "
    "person who transports gas), not an equipment or well-site operator. "
    "\"This part\" means Part 191 itself, never 40 CFR anything. Gathering "
    "(Type A/B/C/R), transmission, and distribution lines are legally "
    "distinct categories with different reporting duties -- never "
    "generalize a requirement written for one to another. Expand an "
    "acronym only as this text itself defines it. Incorporated standards "
    "are named, never described. A \"[Reserved]\" row should summarize as "
    "\"[Reserved] -- no requirements,\" nothing more. A definition row "
    "states what a term means, not an obligation. This is a federal "
    "minimum standard -- say nothing about Colorado, CDPHE, AQCC, or ECMC "
    "unless the text itself does. An effective date printed in the text "
    "(e.g. \"Effective October 1, 2026\") is a real requirement and must "
    "survive into the summary; a bracketed \"[Amdt. ...]\" citation is not."
)

REG_PROMPT_HINTS["p192"] = (
    "This row is from 49 CFR Part 192 (PHMSA, US DOT) -- gas pipeline "
    "safety standards. \"Administrator\" means the PHMSA Administrator -- "
    "NEVER EPA, never a Colorado agency. \"Operator\" is the pipeline "
    "operator. \"This part\" means Part 192, never 40 CFR. Gathering (Type "
    "A/B/C/R), transmission, and distribution are legally distinct -- never "
    "generalize across them. Class locations 1-4 are population-density "
    "design classes, not hazard classes. Expand MAOP, SMYS, HCA, MCA, IM, "
    "DIMP, OQ, ILI, ECDA, GWUT, PIR, or UNGSF only as the text defines "
    "them. RMV means rupture-mitigation valve, RCV remote-control valve, "
    "ASV automatic shutoff valve -- expand only as the text does; name "
    "repair-schedule categories (immediate, one-year, two-year, monitored) "
    "only as the section names them. Incorporated standards (API, ASME, "
    "NACE/AMPP, PPI, ASTM) are named, never described. Describe a table by "
    "its purpose; a figure-omitted row has no formula. \"[Reserved]\" "
    "summarizes as \"[Reserved] -- no requirements.\" A definition row is "
    "scoped to its own section -- \"high\" vs. \"moderate\" consequence area "
    "must not be conflated. Say nothing about Colorado, CDPHE, AQCC, or "
    "ECMC unless the text does. An effective date is a real requirement."
)


REG_PROMPT_HINTS["p195"] = (
    "This row is from 49 CFR Part 195 (PHMSA, US DOT) -- Transportation of "
    "Hazardous Liquids by Pipeline: hazardous liquid and carbon dioxide "
    "pipelines, not gas. \"Administrator\" means the PHMSA Administrator (or "
    "the Associate Administrator for Pipeline Safety) -- NEVER EPA, never a "
    "Colorado agency. \"Operator\" is the pipeline operator. \"This part\" "
    "means Part 195. Highly volatile liquid (HVL), rural gathering line, "
    "low-stress line and breakout tank are distinct defined categories -- "
    "never generalize across them. Integrity management is Sec. 195.452 and "
    "high consequence area is defined by Sec. 195.450; cite them only where "
    "the text does; never conflate HCA with an unusually sensitive area. "
    "Expand HVL, HCA, IM, MOP, ILI or EFRD only as the text defines them. "
    "RMV means rupture-mitigation valve, RCV remote-control valve, ASV "
    "automatic shutoff valve -- expand only as the text does; name "
    "repair-schedule categories (immediate, one-year, two-year, monitored) "
    "only as the section names them. Incorporated standards (API 653, API "
    "650, ASME, NACE/AMPP) are named, never described. \"[Reserved]\" "
    "summarizes as \"[Reserved] -- no requirements.\" Say nothing about "
    "Colorado, CDPHE, AQCC, or ECMC unless the text does."
)

REG_PROMPT_HINTS["p199"] = (
    "This row is from 49 CFR Part 199 (PHMSA, US DOT) -- Drug and Alcohol "
    "Testing for pipeline operators. \"Administrator\" means the PHMSA "
    "Administrator -- NEVER EPA and never a Colorado agency. \"Operator\" "
    "is the pipeline operator. \"This part\" means Part 199. The people "
    "covered are \"covered employees\" performing a \"covered function\" "
    "as this part defines those terms -- never widen it to all employees. "
    "The testing procedures themselves are in 49 CFR Part 40, which is NOT "
    "in this corpus: name Part 40 when the text does and never describe "
    "what it requires. MRO (medical review officer), SAP (substance abuse "
    "professional), DER and EBT mean only what this part or Part 40 is said "
    "to define them as. State a random testing rate, a testing category "
    "(pre-employment, post-accident, random, reasonable cause, return-to-"
    "duty, follow-up), or a retention period ONLY as the text states it -- "
    "never a remembered figure. \"[Reserved]\" summarizes as "
    "\"[Reserved] -- no requirements,\" nothing more. Say nothing about "
    "Colorado, CDPHE, AQCC, or ECMC unless the text does."
)

REG_PROMPT_HINTS["p194"] = (
    "This row is from 49 CFR Part 194 (PHMSA, US DOT) -- Response Plans for "
    "Onshore Oil Pipelines, PHMSA's rule under the Oil Pollution Act of "
    "1990 (OPA 90). \"Administrator\" means the PHMSA Administrator (or "
    "the Associate Administrator for Pipeline Safety) -- NEVER EPA and "
    "never a Colorado agency. \"Operator\" is the pipeline operator. "
    "\"This part\" means Part 194. \"Worst case discharge\", \"response "
    "zone\", \"qualified individual\", \"line section\", \"high volume "
    "area\" and \"significant and substantial harm\" are defined terms -- "
    "use them only as Sec. 194.5 and the section in front of you define "
    "them, and never swap one for another. A response plan and a response "
    "zone appendix are different documents. Appendix A is a recommended "
    "format and Appendix B lists high volume areas -- both are guidance, so "
    "never state either as a requirement unless the text does. Response "
    "resource standards named in the text (NFPA 30, API RP 2350, 33 CFR "
    "154) are named, never described. Say nothing about Colorado, CDPHE, "
    "AQCC, or ECMC unless the text does."
)


# --------------------------------------------------------------------------
# Batch C: 49 CFR Parts 190 / 193 / 196 (PHMSA)
# --------------------------------------------------------------------------

REG_PROMPT_HINTS["p190"] = (
    "This row is from 49 CFR Part 190 (PHMSA, US DOT) -- Pipeline Safety "
    "Enforcement and Regulatory Procedures: how PHMSA inspects, enforces, "
    "holds hearings, and makes rules. It sets no pipeline design or "
    "operating standard itself. \"Administrator\" means the PHMSA "
    "Administrator and \"Associate Administrator\" the Associate "
    "Administrator for Pipeline Safety -- NEVER EPA, never \"the Division\" "
    "or any Colorado agency. \"Respondent\" is the person a proceeding is "
    "brought against; \"operator\" is the pipeline operator. \"This part\" "
    "means Part 190. Notice of probable violation, notice of amendment, "
    "compliance order, corrective action order, safety order, emergency "
    "order, consent order and final order are distinct instruments -- name "
    "the one the text names, never substitute another. State a "
    "civil-penalty amount, day count, or deadline ONLY as this row prints "
    "it, with any date the text attaches -- never a remembered or "
    "inflation-adjusted maximum, never a figure from another section. A "
    "hearing is the informal Sec. 190.211 hearing unless the text says "
    "\"formal\". \"[Reserved]\" summarizes as \"[Reserved] -- no requirements.\" "
    "Say nothing about Colorado, CDPHE, AQCC, or ECMC unless the text does."
)

REG_PROMPT_HINTS["p193"] = (
    "This row is from 49 CFR Part 193 (PHMSA, US DOT) -- Liquefied Natural "
    "Gas Facilities: Federal Safety Standards. It covers LNG facilities "
    "(siting, design, construction, equipment, operations, maintenance, "
    "personnel, fire protection, security), not gas pipelines generally. "
    "\"Administrator\" means the PHMSA Administrator -- NEVER EPA, never a "
    "Colorado agency. \"Operator\" is the LNG facility operator. \"This "
    "part\" means Part 193. \"LNG\", \"LNG facility\", \"LNG plant\", "
    "\"impoundment\" / \"impounding system\", \"vaporizer\" (ambient vs. "
    "heated), \"container\", \"design spill\", \"exclusion zone\", "
    "\"thermal radiation\" and \"vapor-gas dispersion\" are defined or "
    "siting terms -- use them only as Sec. 193.2007 and the section in front "
    "of you define them, never as general engineering words. NFPA 59A (and "
    "its edition), API Std 620, ASME BPVC, ASCE/SEI 7 and the GTI models are "
    "incorporated by reference: name them exactly, never describe or "
    "paraphrase what they require. A dimension, distance, time or pressure "
    "is stated ONLY as the text prints it. Subpart J is plant security, not "
    "cybersecurity. \"[Reserved]\" summarizes as \"[Reserved] -- no "
    "requirements.\" Say nothing about Colorado, CDPHE, AQCC, or ECMC unless "
    "the text does."
)

REG_PROMPT_HINTS["p196"] = (
    "This row is from 49 CFR Part 196 (PHMSA, US DOT) -- Protection of "
    "Underground Pipelines From Excavation Activity, the federal "
    "excavation-damage-prevention rule. Its duties fall on the \"excavator\" "
    "(the person doing the digging), not the pipeline operator, except "
    "where the text names \"pipeline operator\" -- keep the two apart. "
    "\"Administrator\" means the PHMSA Administrator -- NEVER EPA, never a "
    "Colorado agency or the Colorado 811 program. \"One-call\" means the "
    "notification system Sec. 196.3 defines; \"excavation damage\" and "
    "\"excavation\" mean only what that section says. \"This part\" means Part "
    "196. Subpart C is PHMSA's administrative enforcement process, which "
    "runs through 49 CFR Part 190 (a separate document in this corpus) -- "
    "name Part 190 when the text does and never describe its procedures "
    "beyond what this row prints. A civil-penalty amount or statutory "
    "citation (49 U.S.C. 60114, 60122) is stated ONLY as the text prints "
    "it, never a remembered maximum. A question-style section (\"What must "
    "an excavator do ...?\") is answered by its own text. \"[Reserved]\" "
    "summarizes as \"[Reserved] -- no requirements.\" Say nothing about "
    "Colorado, CDPHE, AQCC, or ECMC unless the text does."
)


# --------------------------------------------------------------------------
# Text helpers
# --------------------------------------------------------------------------

def strip_html(html: str) -> str:
    """Tag-stripped plain text, mirroring src/lib/regulation.ts's stripHtml
    (minus the truncation -- callers here need the full text to count and
    cap words themselves)."""
    text = TAG_RE.sub(" ", html or "")
    text = NBSP_RE.sub(" ", text)
    text = WS_RE.sub(" ", text).strip()
    return text


def kind_of(provision_id: str) -> str:
    """Mirrors kindOf() in src/lib/regulation.ts -- provision "kind" is
    encoded in the id, there is no separate column."""
    if "-top-REG-" in provision_id:
        return "reg"
    if "-PART-" in provision_id:
        return "part"
    if "-APPENDIX-" in provision_id:
        return "appendix"
    return "item"


def reg_key_of(provision_id: str) -> Optional[str]:
    """Mirrors regKeyOf() in src/lib/changelog.ts -- the regulation key is
    the segment after the "sec-" prefix (e.g. "7" for "sec-7-B-I-C",
    "oooob" for "sec-oooob-5390"). None if the id isn't in that shape."""
    m = re.match(r"^sec-([^-]+)-", provision_id or "")
    return m.group(1).lower() if m else None


def system_prompt_for(provision_id: str) -> str:
    """SYSTEM_PROMPT_TEMPLATE rendered for this row's audience
    (REG_AUDIENCE.get(key, DEFAULT_AUDIENCE)) plus this row's regulation hint
    (REG_PROMPT_HINTS), when one exists. No reg currently overrides
    REG_AUDIENCE, so this renders byte-identically to SYSTEM_PROMPT for every
    existing reg; it's the hook for a future non-oil-and-gas regulation."""
    key = reg_key_of(provision_id) or ""
    base = SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE.get(key, DEFAULT_AUDIENCE))
    if key in _REG_49_CFR_KEYS:
        base = base.replace(_EPA_ADMINISTRATOR_SENTENCE, "")
    hint = REG_PROMPT_HINTS.get(key)
    return f"{base}\n\n{hint}" if hint else base


# --------------------------------------------------------------------------
# Supabase access
# --------------------------------------------------------------------------

def make_supabase_client():
    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def fetch_meta(client, reg: Optional[str]) -> dict[str, dict]:
    """Fetches id/parent_id/citation/title/full_text for every provision in
    scope, to build the regulation-root + parent-chain context for prompts.
    Scoped to one regulation's id prefix when --reg is given; otherwise the
    whole table, paginated past PostgREST's row cap.

    full_text is included so build_prompt can show the immediate parent
    paragraph's opening words -- a sub-paragraph like "(1) ..." often only
    makes sense against its parent's scoping clause, and without it the
    model tends to reach further up to the section heading and pull in
    equipment or dates that don't apply."""
    meta: dict[str, dict] = {}
    like_prefix = f"sec-{reg.lower()}-" if reg else None
    start = 0
    while True:
        q = client.table("provisions").select("id, parent_id, citation, title, full_text")
        if like_prefix:
            q = q.like("id", f"{like_prefix}%")
        q = q.order("sort_order").range(start, start + META_PAGE_SIZE - 1)
        rows = q.execute().data or []
        for row in rows:
            meta[row["id"]] = row
        if len(rows) < META_PAGE_SIZE:
            break
        start += META_PAGE_SIZE
    return meta


def load_ids_file(path: str) -> list[str]:
    """Reads a --ids-file: one provision id per line, blank lines and lines
    starting with '#' ignored. Order is preserved (deduplicated, first
    occurrence wins) -- this is what pipeline/import_ccr.py apply's
    summary_regen_ids.txt looks like. Feeds the exact same iter_candidates
    ids= code path as --ids."""
    ids: list[str] = []
    seen: set[str] = set()
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if s not in seen:
            seen.add(s)
            ids.append(s)
    return ids


def iter_candidates(client, reg: Optional[str], force: bool, limit: Optional[int],
                     ids: Optional[list[str]] = None):
    """Yields full candidate rows (id, citation, title, parent_id, full_text,
    sort_order), ordered by sort_order, paginated DB_PAGE_SIZE at a time,
    stopping once --limit rows have been yielded.

    When `ids` is given, this targets exactly those provision ids (e.g. a
    specific list of rows flagged by a review pass) -- ignores --reg and the
    "ai_summary IS NULL" gate entirely, since asking for a row by id is
    itself the intent to regenerate it regardless of --force."""
    if ids:
        rows_by_id: dict[str, dict] = {}
        for chunk_start in range(0, len(ids), DB_PAGE_SIZE):
            chunk = ids[chunk_start:chunk_start + DB_PAGE_SIZE]
            q = (client.table("provisions")
                 .select("id, citation, title, parent_id, full_text, sort_order")
                 .in_("id", chunk))
            for row in q.execute().data or []:
                rows_by_id[row["id"]] = row
        missing = [i for i in ids if i not in rows_by_id]
        if missing:
            print(f"  WARNING: {len(missing)} id(s) from --ids not found in the "
                  f"database: {', '.join(missing)}", file=sys.stderr)
        yielded = 0
        for provision_id in ids:
            row = rows_by_id.get(provision_id)
            if row is None:
                continue
            yield row
            yielded += 1
            if limit is not None and yielded >= limit:
                return
        return

    like_prefix = f"sec-{reg.lower()}-" if reg else None
    start = 0
    yielded = 0
    columns = "id, citation, title, parent_id, full_text, sort_order"
    while True:
        q = client.table("provisions").select(columns)
        if like_prefix:
            q = q.like("id", f"{like_prefix}%")
        if not force:
            q = q.is_("ai_summary", "null")
        q = q.order("sort_order").range(start, start + DB_PAGE_SIZE - 1)
        rows = q.execute().data or []
        for row in rows:
            yield row
            yielded += 1
            if limit is not None and yielded >= limit:
                return
        if len(rows) < DB_PAGE_SIZE:
            return
        start += DB_PAGE_SIZE


def write_summary(client, provision_id: str, summary: str, model: str) -> None:
    client.table("provisions").update(
        {
            "ai_summary": summary,
            "summary_model": model,
            "summary_generated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", provision_id).execute()


def clear_summary_as_too_short(client, provision_id: str) -> None:
    """Headings-only rows: ensure ai_summary (and its provenance columns)
    are NULL rather than leaving a stale placeholder from a previous
    --force run of a since-shortened row."""
    client.table("provisions").update(
        {"ai_summary": None, "summary_model": None, "summary_generated_at": None}
    ).eq("id", provision_id).execute()


# --------------------------------------------------------------------------
# Prompt building
# --------------------------------------------------------------------------

@dataclass
class PromptResult:
    prompt: str
    system: str                   # SYSTEM_PROMPT (+ this row's REG_PROMPT_HINTS entry, if any)
    body_word_count: int          # tag-stripped word count of the provision's own text
    prompt_word_count: int        # words actually included in the prompt (post-cap)
    truncated: bool


def build_context(provision: dict, meta: dict[str, dict]) -> tuple[Optional[dict], list[dict]]:
    """Walks parent_id from `provision` up to the regulation root. Returns
    (root, chain) where root is the id-'-top-REG-' ancestor (citation +
    title shown once, up front) and chain is the ancestors in between --
    typically the Part/Appendix and any nested items -- in top-down order,
    per the spec's "regulation root ... + the parent chain's citations/
    titles (walk parent_id up to the part)"."""
    root: Optional[dict] = None
    chain: list[dict] = []
    seen: set[str] = set()
    current = provision.get("parent_id")
    while current and current not in seen:
        seen.add(current)
        node = meta.get(current)
        if not node:
            break
        if kind_of(current) == "reg":
            root = node
            break
        chain.append(node)
        current = node.get("parent_id")
    chain.reverse()
    return root, chain


def build_prompt(provision: dict, meta: dict[str, dict]) -> PromptResult:
    root, chain = build_context(provision, meta)
    stripped = strip_html(provision["full_text"])
    words = stripped.split()
    body_word_count = len(words)
    truncated = body_word_count > MAX_PROMPT_WORDS
    used_words = words[:MAX_PROMPT_WORDS] if truncated else words
    body_text = " ".join(used_words)

    lines: list[str] = []
    if root:
        lines.append(f"Regulation: {root['citation']} — {root['title']}")
    for node in chain:
        lines.append(f"Under: {node['citation']} — {node['title']}")
    lines.append(f"Provision: {provision['citation']} — {provision['title']}")

    # The immediate parent's opening words, so the model can scope this
    # paragraph against what it actually hangs off of rather than reaching
    # up to the section heading. Only the nearest ancestor below the
    # regulation root -- the root's own text is a document title, and its
    # citation/title already appear on the "Regulation:" line above.
    parent_excerpt = ""
    if chain:
        parent_stripped = strip_html(chain[-1].get("full_text") or "")
        if parent_stripped:
            parent_excerpt = parent_stripped[:PARENT_TEXT_CHARS]
            if len(parent_stripped) > PARENT_TEXT_CHARS:
                parent_excerpt += "…"
    if parent_excerpt:
        lines.append("")
        lines.append(f"Parent paragraph text ({chain[-1]['citation']}):")
        lines.append(parent_excerpt)

    lines.append("")
    lines.append("Provision text:")
    lines.append(body_text)
    if truncated:
        lines.append(
            f"\n[Note: provision text truncated to the first "
            f"{MAX_PROMPT_WORDS:,} of {body_word_count:,} words.]"
        )

    return PromptResult(
        prompt="\n".join(lines),
        system=system_prompt_for(provision["id"]),
        body_word_count=body_word_count,
        prompt_word_count=len(used_words),
        truncated=truncated,
    )


# --------------------------------------------------------------------------
# Cost estimation
# --------------------------------------------------------------------------

def rate_for(model: str) -> dict:
    return MODEL_RATES.get(model, FALLBACK_RATE)


def estimate_cost(model: str, input_tokens: int, output_tokens: int, batch: bool) -> float:
    rates = rate_for(model)
    discount = 0.5 if batch else 1.0
    cost = (input_tokens / 1_000_000) * rates["in"] * discount
    cost += (output_tokens / 1_000_000) * rates["out"] * discount
    return cost


# --------------------------------------------------------------------------
# Run stats + reporting
# --------------------------------------------------------------------------

@dataclass
class RunStats:
    processed: int = 0
    skipped_short: int = 0
    failed: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    batches_submitted: int = 0

    def add_usage(self, usage) -> None:
        self.input_tokens += getattr(usage, "input_tokens", 0) or 0
        self.output_tokens += getattr(usage, "output_tokens", 0) or 0


def print_report(stats: RunStats, model: str, batch: bool, dry_run: bool) -> None:
    cost = estimate_cost(model, stats.input_tokens, stats.output_tokens, batch=batch)
    mode = "DRY RUN (estimated, no API calls made)" if dry_run else (
        "batch" if batch else "sync"
    )
    print("\n" + "=" * 60)
    print(f"Summary generation run -- model={model} mode={mode}")
    print("=" * 60)
    print(f"{'Rows processed (summarized)':38}{stats.processed:>12,}")
    print(f"{'Rows skipped (headings-only, <'+str(MIN_WORDS)+' words)':38}{stats.skipped_short:>12,}")
    print(f"{'Rows failed':38}{stats.failed:>12,}")
    print(f"{'Input tokens':38}{stats.input_tokens:>12,}")
    print(f"{'Output tokens':38}{stats.output_tokens:>12,}")
    print(f"{'Estimated cost (USD)':38}{'$' + format(cost, ',.4f'):>12}")
    print("=" * 60)
    if stats.batches_submitted:
        print(f"Batches submitted: {stats.batches_submitted}")
    if stats.failed:
        print(f"Failures logged to {FAILED_LOG_PATH} -- they will be retried "
              f"automatically on the next run (rows without --force are always "
              f"re-selected while ai_summary is still NULL).")


def log_failure(custom_id: str, reason: str) -> None:
    FAILED_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with FAILED_LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "id": custom_id,
            "reason": reason,
            "at": datetime.now(timezone.utc).isoformat(),
        }) + "\n")


# --------------------------------------------------------------------------
# Anthropic calls
# --------------------------------------------------------------------------

def run_sync(client_anthropic, client_supabase, rows: list[dict], meta: dict, model: str,
             stats: RunStats, dry_run: bool) -> None:
    for provision in rows:
        result = build_prompt(provision, meta)
        if result.body_word_count < MIN_WORDS:
            stats.skipped_short += 1
            if not dry_run:
                clear_summary_as_too_short(client_supabase, provision["id"])
            continue

        if dry_run:
            print(f"--- {provision['id']} ({provision['citation']}) ---")
            print(result.prompt[:2000])
            print(f"[prompt words: {result.prompt_word_count}"
                  f"{' (truncated from ' + str(result.body_word_count) + ')' if result.truncated else ''}]\n")
            est_in = int(result.prompt_word_count * 1.35) + 250
            stats.input_tokens += est_in
            stats.output_tokens += 120
            stats.processed += 1
            continue

        try:
            message = client_anthropic.messages.create(
                model=model,
                max_tokens=MAX_TOKENS,
                temperature=TEMPERATURE,
                system=result.system,
                messages=[{"role": "user", "content": result.prompt}],
            )
        except Exception as exc:  # noqa: BLE001 -- log and keep going
            stats.failed += 1
            log_failure(provision["id"], str(exc))
            continue

        summary_text = "".join(
            block.text for block in message.content if getattr(block, "type", None) == "text"
        ).strip()
        stats.add_usage(message.usage)
        if not summary_text:
            stats.failed += 1
            log_failure(provision["id"], "empty response")
            continue

        write_summary(client_supabase, provision["id"], summary_text, model)
        stats.processed += 1


CUSTOM_ID_INVALID_RE = re.compile(r"[^a-zA-Z0-9_-]")
CUSTOM_ID_MAX_LEN = 64


def make_custom_id(provision_id: str, used: dict[str, str]) -> str:
    """Build an Anthropic Batches API-safe custom_id for provision_id.

    custom_id must match ^[a-zA-Z0-9_-]{1,64}$, but provision ids can
    contain other characters -- e.g. citation ids like
    'sec-7-B-I-C-1-e-(i)' contain parentheses -- and can exceed 64 chars
    (e.g. 'sec-7-B-III-C-4-c-(ii)-(A)-(1)'). Confirmed against the live
    corpus, 859 ids across all regs contain disallowed characters. This
    sanitizes the id and, when the sanitized form is too long or collides
    with a *different* provision id already placed in `used`, truncates it
    and appends a short content hash of the original id to keep it unique.

    `used` maps custom_id -> provision_id and is mutated in place so the
    caller can look the original provision id back up when reading batch
    results (never write a summary under the sanitized id itself).
    """
    sanitized = CUSTOM_ID_INVALID_RE.sub("_", provision_id) or "_"
    candidate = sanitized

    def collides(cid: str) -> bool:
        return cid in used and used[cid] != provision_id

    if len(candidate) > CUSTOM_ID_MAX_LEN or collides(candidate):
        suffix = "_" + hashlib.sha1(provision_id.encode("utf-8")).hexdigest()[:8]
        candidate = sanitized[:CUSTOM_ID_MAX_LEN - len(suffix)] + suffix
        # Vanishingly unlikely, but keep colliding even after the hash
        # (e.g. two different provision ids happen to share the same
        # truncated-prefix + hash) deterministically unique too.
        n = 0
        base = candidate
        while collides(candidate):
            n += 1
            extra = f"_{n}"
            candidate = base[:CUSTOM_ID_MAX_LEN - len(extra)] + extra

    used[candidate] = provision_id
    return candidate


def run_batch(client_anthropic, client_supabase, rows: list[dict], meta: dict, model: str,
              stats: RunStats, poll_interval: int) -> None:
    """Batch mode is only ever invoked for real runs (main() routes --dry-run
    and --sync through run_sync instead), so every row here either gets
    submitted to the Anthropic Batches API or is skipped as headings-only
    and cleared in the database."""
    batch_requests = []
    # custom_id (Batches API, ^[a-zA-Z0-9_-]{1,64}$) -> real provision id.
    # Provision ids can contain parentheses (e.g. citation-derived ids like
    # 'sec-7-B-I-C-1-e-(i)') and can exceed 64 chars, so the custom_id sent
    # to Anthropic is a sanitized/possibly-hashed stand-in -- always map
    # back through this dict before writing a summary or logging a failure.
    custom_id_map: dict[str, str] = {}

    for provision in rows:
        result = build_prompt(provision, meta)
        if result.body_word_count < MIN_WORDS:
            stats.skipped_short += 1
            clear_summary_as_too_short(client_supabase, provision["id"])
            continue
        custom_id = make_custom_id(provision["id"], custom_id_map)
        batch_requests.append({
            "custom_id": custom_id,
            "params": {
                "model": model,
                "max_tokens": MAX_TOKENS,
                "temperature": TEMPERATURE,
                "system": result.system,
                "messages": [{"role": "user", "content": result.prompt}],
            },
        })

    if not batch_requests:
        return

    for chunk_start in range(0, len(batch_requests), BATCH_MAX_REQUESTS):
        chunk = batch_requests[chunk_start:chunk_start + BATCH_MAX_REQUESTS]
        print(f"Submitting batch of {len(chunk)} requests "
              f"({chunk_start + 1}-{chunk_start + len(chunk)} of {len(batch_requests)})...")
        batch = client_anthropic.messages.batches.create(requests=chunk)
        stats.batches_submitted += 1
        print(f"  batch id: {batch.id} -- polling every {poll_interval}s "
              f"(processing_status starts as '{batch.processing_status}')")

        deadline = time.monotonic() + MAX_POLL_SECONDS
        while True:
            batch = client_anthropic.messages.batches.retrieve(batch.id)
            if batch.processing_status == "ended":
                break
            if time.monotonic() > deadline:
                print(f"  WARNING: batch {batch.id} did not finish within "
                      f"{MAX_POLL_SECONDS}s -- leaving remaining rows for next run.")
                for req in chunk:
                    provision_id = custom_id_map.get(req["custom_id"], req["custom_id"])
                    log_failure(provision_id, "batch poll timeout")
                    stats.failed += 1
                break
            time.sleep(poll_interval)

        if batch.processing_status != "ended":
            continue

        counts = batch.request_counts
        print(f"  done: succeeded={counts.succeeded} errored={counts.errored} "
              f"canceled={counts.canceled} expired={counts.expired}")

        for item in client_anthropic.messages.batches.results(batch.id):
            custom_id = item.custom_id
            # Always resolve back to the real provision id -- never write a
            # summary (or log a failure) under the sanitized custom_id.
            provision_id = custom_id_map.get(custom_id, custom_id)
            result = item.result
            if result.type == "succeeded":
                message = result.message
                summary_text = "".join(
                    block.text for block in message.content
                    if getattr(block, "type", None) == "text"
                ).strip()
                stats.add_usage(message.usage)
                if not summary_text:
                    stats.failed += 1
                    log_failure(provision_id, "empty response")
                    continue
                write_summary(client_supabase, provision_id, summary_text, model)
                stats.processed += 1
            else:
                stats.failed += 1
                error_detail = getattr(getattr(result, "error", None), "message", result.type)
                log_failure(provision_id, f"{result.type}: {error_detail}")


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate plain-English AI summaries for essentialregs.com provisions.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--reg", default=None,
        help="Limit to one regulation's id prefix, e.g. 1, 2, 3, 6, 7, 8, 26, ecmc, oooob. "
             "Omit to run against every regulation. Ignored if --ids-file is given.",
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Stop after this many candidate rows (for test runs). Ignored if --ids-file is given.",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Regenerate summaries even for rows that already have one "
             "(default: only rows where ai_summary IS NULL). Not needed "
             "alongside --ids, which always regenerates the listed rows.",
    )
    parser.add_argument(
        "--ids", default=None,
        help="Comma-separated list of exact provision ids to regenerate "
             "(e.g. from a review report flagging specific rows). Ignores "
             "the ai_summary IS NULL gate -- every listed id is always "
             "processed, --force is not needed. Also pass --reg so the "
             "parent/citation metadata lookup is scoped to that regulation "
             "rather than the whole corpus.",
    )
    parser.add_argument(
        "--ids-file", default=None,
        help="Path to a text file of provision ids, one per line (as produced by "
             "pipeline/import_ccr.py apply's summary_regen_ids.txt) -- summarize "
             "exactly this set, in file order, via the same code path as --ids. "
             "Blank lines and lines starting with '#' are ignored. Mutually "
             "exclusive with --reg, --limit, and --ids. Normally combined with "
             "--force so a `changed` row's stale summary is actually regenerated "
             "(--force is not required, though, since --ids-file rows ignore the "
             "ai_summary IS NULL gate just like --ids).",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Build and print prompts + token/cost estimates for every "
             "candidate row. Never calls the Anthropic API and never writes "
             "to the database. Still reads Supabase to select real rows.",
    )
    parser.add_argument(
        "--sync", action="store_true",
        help="Use single synchronous Messages API calls instead of the "
             "Message Batches API. Simpler for small test runs; costs 2x "
             "the batch price.",
    )
    parser.add_argument(
        "--model", default=DEFAULT_MODEL,
        help="Anthropic model id to use.",
    )
    parser.add_argument(
        "--poll-interval", type=int, default=POLL_INTERVAL_SECONDS,
        help="Seconds between batch status polls (batch mode only).",
    )
    return parser.parse_args(argv)


def require_env(names: list[str]) -> None:
    missing = [n for n in names if not os.environ.get(n)]
    if missing:
        print(f"Missing required environment variable(s): {', '.join(missing)}",
              file=sys.stderr)
        sys.exit(1)


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)

    if args.ids_file and (args.reg or args.limit is not None or args.ids):
        print("--ids-file is mutually exclusive with --reg, --limit, and --ids.",
              file=sys.stderr)
        return 1

    required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    if not args.dry_run:
        required.append("ANTHROPIC_API_KEY")
    require_env(required)

    client_supabase = make_supabase_client()
    client_anthropic = None
    if not args.dry_run:
        import anthropic
        client_anthropic = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    # Fresh failed.jsonl per run so the workflow artifact reflects only this
    # run's failures; a row that failed is naturally retried on the next run
    # because it's still selected by "ai_summary IS NULL" (unless --force).
    if not args.dry_run and FAILED_LOG_PATH.exists():
        FAILED_LOG_PATH.unlink()

    # --ids-file may span more than one regulation in principle, so build
    # context metadata across the whole table (cheap -- see fetch_meta)
    # rather than scoping to a single --reg prefix.
    meta_reg = None if args.ids_file else args.reg

    print(f"Fetching parent/citation metadata"
          f"{f' for reg {meta_reg}' if meta_reg else ' (all regulations)'}...")
    meta = fetch_meta(client_supabase, meta_reg)
    print(f"  {len(meta):,} rows loaded for context lookups.")

    if args.ids_file:
        ids = load_ids_file(args.ids_file)
    elif args.ids:
        ids = [i.strip() for i in args.ids.split(",") if i.strip()]
    else:
        ids = None

    print("Fetching candidate rows"
          f"{f' ({len(ids)} explicit id(s))' if ids else ''}"
          f"{f' (limit {args.limit})' if args.limit and not ids else ''}"
          f"{' [force: regenerating existing summaries too]' if args.force and not ids else ''}...")
    rows = list(iter_candidates(client_supabase, args.reg, args.force, args.limit, ids=ids))
    print(f"  {len(rows):,} candidate rows.")

    if not rows:
        print("Nothing to do.")
        return 0

    stats = RunStats()
    if args.sync or args.dry_run:
        run_sync(client_anthropic, client_supabase, rows, meta, args.model, stats, args.dry_run)
    else:
        run_batch(client_anthropic, client_supabase, rows, meta, args.model, stats,
                   args.poll_interval)

    print_report(stats, args.model, batch=not (args.sync or args.dry_run), dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
