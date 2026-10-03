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
    # Batch 7 merge: all eight new keys name their own reader — "proc" (the
    # AQCC Procedural Rules) the people appearing before the Commission, 4
    # stove/fireplace retailers and homeowners, 10 transportation planners,
    # 15 A/C and refrigeration technicians, 23 power-plant and large
    # industrial environmental managers, 28 building owners, 29 public-entity
    # grounds and fleet managers, 31 landfill operators. None of them is the
    # oil-and-gas default.
    assert set(REG_AUDIENCE) == {"11", "12", "25", "27", "aqs", "16", "sip", "18", "19", "20", "21",
                                 "proc", "4", "10", "15", "23", "28", "29", "31"}
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
        text = "ok."

    class _Message:
        content = [_Block()]
        usage = _Usage()

    class _Messages:
        def create(self, **kwargs):
            if "temperature" in kwargs:
                raise TypeError("Messages.create() got an unexpected keyword argument 'temperature'")
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


# --------------------------------------------------------------------------
# Batch 7: the AQCC Procedural Rules (key "proc")
# --------------------------------------------------------------------------

@pytest.mark.parametrize("provision_id", [
    "sec-proc-A-III-D", "sec-proc-B-V-E-3", "sec-proc-B-VI-C-12", "sec-proc-B-XII-I",
])
def test_proc_hint_and_audience_selected_by_id_prefix(provision_id):
    assert reg_key_of(provision_id) == "proc"
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE['proc'])}\n\n{REG_PROMPT_HINTS['proc']}"
    assert "5 CCR 1001-1" in system
    assert REG_AUDIENCE["proc"] in system[:400]
    assert DEFAULT_AUDIENCE not in system[:400]


def test_proc_audience_names_the_real_reader():
    audience = REG_AUDIENCE["proc"]
    for word in ("appearing before", "Air Quality Control Commission", "rulemaking", "adjudication"):
        assert word in audience
    assert "oil and gas" not in audience


def test_proc_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["proc"]
    for marker in (
        "5 CCR 1001-1", "not a pollution-control rule",
        "Air Quality Control Commission (AQCC)", "Air Pollution Control Division (APCD)",
        "Section III of this same part defines them",
        '"Hearing Officer" is never defined here',
        "24-4-101 et seq., C.R.S.", "State Administrative Procedure Act",
        "25-7-101 et seq., C.R.S.", "never describe what they require",
        "deadline", "days or working days", "page limit", "copy count",
        "time allotment", "exactly as printed",
        "Section XII rows are rulemaking history",
    ):
        assert marker in hint, f"missing {marker!r} from proc hint"
    assert len(hint.split()) <= 200


def test_proc_hint_forbids_restating_the_part_a_part_b_date_split():
    """Batch 6's Reg 21 lesson: the hint must tell the model NOT to repeat or
    infer the applicability/date scope on rows that do not state it."""
    hint = REG_PROMPT_HINTS["proc"]
    assert (
        "The August 1, 2025 split between Part A and Part B is stated on the "
        "two PART rows and nowhere else: never repeat it, name a part, or add "
        "a date window on any other row."
    ) in hint
    # ... and it must NOT invite the opposite behaviour
    for forbidden in ("state which part applies", "state the applicability",
                      "note whether the row is in Part A or Part B"):
        assert forbidden not in hint


def test_proc_hint_does_not_name_terms_the_document_never_defines():
    # "Presiding Officer" does not appear anywhere in REG_PROC.txt.
    assert "Presiding Officer" not in REG_PROMPT_HINTS["proc"]


def test_proc_hint_does_not_leak_into_other_regs():
    for other in ("sec-7-B-I-C-1", "sec-26-B-III", "sec-25-B-I-A", "sec-30-B-I",
                  "sec-aqs-V-A-1", "sec-ecmc-100-a", "sec-1-III-C-1"):
        system = system_prompt_for(other)
        assert REG_PROMPT_HINTS["proc"] not in system
        assert REG_AUDIENCE["proc"] not in system


def test_proc_build_prompt_system_matches_row_reg():
    result = build_prompt(_row("sec-proc-B-V-D-5-a-(iii)"), meta={})
    assert result.system == system_prompt_for("sec-proc-B-V-D-5-a-(iii)")
    assert result.system.endswith(REG_PROMPT_HINTS["proc"])
    assert REG_PROMPT_HINTS["proc"] not in result.prompt


# --------------------------------------------------------------------------
# Batch 7: Regulation Number 4 (wood-burning appliances, 5 CCR 1001-6)
# --------------------------------------------------------------------------


def test_reg4_hint_selected_by_id_prefix():
    for provision_id in ("sec-4-B-I-A-19", "sec-4-A-I", "sec-4-C-XI-A",
                         "sec-4-C-APPENDIX-A-5.5.12.1.1"):
        system = system_prompt_for(provision_id)
        assert system.endswith(REG_PROMPT_HINTS["4"])
        assert "Regulation Number 4" in system


def test_reg4_audience_names_the_real_reader():
    audience = REG_AUDIENCE["4"]
    for word in ("stove", "fireplace", "retailer", "installer", "homeowner",
                 "Colorado", "high-pollution"):
        assert word in audience
    assert "oil & gas" not in audience and "oil and gas" not in audience
    system = system_prompt_for("sec-4-B-II-A-1")
    assert audience in system[:400]
    assert DEFAULT_AUDIENCE not in system[:400]


def test_reg4_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["4"]
    for marker in (
        "Regulation Number 4", "5 CCR 1001-6",
        "Part A, Section I states the applicability",
        "state-only basis for carbon monoxide", "October 15, 2024",
        "(State Only)", "Air Quality Control Commission",
        "Air Pollution Control Division", "Phase III Certified",
        "exempt device", "approved pellet stove", "approved masonry heater",
        "high pollution day", "burn down time", "primary source of heat",
        "Section I.A", "40 CFR Part 60 Subpart AAA", "Methods 5G, 5H, 28 and 28A",
        "never describe what they require", "4.1 grams per hour",
        "Give exemptions only as listed", "Section IX", "Section X and Part C",
        "rulemaking history", "Appendix A is a laboratory test protocol",
    ):
        assert marker in hint, f"missing {marker!r} from reg 4 hint"
    assert len(hint.split()) <= 200


def test_reg4_hint_forbids_restating_applicability_on_other_rows():
    """Batch 6's Reg 21 lesson: a hint that invites the model to state
    applicability per row makes it GUESS one. Reg 4's hint must pin
    applicability to Part A Section I and forbid it everywhere else."""
    hint = REG_PROMPT_HINTS["4"]
    assert "Do not repeat or infer applicability, scope, geography or an "\
           "effective date on any other row" in hint
    assert "name an area, county or date only when that row's own text names it" in hint
    for banned in ("state applicability per part", "state the applicability of each"):
        assert banned not in hint


def test_reg4_hint_does_not_leak_into_other_regs():
    for other in ("sec-7-B-I-C-1", "sec-3-A-I", "sec-25-B-I-A",
                  "sec-26-B-I-D-5-d-(ii)", "sec-1-III-D-2-b-(ii)"):
        system = system_prompt_for(other)
        assert REG_PROMPT_HINTS["4"] not in system
        assert REG_AUDIENCE["4"] not in system


