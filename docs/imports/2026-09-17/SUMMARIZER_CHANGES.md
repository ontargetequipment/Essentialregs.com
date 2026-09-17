# Summarizer changes — per-regulation prompt hints + admin review filter

Working dir: `/home/claude/working/er/summ/`. Originals preserved in `orig/`. No API or Supabase calls were made.

## 1. Hint text (exact, as shipped in `summarize.py`)

### Reg 1 (`REG_PROMPT_HINTS["1"]`, 187 words)

> This row is from Colorado Regulation Number 1 (particulates, smoke, carbon monoxide, sulfur oxides). Reg 1 applies statewide unless a provision names attainment, attainment-maintenance, or nonattainment areas -- if the text names an area, say so; if it doesn't, don't add one. Sections VII and VIII set unit-level limits for named facilities (e.g. Public Service Company of Colorado stations); never generalize them to all sources. Section X and its subsections (X.A-X.Q) are rulemaking history, not current requirements. Appendices A and B are test methods -- describe them as methods, not as history. Federal methods (EPA Method 9, Methods 1-8, 40 CFR Part 60 appendices and subparts) are incorporated by reference with a fixed edition date; do not describe their contents. In formulas a caret is an exponent ((FI)^-0.26 is FI raised to the negative 0.26 power) and 10^6 BTU means one million BTU. PE is the particulate emission variable (pounds per hour or pounds per million BTU, as the text says), not "professional engineer"; FI is fuel input; P is process weight rate. "Commission" is the Air Quality Control Commission; "Division" is the Air Pollution Control Division.

### Reg 2 (`REG_PROMPT_HINTS["2"]`, 176 words)

> This row is from Colorado Regulation Number 2 (odor). Part A is the general odor standard for sources statewide; Part B applies only to housed commercial swine feeding operations, so never generalize a Part B row to other sources. In Part B, "the Division" means the Division of Environmental Health and Sustainability of CDPHE, not the Air Pollution Control Division; in Part A it is the Air Pollution Control Division. Many Part B rows open with a bare heading or defined term followed by the body -- treat that first line as the heading, not a sentence. Section IX.B lists recommended practices the Division may require, even where a sub-row says "shall"; do not present them as blanket mandates unless the text says so. Part C rows are statements of basis: rulemaking history, not requirements, and sections they describe as removed no longer exist. Leave SB 06-114, C.A.R.E., USPHS Pub. #999-AP-32, BOD, FTE, and WQCC/Regulation 61 as written unless the text expands them; cross-references to Regulation Number 6 or the Common Provisions point outside this regulation.

### Reg 6 (`REG_PROMPT_HINTS["6"]`, 187 words)

> This row is from Colorado Regulation Number 6 (standards of performance for new stationary sources). Part A rows are adoption-by-reference records: a row that reads "<title>. 40 CFR Part 60, Subpart Xx (July 1, 2025)." means Colorado adopts that federal subpart by reference as of that CFR edition -- say exactly that, and do not invent or summarize the subpart's requirements. The date in parentheses is the incorporated CFR edition, not a compliance date. If a row adds Colorado-specific deviations, summarize only those. In Part 60-adopted text, "Administrator" means the Colorado Air Pollution Control Division except where the text or Table 1 says otherwise; in Part 75 text it means EPA. Statement-of-basis rows (Part A Sections I-XXXII, Part B Section IX) are rulemaking history, not requirements. Part B Section VIII is Colorado's state-only mercury program for coal-fired power plants; do not conflate it with the federal MATS rule (40 CFR 63 Subpart UUUUU). Quote numeric limits and equations as written (a caret is an exponent); never recompute them. Subparts Cb, Cc, Cf, DDDD, FFFF, HHHH, and MMMM are emission guidelines for existing sources, not new-source performance standards.

### Reg 8 (`REG_PROMPT_HINTS["8"]`, 188 words)

