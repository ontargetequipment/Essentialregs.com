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
    REG_PROMPT_HINTS,
    SYSTEM_PROMPT,
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