def test_reg4_build_prompt_system_matches_row_reg():
    result = build_prompt(_row("sec-4-B-VII-E-1"), meta={})
    assert result.system == system_prompt_for("sec-4-B-VII-E-1")
    assert result.system.endswith(REG_PROMPT_HINTS["4"])
    assert REG_PROMPT_HINTS["4"] not in result.prompt


# --------------------------------------------------------------------------
# Batch 7: Reg 10 (transportation conformity), Reg 15 (ozone-depleting
# compounds) and Reg 29 (lawn and garden equipment) -- agent_small7.
#
# The START_HERE lesson these tests exist to lock in: after Reg 21's audience
# hint told the model to "state applicability per part", it prepended a
# guessed geographic scope tag to ~60% of rows and 186 had to be corrected by
# hand. None of these three hints may ask for applicability, scope, geography
# or an effective date to be restated on rows that do not state them.
# --------------------------------------------------------------------------

_BATCH7_SMALL_KEYS = ("10", "15", "29")


@pytest.mark.parametrize("provision_id, key", [
    ("sec-10-I-A", "10"),
    ("sec-10-III-A-3-c", "10"),
    ("sec-10-VI-D", "10"),
    ("sec-15-I-G", "15"),
    ("sec-15-IV-A-1", "15"),
    ("sec-15-VI-B", "15"),
    ("sec-29-A-I-C", "29"),
    ("sec-29-A-III-B", "29"),
    ("sec-29-B-I", "29"),
])
def test_batch7_small_hint_selected_by_id_prefix(provision_id, key):
    assert reg_key_of(provision_id) == key
    system = system_prompt_for(provision_id)
    base = SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE[key])
    assert system == f"{base}\n\n{REG_PROMPT_HINTS[key]}"
    assert REG_AUDIENCE[key] in system[:400]
    assert DEFAULT_AUDIENCE not in system[:400]


def test_reg10_audience_names_the_real_reader():
    audience = REG_AUDIENCE["10"]
    for word in ("transportation planner", "metropolitan planning organization",
                 "conformity", "Colorado"):
        assert word in audience
    assert "oil" not in audience


def test_reg15_audience_names_the_real_reader():
    audience = REG_AUDIENCE["15"]
    for word in ("air-conditioning", "refrigeration", "technician", "Colorado"):
        assert word in audience
    assert "oil" not in audience


def test_reg29_audience_names_the_real_reader():
    audience = REG_AUDIENCE["29"]
    for word in ("fleet", "grounds manager", "lawn and garden", "Colorado"):
        assert word in audience
    assert "oil" not in audience


def test_reg10_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["10"]
    for marker in (
        "Regulation Number 10", "40 CFR Part 93 Subpart A", "93.105",
        "93.122(a)(4)(ii)", "93.125(c)", "51.390",
        "name the citation, never describe what the federal rule requires",
        "Section II's defined terms", "CDOT", "Lead Planning Agency (LPA)",
        "metropolitan planning organization (MPO)",
        "Transportation Planning Region (TPR)", "Hot Spot Analysis",
        "routine conformity determination", "Air Quality Control Commission",
        "Air Pollution Control Division",
        "never move one agency's duty to another",
        "TCM, TIP, SIP, FHWA, FTA and EPA",
        "Section VI rows are rulemaking history",
        "ignore the trailing Editor's Notes revision history",
    ):
        assert marker in hint, f"missing {marker!r} from reg 10 hint"
    assert len(hint.split()) <= 200


def test_reg15_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["15"]
    for marker in (
        "Regulation Number 15", "Air Conditioning and Refrigeration Service",
        "Product Refrigeration System", "Refrigerated Food Appliance",
        "Refrigerated Food Facility", "Stationary Appliance",
        "100 horsepower or greater", "40 CFR Part 82 Subparts B and F",
        "42 USC 7671g", "62 Fed. Reg. 68026",
        "name them, never describe their contents",
        "Quote every fee, cap, pound threshold and filing window",
        "Air Pollution Control Division", "Air Quality Control Commission",
        "Section VI rows are rulemaking history",
        "ignore the trailing Editor's Notes revision history",
    ):
        assert marker in hint, f"missing {marker!r} from reg 15 hint"
    assert len(hint.split()) <= 200


def test_reg29_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["29"]
    for marker in (
        "Regulation Number 29", "Part A Section I", "Section I.B exemptions",
        "Section II defines", "ozone nonattainment area", "special district",
        "state government agency",
        "III.A covers state government agencies", "19 kW (25 horsepower)",
        "III.B covers the federal government and local governments",
        "7 kW (10 horsepower)", "June 1 - August 31",
        "Part B is rulemaking history",
        "ignore the trailing Editor's Notes revision history",
    ):
        assert marker in hint, f"missing {marker!r} from reg 29 hint"
    assert len(hint.split()) <= 200


@pytest.mark.parametrize("key", _BATCH7_SMALL_KEYS)
def test_batch7_small_hints_never_ask_to_restate_applicability(key):
    """The Reg 21 failure mode: a hint that tells the model to state
    applicability/scope on every row makes it guess one. Each of these three
    hints must instead FORBID adding a scope, area or date a row does not
    print."""
    hint = REG_PROMPT_HINTS[key]
    lowered = hint.lower()
    for banned in (
        "state applicability", "state the applicability",
        "state its applicability", "state which area",
        "state the scope", "state where it applies",
        "always say which area", "note the applicability",
    ):
        assert banned not in lowered, f"reg {key} hint asks for applicability to be restated"
    assert "a row does not itself" in hint or "a row does not itself name" in hint
    assert "never" in lowered


@pytest.mark.parametrize("key", _BATCH7_SMALL_KEYS)
def test_batch7_small_hint_forbids_inventing_an_area_or_date(key):
    hint = REG_PROMPT_HINTS[key]
    assert "never add" in hint or "never write" in hint
    for word in ("area", "date"):
        assert word in hint


@pytest.mark.parametrize("key", _BATCH7_SMALL_KEYS)
def test_batch7_small_hints_reasonably_short(key):
    assert len(REG_PROMPT_HINTS[key].split()) <= 200


@pytest.mark.parametrize("key", _BATCH7_SMALL_KEYS)
def test_batch7_small_hints_do_not_leak_into_other_regs(key):
    for other in ("sec-7-B-I-C-1", "sec-22-A-I", "sec-25-B-I-A",
                  "sec-21-A-II-O", "sec-30-B-I", "sec-9-II-A"):
        system = system_prompt_for(other)
        assert REG_PROMPT_HINTS[key] not in system
        assert REG_AUDIENCE[key] not in system


@pytest.mark.parametrize("key", _BATCH7_SMALL_KEYS)
def test_batch7_small_hints_are_distinct(key):
    others = [REG_PROMPT_HINTS[k] for k in _BATCH7_SMALL_KEYS if k != key]
    assert REG_PROMPT_HINTS[key] not in others


@pytest.mark.parametrize("provision_id, key", [
    ("sec-10-III-H-4-c", "10"),
    ("sec-15-V-A-2", "15"),
    ("sec-29-A-IV-B-3-b", "29"),
])
def test_batch7_small_build_prompt_system_matches_row_reg(provision_id, key):
    result = build_prompt(_row(provision_id), meta={})
    assert result.system == system_prompt_for(provision_id)
    assert result.system.endswith(REG_PROMPT_HINTS[key])
    assert REG_PROMPT_HINTS[key] not in result.prompt


