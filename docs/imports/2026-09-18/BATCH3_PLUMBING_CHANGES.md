# Batch 3 Plumbing Changes (cp, 9, 24, 30)

Scope: `pipeline/summarize.py`, `src/app/admin/review/page.tsx`, and
`.github/workflows/import.yml`, wiring in the four new AQCC regulations from
batch 3 — `cp` (Common Provisions, 5 CCR 1001-2), `9` (Open Burning /
Prescribed Fire / Permitting), `24` (VOC & Petroleum Liquids
Storage/Processing/Refining), `30` (Toxic Air Contaminants). No network, no
database, no cost — pure code/config edits, verified with the local unit
test suite only.

## 1. `pipeline/summarize.py`

Added four new entries to `REG_PROMPT_HINTS`, one per new regulation, in the
same voice/format as the existing "1", "2", "6", "8", and "ecmc" entries
(distilled from `../agent_cp/REPORT.md`, `../agent_9/REPORT.md`,
`../agent_24/REPORT.md`, `../agent_30/REPORT.md`'s "summarizer" sections).
No other code in the file changed — `system_prompt_for()`, `reg_key_of()`,
and every existing hint are untouched, so every pre-existing regulation's
rendered prompt stays byte-identical (`test_rendered_prompt_byte_identical_
to_before_ecmc_change` still passes unmodified).

- **`"cp"`** (169 words) — flags that Section I.G defines terms used by
  every AQCC regulation ("Commission" = AQCC, "Division" = APCD); that each
  I.G row is a single defined term to summarize as a definition, not a
  general rule, with its own a./b./c. sub-items folded into that one term
  (including the verbatim source typo "SOURCE DEFINTIONS"); that Section
  III's "(State Only)" qualifier and Section IV's "Reserved" status are
  printed as-is; that Section V (V.A–V.V) is rulemaking history; and that
  Table 1 (III.B.3) civil-penalty CPI figures must be quoted exactly.
- **`"9"`** (169 words) — flags "Division" = APCD vs. "Authorized Local
  Agency" as a distinct delegate; the three separate permit tracks (open
  burning, planned-ignition/prescribed fire, unplanned-ignition fire) that
  must never be merged; Section VIII fees as prose, not a table; Section IX
  as rulemaking history; Appendix A/B thresholds and PM10 example
  calculations as Colorado fuel-type specific and verbatim; and "Land
  Manager" / "Significant User of Prescribed Fire" as this regulation's own
  defined terms.
- **`"24"`** (168 words) — flags that several Part B provisions are scoped
  to the ozone nonattainment/attainment-maintenance areas listed in
  Appendix A (never generalized to statewide); "(State Only)" markers as
  printed; Reid vapor pressure, temperatures, torr/psia values, and tank
  capacities (both liters and gallons) as verbatim; Table 1 cargo-tank
  pressure values as plain numbers; Appendices B/C as engineering criteria;
  Part C (including the 2026 Reg 7 → 24/25/26/27 reorganization) as
  rulemaking history, not a current requirement; and "40 CFR Part 60"
  references as named incorporations, not descriptions.
- **`"30"`** (175 words) — flags the TAC vs. PTAC (five named priority
  chemicals) distinction; Appendix A (PTAC list) and Appendix B
  (health-protective benchmarks, approved-vs-pending per the text); verbatim
  compliance dates; acronyms (HQ, IUR, RfC, AIRS ID, HEPA) expanded only as
  the regulation's own text defines them; "Division" = APCD; the genuine
  source omission in Part B's Section I heading row; tables pointed to
  rather than restated; Part C as rulemaking history; and § 25-7-109.5,
  C.R.S. mentioned only if the text itself references it.

All four hints are ≤190 words (169 / 169 / 168 / 175).

## 2. `src/app/admin/review/page.tsx`

- Added `"cp"`, `"9"`, `"24"`, `"30"` to `REG_KEYS`, with `"cp"` placed
  first and the numeric keys kept in ascending numeric order:
  `["cp", "1", "2", "3", "6", "7", "8", "9", "22", "24", "26", "30", "ecmc", "ooooa", "oooob", "ooooc"]`.
- Added matching `REG_LABELS` entries: `cp: "Common Provisions"`,
  `"9": "Reg 9"`, `"24": "Reg 24"`, `"30": "Reg 30"` — matching the existing
  `"Reg <n>"` label style used for "1", "2", "3", "6", "7", "8", "26".

Why: without these, the four new regulations' rows would never show up as
filter chips on the admin review queue, and any review-queue link for them
would fall back to the raw key instead of a readable label.

## 3. `.github/workflows/import.yml`

- In the "Map reg to source file basename" step, added
  `elif [ "$REG" = "cp" ]; then SRC_BASENAME="REG_CP"` (before the `ecmc`
  branch). "9", "24", and "30" need no new branch — they already match the
  existing `^[0-9]+$` numeric-reg branch and resolve to `REG_9`, `REG_24`,
  `REG_30` automatically.
- Updated the `reg` workflow input's `description` to mention `cp`:
  `"Regulation number to (re-)import, e.g. 7, 3, 22, 26, cp, ecmc, oooob, ooooa, ooooc."`
- Updated the `::error::` message in the same step to mention `cp`:
  `"...expected a numeric CCR reg (e.g. 7, 22, 26), cp, ecmc, or one of oooob/ooooa/ooooc."`

Nothing else in the workflow was touched.

## Tests

Added to `test_summarize.py`, following the existing ecmc-hint test
pattern:

- `test_batch3_reg_key_of` — `reg_key_of("sec-cp-I-G-1") == "cp"`,
  `reg_key_of("sec-9-B-I-A") == "9"`, `reg_key_of("sec-24-B-II-C") == "24"`,
  `reg_key_of("sec-30-B-I-A") == "30"`.
- `test_batch3_hint_selected_by_id_prefix` — `system_prompt_for(...)` for a
  row from each new reg equals `SYSTEM_PROMPT + "\n\n" + REG_PROMPT_HINTS[key]`.
- `test_cp_hint_covers_required_points`, `test_reg9_hint_covers_required_points`,
  `test_reg24_hint_covers_required_points`, `test_reg30_hint_covers_required_points`
  — each asserts the hint contains its required markers (definitions,
  terms, section/appendix/table references, etc.).
- `test_batch3_hints_reasonably_short` — each of the four hints is
  `<= 190` words.
- `test_reg7_prompt_has_no_batch3_specific_text` — none of the four new
  hints, or reg-specific-only terms from them, leak into an unrelated
  reg's (Reg 7's) rendered prompt.

**Test run:** `python3 -m pytest -q test_summarize.py` → **72 passed**
(the pristine `orig_test_summarize.py` alone passes 55; this change adds
17 new tests on top, and every pre-existing test, including the
`orig_summarize.py` byte-identical guard, still passes unmodified).

## Diff

`plumb.patch` (in this directory) is `diff -u` of the three edited files
against their pristine `orig_*` copies:
- `summarize.py` vs `orig_summarize.py`
- `page.tsx` vs `orig_page.tsx`
- `import.yml` vs `orig_import.yml`

(`test_summarize.py`'s own diff against `orig_test_summarize.py` is not
included in `plumb.patch`, per scope — only the three edited application
files are covered there.)