> This row is from Colorado Regulation Number 8 (hazardous air pollutants, including asbestos). Parts A and E list 40 CFR Part 61 and Part 63 subparts incorporated by reference with a CFR edition date -- say the subpart is incorporated as of that version and do not summarize or invent the subpart's requirements (an inline Title V exemption stated in the row may be reported). Entries marked "Repealed" or "Reserved" are placeholders. Part C is repealed apart from its statement-of-basis entries. In Part B, keep the distinction between school buildings (Section IV), other facilities, and single-family residential dwellings, and mention "areas of public access" or "trigger levels" only when the text does. Reg 8 acronyms: AMS is Air Monitoring Specialist, GAC is General Abatement Contractor, LEA is local education agency, MAAL is Maximum Allowable Asbestos Level, NAM is negative air machine, LCF is large contiguous facility, SFRD is single-family residential dwelling; in Part D, "source" and "base year" carry Part D's own definitions. Statement-of-basis rows are rulemaking history, not requirements. Refer to fee and weighting tables rather than restating every row. Ignore any trailing Editor's Notes revision history.

### Shared hint for Regs 3, 7, 22, 26 (`_COLORADO_AREA_SCOPE_HINT`, one string object mapped under all four keys, 103 words)

> Many sections of this Colorado regulation are scoped to a specific area -- the 8-hour Ozone Control Area, a named nonattainment or attainment-maintenance area, or a listed set of counties -- while others apply statewide. Do not infer either. Never write "in Colorado", "statewide", or "anywhere in the state" for a provision unless the text in front of you (its own words or the parent paragraph shown) says so, and never name an area or county it does not name. If the text states the area, repeat it exactly; if it says nothing about where it applies, say nothing about where it applies.

Rows whose reg key is not in the dict (`ooooa`, `oooob`, `ooooc`, or any malformed id) get `SYSTEM_PROMPT` unchanged.

## 2. Where the hint is injected, and why

**Injected into the *system* prompt**, as a final paragraph appended after `SYSTEM_PROMPT` with a blank-line separator: `system_prompt_for(provision_id)` returns `f"{SYSTEM_PROMPT}\n\n{hint}"` or `SYSTEM_PROMPT`.

Mechanics:

- `reg_key_of(provision_id)` — new helper mirroring `regKeyOf()` in `src/lib/changelog.ts`: the segment after `sec-` (`sec-7-B-I-C` -> `"7"`, `sec-oooob-5390` -> `"oooob"`), lower-cased; `None` for anything else.
- `system_prompt_for(provision_id)` — looks up `REG_PROMPT_HINTS[reg_key]` and appends it.
- `PromptResult` gained a `system: str` field; `build_prompt()` fills it via `system_prompt_for(provision["id"])`.
- `run_sync` and `run_batch` now pass `system=result.system` / `"system": result.system` instead of the module constant `SYSTEM_PROMPT`.

Why there:

- **Per row, not per `--reg`.** Both call sites already build one `PromptResult` per row, so hanging the system text off `PromptResult` makes the hint follow the row's own id in every mode — full-corpus runs (`--reg` omitted), `--ids`, `--ids-file` (which may span regs), and `--dry-run`. `--reg` is never consulted.
- **System rather than user prompt.** `SYSTEM_PROMPT` is where every other instruction to the model lives (voice, what not to invent, how to treat acronyms, the Division/Administrator rules); the user prompt is strictly data (`Regulation:` / `Under:` / `Parent paragraph text:` / `Provision text:`). Keeping instructions and data separate avoids the model treating the hint as part of the provision and avoids disturbing the `--dry-run` printout and word/token accounting, which are computed from `result.prompt` only. The Batches API takes `system` per request, so per-row system prompts cost nothing extra in batch mode (no prompt caching is used in this script).
- **Appended last** so the regulation-specific rules read as refinements of the general rules already stated, and so the existing prompt text is byte-for-byte unchanged for regs without a hint.

Also changed: the `--reg` help string and the module docstring examples now list `1, 2, 6, 8` alongside the existing regs. Model names, pricing table, batch/poll logic, DB access, and CLI behaviour are untouched.

## 3. Admin review filter (`page.tsx`)