# --------------------------------------------------------------------------
# Batch 7: Regulation Number 23 (Regional Haze Limits, 5 CCR 1001-27)
# --------------------------------------------------------------------------

@pytest.mark.parametrize("provision_id", [
    "sec-23-A-I", "sec-23-A-II-M", "sec-23-A-IV-A-2", "sec-23-A-V-A-1-b-(i)-(C)", "sec-23-B-II",
])
def test_reg23_hint_selected_by_id_prefix(provision_id):
    assert reg_key_of(provision_id) == "23"
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE['23'])}\n\n{REG_PROMPT_HINTS['23']}"
    assert "Regulation Number 23" in system
    assert REG_AUDIENCE["23"] in system[:400]
    assert DEFAULT_AUDIENCE not in system[:400]


def test_reg23_audience_names_the_real_reader():
    audience = REG_AUDIENCE["23"]
    for word in ("environmental manager", "Colorado", "power plant", "industrial source", "regional haze"):
        assert word in audience
    assert "oil & gas" not in audience and "oil and gas" not in audience


def test_reg23_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["23"]
    for marker in (
        "Regulation Number 23", "Regional Haze Limits",
        "Section I states applicability",
        "Regional Haze State Implementation Plan", "State-Only",
        "Section II defines BART", "Reasonable Progress (RP)",
        "Existing Stationary Facility", "deciview",
        "Section IV sets limits for named units in tables",
        "lb/MMBtu", "tons per year", "ppmvd", "lb/ton of clinker", "grains/dscf",
        "averaging period", "exactly as printed",
        "empty table cell means no printed limit",
        "40 CFR Parts 51, 60, 63, 64 and 75", "name them, never describe them",
        "Air Quality Control Commission", "Air Pollution Control Division",
        "Colorado Public Utilities Commission",
        "Part B rows are rulemaking history",
    ):
        assert marker in hint, f"missing {marker!r} from reg 23 hint"
    assert len(hint.split()) <= 200
    # Reg 23's hint must not leak into any other regulation's prompt.
    for other in ("sec-7-B-I-C-1", "sec-3-A-I", "sec-22-A-I", "sec-25-B-I-A",
                  "sec-26-B-I", "sec-2-B-IX-B-3", "sec-ecmc-100-a"):
        assert REG_PROMPT_HINTS["23"] not in system_prompt_for(other)
        assert REG_AUDIENCE["23"] not in system_prompt_for(other)


def test_reg23_hint_never_asks_for_applicability_on_other_rows():
    """Batch 6's Reg 21 lesson: a hint that tells the model to state
    applicability per row makes it invent a scope tag on rows that state
    none. Reg 23's hint must say the opposite, once, and nowhere ask for a
    restatement."""
    hint = REG_PROMPT_HINTS["23"]
    assert ("do not repeat or infer applicability, scope, geography, the "
            "SIP/State-Only split or an effective date on any other row") in hint
    for banned in ("state applicability", "state the applicability",
                   "say which area", "name the area", "add the scope",
                   "state the scope", "restate"):
        assert banned not in hint.lower(), banned


def test_reg23_build_prompt_system_matches_row_reg():
    result = build_prompt(_row("sec-23-A-IV-F-3"), meta={})
    assert result.system == system_prompt_for("sec-23-A-IV-F-3")
    assert result.system.endswith(REG_PROMPT_HINTS["23"])
    assert REG_PROMPT_HINTS["23"] not in result.prompt


# --------------------------------------------------------------------------
# Batch 7: Regulation Number 28 (building benchmarking and performance
# standards, 5 CCR 1001-32)
# --------------------------------------------------------------------------

@pytest.mark.parametrize("provision_id", ["sec-28-A-II-A", "sec-28-A-III-O", "sec-28-C-I-B-2-a-(iv)", "sec-28-F-I"])
def test_reg28_hint_selected_by_id_prefix(provision_id):
    assert reg_key_of(provision_id) == "28"
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE['28'])}\n\n{REG_PROMPT_HINTS['28']}"
    assert "Regulation Number 28" in system
    assert REG_AUDIENCE["28"] in system[:400]
    assert DEFAULT_AUDIENCE not in system[:400]


def test_reg28_audience_names_the_real_reader():
    audience = REG_AUDIENCE["28"]
    for word in ("owner", "property manager", "commercial", "multifamily", "Colorado"):
        assert word in audience
    assert "oil and gas" not in audience


def test_reg28_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["28"]
    for marker in (
        "Regulation Number 28", "5 CCR 1001-32", "Colorado Energy Office",
        "never a chief executive officer", "Air Pollution Control Division", "AQCC",
        "Covered building", "public building", "under-resourced building",
        "building owner", "gross floor area", "benchmarking tool", "site EUI",
        "weather-normalized", "square-footage threshold", "fee",
        "civil-penalty amount", "never round or convert",
        "Part C, Table 1", "point to the table rather than restating a value",
        "never apply one property type's target to another",
        "ENERGY STAR Portfolio Manager", "Building Emissions Calculator",
        "name them, do not describe them",
        "Part F rows are rulemaking history",
    ):
        assert marker in hint, f"missing {marker!r} from reg 28 hint"
    assert len(hint.split()) <= 200


def test_reg28_hint_confines_applicability_to_its_own_section():
    """The Batch 6 lesson (START_HERE.md): Reg 21's hint told the model to
    "state applicability per part" and it prepended a guessed scope tag to
    ~60% of rows. Reg 28's hint must name where applicability and the
    definitions live and forbid repeating or inferring them anywhere else."""
    hint = REG_PROMPT_HINTS["28"]
    assert "Part A, Section II states applicability and Part A, Section III defines every term" in hint
    assert ("do not repeat or infer applicability, coverage, an exemption or a definition "
            "on any other row") in hint
    assert "describe only what the row in front of you says" in hint
    # ...and it must not ask for applicability/scope to be restated.
    for banned in ("state applicability", "state the applicability", "state who it applies to",
                   "say where it applies", "statewide"):
        assert banned not in hint, banned


def test_reg28_hint_does_not_leak_into_other_regs():
    for other in ("sec-7-B-I-C-1", "sec-22-A-I", "sec-25-B-I-A", "sec-27-B-I-A-3",
                  "sec-30-B-I", "sec-21-A-II-O"):
        assert REG_PROMPT_HINTS["28"] not in system_prompt_for(other)
        assert REG_AUDIENCE["28"] not in system_prompt_for(other)


def test_reg28_build_prompt_system_matches_row_reg():
    result = build_prompt(_row("sec-28-C-I-A-1"), meta={})
    assert result.system == system_prompt_for("sec-28-C-I-A-1")
    assert result.system.endswith(REG_PROMPT_HINTS["28"])
    assert REG_PROMPT_HINTS["28"] not in result.prompt


# --------------------------------------------------------------------------
# Batch 7: Regulation Number 31 (methane from municipal solid waste landfills)
# --------------------------------------------------------------------------

