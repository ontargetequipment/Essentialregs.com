"""Unit tests for pipeline.summarize's batch custom_id handling.

Covers the fix for anthropic.BadRequestError 400 on
`requests.N.custom_id: String should match pattern '^[a-zA-Z0-9_-]{1,64}$'`,
caused by provision ids that contain parentheses (e.g. citation-derived ids
like 'sec-7-B-I-C-1-e-(i)') and/or exceed 64 characters.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from summarize import CUSTOM_ID_MAX_LEN, make_custom_id  # noqa: E402

VALID_CUSTOM_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")

LONG_PAREN_ID = "sec-7-B-III-C-4-c-(ii)-(A)-(1)-really-long-tail-that-pushes-this-well-past-sixty-four-characters"


def test_sanitizes_parens_to_valid_pattern():
    used: dict[str, str] = {}
    custom_id = make_custom_id("sec-7-B-I-C-1-e-(i)", used)
    assert VALID_CUSTOM_ID_RE.match(custom_id)
    assert "(" not in custom_id and ")" not in custom_id
    assert used[custom_id] == "sec-7-B-I-C-1-e-(i)"


def test_long_id_truncated_and_valid():
    custom_id = make_custom_id(LONG_PAREN_ID, {})
    assert len(custom_id) <= CUSTOM_ID_MAX_LEN
    assert VALID_CUSTOM_ID_RE.match(custom_id)


def test_uniqueness_for_ids_that_sanitize_to_same_string():
    # These two ids differ only in a character that sanitizes to the same
    # placeholder ('(' and ')' both become '_'), so their naive sanitized
    # forms collide -- the second must get a distinguishing suffix.
    used: dict[str, str] = {}
    id_a = "sec-7-B-1-(a)"
    id_b = "sec-7-B-1-)a("
    custom_a = make_custom_id(id_a, used)
    custom_b = make_custom_id(id_b, used)

    assert custom_a != custom_b
    assert VALID_CUSTOM_ID_RE.match(custom_a)
    assert VALID_CUSTOM_ID_RE.match(custom_b)
    # Round trip: each custom_id maps back to the provision id it came from.
    assert used[custom_a] == id_a
    assert used[custom_b] == id_b


def test_same_provision_id_reuses_same_custom_id():
    used: dict[str, str] = {}
    pid = "sec-7-B-I-C-1-e-(i)"
    first = make_custom_id(pid, used)
    second = make_custom_id(pid, used)
    assert first == second
    assert len(used) == 1


def test_all_ids_at_most_64_chars_and_valid():
    ids = [
        "sec-7-B-I-C-1-e-(i)",
        "sec-7-B-III-C-4-c-(ii)-(A)-(1)",
        LONG_PAREN_ID,
        "plain-id-no-special-chars",
        "",
    ]
    used: dict[str, str] = {}
    for pid in ids:
        custom_id = make_custom_id(pid, used)
        assert 1 <= len(custom_id) <= CUSTOM_ID_MAX_LEN
        assert VALID_CUSTOM_ID_RE.match(custom_id)


def test_round_trip_mapping_for_batch_of_provision_ids():
    provision_ids = [
        "sec-7-B-I-C-1-e-(i)",
        "sec-7-B-III-C-4-c-(ii)-(A)-(1)",
        "sec-3-A-1",
        LONG_PAREN_ID,
    ]
    used: dict[str, str] = {}
    custom_ids = [make_custom_id(pid, used) for pid in provision_ids]

    # No duplicate custom_ids within the batch.
    assert len(set(custom_ids)) == len(custom_ids)

    # Every custom_id maps back to exactly the provision id it was built
    # from (this is what run_batch relies on to write summaries to the
    # right provision id when reading batch results back).
    for pid, cid in zip(provision_ids, custom_ids):
        assert used[cid] == pid


# ==========================================================================
# Per-regulation prompt hints (REG_PROMPT_HINTS / system_prompt_for) --
# added Sept 17 2026 with the Reg 1/2/6/8 import.
# ==========================================================================

import pytest  # noqa: E402

import summarize  # noqa: E402
from summarize import (
    DEFAULT_AUDIENCE,
    REG_AUDIENCE,
    REG_PROMPT_HINTS,
    SYSTEM_PROMPT,
    SYSTEM_PROMPT_TEMPLATE,
    build_prompt,
    reg_key_of,
    system_prompt_for,
)


def _row(provision_id: str) -> dict:
    """A minimal provision row with enough words to clear MIN_WORDS."""
    return {
        "id": provision_id,
        "citation": "X.Y.Z",
        "title": "Test provision",
        "parent_id": None,
        "full_text": "<p>" + " ".join(["word"] * 40) + "</p>",
        "sort_order": 1,
    }


# --------------------------------------------------------------------------
# reg_key_of
# --------------------------------------------------------------------------

@pytest.mark.parametrize("provision_id, expected", [
    ("sec-1-III-C-1", "1"),
    ("sec-2-B-II-H", "2"),
    ("sec-6-A-SUBPART-Kb", "6"),
    ("sec-8-B-I-C-3", "8"),
    ("sec-7-B-I-C-1-e-(i)", "7"),
    ("sec-22-top-REG-22", "22"),
    ("sec-oooob-5390", "oooob"),
    ("sec-OOOOa-5397a", "ooooa"),
    ("", None),
    ("notasec-7-x", None),
])
def test_reg_key_of(provision_id, expected):
    assert reg_key_of(provision_id) == expected


# --------------------------------------------------------------------------
# Hint selection by row id prefix
# --------------------------------------------------------------------------

@pytest.mark.parametrize("provision_id, key, marker", [
    ("sec-1-III-C-1", "1", "Regulation Number 1"),
    ("sec-2-B-IX-B-3", "2", "Regulation Number 2"),
    ("sec-6-A-SUBPART-Kb", "6", "Regulation Number 6"),
    ("sec-8-E-III-M", "8", "Regulation Number 8"),
    ("sec-25-B-I-L-2-b-(ii)", "25", "Regulation Number 25"),
    ("sec-25-A-APPENDIX-A", "25", "Appendix A"),
])
def test_specific_hint_selected_by_id_prefix(provision_id, key, marker):
    system = system_prompt_for(provision_id)
    assert system.startswith(SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE.get(key, DEFAULT_AUDIENCE)))
    assert system.endswith(REG_PROMPT_HINTS[key])
    assert marker in system
    # Exactly one hint appended, separated from the base prompt by a blank line.
    base = SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE.get(key, DEFAULT_AUDIENCE))
    assert system == f"{base}\n\n{REG_PROMPT_HINTS[key]}"


@pytest.mark.parametrize("provision_id, key", [
    ("sec-3-B-II-D-1", "3"),
    ("sec-7-B-I-C-1-e-(i)", "7"),
    ("sec-22-A-I", "22"),
    ("sec-26-B-III", "26"),
])
def test_shared_colorado_scope_hint(provision_id, key):
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT}\n\n{REG_PROMPT_HINTS[key]}"
    assert "8-hour Ozone Control Area" in system
    assert "attainment-maintenance" in system
    assert "statewide" in system


def test_shared_hint_is_identical_across_existing_colorado_regs():
    hints = {REG_PROMPT_HINTS[k] for k in ("3", "7", "22", "26")}
    assert len(hints) == 1


@pytest.mark.parametrize("provision_id", [
    "sec-ooooa-5397a",
    "sec-oooob-5390",
    "sec-ooooc-5386",
])
def test_no_hint_for_cfr_subparts(provision_id):
    assert reg_key_of(provision_id) not in REG_PROMPT_HINTS
    assert system_prompt_for(provision_id) == SYSTEM_PROMPT


def test_reg_11_hint_and_audience():
    system = system_prompt_for("sec-11-F-III-C")
    assert system.endswith(REG_PROMPT_HINTS["11"])
    assert "Regulation Number 11" in system
    assert "Department of Revenue" in system and "Air Pollution Control Division" in system
    assert "never invent or round a cutpoint" in system
    # Reg 11's audience is inspection stations / fleets, not oil and gas.
    assert REG_AUDIENCE["11"] in system
    assert DEFAULT_AUDIENCE not in system
    assert system_prompt_for("sec-11-H-APPENDIX-A-ATT-V-OPACITY").startswith(
        SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE["11"]))
    # every other reg still renders the default audience
    assert system_prompt_for("sec-26-B-III").startswith(SYSTEM_PROMPT)


def test_no_hint_for_unknown_or_malformed_id():
    assert system_prompt_for("") == SYSTEM_PROMPT
    assert system_prompt_for("sec-99-A") == SYSTEM_PROMPT


def test_reg7_prompt_has_no_reg6_specific_text():
    system = system_prompt_for("sec-7-B-I-C-1")
    for reg6_only in (
        "Regulation Number 6",
        "adoption-by-reference",
        "mercury",
        "Part 75",
        "UUUUU",
        "40 CFR Part 60, Subpart Xx",
    ):
        assert reg6_only not in system
    # ...and no other reg-specific hint leaked in either.
    for key in ("1", "2", "6", "8"):
        assert REG_PROMPT_HINTS[key] not in system


def test_hints_are_reasonably_short():
    for key, hint in REG_PROMPT_HINTS.items():
        assert len(hint.split()) <= 200, f"hint for reg {key} is too long"


# --------------------------------------------------------------------------
# build_prompt carries the per-row system prompt (what run_sync/run_batch use)
# --------------------------------------------------------------------------

@pytest.mark.parametrize("provision_id, key", [
    ("sec-1-III-C-1", "1"),
    ("sec-2-B-II-H", "2"),
    ("sec-6-B-VIII-A", "6"),
    ("sec-8-B-I-C-3", "8"),
    ("sec-7-B-I-C-1", "7"),
])
def test_build_prompt_system_matches_row_reg(provision_id, key):
    result = build_prompt(_row(provision_id), meta={})
    assert result.system == f"{SYSTEM_PROMPT}\n\n{REG_PROMPT_HINTS[key]}"
    # The hint lives in the system prompt, not the user prompt.
    assert REG_PROMPT_HINTS[key] not in result.prompt


def test_build_prompt_system_unchanged_for_cfr_row():
    result = build_prompt(_row("sec-oooob-5390"), meta={})
    assert result.system == SYSTEM_PROMPT


def test_build_prompt_user_prompt_unchanged_shape():
    result = build_prompt(_row("sec-6-A-SUBPART-Kb"), meta={})
    assert result.prompt.startswith("Provision: X.Y.Z — Test provision")
    assert "Provision text:" in result.prompt
    assert result.body_word_count == 40
    assert result.truncated is False


# --------------------------------------------------------------------------
# ECMC hint (added Sept 17 2026)
# --------------------------------------------------------------------------

@pytest.mark.parametrize("provision_id", [
    "sec-ecmc-100-a",
    "sec-ecmc-604-b-(1)",
    "sec-ecmc-1301-a",
    "sec-ecmc-APPENDIX-IX",
])
def test_ecmc_hint_selected_by_id_prefix(provision_id):
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT}\n\n{REG_PROMPT_HINTS['ecmc']}"
    assert "Energy and Carbon Management Commission" in system
    assert "AQCC" in system


def test_ecmc_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["ecmc"]
    for marker in (
        "ECMC", "formerly", "COGCC", "APCD", "Division", "Director", "LGD",
        "Local Governmental Designee", "Relevant Local Government",
        "Proximate Local Government", "Disproportionately Impacted "
        "Community", "Cumulative Impacts", "Working Pad Surface",
        "Oil and Gas Location", "High Priority Habitat", "ECMC form",
        "setback", "1300 Series", "1400 Series", "200-1200 Series",
        "100 Series", "definitions", "Table 423-1", "423-2", "History",
        "Appendix IX", "Form 41",
    ):
        assert marker in hint, f"missing {marker!r} from ecmc hint"


def test_ecmc_hint_reasonably_short():
    assert len(REG_PROMPT_HINTS["ecmc"].split()) <= 190


def test_reg7_prompt_has_no_ecmc_specific_text():
    system = system_prompt_for("sec-7-B-I-C-1")
    assert REG_PROMPT_HINTS["ecmc"] not in system
    for ecmc_only in ("ECMC", "1300 Series", "Form 41"):
        assert ecmc_only not in system


# --------------------------------------------------------------------------
# Batch 3 hints: cp, 9, 24, 30 (added Sept 18 2026)
# --------------------------------------------------------------------------

@pytest.mark.parametrize("provision_id, expected", [
    ("sec-cp-I-G-1", "cp"),
    ("sec-9-B-I-A", "9"),
    ("sec-24-B-II-C", "24"),
    ("sec-30-B-I-A", "30"),
])
def test_batch3_reg_key_of(provision_id, expected):
    assert reg_key_of(provision_id) == expected


@pytest.mark.parametrize("provision_id, key, marker", [
    ("sec-cp-I-G-1", "cp", "Common Provisions Regulation"),
    ("sec-9-B-I-A", "9", "Regulation Number 9"),
    ("sec-24-B-II-C", "24", "Regulation Number 24"),
    ("sec-30-B-I-A", "30", "Regulation Number 30"),
])
def test_batch3_hint_selected_by_id_prefix(provision_id, key, marker):
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT}\n\n{REG_PROMPT_HINTS[key]}"
    assert marker in system


def test_cp_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["cp"]
    for marker in (
        "Common Provisions Regulation", "AQCC", "Air Quality Control "
        "Commission", "APCD", "definition", "SOURCE DEFINTIONS",
        "(State Only)", "Reserved", "V.A-V.V", "Table 1", "III.B.3",
    ):
        assert marker in hint, f"missing {marker!r} from cp hint"


def test_reg9_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["9"]
    for marker in (
        "Regulation Number 9", "Authorized Local Agency", "planned ignition",
        "unplanned ignition", "Land Manager",
        "Significant User of Prescribed Fire", "Section VIII", "Section IX",
        "Appendix A", "Appendix B", "PM10",
    ):
        assert marker in hint, f"missing {marker!r} from reg 9 hint"


def test_reg24_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["24"]
    for marker in (
        "Regulation Number 24", "Appendix A", "8-hour Ozone Control Area",
        "(State Only)", "Reid vapor pressure", "torr", "psia", "Table 1",
        "Appendices B and C", "Part C", "2026 reorganization",
        "40 CFR Part 60",
    ):
        assert marker in hint, f"missing {marker!r} from reg 24 hint"


def test_reg30_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["30"]
    for marker in (
        "Regulation Number 30", "TAC", "PTAC", "Appendix A", "Appendix B",
        "HQ", "IUR", "RfC", "AIRS ID", "HEPA", "Division", "Part C",
        "25-7-109.5",
    ):
        assert marker in hint, f"missing {marker!r} from reg 30 hint"


@pytest.mark.parametrize("key", ["cp", "9", "24", "30"])
def test_batch3_hints_reasonably_short(key):
    assert len(REG_PROMPT_HINTS[key].split()) <= 190


def test_reg7_prompt_has_no_batch3_specific_text():
    system = system_prompt_for("sec-7-B-I-C-1")
    for key in ("cp", "9", "24", "30"):
        assert REG_PROMPT_HINTS[key] not in system
    for batch3_only in (
        "SOURCE DEFINTIONS", "Authorized Local Agency", "PTAC", "AIRS ID",
    ):
        assert batch3_only not in system


# --------------------------------------------------------------------------
# Batch 4 hints: GP01-GP12 (shared) and jjjj/iiii/zzzz (added Sept 19 2026)
# --------------------------------------------------------------------------

_GP_KEYS = (
    "gp01", "gp02", "gp03", "gp05", "gp06", "gp07",
    "gp08", "gp09", "gp10", "gp11", "gp12",
)


@pytest.mark.parametrize("provision_id, expected", [
    ("sec-gp02-II-A-2", "gp02"),
    ("sec-zzzz-63.6603-(a)", "zzzz"),
])
def test_batch4_reg_key_of(provision_id, expected):
    assert reg_key_of(provision_id) == expected


@pytest.mark.parametrize("provision_id, key", [
    ("sec-gp01-I-A", "gp01"),
    ("sec-gp02-II-A-2", "gp02"),
    ("sec-gp03-A-1", "gp03"),
    ("sec-gp05-B-2", "gp05"),
    ("sec-gp06-C-3", "gp06"),
    ("sec-gp07-D-4", "gp07"),
    ("sec-gp08-E-5", "gp08"),
    ("sec-gp09-F-6", "gp09"),
    ("sec-gp10-G-7", "gp10"),
    ("sec-gp11-H-8", "gp11"),
    ("sec-gp12-I-9", "gp12"),
])
def test_gp_hint_selected_by_id_prefix(provision_id, key):
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT}\n\n{REG_PROMPT_HINTS[key]}"
    assert "APCD" in system
    assert "permit condition" in system


def test_gp_hint_is_identical_across_all_eleven_keys():
    hints = {REG_PROMPT_HINTS[k] for k in _GP_KEYS}
    assert len(hints) == 1


def test_gp_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["gp01"]
    for marker in (
        "permit requires", "permit condition", "APCD", "AQCC",
        "owner or operator", "tpy", "g/hp-hr", "ppmvd",
        "record-retention", "Condition X", "AOS", "NOS", "RICE",
        "PSD/NANSR", "Disproportionately Impacted", "GP09", "GP10",
        "July 15, 2026", "GP12",
    ):
        assert marker in hint, f"missing {marker!r} from gp hint"


@pytest.mark.parametrize("provision_id, key, marker", [
    ("sec-jjjj-60.4230", "jjjj", "Subpart JJJJ"),
    ("sec-iiii-60.4200", "iiii", "Subpart IIII"),
    ("sec-zzzz-63.6603-(a)", "zzzz", "Subpart ZZZZ"),
])
def test_engine_subpart_hint_selected_by_id_prefix(provision_id, key, marker):
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT}\n\n{REG_PROMPT_HINTS[key]}"
    assert marker in system


def test_jjjj_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["jjjj"]
    for marker in (
        "EPA Administrator", "owner or operator", "spark-ignition (SI)",
        "compression-ignition", "Subpart IIII", "ZZZZ", "Emergency",
        "non-emergency", "Tables", "RICE", "2SLB/4SLB/4SRB", "NSCR",
        "oxidation catalyst", "40 CFR Part 1048", "This subpart",
        "General Provisions", "Colorado",
    ):
        assert marker in hint, f"missing {marker!r} from jjjj hint"


def test_iiii_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["iiii"]
    for marker in (
        "EPA Administrator", "owner or operator", "compression-ignition (CI)",
        "spark-ignition", "Subpart JJJJ", "ZZZZ", "Emergency",
        "non-emergency", "Tables", "RICE", "40 CFR Part 1039",
        "This subpart", "General Provisions", "Colorado",
    ):
        assert marker in hint, f"missing {marker!r} from iiii hint"


def test_zzzz_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["zzzz"]
    for marker in (
        "EPA Administrator", "owner or operator", "spark-ignition (SI",
        "compression-ignition (CI", "Subpart JJJJ", "Subpart IIII",
        "Emergency", "non-emergency", "major source", "HAP",
        "load-bearing", "Tables 2c vs. 2d", "RICE", "2SLB/4SLB/4SRB",
        "NSCR", "oxidation catalyst", "CO as a surrogate", "formaldehyde",
        "Tables 1a-8", "40 CFR Part 1039", "This subpart",
        "General Provisions", "Colorado",
    ):
        assert marker in hint, f"missing {marker!r} from zzzz hint"


@pytest.mark.parametrize("key", ["gp01", "jjjj", "iiii", "zzzz",
                                "p191", "p192", "p194", "p195", "p199",
                                "p190", "p193", "p196"])
def test_batch4_hints_reasonably_short(key):
    assert len(REG_PROMPT_HINTS[key].split()) <= 190


def test_reg7_prompt_has_no_batch4_specific_text():
    system = system_prompt_for("sec-7-B-I-C-1")
    for key in ("gp01", "jjjj", "iiii", "zzzz"):
        assert REG_PROMPT_HINTS[key] not in system
    for batch4_only in (
        "permit condition", "Subpart JJJJ", "Subpart IIII", "Subpart ZZZZ",
        "2SLB/4SLB/4SRB",
    ):
        assert batch4_only not in system


def test_jjjj_iiii_zzzz_hints_do_not_conflate_each_other():
    # JJJJ's hint should not carry ZZZZ- or IIII-only vocabulary and vice
    # versa (beyond the deliberate short cross-references to each other).
    assert "compression-ignition (CI)" not in REG_PROMPT_HINTS["jjjj"]
    assert "spark-ignition (SI)" not in REG_PROMPT_HINTS["iiii"]
    assert "CO as a surrogate" not in REG_PROMPT_HINTS["jjjj"]
    assert "CO as a surrogate" not in REG_PROMPT_HINTS["iiii"]


@pytest.mark.parametrize("provision_id, key", [
    ("sec-gp06-C-3", "gp06"),
    ("sec-jjjj-60.4230", "jjjj"),
    ("sec-iiii-60.4200", "iiii"),
    ("sec-zzzz-63.6603-(a)", "zzzz"),
])
def test_batch4_build_prompt_system_matches_row_reg(provision_id, key):
    result = build_prompt(_row(provision_id), meta={})
    assert result.system == f"{SYSTEM_PROMPT}\n\n{REG_PROMPT_HINTS[key]}"
    assert REG_PROMPT_HINTS[key] not in result.prompt


# --------------------------------------------------------------------------
# p191 / p192 (PHMSA, 49 CFR gas pipeline safety) hints
# --------------------------------------------------------------------------

def test_p191_p192_hints_are_registered():
    assert "p191" in REG_PROMPT_HINTS
    assert "p192" in REG_PROMPT_HINTS


def test_batch_b_p194_p195_p199_hints_are_registered():
    for key in ("p194", "p195", "p199"):
        assert key in REG_PROMPT_HINTS
        assert len(REG_PROMPT_HINTS[key].split()) <= 185


@pytest.mark.parametrize("provision_id", [
    "sec-p194-194.107-(a)",
    "sec-p195-195.2-operator",
    "sec-p199-199.3-covered-employee",
])
def test_batch_b_49_cfr_prompts_say_phmsa_not_epa(provision_id):
    system = system_prompt_for(provision_id)
    assert "PHMSA" in system
    assert "EPA Administrator" not in system
    assert "EPA" not in system.replace("NEVER EPA", "")


def test_all_eight_pipeline_parts_are_registered_as_49_cfr_keys():
    import summarize as _sm
    assert _sm._REG_49_CFR_KEYS == frozenset(
        {"p190", "p191", "p192", "p193", "p194", "p195", "p196", "p199"})
    for key in _sm._REG_49_CFR_KEYS:
        assert key in REG_PROMPT_HINTS


def test_batch_b_hints_do_not_conflate_each_other():
    # Part 195 is liquids, Part 199 is drug/alcohol testing, Part 194 is
    # response plans -- none of their signature vocabulary may cross over.
    assert "covered employee" not in REG_PROMPT_HINTS["p195"]
    assert "worst case discharge" not in REG_PROMPT_HINTS["p195"].lower()
    assert "Part 40" not in REG_PROMPT_HINTS["p195"]
    assert "breakout tank" not in REG_PROMPT_HINTS["p199"]
    assert "195.452" not in REG_PROMPT_HINTS["p199"]
    assert "195.452" not in REG_PROMPT_HINTS["p194"]
    assert "covered function" not in REG_PROMPT_HINTS["p194"]
    # ... and none of them carries the gas-only Part 192 vocabulary.
    for key in ("p194", "p195", "p199"):
        assert "MAOP" not in REG_PROMPT_HINTS[key]
        assert "SMYS" not in REG_PROMPT_HINTS[key]
        assert "Class locations" not in REG_PROMPT_HINTS[key]


def test_batch_b_hints_name_standards_without_describing_them():
    assert "API 653" in REG_PROMPT_HINTS["p195"]
    assert "named, never described" in REG_PROMPT_HINTS["p195"]
    assert "NFPA 30" in REG_PROMPT_HINTS["p194"]
    assert "named, never described" in REG_PROMPT_HINTS["p194"]
    # Part 40 is named but explicitly never described
    assert "never describe" in REG_PROMPT_HINTS["p199"]


@pytest.mark.parametrize("provision_id, key", [
    ("sec-p191-191.3-incident", "p191"),
    ("sec-p192-192.605-(b)", "p192"),
    ("sec-p194-194.5-response-zone", "p194"),
    ("sec-p195-195.452-(h)-(1)-(i)", "p195"),
    ("sec-p199-199.105-(b)", "p199"),
])
def test_p19x_build_prompt_system_matches_row_reg(provision_id, key):
    result = build_prompt(_row(provision_id), meta={})
    assert result.system == system_prompt_for(provision_id)
    assert result.system.endswith(REG_PROMPT_HINTS[key])
    assert REG_PROMPT_HINTS[key] not in result.prompt


def test_system_prompt_for_p192_says_phmsa_not_epa():
    system = system_prompt_for("sec-p192-192.605-(b)")
    assert "PHMSA" in system
    assert "EPA Administrator" not in system


def test_system_prompt_for_p191_says_phmsa_not_epa():
    system = system_prompt_for("sec-p191-191.3-incident")
    assert "PHMSA" in system
    assert "EPA Administrator" not in system


def test_reg7_prompt_has_no_p19x_specific_text():
    system = system_prompt_for("sec-7-B-I-C-1")
    for key in ("p191", "p192", "p194", "p195", "p199", "p190", "p193", "p196"):
        assert REG_PROMPT_HINTS[key] not in system
    for p19x_only in ("PHMSA", "MAOP", "SMYS", "gathering", "UNGSF"):
        assert p19x_only not in system


def test_p19x_hints_do_not_conflate_each_other():
    # p192-only vocabulary (class locations, the acronym list) shouldn't
    # leak into the p191 hint, which covers a much smaller reporting-only
    # part with no subparts.
    assert "Class locations" not in REG_PROMPT_HINTS["p191"]
    assert "MAOP" not in REG_PROMPT_HINTS["p191"]


# --------------------------------------------------------------------------
# Batch C: p190 / p193 / p196 hints, and the RMV/repair-schedule sentence
# added to p192 / p195
# --------------------------------------------------------------------------

def test_batch_c_hints_are_registered_and_within_budget():
    for key in ("p190", "p193", "p196"):
        assert key in REG_PROMPT_HINTS
        assert len(REG_PROMPT_HINTS[key].split()) <= 185, key


def test_p192_and_p195_still_within_budget_after_the_rmv_sentence():
    for key in ("p192", "p195"):
        assert len(REG_PROMPT_HINTS[key].split()) <= 185, key


@pytest.mark.parametrize("key", ["p192", "p195"])
def test_p192_p195_carry_the_valve_and_repair_schedule_sentence(key):
    hint = REG_PROMPT_HINTS[key]
    assert "RMV means rupture-mitigation valve" in hint
    assert "RCV remote-control valve" in hint
    assert "ASV automatic shutoff valve" in hint
    assert "expand only as the text does" in hint
    assert "(immediate, one-year, two-year, monitored)" in hint
    assert "only as the section names them" in hint


def test_p192_p195_kept_their_batch_a_b_anchors_after_the_trim():
    # the trim to fit the RMV sentence must not have dropped the checks the
    # earlier tests and briefs rely on
    p192 = REG_PROMPT_HINTS["p192"]
    for must in ("NEVER EPA", "Type A/B/C/R", "Class locations 1-4", "MAOP", "UNGSF",
                 "named, never described", "figure-omitted", "[Reserved]",
                 "\"high\" vs. \"moderate\"", "effective date"):
        assert must in p192, must
    p195 = REG_PROMPT_HINTS["p195"]
    for must in ("carbon dioxide", "NEVER EPA", "breakout tank", "195.452", "195.450",
                 "unusually sensitive area", "API 653", "named, never described", "[Reserved]"):
        assert must in p195, must


@pytest.mark.parametrize("provision_id", [
    "sec-p190-190.223-(a)",
    "sec-p190-190.3-respondent",
    "sec-p193-193.2007-lng-facility",
    "sec-p193-193.2057",
    "sec-p196-196.103",
    "sec-p196-196.3-excavator",
])
def test_batch_c_49_cfr_prompts_say_phmsa_not_epa(provision_id):
    system = system_prompt_for(provision_id)
    assert "PHMSA" in system
    assert "EPA Administrator" not in system
    assert "EPA" not in system.replace("NEVER EPA", "")


@pytest.mark.parametrize("provision_id, key", [
    ("sec-p190-190.223-(a)", "p190"),
    ("sec-p193-193.2007-lng-facility", "p193"),
    ("sec-p196-196.103", "p196"),
])
def test_batch_c_build_prompt_system_matches_row_reg(provision_id, key):
    result = build_prompt(_row(provision_id), meta={})
    assert result.system == system_prompt_for(provision_id)
    assert result.system.endswith(REG_PROMPT_HINTS[key])
    assert REG_PROMPT_HINTS[key] not in result.prompt


def test_p190_hint_is_procedural_and_never_invents_penalty_maxima():
    hint = REG_PROMPT_HINTS["p190"]
    for must in ("Respondent", "Associate Administrator", "Notice of probable violation",
                 "compliance order", "civil-penalty amount", "never a remembered",
                 "hearing", "Sec. 190.211"):
        assert must in hint, must
    # it sets no design standard, so none of the Part 192/195 engineering vocabulary
    for never in ("MAOP", "SMYS", "Class locations", "breakout tank", "HVL", "LNG"):
        assert never not in hint, never


def test_p193_hint_names_nfpa_59a_without_describing_it():
    hint = REG_PROMPT_HINTS["p193"]
    for must in ("LNG", "impoundment", "vaporizer", "Operator", "NFPA 59A",
                 "never describe", "design spill", "thermal radiation",
                 "vapor-gas dispersion", "exclusion zone", "Sec. 193.2007", "Subpart J"):
        assert must in hint, must
    for never in ("MAOP", "Class locations", "gathering", "Respondent", "excavator"):
        assert never not in hint, never


def test_p196_hint_keeps_excavator_and_operator_apart_and_points_at_part_190():
    hint = REG_PROMPT_HINTS["p196"]
    for must in ("excavator", "pipeline operator", "One-call", "excavation damage",
                 "Subpart C", "49 CFR Part 190", "never describe its procedures",
                 "never a remembered maximum", "Colorado 811"):
        assert must in hint, must
    for never in ("MAOP", "LNG", "Class locations", "Respondent", "impoundment"):
        assert never not in hint, never


def test_batch_c_hints_do_not_conflate_each_other_or_batch_a_b():
    assert "LNG" not in REG_PROMPT_HINTS["p190"]
    assert "excavator" not in REG_PROMPT_HINTS["p190"]
    assert "Respondent" not in REG_PROMPT_HINTS["p193"]
    assert "excavator" not in REG_PROMPT_HINTS["p193"]
    assert "LNG" not in REG_PROMPT_HINTS["p196"]
    assert "Notice of probable violation" not in REG_PROMPT_HINTS["p196"]
    for key in ("p191", "p192", "p194", "p195", "p199"):
        assert "Respondent" not in REG_PROMPT_HINTS[key], key
        assert "excavator" not in REG_PROMPT_HINTS[key], key
        assert "NFPA 59A" not in REG_PROMPT_HINTS[key], key


def test_reg7_and_oooob_prompts_have_no_batch_c_specific_text():
    for pid in ("sec-7-B-I-C-1", "sec-oooob-60.5390b"):
        system = system_prompt_for(pid)
        for key in ("p190", "p193", "p196"):
            assert REG_PROMPT_HINTS[key] not in system
        for only in ("Respondent", "NFPA 59A", "excavator", "One-call", "rupture-mitigation"):
            assert only not in system, (pid, only)


# --------------------------------------------------------------------------
# Audience hook (REG_AUDIENCE / DEFAULT_AUDIENCE / SYSTEM_PROMPT_TEMPLATE)
# --------------------------------------------------------------------------

def test_system_prompt_is_template_rendered_with_default_audience():
    assert SYSTEM_PROMPT == SYSTEM_PROMPT_TEMPLATE.format(audience=DEFAULT_AUDIENCE)


def test_default_audience_matches_original_wording():
    assert DEFAULT_AUDIENCE == (
        "an EHS or compliance person at a Colorado oil & gas operator"
    )


def test_only_reg_11_overrides_the_audience():
    # ECMC and every oil-and-gas regulation stay on the O&G default; Reg 11
    # (motor vehicle inspection stations) is the first non-O&G audience.
    # Batch 6 merge: aqs, 16, sip, 18, 19, 20, 21 all name their own reader.
    assert set(REG_AUDIENCE) == {"11", "12", "25", "27", "aqs", "16", "sip", "18", "19", "20", "21"}
    assert system_prompt_for("sec-ecmc-100-a").startswith(SYSTEM_PROMPT)


@pytest.mark.parametrize("provision_id", [
    "sec-7-B-I-C-1",
    "sec-ecmc-100-a",
    "sec-oooob-5390",
    "sec-1-III-C-1",
])
def test_every_existing_and_new_reg_uses_default_audience(provision_id):
    system = system_prompt_for(provision_id)
    assert system.startswith(SYSTEM_PROMPT_TEMPLATE.format(audience=DEFAULT_AUDIENCE))


# --------------------------------------------------------------------------
# Byte-identical guarantee: adding the ecmc hint/audience hook must not
# change the rendered prompt for any pre-existing regulation.
# --------------------------------------------------------------------------

def _load_orig_summarize():
    import importlib.util

    orig_path = Path(__file__).resolve().parent / "orig_summarize.py"
    spec = importlib.util.spec_from_file_location("orig_summarize", orig_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules["orig_summarize"] = module
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


@pytest.mark.parametrize("provision_id", [
    "sec-7-B-I-C-1",
    "sec-oooob-5390",
])
def test_rendered_prompt_byte_identical_to_before_ecmc_change(provision_id):
    # orig_summarize.py is a local pre-change copy used during review only;
    # it is not committed, so this guard test skips in CI.
    if not (Path(__file__).resolve().parent / "orig_summarize.py").exists():
        pytest.skip("orig_summarize.py (pre-change copy) not present in this checkout")
    orig = _load_orig_summarize()
    assert system_prompt_for(provision_id) == orig.system_prompt_for(provision_id)


def test_call_sites_use_per_row_system(monkeypatch):
    """run_sync must send result.system (with hint), not the bare SYSTEM_PROMPT."""
    captured: list[dict] = []

    class _Usage:
        input_tokens = 1
        output_tokens = 1

    class _Block:
        type = "text"
        text = "ok"

    class _Message:
        content = [_Block()]
        usage = _Usage()

    class _Messages:
        def create(self, **kwargs):
            captured.append(kwargs)
            return _Message()

    class _Anthropic:
        messages = _Messages()

    monkeypatch.setattr(summarize, "write_summary", lambda *a, **k: None)
    stats = summarize.RunStats()
    summarize.run_sync(_Anthropic(), None, [_row("sec-8-B-I-C-3"), _row("sec-oooob-1")],
                       {}, "claude-sonnet-4-5", stats, dry_run=False)
    assert len(captured) == 2
    assert captured[0]["system"] == f"{SYSTEM_PROMPT}\n\n{REG_PROMPT_HINTS['8']}"
    assert captured[1]["system"] == SYSTEM_PROMPT
    assert stats.processed == 2


# --------------------------------------------------------------------------
# Batch 5: Regulation Number 12 (diesel vehicle emissions)
# --------------------------------------------------------------------------

@pytest.mark.parametrize("provision_id", ["sec-12-A-I-B-8", "sec-12-B-III-C-4-b-viii-C", "sec-12-D-XI"])
def test_reg12_hint_selected_by_id_prefix(provision_id):
    assert reg_key_of(provision_id) == "12"
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE['12'])}\n\n{REG_PROMPT_HINTS['12']}"
    assert "Regulation Number 12" in system


def test_reg12_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["12"]
    for marker in (
        "Regulation Number 12", "State-Only", "Part A", "Diesel Fleet Self-Certification",
        "Part B", "Diesel Opacity Inspection", "Air Pollution Control Division",
        "Department of Revenue", "fleet owner", "Excessive Violation", "program area",
        "twenty percent (20%) opacity", "model-year", "never invent a cutpoint",
        "Part C", "Part D", "SAE J1667", "40 C.F.R. Part 85, Subpart V", "Reserved",
    ):
        assert marker in hint, f"missing {marker!r} from reg 12 hint"
    assert len(hint.split()) <= 200


# --------------------------------------------------------------------------
# Batch 5: Regulation Number 27 (GHG emissions and energy management, GEMM 2)
# --------------------------------------------------------------------------

@pytest.mark.parametrize("provision_id", ["sec-27-B-I-A-3", "sec-27-D-IV-B-1", "sec-27-E-IV"])
def test_reg27_hint_selected_by_id_prefix(provision_id):
    assert reg_key_of(provision_id) == "27"
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE['27'])}\n\n{REG_PROMPT_HINTS['27']}"
    assert "Regulation Number 27" in system
    # Reg 27 has its own manufacturing-facility audience (Batch 5).
    assert "manufacturing" in system[:400]


def test_reg27_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["27"]
    for marker in (
        "Regulation Number 27", "GEMM 2", "TIER", "never name a facility",
        "October 2023 statement of basis", "verbatim", "Part A, Section II",
        "GHG credit", "EITE stationary source", "GHG BAECT", "APCD", "AQCC",
        "$89/mt", "25,000 metric tons", "5 % EITE", "Table 5", "50 % CHP",
        "as printed", "entries I and II", "pre-2023 Regulation Number 22",
        "not current sections", "Regulation Number 22, Part A",
        "Regulation Number 7, Part B, Section VII", "do not describe",
    ):
        assert marker in hint, f"missing {marker!r} from reg 27 hint"
    assert len(hint.split()) <= 200
    # Reg 27's hint must not leak into any other Colorado reg's prompt.
    for other in ("sec-7-B-I-C-1", "sec-22-A-I", "sec-25-B-I-A", "sec-30-B-I"):
        assert REG_PROMPT_HINTS["27"] not in system_prompt_for(other)


# --------------------------------------------------------------------------
# Batch 6: Air Quality Standards, Designations and Emission Budgets (key "aqs")
# --------------------------------------------------------------------------

@pytest.mark.parametrize("provision_id", ["sec-aqs-I-B-1", "sec-aqs-V-A-1", "sec-aqs-VIII-DD"])
def test_aqs_hint_and_audience_selected_by_id_prefix(provision_id):
    assert reg_key_of(provision_id) == "aqs"
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE['aqs'])}\n\n{REG_PROMPT_HINTS['aqs']}"
    assert "5 CCR 1001-14" in system
    assert "air-quality planner or permit engineer" in system[:300]
    # the Colorado O&G default audience is gone from this prompt
    assert DEFAULT_AUDIENCE not in system


def test_aqs_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["aqs"]
    for marker in (
        "5 CCR 1001-14", "not a numbered", "Air Quality Control Commission", "AQCC",
        "Air Pollution Control Division", "40 CFR Part 50", "Section I.B", "Section IV",
        "Eisenhower Tunnel", "State Only", "exactly as printed", "never converted",
        "700 micrograms per cubic meter", "three-hour maximum", ".076/km", "100 parts per million",
        "15 minute average", "Section III", "effective date", "boundary", "map", "Section V",
        "tons/day", "tons per summer day (tpsd)", "lbs./day", "verbatim", "Repealed", "Reserved",
        "[1]-[5]", "Section VII", "Section VIII", "not current requirements",
    ):
        assert marker in hint, f"missing {marker!r} from aqs hint"
    assert len(hint.split()) <= 200
    # never leaks into any other reg's prompt
    for other in ("sec-7-B-I-C-1", "sec-1-III-C-1", "sec-cp-I-G-1", "sec-25-B-I-A", "sec-ecmc-100-a"):
        assert REG_PROMPT_HINTS["aqs"] not in system_prompt_for(other)
        assert REG_AUDIENCE["aqs"] not in system_prompt_for(other)


def test_aqs_audience_names_the_real_reader():
    audience = REG_AUDIENCE["aqs"]
    assert "planner" in audience and "permit engineer" in audience
    assert "oil" not in audience


# --------------------------------------------------------------------------
# Batch 6 (agent_small): Reg 16, the SIP Local Elements document, Reg 18
# --------------------------------------------------------------------------

@pytest.mark.parametrize("provision_id,key", [
    ("sec-16-I-C-1-a", "16"), ("sec-16-II-C-4", "16"), ("sec-16-III-A", "16"),
    ("sec-sip-INTRODUCTION", "sip"), ("sec-sip-VIII-D-2", "sip"), ("sec-sip-I-B-2-a", "sip"),
    ("sec-18-I", "18"), ("sec-18-II-G", "18"),
])
def test_batch6_small_hint_and_audience_selected_by_id_prefix(provision_id, key):
    assert reg_key_of(provision_id) == key
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE[key])}\n\n{REG_PROMPT_HINTS[key]}"
    assert REG_AUDIENCE[key] in system[:400]
    assert DEFAULT_AUDIENCE not in system


def test_batch6_small_audiences_name_the_real_reader():
    assert REG_AUDIENCE["16"] == REG_AUDIENCE["sip"]
    assert "public-works" in REG_AUDIENCE["16"] and "PM10" in REG_AUDIENCE["16"]
    assert "electric utility" in REG_AUDIENCE["18"] and "combustion source" in REG_AUDIENCE["18"]
    for key in ("16", "sip", "18"):
        assert "oil" not in REG_AUDIENCE[key]


def test_reg16_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["16"]
    for marker in (
        "Regulation Number 16", "Denver PM10 attainment/maintenance area",
        "AIR program area", "2% fines", "45% durability index", "4% fines",
        "33% durability index", "angularity", "30%, 20%, 72%, 54% and 50%",
        "1989", "Percent Fines", "Durability Index", "Base Sanding Amount",
        "Foothills Area", "Air Pollution Control Division", "RAQC", "CDOT",
        "sand ;d during c :h", "III.A, III.B", "statements of basis",
        "never generalize",
    ):
        assert marker in hint, f"missing {marker!r} from reg 16 hint"


def test_sip_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["sip"]
    for marker in (
        "SIP Local Elements", "5 CCR 1001-20", "Pagosa Springs", "Telluride",
        "Aspen/Pitkin County", "Lamar", "Canon City", "Fort Collins",
        "Colorado Springs", "Steamboat Springs", "never write \"statewide\"",
        "1% fines", "2% fines", "30% durability index", "10%/15%",
        "#200 sieve", "ordinances", "incorporated by reference",
        "Statement of Basis", "VIII.F", "Reserved", "Repealed", "AQCC",
    ):
        assert marker in hint, f"missing {marker!r} from sip hint"


def test_reg18_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["18"]
    for marker in (
        "Regulation Number 18", "5 CCR 1001-22", "40 CFR Part 72", "Part 76",
        "July 1, 2011", "Title IV", "Acid Rain Program", "do not summarize",
        "not a compliance date", "Permitting authority", "Administrator",
        "Regulation Number 3", "delegated program", "not SIP revisions",
        "II.A-II.G", "statements of basis", "Air Quality Control Commission",
    ):
        assert marker in hint, f"missing {marker!r} from reg 18 hint"


@pytest.mark.parametrize("key", ["16", "sip", "18"])
def test_batch6_small_hints_within_200_words(key):
    assert len(REG_PROMPT_HINTS[key].split()) <= 200


def test_batch6_small_hints_do_not_leak_into_other_regs():
    for other in ("sec-7-B-I-C-1", "sec-1-III-A-1", "sec-9-IX-A", "sec-cp-I-G-1",
                  "sec-25-B-I-A", "sec-27-E-IV", "sec-ecmc-100", "sec-gp01-II-A"):
        system = system_prompt_for(other)
        for key in ("16", "sip", "18"):
            assert REG_PROMPT_HINTS[key] not in system
            assert REG_AUDIENCE[key] not in system
        for batch6_only in ("street sanding", "Acid Rain Program", "Pagosa Springs"):
            assert batch6_only not in system


def test_batch6_small_build_prompt_uses_hint_only_in_system():
    result = build_prompt(_row("sec-sip-VIII-B-2-a"), {})
    assert result.system == f"{SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE['sip'])}\n\n{REG_PROMPT_HINTS['sip']}"
    assert REG_PROMPT_HINTS["sip"] not in result.prompt


# --------------------------------------------------------------------------
# Batch 6: Regulation Number 19 (The Control of Lead Hazards)
# --------------------------------------------------------------------------

@pytest.mark.parametrize("provision_id", ["sec-19-A-III-B-5-a", "sec-19-B-III-A-1", "sec-19-C-V", "sec-19-A-APPENDIX-A"])
def test_reg19_hint_selected_by_id_prefix(provision_id):
    assert reg_key_of(provision_id) == "19"
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE['19'])}\n\n{REG_PROMPT_HINTS['19']}"
    assert "Regulation Number 19" in system
    # Reg 19's reader is the lead-based-paint trade, not oil and gas.
    assert REG_AUDIENCE["19"] == "a lead-based-paint contractor, inspector, risk assessor or renovator in Colorado"
    assert "lead-based-paint contractor" in system[:300]
    assert DEFAULT_AUDIENCE not in system


def test_reg19_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["19"]
    for marker in (
        "Regulation Number 19", "5 CCR 1001-23", "Part A", "Part B", "pre-renovation education",
        "\"Division\" is CDPHE's Air Pollution Control Division", "II.B.28.", "\"Commission\" the AQCC",
        "\"Department\" is not a defined term", "target housing", "child-occupied facility",
        "abatement (not renovation)", "LAF/LEF", "inspector, risk assessor, supervisor, worker, project designer",
        "Part A, Section II", "course hours", "every 3 or 5 years", "$180 per year", "$600", "$1,500",
        "notification fee bands", "ug/ft2", "Appendix A", "exactly as printed", "never round, convert or interpolate",
        "40 CFR Part 745", "name it, do not describe it", "SAMPLE", "Part C is rulemaking history",
        "\"PART A.\"/\"PART B.\"", "III.B.4. is Reserved",
    ):
        assert marker in hint, f"missing {marker!r} from reg 19 hint"
    assert len(hint.split()) <= 200
    # Reg 19's hint and audience must not leak into any other reg's prompt.
    for other in ("sec-7-B-I-C-1", "sec-22-A-I", "sec-25-B-I-A", "sec-30-B-I", "sec-11-F-I-A", "sec-ecmc-100-a"):
        assert REG_PROMPT_HINTS["19"] not in system_prompt_for(other)
        assert REG_AUDIENCE["19"] not in system_prompt_for(other)


def test_reg19_hint_never_names_the_division_as_the_department():
    hint = REG_PROMPT_HINTS["19"]
    assert "Division\" is the Department" not in hint
    assert "Air Pollution Control Division" in hint


# --------------------------------------------------------------------------
# Batch 6: Regulation Number 20 (Colorado Clean Cars and Trucks)
# --------------------------------------------------------------------------

@pytest.mark.parametrize("provision_id", ["sec-20-A-II-AA", "sec-20-D-V-A-3-b-1", "sec-20-H-TABLE-1", "sec-20-I-V"])
def test_reg20_hint_selected_by_id_prefix(provision_id):
    assert reg_key_of(provision_id) == "20"
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE['20'])}\n\n{REG_PROMPT_HINTS['20']}"
    assert "Regulation Number 20" in system
    # Reg 20's audience is vehicle manufacturers / dealers / fleets, not oil and gas.
    assert "vehicle manufacturer, dealer or fleet compliance manager" in system[:400]
    assert DEFAULT_AUDIENCE not in system


def test_reg20_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["20"]
    for marker in (
        "Regulation Number 20", "Clean Cars", "California Code of Regulations, Title", "incorporated by reference",
        "Part H, Table 1", "13 CCR 1962.4", "never describe or guess the California text",
        "never invent a percentage", "\"California\" means Colorado", "CDPHE", "Executive Officer",
        "Executive Director", "\"Department\" is CDPHE", "model-year", "2022 through 2025 and 2027 through 2032",
        "8,500 lbs", "14,001 lbs", "36 percent", "23 percent", "exactly as printed",
        "Part B (LEV)", "Part D (ZEV", "Part E (HD Low NOx", "Part F (ACT)", "Part G", "Large Entity Reporting",
        "ZEV, TZEV, NZEV, PHEV, BEVx, FCEV, NEV", "Part G, Section VI", "Part H rows", "Part I rows",
        "rulemaking history",
    ):
        assert marker in hint, f"missing {marker!r} from reg 20 hint"
    assert len(hint.split()) <= 200
    # Reg 20's hint must not leak into any other regulation's prompt.
    for other in ("sec-7-B-I-C-1", "sec-11-F-III-C", "sec-12-A-I-B-8", "sec-25-B-I-A", "sec-27-B-I-A-3", "sec-2-B-IX-B-3"):
        assert REG_PROMPT_HINTS["20"] not in system_prompt_for(other)
        assert REG_AUDIENCE["20"] not in system_prompt_for(other)


# --------------------------------------------------------------------------
# Batch 6: Regulation Number 21 (consumer products and AIM coatings VOC limits)
# --------------------------------------------------------------------------

@pytest.mark.parametrize("provision_id", ["sec-21-A-II-O", "sec-21-A-VI-XXXX", "sec-21-B-II-F", "sec-21-C-I"])
def test_reg21_hint_selected_by_id_prefix(provision_id):
    assert reg_key_of(provision_id) == "21"
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE['21'])}\n\n{REG_PROMPT_HINTS['21']}"
    assert "Regulation Number 21" in system
    # Reg 21 has its own product-seller audience (Batch 6), not the
    # stationary-source default.
    assert REG_AUDIENCE["21"] in system[:400]
    assert "manufacturer, distributor or retailer" in system[:400]
    assert DEFAULT_AUDIENCE not in system[:400]


def test_reg21_audience_names_the_real_reader():
    audience = REG_AUDIENCE["21"]
    for word in ("manufacturer", "distributor", "retailer", "consumer products", "architectural coatings", "Colorado"):
        assert word in audience
    assert "oil and gas" not in audience


def test_reg21_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["21"]
    for marker in (
        "Regulation Number 21", "consumer products, Part A", "(AIM) coatings, Part B",
        "8-hour Ozone Control Area", "northern Weld County", "(State Only)",
        "units printed", "percent VOC by weight", "grams per liter",
        "May 1, 2020", "60 days after an EPA finding", "May 1, 2021",
        "Point to a table", "Section VI", "Parts A and B define terms separately",
        "LVP-VOC", "Table B compound", "HVOC", "MVOC", "ACP",
        "CARB Method 310", "EPA Method 24", "Title 17", "name them, never describe them",
        "Air Pollution Control Division", "AQCC", "Part C rows are rulemaking history",
    ):
        assert marker in hint, f"missing {marker!r} from reg 21 hint"
    assert len(hint.split()) <= 200
    # Reg 21's hint must not leak into any other Colorado reg's prompt.
    for other in ("sec-7-B-I-C-1", "sec-22-A-I", "sec-25-B-I-A", "sec-27-B-I-A-3", "sec-30-B-I"):
        assert REG_PROMPT_HINTS["21"] not in system_prompt_for(other)
        assert REG_AUDIENCE["21"] not in system_prompt_for(other)


def test_reg21_build_prompt_system_matches_row_reg():
    result = build_prompt(_row("sec-21-A-VI-QQQQQQQ"), meta={})
    assert result.system == system_prompt_for("sec-21-A-VI-QQQQQQQ")
    assert result.system.endswith(REG_PROMPT_HINTS["21"])
    assert REG_PROMPT_HINTS["21"] not in result.prompt