`REG_KEYS` is now `["1", "2", "3", "6", "7", "8", "22", "26", "ooooa", "oooob", "ooooc"]` and `REG_LABELS` gained `"1": "Reg 1"`, `"2": "Reg 2"`, `"6": "Reg 6"`, `"8": "Reg 8"`, inserted in ascending numeric order before the CFR subparts. Nothing else in the file was touched. The filter already derives the id prefix as `sec-${regFilter}-%`, so the new keys work with no other change.

## 4. Test output

```
$ python3 -m pytest -q test_summarize.py
.................................                                        [100%]
33 passed in 0.03s
```

`test_summarize.py` (new; there was no existing `pipeline/test_summarize.py` to copy) covers: `reg_key_of` parsing; the specific hint selected by id prefix for each of 1/2/6/8; the shared hint (and its identity) for 3/7/22/26 including the Ozone-Control-Area / attainment-maintenance / statewide wording; no hint for ooooa/oooob/ooooc and malformed ids; a Reg 7 row's system prompt containing no Reg-6-specific text and none of the 1/2/6/8 hints; hint length cap; `build_prompt` populating `result.system` (and not leaking the hint into the user prompt); and a monkeypatched `run_sync` proving the call site sends `result.system` rather than the bare `SYSTEM_PROMPT`.

## 5. Unified diff vs originals