@pytest.mark.parametrize(
    "provision_id",
    ["sec-31-A-II-A", "sec-31-A-IV-GG", "sec-31-C-III-B-9", "sec-31-D-I-C-2-d", "sec-31-K-I"],
)
def test_reg31_hint_selected_by_id_prefix(provision_id):
    assert reg_key_of(provision_id) == "31"
    system = system_prompt_for(provision_id)
    assert system == f"{SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE['31'])}\n\n{REG_PROMPT_HINTS['31']}"
    assert "Regulation Number 31" in system
    # Reg 31 has its own landfill-operator audience, not the oil & gas default.
    assert REG_AUDIENCE["31"] in system[:400]
    assert "municipal solid waste landfill" in system[:400]
    assert DEFAULT_AUDIENCE not in system[:400]


def test_reg31_audience_names_the_real_reader():
    audience = REG_AUDIENCE["31"]
    for word in ("operator", "municipal solid waste landfill", "Colorado"):
        assert word in audience
    assert "oil and gas" not in audience
    assert "oil & gas" not in audience


def test_reg31_hint_covers_required_points():
    hint = REG_PROMPT_HINTS["31"]
    for marker in (
        "Regulation Number 31",
        "Part A, Section II states applicability",
        "Section III the exemptions",
        "Part A, Section IV defines",
        "GCCS", "component leak", "waste-in-place", "ppmv and ppm-m",
        "450,000 short tons", "500 ppm", "200 ppmv", "25-foot and 100-foot spacing",
        "the owner or operator",
        "AQCC", "APCD", "Hazardous Materials and Waste Management Division",
        "40 CFR Part 60 Subparts Cf and XXX", "40 CFR Part 63 Subpart AAAA",
        "40 CFR Part 98", "EPA Methods 3A, 3C, 18, 21 and 25C",
        "name them, never describe them",
        "Part K is rulemaking history",
    ):
        assert marker in hint, f"missing {marker!r} from reg 31 hint"
    assert len(hint.split()) <= 200


def test_reg31_hint_forbids_restating_applicability_on_other_rows():
    """The Batch 6 Reg 21 lesson: a hint that invites the model to restate
    applicability/scope produces guessed scope tags on rows that never say
    it. Reg 31's hint must say the opposite, in so many words."""
    hint = REG_PROMPT_HINTS["31"]
    assert "do not repeat or infer applicability, scope or a date on any other row" in hint
    assert "if a row does not say whom or where it covers, say nothing about that" in hint
    # and it must not tell the model to state applicability per row/part
    for forbidden in ("state applicability", "state the applicability",
                      "say whether it applies statewide", "name the area"):
        assert forbidden not in hint


def test_reg31_hint_does_not_leak_into_other_regs():
    for other in ("sec-7-B-I-C-1", "sec-22-A-I", "sec-25-B-I-A", "sec-26-A-I-A",
                  "sec-30-B-I", "sec-ecmc-100-DEF-OPERATOR", "sec-21-A-VI-XXXX"):
        system = system_prompt_for(other)
        assert REG_PROMPT_HINTS["31"] not in system
        assert REG_AUDIENCE["31"] not in system


def test_reg31_build_prompt_system_matches_row_reg():
    result = build_prompt(_row("sec-31-D-I-C-2"), meta={})
    assert result.system == system_prompt_for("sec-31-D-I-C-2")
    assert result.system.endswith(REG_PROMPT_HINTS["31"])
    assert REG_PROMPT_HINTS["31"] not in result.prompt


# ==========================================================================
# Phase 0 (Sept 30 2026): parent summaries regenerated from parent +
# descendants -- descendants block, outline mode, hedging guard, write-back,
# --parents selector.
# ==========================================================================

from summarize import (  # noqa: E402
    CHILD_TEXT_WORDS,
    HEDGING_RETRY_LINE,
    PromptResult,
    build_children_index,
    build_descendants,
    guard_and_write,
    is_hedging,
    iter_candidates,
    write_summary,
)


def _node(provision_id, parent_id, citation, title, text, sort_order):
    return {
        "id": provision_id, "parent_id": parent_id, "citation": citation,
        "title": title, "full_text": f"<p>{text}</p>", "sort_order": sort_order,
    }


def _reg6_tree() -> dict[str, dict]:
    """Reg 6 I.C.2.b: a chapeau with two children, one of which has a
    grandchild, plus an unrelated sibling that must never appear."""
    long_body = " ".join(["must"] * 30)
    rows = [
        _node("sec-6-top-REG-6", None, "Reg 6", "Standards of Performance", "root", 0),
        _node("sec-6-B-I-C-2", "sec-6-top-REG-6", "I.C.2.", "Emission factors",
              "Owners must demonstrate compliance", 10),
        _node("sec-6-B-I-C-2-b", "sec-6-B-I-C-2", "I.C.2.b.", "",
              f"The owner or operator {long_body} comply with one of the following:", 20),
        _node("sec-6-B-I-C-2-b-(ii)", "sec-6-B-I-C-2-b", "I.C.2.b.(ii).", "",
              "Division approved testing under representative conditions.", 22),
        _node("sec-6-B-I-C-2-b-(i)", "sec-6-B-I-C-2-b", "I.C.2.b.(i).", "",
              "Manufacturer certified emission factors; or", 21),
        _node("sec-6-B-I-C-2-b-(i)-(A)", "sec-6-B-I-C-2-b-(i)", "I.C.2.b.(i)(A).", "",
              "Factors must be current.", 23),
        _node("sec-6-B-I-C-2-c", "sec-6-B-I-C-2", "I.C.2.c.", "", "Unrelated sibling text.", 30),
    ]
    return {r["id"]: r for r in rows}


def test_children_index_orders_by_sort_order():
    index = build_children_index(_reg6_tree())
    assert [c["id"] for c in index["sec-6-B-I-C-2-b"]] == [
        "sec-6-B-I-C-2-b-(i)", "sec-6-B-I-C-2-b-(ii)",
    ]
    assert "sec-6-B-I-C-2-b-(i)-(A)" not in index["sec-6-B-I-C-2-b"]  # grandchild, not child


def test_build_descendants_depth_first_reading_order():
    meta = _reg6_tree()
    descendants = build_descendants(meta["sec-6-B-I-C-2-b"], meta)
    assert [(d["citation"], d["depth"]) for d in descendants] == [
        ("I.C.2.b.(i).", 1), ("I.C.2.b.(i)(A).", 2), ("I.C.2.b.(ii).", 1),
    ]
    assert descendants[0]["text"] == "Manufacturer certified emission factors; or"


def test_prompt_lists_descendants_in_order_after_provision_text():
    meta = _reg6_tree()
    result = build_prompt(meta["sec-6-B-I-C-2-b"], meta)
    prompt = result.prompt
    block = prompt.index("Provisions inside this one (its children, in order):")
    assert block > prompt.index("Provision text:")
    i = prompt.index("I.C.2.b.(i). Manufacturer certified emission factors; or")
    a = prompt.index("  I.C.2.b.(i)(A). Factors must be current.")
    ii = prompt.index("I.C.2.b.(ii). Division approved testing under representative conditions.")
    assert block < i < a < ii
    assert "Unrelated sibling" not in prompt
    assert result.descendant_count == 3
    assert result.outline_mode is False
    assert result.descendant_word_count == 5 + 4 + 6
    assert "bodies omitted" not in prompt


