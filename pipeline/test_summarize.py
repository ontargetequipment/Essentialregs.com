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
from summarize import (  # noqa: E402
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
])
def test_specific_hint_selected_by_id_prefix(provision_id, key, marker):
    system = system_prompt_for(provision_id)
    assert system.startswith(SYSTEM_PROMPT)
    assert system.endswith(REG_PROMPT_HINTS[key])
    assert marker in system
    # Exactly one hint appended, separated from the base prompt by a blank line.
    assert system == f"{SYSTEM_PROMPT}\n\n{REG_PROMPT_HINTS[key]}"


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


@pytest.mark.parametrize("key", ["gp01", "jjjj", "iiii", "zzzz"])
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
# Audience hook (REG_AUDIENCE / DEFAULT_AUDIENCE / SYSTEM_PROMPT_TEMPLATE)
# --------------------------------------------------------------------------

def test_system_prompt_is_template_rendered_with_default_audience():
    assert SYSTEM_PROMPT == SYSTEM_PROMPT_TEMPLATE.format(audience=DEFAULT_AUDIENCE)


def test_default_audience_matches_original_wording():
    assert DEFAULT_AUDIENCE == (
        "an EHS or compliance person at a Colorado oil & gas operator"
    )


def test_no_reg_overrides_audience_yet():
    # ECMC stays on the O&G default -- REG_AUDIENCE is a hook for a future
    # non-oil-and-gas regulation, not yet populated.
    assert REG_AUDIENCE == {}


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