```diff
--- orig/summarize.py	2026-09-17 07:34:43.347598678 -0600
+++ summarize.py	2026-09-17 07:36:13.918095513 -0600
@@ -27,6 +27,10 @@
     # Regenerate every summary in Reg 3 from scratch.
     python pipeline/summarize.py --reg 3 --force
 
+    # --reg takes any regulation id prefix: 1, 2, 3, 6, 7, 8, 22, 26,
+    # ooooa, oooob, ooooc. Regs listed in REG_PROMPT_HINTS get an extra
+    # regulation-specific paragraph appended to the system prompt per row.
+
 Required environment variables (all three, unless --dry-run — see below):
     ANTHROPIC_API_KEY
     SUPABASE_URL
@@ -147,6 +151,112 @@
     "summary."
 )
 
+# Regulation-specific guidance appended to SYSTEM_PROMPT per ROW, keyed by
+# the row's own regulation key (the "<regkey>" in an id like
+# "sec-<regkey>-..."), so it applies in full-corpus runs (no --reg) and
+# --ids/--ids-file runs alike. Distilled from the importer agents' warnings
+# (SUMMARIZER_WARNINGS.md). Regs with no entry get SYSTEM_PROMPT unchanged.
+_COLORADO_AREA_SCOPE_HINT = (
+    "Many sections of this Colorado regulation are scoped to a specific area "
+    "-- the 8-hour Ozone Control Area, a named nonattainment or "
+    "attainment-maintenance area, or a listed set of counties -- while others "
+    "apply statewide. Do not infer either. Never write \"in Colorado\", "
+    "\"statewide\", or \"anywhere in the state\" for a provision unless the "
+    "text in front of you (its own words or the parent paragraph shown) says "
+    "so, and never name an area or county it does not name. If the text "
+    "states the area, repeat it exactly; if it says nothing about where it "
+    "applies, say nothing about where it applies."
+)
+
+REG_PROMPT_HINTS: dict[str, str] = {
+    "1": (
+        "This row is from Colorado Regulation Number 1 (particulates, smoke, "
+        "carbon monoxide, sulfur oxides). Reg 1 applies statewide unless a "
+        "provision names attainment, attainment-maintenance, or nonattainment "
+        "areas -- if the text names an area, say so; if it doesn't, don't add "
+        "one. Sections VII and VIII set unit-level limits for named facilities "
+        "(e.g. Public Service Company of Colorado stations); never generalize "
+        "them to all sources. Section X and its subsections (X.A-X.Q) are "
+        "rulemaking history, not current requirements. Appendices A and B are "
+        "test methods -- describe them as methods, not as history. Federal "
+        "methods (EPA Method 9, Methods 1-8, 40 CFR Part 60 appendices and "
+        "subparts) are incorporated by reference with a fixed edition date; do "
+        "not describe their contents. In formulas a caret is an exponent "
+        "((FI)^-0.26 is FI raised to the negative 0.26 power) and 10^6 BTU "
+        "means one million BTU. PE is the particulate emission variable "
+        "(pounds per hour or pounds per million BTU, as the text says), not "
+        "\"professional engineer\"; FI is fuel input; P is process weight "
+        "rate. \"Commission\" is the Air Quality Control Commission; "
+        "\"Division\" is the Air Pollution Control Division."
+    ),
+    "2": (
+        "This row is from Colorado Regulation Number 2 (odor). Part A is the "
+        "general odor standard for sources statewide; Part B applies only to "
+        "housed commercial swine feeding operations, so never generalize a "
+        "Part B row to other sources. In Part B, \"the Division\" means the "
+        "Division of Environmental Health and Sustainability of CDPHE, not "
+        "the Air Pollution Control Division; in Part A it is the Air "
+        "Pollution Control Division. Many Part B rows open with a bare "
+        "heading or defined term followed by the body -- treat that first "
+        "line as the heading, not a sentence. Section IX.B lists recommended "
+        "practices the Division may require, even where a sub-row says "
+        "\"shall\"; do not present them as blanket mandates unless the text "
+        "says so. Part C rows are statements of basis: rulemaking history, "
+        "not requirements, and sections they describe as removed no longer "
+        "exist. Leave SB 06-114, C.A.R.E., USPHS Pub. #999-AP-32, BOD, FTE, "
+        "and WQCC/Regulation 61 as written unless the text expands them; "
+        "cross-references to Regulation Number 6 or the Common Provisions "
+        "point outside this regulation."
+    ),
+    "6": (
+        "This row is from Colorado Regulation Number 6 (standards of "
+        "performance for new stationary sources). Part A rows are "
+        "adoption-by-reference records: a row that reads \"<title>. 40 CFR "
+        "Part 60, Subpart Xx (July 1, 2025).\" means Colorado adopts that "
+        "federal subpart by reference as of that CFR edition -- say exactly "
+        "that, and do not invent or summarize the subpart's requirements. The "
+        "date in parentheses is the incorporated CFR edition, not a "
+        "compliance date. If a row adds Colorado-specific deviations, "
+        "summarize only those. In Part 60-adopted text, \"Administrator\" "
+        "means the Colorado Air Pollution Control Division except where the "
+        "text or Table 1 says otherwise; in Part 75 text it means EPA. "
+        "Statement-of-basis rows (Part A Sections I-XXXII, Part B Section IX) "
+        "are rulemaking history, not requirements. Part B Section VIII is "
+        "Colorado's state-only mercury program for coal-fired power plants; "
+        "do not conflate it with the federal MATS rule (40 CFR 63 Subpart "
+        "UUUUU). Quote numeric limits and equations as written (a caret is an "
+        "exponent); never recompute them. Subparts Cb, Cc, Cf, DDDD, FFFF, "
+        "HHHH, and MMMM are emission guidelines for existing sources, not "
+        "new-source performance standards."
+    ),
+    "8": (
+        "This row is from Colorado Regulation Number 8 (hazardous air "
+        "pollutants, including asbestos). Parts A and E list 40 CFR Part 61 "
+        "and Part 63 subparts incorporated by reference with a CFR edition "
+        "date -- say the subpart is incorporated as of that version and do "
+        "not summarize or invent the subpart's requirements (an inline Title "
+        "V exemption stated in the row may be reported). Entries marked "
+        "\"Repealed\" or \"Reserved\" are placeholders. Part C "
+        "is repealed apart from its statement-of-basis entries. In Part B, "
+        "keep the distinction between school buildings (Section IV), other "
+        "facilities, and single-family residential dwellings, and mention "
+        "\"areas of public access\" or \"trigger levels\" only when the text "
+        "does. Reg 8 acronyms: AMS is Air Monitoring Specialist, GAC is "
+        "General Abatement Contractor, LEA is local education agency, MAAL is "
+        "Maximum Allowable Asbestos Level, NAM is negative air machine, LCF "
+        "is large contiguous facility, SFRD is single-family residential "
+        "dwelling; in Part D, \"source\" and \"base year\" carry Part D's own "
+        "definitions. Statement-of-basis rows are rulemaking history, not "
+        "requirements. Refer to fee and weighting tables rather than "
+        "restating every row. Ignore any trailing Editor's Notes revision "
+        "history."
+    ),
+    "3": _COLORADO_AREA_SCOPE_HINT,
+    "7": _COLORADO_AREA_SCOPE_HINT,
+    "22": _COLORADO_AREA_SCOPE_HINT,
+    "26": _COLORADO_AREA_SCOPE_HINT,
+}
+
 
 # --------------------------------------------------------------------------
 # Text helpers
@@ -174,6 +284,21 @@
     return "item"
 
 
+def reg_key_of(provision_id: str) -> Optional[str]:
+    """Mirrors regKeyOf() in src/lib/changelog.ts -- the regulation key is
+    the segment after the "sec-" prefix (e.g. "7" for "sec-7-B-I-C",
+    "oooob" for "sec-oooob-5390"). None if the id isn't in that shape."""
+    m = re.match(r"^sec-([^-]+)-", provision_id or "")
+    return m.group(1).lower() if m else None
+
+
+def system_prompt_for(provision_id: str) -> str:
+    """SYSTEM_PROMPT plus this row's regulation hint (REG_PROMPT_HINTS),
+    when one exists; otherwise SYSTEM_PROMPT unchanged."""
+    hint = REG_PROMPT_HINTS.get(reg_key_of(provision_id) or "")
+    return f"{SYSTEM_PROMPT}\n\n{hint}" if hint else SYSTEM_PROMPT
+
+
 # --------------------------------------------------------------------------
 # Supabase access
 # --------------------------------------------------------------------------
@@ -314,6 +439,7 @@
 @dataclass
 class PromptResult:
     prompt: str
+    system: str                   # SYSTEM_PROMPT (+ this row's REG_PROMPT_HINTS entry, if any)
     body_word_count: int          # tag-stripped word count of the provision's own text
     prompt_word_count: int        # words actually included in the prompt (post-cap)
     truncated: bool
@@ -388,6 +514,7 @@
 
     return PromptResult(
         prompt="\n".join(lines),
+        system=system_prompt_for(provision["id"]),
         body_word_count=body_word_count,
         prompt_word_count=len(used_words),
         truncated=truncated,
@@ -491,7 +618,7 @@
                 model=model,
                 max_tokens=MAX_TOKENS,
                 temperature=TEMPERATURE,
-                system=SYSTEM_PROMPT,
+                system=result.system,
                 messages=[{"role": "user", "content": result.prompt}],
             )
         except Exception as exc:  # noqa: BLE001 -- log and keep going
@@ -582,7 +709,7 @@
                 "model": model,
                 "max_tokens": MAX_TOKENS,
                 "temperature": TEMPERATURE,
-                "system": SYSTEM_PROMPT,
+                "system": result.system,
                 "messages": [{"role": "user", "content": result.prompt}],
             },
         })
@@ -657,7 +784,7 @@
     )
     parser.add_argument(
         "--reg", default=None,
-        help="Limit to one regulation's id prefix, e.g. 7, 3, 26, oooob. "
+        help="Limit to one regulation's id prefix, e.g. 1, 2, 3, 6, 7, 8, 26, oooob. "
              "Omit to run against every regulation. Ignored if --ids-file is given.",
     )
     parser.add_argument(
--- /dev/null	2026-09-14 18:17:59.089226164 -0600
+++ test_summarize.py	2026-09-17 07:36:03.390094887 -0600
@@ -0,0 +1,189 @@
+"""Tests for the per-regulation prompt hints in summarize.py.
+
+Pure unit tests: no Supabase, no Anthropic. Run with
+    python3 -m pytest -q test_summarize.py
+"""
+
+from __future__ import annotations
+
+import pytest
+
+import summarize
+from summarize import (
+    REG_PROMPT_HINTS,
+    SYSTEM_PROMPT,
+    build_prompt,
+    reg_key_of,
+    system_prompt_for,
+)
+
+
+def _row(provision_id: str) -> dict:
+    """A minimal provision row with enough words to clear MIN_WORDS."""
+    return {
+        "id": provision_id,
+        "citation": "X.Y.Z",
+        "title": "Test provision",
+        "parent_id": None,
+        "full_text": "<p>" + " ".join(["word"] * 40) + "</p>",
+        "sort_order": 1,
+    }
+
+
+# --------------------------------------------------------------------------
+# reg_key_of
+# --------------------------------------------------------------------------
+
+@pytest.mark.parametrize("provision_id, expected", [
+    ("sec-1-III-C-1", "1"),
+    ("sec-2-B-II-H", "2"),
+    ("sec-6-A-SUBPART-Kb", "6"),
+    ("sec-8-B-I-C-3", "8"),
+    ("sec-7-B-I-C-1-e-(i)", "7"),
+    ("sec-22-top-REG-22", "22"),
+    ("sec-oooob-5390", "oooob"),
+    ("sec-OOOOa-5397a", "ooooa"),
+    ("", None),
+    ("notasec-7-x", None),
+])
+def test_reg_key_of(provision_id, expected):
+    assert reg_key_of(provision_id) == expected
+
+
+# --------------------------------------------------------------------------
+# Hint selection by row id prefix
+# --------------------------------------------------------------------------
+
+@pytest.mark.parametrize("provision_id, key, marker", [
+    ("sec-1-III-C-1", "1", "Regulation Number 1"),
+    ("sec-2-B-IX-B-3", "2", "Regulation Number 2"),
+    ("sec-6-A-SUBPART-Kb", "6", "Regulation Number 6"),
+    ("sec-8-E-III-M", "8", "Regulation Number 8"),
+])
+def test_specific_hint_selected_by_id_prefix(provision_id, key, marker):
+    system = system_prompt_for(provision_id)
+    assert system.startswith(SYSTEM_PROMPT)
+    assert system.endswith(REG_PROMPT_HINTS[key])
+    assert marker in system
+    # Exactly one hint appended, separated from the base prompt by a blank line.
+    assert system == f"{SYSTEM_PROMPT}\n\n{REG_PROMPT_HINTS[key]}"
+
+
+@pytest.mark.parametrize("provision_id, key", [
+    ("sec-3-B-II-D-1", "3"),
+    ("sec-7-B-I-C-1-e-(i)", "7"),
+    ("sec-22-A-I", "22"),
+    ("sec-26-B-III", "26"),
+])
+def test_shared_colorado_scope_hint(provision_id, key):
+    system = system_prompt_for(provision_id)
+    assert system == f"{SYSTEM_PROMPT}\n\n{REG_PROMPT_HINTS[key]}"
+    assert "8-hour Ozone Control Area" in system
+    assert "attainment-maintenance" in system
+    assert "statewide" in system
+
+
+def test_shared_hint_is_identical_across_existing_colorado_regs():
+    hints = {REG_PROMPT_HINTS[k] for k in ("3", "7", "22", "26")}
+    assert len(hints) == 1
+
+
+@pytest.mark.parametrize("provision_id", [
+    "sec-ooooa-5397a",
+    "sec-oooob-5390",
+    "sec-ooooc-5386",
+])
+def test_no_hint_for_cfr_subparts(provision_id):
+    assert reg_key_of(provision_id) not in REG_PROMPT_HINTS
+    assert system_prompt_for(provision_id) == SYSTEM_PROMPT
+
+
+def test_no_hint_for_unknown_or_malformed_id():
+    assert system_prompt_for("") == SYSTEM_PROMPT
+    assert system_prompt_for("sec-99-A") == SYSTEM_PROMPT
+
+
+def test_reg7_prompt_has_no_reg6_specific_text():
+    system = system_prompt_for("sec-7-B-I-C-1")
+    for reg6_only in (
+        "Regulation Number 6",
+        "adoption-by-reference",
+        "mercury",
+        "Part 75",
+        "UUUUU",
+        "40 CFR Part 60, Subpart Xx",
+    ):
+        assert reg6_only not in system
+    # ...and no other reg-specific hint leaked in either.
+    for key in ("1", "2", "6", "8"):
+        assert REG_PROMPT_HINTS[key] not in system
+
+
+def test_hints_are_reasonably_short():
+    for key, hint in REG_PROMPT_HINTS.items():
+        assert len(hint.split()) <= 200, f"hint for reg {key} is too long"
+
+
+# --------------------------------------------------------------------------
+# build_prompt carries the per-row system prompt (what run_sync/run_batch use)
+# --------------------------------------------------------------------------
+
+@pytest.mark.parametrize("provision_id, key", [
+    ("sec-1-III-C-1", "1"),
+    ("sec-2-B-II-H", "2"),
+    ("sec-6-B-VIII-A", "6"),
+    ("sec-8-B-I-C-3", "8"),
+    ("sec-7-B-I-C-1", "7"),
+])
+def test_build_prompt_system_matches_row_reg(provision_id, key):
+    result = build_prompt(_row(provision_id), meta={})
+    assert result.system == f"{SYSTEM_PROMPT}\n\n{REG_PROMPT_HINTS[key]}"
+    # The hint lives in the system prompt, not the user prompt.
+    assert REG_PROMPT_HINTS[key] not in result.prompt
+
+
+def test_build_prompt_system_unchanged_for_cfr_row():
+    result = build_prompt(_row("sec-oooob-5390"), meta={})
+    assert result.system == SYSTEM_PROMPT
+
+
+def test_build_prompt_user_prompt_unchanged_shape():
+    result = build_prompt(_row("sec-6-A-SUBPART-Kb"), meta={})
+    assert result.prompt.startswith("Provision: X.Y.Z — Test provision")
+    assert "Provision text:" in result.prompt
+    assert result.body_word_count == 40
+    assert result.truncated is False
+
+
+def test_call_sites_use_per_row_system(monkeypatch):
+    """run_sync must send result.system (with hint), not the bare SYSTEM_PROMPT."""
+    captured: list[dict] = []
+
+    class _Usage:
+        input_tokens = 1
+        output_tokens = 1
+
+    class _Block:
+        type = "text"
+        text = "ok"
+
+    class _Message:
+        content = [_Block()]
+        usage = _Usage()
+
+    class _Messages:
+        def create(self, **kwargs):
+            captured.append(kwargs)
+            return _Message()
+
+    class _Anthropic:
+        messages = _Messages()
+
+    monkeypatch.setattr(summarize, "write_summary", lambda *a, **k: None)
+    stats = summarize.RunStats()
+    summarize.run_sync(_Anthropic(), None, [_row("sec-8-B-I-C-3"), _row("sec-oooob-1")],
+                       {}, "claude-sonnet-4-5", stats, dry_run=False)
+    assert len(captured) == 2
+    assert captured[0]["system"] == f"{SYSTEM_PROMPT}\n\n{REG_PROMPT_HINTS['8']}"
+    assert captured[1]["system"] == SYSTEM_PROMPT
+    assert stats.processed == 2
--- orig/page.tsx	2026-09-17 07:34:43.347658432 -0600
+++ page.tsx	2026-09-17 07:36:18.410095780 -0600
@@ -7,10 +7,14 @@
 
 export const metadata = { title: "Review queue" };
 
-const REG_KEYS = ["3", "7", "22", "26", "ooooa", "oooob", "ooooc"] as const;
+const REG_KEYS = ["1", "2", "3", "6", "7", "8", "22", "26", "ooooa", "oooob", "ooooc"] as const;
 const REG_LABELS: Record<string, string> = {
+  "1": "Reg 1",
+  "2": "Reg 2",
   "3": "Reg 3",
+  "6": "Reg 6",
   "7": "Reg 7",
+  "8": "Reg 8",
   "22": "Regulation 22",
   "26": "Reg 26",
   ooooa: "40 CFR 60 Subpart OOOOa",
```