def test_prompt_has_no_descendants_block_for_a_leaf():
    meta = _reg6_tree()
    result = build_prompt(meta["sec-6-B-I-C-2-b-(ii)"], meta)
    assert "Provisions inside this one" not in result.prompt
    assert result.descendant_count == 0
    # and a caller with no children index at all still gets the old shape
    assert build_prompt(_row("sec-6-A-SUBPART-Kb"), meta={}).descendant_count == 0


def test_outline_mode_over_the_word_budget():
    meta = _reg6_tree()
    parent = meta["sec-6-B-I-C-2-b"]
    # Two direct children, one titled and one not, whose bodies together
    # exceed CHILD_TEXT_WORDS.
    half = " ".join(["body"] * (CHILD_TEXT_WORDS // 2 + 10))
    meta["sec-6-B-I-C-2-b-(i)"]["full_text"] = f"<p>{half}</p>"
    meta["sec-6-B-I-C-2-b-(i)"]["title"] = "Certified factors"
    meta["sec-6-B-I-C-2-b-(ii)"]["full_text"] = "<p>" + " ".join(f"w{n}" for n in range(CHILD_TEXT_WORDS)) + "</p>"
    result = build_prompt(parent, meta)
    assert result.outline_mode is True
    assert result.descendant_word_count == 0
    assert "I.C.2.b.(i). Certified factors" in result.prompt
    # untitled: first 12 words of its text, then an ellipsis
    assert "I.C.2.b.(ii). " + " ".join(f"w{n}" for n in range(12)) + "…" in result.prompt
    assert "body body body" not in result.prompt
    assert ("[3 provisions inside; bodies omitted for length — summarize what this "
            "provision introduces and say the detail is in the listed items]") in result.prompt


def test_system_prompt_carries_the_descendants_rule_for_every_family():
    rule = (
        "The provision text may be an introduction whose substance is in the "
        "provisions listed under \"Provisions inside this one\". Summarize what "
        "the provision, taken together with those listed provisions, requires. "
        "Never state or imply that something is absent, not shown, not "
        "specified, unclear, or not stated in the text. If a detail is in a "
        "listed provision, state it; if the listed provisions are shown only as "
        "an outline, say the provision introduces those items and name them."
    )
    for pid in ("sec-6-B-I-C-2-b", "sec-iiii-4202-f", "sec-oooob-5416b-b-7", "sec-gp01-I-A",
                "sec-p192-1", "sec-11-A-I", "sec-ecmc-100-a", "sec-unknown-1"):
        assert rule in system_prompt_for(pid), pid


@pytest.mark.parametrize("phrase", [
    "The text does not list them.",
    "Which engines it covers Does Not Show here.",
    "The deadline is not stated.",
    "The threshold is NOT SPECIFIED in this paragraph.",
    "It is unclear which methods apply.",
    "There is no date given for compliance.",
])
def test_hedging_guard_catches_each_phrase(phrase):
    assert is_hedging("Operators must certify engines. " + phrase)


def test_hedging_guard_passes_a_clean_summary():
    assert not is_hedging(
        "You can show compliance either with manufacturer-certified emission "
        "factors or with Division-approved testing under representative conditions."
    )
    assert not is_hedging("")


class _StubTable:
    """Minimal supabase-py table stub: records updates/inserts, answers a
    select with a canned row."""

    def __init__(self, log: list, existing: dict):
        self.log = log
        self.existing = existing
        self._op = None
        self._payload = None

    def select(self, cols):
        self._op = ("select", cols)
        return self

    def update(self, payload):
        self._op = ("update",)
        self._payload = payload
        return self

    def insert(self, payload):
        self._op = ("insert",)
        self._payload = payload
        return self

    def eq(self, col, val):
        self._eq = (col, val)
        return self

    def execute(self):
        if self._op[0] == "select":
            return type("R", (), {"data": [dict(self.existing)]})()
        self.log.append((self.name, self._op[0], self._payload))
        return type("R", (), {"data": []})()


class _StubClient:
    def __init__(self, existing: dict):
        self.log: list = []
        self.existing = existing

    def table(self, name):
        t = _StubTable(self.log, self.existing)
        t.name = name
        return t


def test_write_back_regenerated_preserves_existing_summary_original():
    client = _StubClient({"ai_summary": "old ai text", "summary_original": "reviewer-kept original"})
    write_summary(client, "sec-6-B-I-C-2-b", "new text", "claude-sonnet-4-5",
                  regenerated=True, descendant_count=2)
    (table, op, payload), (ctable, cop, cpayload) = client.log
    assert (table, op) == ("provisions", "update")
    assert payload["ai_summary"] == "new text"
    assert payload["summary_model"] == "claude-sonnet-4-5"
    assert payload["summary_original"] == "reviewer-kept original"   # never overwritten
    assert payload["summary_status"] == "pending"
    assert payload["reviewed_by"] is None and payload["reviewed_at"] is None
    assert (ctable, cop) == ("provision_changes", "insert")
    assert cpayload["provision_id"] == "sec-6-B-I-C-2-b"
    assert cpayload["change_type"] == "summary_regenerated"
    assert cpayload["note"] == "Phase 0: regenerated from provision + 2 descendants (model claude-sonnet-4-5)"


def test_write_back_regenerated_falls_back_to_old_ai_summary():
    client = _StubClient({"ai_summary": "old ai text", "summary_original": None})
    write_summary(client, "x", "new text", "m", regenerated=True, descendant_count=0)
    assert client.log[0][2]["summary_original"] == "old ai text"


def test_write_back_not_regenerated_is_unchanged():
    client = _StubClient({"ai_summary": "old", "summary_original": None})
    write_summary(client, "x", "new text", "m")
    assert len(client.log) == 1
    payload = client.log[0][2]
    assert set(payload) == {"ai_summary", "summary_model", "summary_generated_at"}


def _fake_anthropic(answers: list[str], calls: list[dict], stop_reason: str = "end_turn"):
    class _Usage:
        input_tokens = 10
        output_tokens = 5

    class _Block:
        type = "text"

        def __init__(self, text):
            self.text = text

    class _Message:
        usage = _Usage()

        def __init__(self, text):
            self.content = [_Block(text)]
            self.stop_reason = stop_reason

    class _Messages:
        def create(self, **kwargs):
            # anthropic 1.x: temperature/top_p/top_k are not parameters of
            # messages.create() any more. Mirror the real SDK so a regression
            # fails here instead of in a paid run.
            for removed in ("temperature", "top_p", "top_k"):
                if removed in kwargs:
                    raise TypeError(f"Messages.create() got an unexpected keyword argument '{removed}'")
            calls.append(kwargs)
            return _Message(answers.pop(0))

    class _Anthropic:
        messages = _Messages()

    return _Anthropic()


def _prompt_result() -> PromptResult:
    return PromptResult(prompt="P", system="S", body_word_count=30, prompt_word_count=30,
                        truncated=False, descendant_count=2)


def test_guard_retries_once_then_writes_clean_answer(monkeypatch, tmp_path):
    written: list = []
    monkeypatch.setattr(summarize, "write_summary",
                        lambda c, pid, text, model, **kw: written.append((pid, text, kw)))
    monkeypatch.setattr(summarize, "FAILED_LOG_PATH", tmp_path / "failed.jsonl")
    calls: list[dict] = []
    client = _fake_anthropic(["Clean rewrite."], calls)
    stats = summarize.RunStats()
    guard_and_write(client, None, "sec-x", _prompt_result(),
                    "The text does not show the methods.", "m", stats, regenerated=True)
    assert written == [("sec-x", "Clean rewrite.", {"regenerated": True, "descendant_count": 2})]
    assert len(calls) == 1
    assert calls[0]["messages"][-1] == {"role": "user", "content": HEDGING_RETRY_LINE}
    assert calls[0]["messages"][1]["content"] == "The text does not show the methods."
    assert stats.hedging_retried == 1 and stats.hedging_failed == 0 and stats.processed == 1
    assert not (tmp_path / "failed.jsonl").exists()


def test_guard_logs_hedging_and_does_not_write_after_second_hit(monkeypatch, tmp_path):
    written: list = []
    monkeypatch.setattr(summarize, "write_summary",
                        lambda *a, **k: written.append(a))
    monkeypatch.setattr(summarize, "FAILED_LOG_PATH", tmp_path / "failed.jsonl")
    client = _fake_anthropic(["Still not specified."], [])
    stats = summarize.RunStats()
    guard_and_write(client, None, "sec-x", _prompt_result(),
                    "It is unclear.", "m", stats, regenerated=True)
    assert written == []
    assert stats.hedging_retried == 1 and stats.hedging_failed == 1
    assert stats.failed == 1 and stats.processed == 0
    import json as _json
    entry = _json.loads((tmp_path / "failed.jsonl").read_text().strip())
    assert entry == {"id": "sec-x", "reason": "hedging", "at": entry["at"]}


def test_guard_writes_clean_answer_without_calling_the_api(monkeypatch):
    written: list = []
    monkeypatch.setattr(summarize, "write_summary", lambda *a, **k: written.append(a))
    calls: list[dict] = []
    stats = summarize.RunStats()
    guard_and_write(_fake_anthropic([], calls), None, "sec-x", _prompt_result(),
                    "Clean.", "m", stats, regenerated=False)
    assert len(written) == 1 and calls == []


class _SelectClient:
    """iter_candidates stub: serves `rows` through the --parents query shape
    (select / not_.is_ / like / order / range) and records the filters."""

    def __init__(self, rows):
        self.rows = rows
        self.filters: list = []
        self._q = None

    def table(self, name):
        return self

    def select(self, cols):
        self._like = None
        return self

    @property
    def not_(self):
        self.filters.append("not_")
        return self

    def is_(self, col, val):
        self.filters.append(("is_", col, val))
        return self

    def like(self, col, pat):
        self._like = pat[:-1]
        return self

    def order(self, col):
        return self

    def range(self, start, end):
        self._range = (start, end)
        return self

    def execute(self):
        rows = [r for r in self.rows if r["ai_summary"] is not None]
        if self._like:
            rows = [r for r in rows if r["id"].startswith(self._like)]
        s, e = self._range
        return type("R", (), {"data": rows[s:e + 1]})()


def test_parents_selects_parent_with_summary_skips_leaf_and_unsummarized_parent():
    meta = _reg6_tree()
    children_index = build_children_index(meta)
    rows = [
        {"id": "sec-6-B-I-C-2", "ai_summary": None},                 # parent, no summary
        {"id": "sec-6-B-I-C-2-b", "ai_summary": "old"},              # parent with summary
        {"id": "sec-6-B-I-C-2-b-(ii)", "ai_summary": "leaf summary"},  # leaf
        {"id": "sec-6-B-I-C-2-b-(i)", "ai_summary": "x"},            # parent with summary
        {"id": "sec-7-Z", "ai_summary": "x"},                        # other reg, no children
    ]
    client = _SelectClient(rows)
    got = [r["id"] for r in iter_candidates(client, "6", False, None,
                                            parent_ids=set(children_index))]
    assert got == ["sec-6-B-I-C-2-b", "sec-6-B-I-C-2-b-(i)"]
    assert ("is_", "ai_summary", "null") in client.filters and "not_" in client.filters
    # --limit applies to the filtered set
    got = [r["id"] for r in iter_candidates(_SelectClient(rows), "6", False, 1,
                                            parent_ids=set(children_index))]
    assert got == ["sec-6-B-I-C-2-b"]


def test_parents_flag_implies_force_and_excludes_ids():
    args = summarize.parse_args(["--parents", "--reg", "6", "--limit", "25"])
    assert args.parents and args.reg == "6" and args.limit == 25
    assert summarize.main(["--parents", "--ids", "a"]) == 1


def test_run_batch_submits_every_chunk_before_polling(monkeypatch, tmp_path):
    """Phase 0: all chunks go to the Batches API up front and are polled
    together, so the wall-clock is the slowest batch, not the sum."""
    monkeypatch.setattr(summarize, "BATCH_MAX_REQUESTS", 2)
    monkeypatch.setattr(summarize, "FAILED_LOG_PATH", tmp_path / "failed.jsonl")
    monkeypatch.setattr(summarize.time, "sleep", lambda s: None)
    written: list = []
    monkeypatch.setattr(summarize, "write_summary", lambda c, pid, text, model, **kw: written.append(pid))
    events: list[str] = []

    class _Counts:
        succeeded = 2; errored = 0; canceled = 0; expired = 0

    class _Batch:
        def __init__(self, bid, requests):
            self.id = bid; self.requests = requests
            self.processing_status = "in_progress"; self.request_counts = _Counts()

    class _Usage:
        input_tokens = 1; output_tokens = 1

    class _Block:
        type = "text"
        def __init__(self, t): self.text = t

    class _Msg:
        usage = _Usage()
        def __init__(self, t): self.content = [_Block(t)]

    class _Res:
        type = "succeeded"
        def __init__(self, t): self.message = _Msg(t)

    class _Item:
        def __init__(self, cid): self.custom_id = cid; self.result = _Res("Clean summary.")

    class _Batches:
        def __init__(self): self.store = {}; self.polls = 0
        def create(self, requests):
            b = _Batch(f"b{len(self.store)}", requests); self.store[b.id] = b
            events.append(f"create:{b.id}"); return b
        def retrieve(self, bid):
            self.polls += 1; b = self.store[bid]
            events.append(f"poll:{bid}")
            # every batch ends on its second poll
            if events.count(f"poll:{bid}") >= 2:
                b.processing_status = "ended"
            return b
        def results(self, bid):
            return [_Item(r["custom_id"]) for r in self.store[bid].requests]

    class _Messages:
        batches = _Batches()

    class _Anthropic:
        messages = _Messages()

    rows = [_row(f"sec-6-B-{i}") for i in range(5)]  # 5 rows -> 3 chunks of <=2
    stats = summarize.RunStats()
    summarize.run_batch(_Anthropic(), None, rows, {}, "m", stats, poll_interval=0)
    creates = [e for e in events if e.startswith("create:")]
    first_poll = next(i for i, e in enumerate(events) if e.startswith("poll:"))
    assert creates == ["create:b0", "create:b1", "create:b2"]
    assert all(events.index(c) < first_poll for c in creates)   # all submitted before any poll
    assert stats.batches_submitted == 3
    assert sorted(written) == sorted(r["id"] for r in rows)
    assert stats.processed == 5 and stats.failed == 0


# --- Phase 0 follow-up: length guard and --longer-than ----------------------

from summarize import LENGTH_RETRY_LINE, LENGTH_RETRY_WORDS, is_too_long  # noqa: E402


def test_system_prompt_keeps_the_rule_and_adds_the_length_sentence():
    system = system_prompt_for("sec-oooob-60.5395b")
    assert "Summarize what the provision, taken together with those listed provisions, requires." in system
    assert "keep to the usual 2-5 short sentences" in system
    assert "do not restate each one" in system


def test_is_too_long_threshold():
    assert not is_too_long(" ".join(["w"] * LENGTH_RETRY_WORDS))
    assert is_too_long(" ".join(["w"] * (LENGTH_RETRY_WORDS + 1)))


def test_length_guard_retries_once_and_writes_the_shorter_clean_answer(monkeypatch):
    written: list = []
    monkeypatch.setattr(summarize, "write_summary", lambda c, pid, text, model, **kw: written.append(text))
    calls: list[dict] = []
    long_text = " ".join(["word"] * (LENGTH_RETRY_WORDS + 40)) + "."
    client = _fake_anthropic(["Short and clean."], calls)
    stats = summarize.RunStats()
    guard_and_write(client, None, "sec-x", _prompt_result(), long_text, "m", stats, regenerated=True)
    assert written == ["Short and clean."]
    assert calls[0]["messages"][-1] == {"role": "user", "content": LENGTH_RETRY_LINE}
    assert stats.length_retried == 1 and stats.length_still_long == 0 and stats.processed == 1


def test_length_retry_uses_the_word_budget_line_and_token_ceiling(monkeypatch):
    monkeypatch.setattr(summarize, "write_summary", lambda *a, **k: None)
    calls: list[dict] = []
    long_text = " ".join(["word"] * (LENGTH_RETRY_WORDS + 40)) + "."
    guard_and_write(_fake_anthropic(["Done."], calls), None, "sec-x", _prompt_result(),
                    long_text, "m", summarize.RunStats(), regenerated=True)
    assert calls[0]["max_tokens"] == summarize.LENGTH_RETRY_MAX_TOKENS
    assert "at most 100 words" in calls[0]["messages"][-1]["content"]


def test_length_guard_rejects_a_rewrite_cut_mid_sentence(monkeypatch):
    written: list = []
    monkeypatch.setattr(summarize, "write_summary", lambda c, pid, text, model, **kw: written.append(text))
    long_text = " ".join(["word"] * (LENGTH_RETRY_WORDS + 40)) + "."
    guard_and_write(_fake_anthropic(["Shorter but cut off in the middle of a"], []), None, "sec-x",
                    _prompt_result(), long_text, "m", summarize.RunStats(), regenerated=True)
    assert written == [long_text]


def test_length_guard_keeps_the_long_answer_when_the_rewrite_hedges_or_grows(monkeypatch):
    written: list = []
    monkeypatch.setattr(summarize, "write_summary", lambda c, pid, text, model, **kw: written.append(text))
    long_text = " ".join(["word"] * (LENGTH_RETRY_WORDS + 40)) + "."
    stats = summarize.RunStats()
    guard_and_write(_fake_anthropic(["Shorter but the text does not say."], []), None, "sec-x",
                    _prompt_result(), long_text, "m", stats, regenerated=True)
    assert written == [long_text]            # hedging rewrite rejected, long clean answer kept
    assert stats.length_retried == 1 and stats.length_still_long == 1 and stats.failed == 0


def test_parents_longer_than_keeps_only_long_summaries():
    meta = _reg6_tree()
    children_index = build_children_index(meta)
    rows = [
        {"id": "sec-6-B-I-C-2-b", "ai_summary": "x" * 1000},
        {"id": "sec-6-B-I-C-2-b-(i)", "ai_summary": "x" * 300},
    ]
    got = [r["id"] for r in iter_candidates(_SelectClient(rows), "6", False, None,
                                            parent_ids=set(children_index), longer_than=900)]
    assert got == ["sec-6-B-I-C-2-b"]
    assert summarize.main(["--longer-than", "900"]) == 1   # needs --parents


# --- Corpus QA (3 Oct 2026): cut-off primary answers and leaked tags --------

import json  # noqa: E402
from summarize import is_cut_off, is_whole, strip_wrapper_tags  # noqa: E402


def _cut_off_fixture(monkeypatch, tmp_path):
    written: list = []
    monkeypatch.setattr(summarize, "write_summary", lambda c, pid, text, model, **kw: written.append(text))
    monkeypatch.setattr(summarize, "FAILED_LOG_PATH", tmp_path / "failed.jsonl")
    return written


def test_primary_answer_stopped_at_max_tokens_triggers_the_retry(monkeypatch, tmp_path):
    """stop_reason == "max_tokens" is cut off even when the text happens to
    end in a period: the length retry runs and its whole answer is written."""
    written = _cut_off_fixture(monkeypatch, tmp_path)
    calls: list[dict] = []
    stats = summarize.RunStats()
    guard_and_write(_fake_anthropic(["Whole retry."], calls), None, "sec-x", _prompt_result(),
                    "Looks finished but the API says otherwise.", "m", stats, regenerated=True,
                    stop_reason="max_tokens")
    assert written == ["Whole retry."]
    assert len(calls) == 1
    assert calls[0]["messages"][-1] == {"role": "user", "content": LENGTH_RETRY_LINE}
    assert calls[0]["max_tokens"] == summarize.LENGTH_RETRY_MAX_TOKENS
    assert stats.cut_off_retried == 1 and stats.cut_off == 0
    assert stats.processed == 1 and stats.failed == 0 and stats.length_retried == 0


def test_primary_answer_ending_mid_word_triggers_the_retry(monkeypatch, tmp_path):
    """A primary answer with stop_reason end_turn that does not end in
    terminal punctuation is cut off too."""
    written = _cut_off_fixture(monkeypatch, tmp_path)
    calls: list[dict] = []
    stats = summarize.RunStats()
    guard_and_write(_fake_anthropic(["Whole retry."], calls), None, "sec-x", _prompt_result(),
                    "Natural gas engines may use propane as an alternative fuel for", "m", stats,
                    regenerated=True, stop_reason="end_turn")
    assert written == ["Whole retry."]
    assert len(calls) == 1
    assert stats.cut_off_retried == 1 and stats.cut_off == 0 and stats.processed == 1


@pytest.mark.parametrize("text", [
    "A whole answer.",
    "A whole answer (with a bracket).",
    "A whole answer ending in a bracket.)",
    "A whole answer with a footnote.)*",
    "A whole answer with a footnote.*",
    'A whole answer ending in a quote."',
    "A whole answer ending in a square bracket.]",
])
def test_whole_primary_answer_is_written_without_a_retry(monkeypatch, tmp_path, text):
    written = _cut_off_fixture(monkeypatch, tmp_path)
    calls: list[dict] = []
    stats = summarize.RunStats()
    guard_and_write(_fake_anthropic([], calls), None, "sec-x", _prompt_result(), text, "m", stats,
                    regenerated=False, stop_reason="end_turn")
    assert written == [text] and calls == []
    assert stats.cut_off_retried == 0 and stats.cut_off == 0 and stats.processed == 1
    assert not (tmp_path / "failed.jsonl").exists()


def test_cut_off_primary_and_cut_off_retry_writes_nothing_and_logs_cut_off(monkeypatch, tmp_path):
    written = _cut_off_fixture(monkeypatch, tmp_path)
    stats = summarize.RunStats()
    guard_and_write(_fake_anthropic(["Shorter but still cut off in the middle of"], []), None, "sec-x",
                    _prompt_result(), "First answer cut off in the middle of a", "m", stats,
                    regenerated=True, stop_reason="max_tokens")
    assert written == []
    assert stats.cut_off_retried == 1 and stats.cut_off == 1
    assert stats.failed == 1 and stats.processed == 0
    entry = json.loads((tmp_path / "failed.jsonl").read_text().strip())
    assert entry == {"id": "sec-x", "reason": "cut_off", "at": entry["at"]}


def test_is_cut_off_and_is_whole():
    assert is_cut_off("Done.", "max_tokens")
    assert is_cut_off("cut in the middle of a", "end_turn")
    assert is_cut_off("cut in the middle of a", None)
    assert not is_cut_off("Done.", "end_turn")
    assert not is_cut_off("Done.", None)
    assert is_whole("Done.)*") and not is_whole("Done*") and not is_whole("")


def test_strip_wrapper_tags_removes_answer_tags_and_keeps_inner_text():
    assert strip_wrapper_tags("<answer>VOC content is ((B minus C) divided by A) times 100.</answer>") \
        == "VOC content is ((B minus C) divided by A) times 100."
    assert strip_wrapper_tags("<ANSWER>\nText.\n</ANSWER >") == "Text."
    assert strip_wrapper_tags("<summary>Text.</summary>") == "Text."
    assert strip_wrapper_tags("Text with a trailing tag.</answer>") == "Text with a trailing tag."
    # Not wrapper tags: left alone (the reader's markup never reaches this path, but be safe).
    assert strip_wrapper_tags("<p>Text.</p>") == "<p>Text.</p>"
    assert strip_wrapper_tags("<answers>Text.</answers>") == "<answers>Text.</answers>"
    assert strip_wrapper_tags("the <answer> to this question is 42.") == "the  to this question is 42."


def test_leaked_answer_tag_is_stripped_before_the_whole_answer_test(monkeypatch, tmp_path):
    """The real row: a whole answer wrapped in <answer>...</answer> used to
    fail the terminal-punctuation check (it ended in ">") and would now be
    retried; stripping first writes the inner text with no API call."""
    written = _cut_off_fixture(monkeypatch, tmp_path)
    calls: list[dict] = []
    stats = summarize.RunStats()
    guard_and_write(_fake_anthropic([], calls), None, "sec-x", _prompt_result(),
                    "<answer>VOC content is calculated per unit.</answer>", "m", stats,
                    regenerated=True, stop_reason="end_turn")
    assert written == ["VOC content is calculated per unit."] and calls == []
    assert stats.processed == 1 and stats.cut_off_retried == 0


def test_run_sync_passes_stop_reason_to_the_guard(monkeypatch, tmp_path):
    """Sync mode threads the API's stop_reason through, so a max_tokens
    primary is retried even when it happens to end in a period."""
    written = _cut_off_fixture(monkeypatch, tmp_path)
    calls: list[dict] = []
    client = _fake_anthropic(["Cut at the ceiling but ends in a period.", "Whole retry."], calls,
                             stop_reason="max_tokens")
    stats = summarize.RunStats()
    summarize.run_sync(client, None, [_row("sec-6-B-1")], {}, "m", stats, dry_run=False)
    assert written == ["Whole retry."]
    assert len(calls) == 2 and calls[1]["messages"][-1]["content"] == LENGTH_RETRY_LINE
    assert stats.cut_off_retried == 1 and stats.processed == 1


def test_batch_results_pass_stop_reason_to_the_guard(monkeypatch, tmp_path):
    """Batch mode behaves the same as sync: a max_tokens result is retried
    synchronously and the whole retry is written."""
    written = _cut_off_fixture(monkeypatch, tmp_path)
    calls: list[dict] = []
    retry_client = _fake_anthropic(["Whole retry."], calls)

    class _Usage:
        input_tokens = 1; output_tokens = 1

    class _Block:
        type = "text"
        def __init__(self, t): self.text = t

    class _Msg:
        usage = _Usage()
        stop_reason = "max_tokens"
        def __init__(self, t): self.content = [_Block(t)]

    class _Res:
        type = "succeeded"
        def __init__(self, t): self.message = _Msg(t)

    class _Item:
        def __init__(self, cid, t): self.custom_id = cid; self.result = _Res(t)

    class _Batches:
        def results(self, bid):
            return [_Item("sec-6-B-1", "Cut at the ceiling but ends in a period.")]

    retry_client.messages.batches = _Batches()
    stats = summarize.RunStats()
    summarize._consume_batch_results(retry_client, None, "b0", {"sec-6-B-1": "sec-6-B-1"},
                                     {"sec-6-B-1": _prompt_result()}, "m", stats, regenerated=False)
    assert written == ["Whole retry."]
    assert len(calls) == 1 and stats.cut_off_retried == 1 and stats.processed == 1


@pytest.mark.parametrize("argv, want", [
    (["--ids", "sec-6-B-1", "--sync"], True),
    (["--parents", "--sync"], True),
    (["--reg", "6", "--sync"], False),
])
def test_main_routes_ids_runs_through_the_regenerated_write(monkeypatch, tmp_path, argv, want):
    """An --ids row already has a summary, so its write must keep
    summary_original and put the row back to pending, like --parents."""
    for var in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"):
        monkeypatch.setenv(var, "x")
    monkeypatch.setattr(summarize, "FAILED_LOG_PATH", tmp_path / "failed.jsonl")
    monkeypatch.setattr(summarize, "make_supabase_client", lambda: object())
    import anthropic
    monkeypatch.setattr(anthropic, "Anthropic", lambda api_key: object())
    monkeypatch.setattr(summarize, "fetch_meta", lambda client, reg: {})
    monkeypatch.setattr(summarize, "iter_candidates", lambda *a, **k: iter([_row("sec-6-B-1")]))
    seen: list[bool] = []
    monkeypatch.setattr(summarize, "run_sync",
                        lambda *a, **k: seen.append(k["regenerated"]))
    assert summarize.main(argv) == 0
    assert seen == [want]


def test_sync_calls_send_temperature_through_extra_body(monkeypatch, tmp_path):
    """anthropic 1.x dropped the temperature keyword; the sync primary call
    and the retry both carry it in extra_body, and the batch params keep it."""
    monkeypatch.setattr(summarize, "write_summary", lambda *a, **k: None)
    monkeypatch.setattr(summarize, "FAILED_LOG_PATH", tmp_path / "failed.jsonl")
    calls: list[dict] = []
    client = _fake_anthropic(["Primary answer cut in the middle of a", "Whole retry."], calls)
    stats = summarize.RunStats()
    summarize.run_sync(client, None, [_row("sec-6-B-1")], {}, "m", stats, dry_run=False)
    assert len(calls) == 2 and stats.processed == 1 and stats.failed == 0
    for call in calls:
        assert "temperature" not in call
        assert call["extra_body"] == {"temperature": summarize.TEMPERATURE}
