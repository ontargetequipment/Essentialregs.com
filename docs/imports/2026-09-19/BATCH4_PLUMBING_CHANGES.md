# Batch 4 plumbing changes — APCD general permits GP01–GP12 + federal engine subparts JJJJ/IIII/ZZZZ

Scope: `summarize.py` / `test_summarize.py`, `page.tsx` (`src/app/admin/review/page.tsx`),
`import.yml`. All work done in `/home/claude/working/er/batch4/plumb/`.

## 1. summarize.py — REG_PROMPT_HINTS

**Mechanism chosen:** register the *same* hint string under multiple dict keys
(no new `HINT_ALIASES` indirection layer) — this matches the file's own
existing convention (`_COLORADO_AREA_SCOPE_HINT` is already assigned to keys
`"3"`, `"7"`, `"22"`, `"26"` this way) and keeps `REG_PROMPT_HINTS[key]` /
`system_prompt_for()` working completely unchanged for every reg not in this
batch — a pure additive, no-op change for every other key.

- **`_GP_HINT`** (one shared string, 175 words) registered under all eleven
  keys `gp01, gp02, gp03, gp05, gp06, gp07, gp08, gp09, gp10, gp11, gp12` via
  a small loop right after the dict literal. Covers: permit vs. regulation
  phrasing ("the permit requires" / "permit condition"), Division = APCD /
  Commission = AQCC, "the owner or operator" = registrant, verbatim
  quoting of tpy / g/hp-hr / ppmvd / record-retention periods / deadlines,
  "Condition X" as a same-permit cross-reference, AOS/NOS/RICE/PSD-NANSR/DI
  Communities as permit-defined-only terms, GP09 (attainment) / GP10
  (nonattainment) both closing to new registrations July 15, 2026 but still
  binding on existing registrants with GP12 replacing them (stated only when
  the text says so), and pointing to emission-limit tables rather than
  restating every cell.
- **`REG_PROMPT_HINTS["jjjj"]`** (177 words): Administrator = EPA
  Administrator, "you" = owner/operator, JJJJ = spark-ignition only (never
  conflate with IIII/ZZZZ), emergency vs. non-emergency kept separate,
  model-year/hp-kW/displacement thresholds and g/hp-hr/ppmvd limits live in
  Tables 1–4 (point to them), RICE/2SLB/4SLB/4SRB/NSCR/oxidation catalyst as
  terms of art, certification named to Part 1048/1054/1060/1065/1068,
  "this subpart" = JJJJ only (never Part 60 Subpart A), nothing about
  Colorado unless stated.
- **`REG_PROMPT_HINTS["iiii"]`** (177 words): same shape for
  compression-ignition engines, Tables 1–8, certification named to
  Part 1039/1042/1068.
- **`REG_PROMPT_HINTS["zzzz"]`** (187 words): both SI (JJJJ) and CI (IIII)
  under one NESHAP, area vs. major source of HAP as load-bearing (Tables 2c
  vs. 2d), CO-as-formaldehyde-surrogate stated only when the text says so,
  Tables 1a–8, certification named to Part 1039/1042/1048/1054/1060/1065/1068,
  "this subpart" = ZZZZ only.

All four new hints checked against the existing "Administrator means the EPA
Administrator" wording already in `SYSTEM_PROMPT_TEMPLATE` (the federal-CFR
paragraph) — the new hints restate it per-subpart without contradicting it.

**Word counts** (`hint.split()`, all ≤190 as required): gp = 175, jjjj = 177,
iiii = 177, zzzz = 187.

No other line in `summarize.py` was touched — `reg_key_of()` and
`system_prompt_for()` needed no code changes; both already split on the
first `-`-delimited segment after `sec-`, so `sec-gp02-II-A-2` → `gp02` and
`sec-zzzz-63.6603-(a)` → `zzzz` work with the existing regex.

## 2. test_summarize.py

Added one new section, "Batch 4 hints: GP01-GP12 (shared) and
jjjj/iiii/zzzz", mirroring the existing batch-3 (`cp`/`9`/`24`/`30`) pattern:

- `test_batch4_reg_key_of` — `sec-gp02-II-A-2` → `gp02`,
  `sec-zzzz-63.6603-(a)` → `zzzz`.
- `test_gp_hint_selected_by_id_prefix` — parametrized over all eleven gp
  keys, asserts `system_prompt_for` appends the right hint.
- `test_gp_hint_is_identical_across_all_eleven_keys` — same string object
  content under every gp0X key (mirrors
  `test_shared_hint_is_identical_across_existing_colorado_regs`).
- `test_gp_hint_covers_required_points` — all required markers present.
- `test_engine_subpart_hint_selected_by_id_prefix` /
  `test_jjjj_hint_covers_required_points` /
  `test_iiii_hint_covers_required_points` /
  `test_zzzz_hint_covers_required_points` — required markers per subpart.
- `test_batch4_hints_reasonably_short` — ≤190 words for gp01/jjjj/iiii/zzzz.
- `test_reg7_prompt_has_no_batch4_specific_text` — Reg 7's prompt carries
  none of the new batch-4 vocabulary (isolation, mirrors the existing
  batch-3/ecmc/reg6 leak-check tests).
- `test_jjjj_iiii_zzzz_hints_do_not_conflate_each_other` — JJJJ's hint
  doesn't say "compression-ignition (CI)", IIII's doesn't say
  "spark-ignition (SI)", neither carries the CO/formaldehyde surrogate
  language (that's ZZZZ-only).
- `test_batch4_build_prompt_system_matches_row_reg` — `build_prompt()`
  attaches the right hint to `result.system` and never leaks it into
  `result.prompt`, for one gp key and all three engine-subpart keys.

The existing `test_rendered_prompt_byte_identical_to_before_ecmc_change`
guard test (comparing `system_prompt_for()` against `orig_summarize.py` for
`sec-7-B-I-C-1` and `sec-oooob-5390`) was left untouched and still passes —
none of batch 4's additions touch those two ids' rendered prompt.

**Test run:** `python3 -m pytest -q test_summarize.py` → **103 passed**
(47 test functions, several parametrized; up from the pre-batch-4 baseline).

## 3. page.tsx (`src/app/admin/review/page.tsx`)

- `REG_KEYS`: inserted `"gp01", "gp02", "gp03", "gp05", "gp06", "gp07",
  "gp08", "gp09", "gp10", "gp11", "gp12"` right after `"30"`, and
  `"jjjj", "iiii", "zzzz"` right after `"ooooc"`.
- `REG_LABELS`: added `gp01: "GP01"` … `gp12: "GP12"` (matching the plain
  reg-number label style already used for `"1"`–`"30"`), and
  `jjjj: "JJJJ (40 CFR 60)"`, `iiii: "IIII (40 CFR 60)"`,
  `zzzz: "ZZZZ (40 CFR 63)"` (matching the `"40 CFR 60 Subpart OOOOa"` /
  `"40 CFR 60 Subpart OOOOc"` federal-label style, abbreviated to fit the
  existing filter-chip UI).
- Nothing else in the file changed — the filter chips are rendered from
  `REG_KEYS.map(...)` (line 163 in `orig_page.tsx`), so no other code needed
  touching.

## 4. import.yml

- Input `reg` description: appended `, gp01-gp12, jjjj, iiii, zzzz` to the
  example list.
- "Map reg to source file basename" step:
  - Added `elif [[ "$REG" =~ ^gp[0-9]{2}$ ]]; then SRC_BASENAME="${REG^^}"`
    (bash uppercase parameter expansion) — `gp01` → `GP01`, … `gp12` → `GP12`.
  - Added `elif [[ "$REG" =~ ^(jjjj|iiii|zzzz)$ ]]; then
    SRC_BASENAME="${REG^^}"` — `jjjj` → `JJJJ`, `iiii` → `IIII`,
    `zzzz` → `ZZZZ`.
  - Updated the inline comment and the `::error::` message to mention the
    new key families.
- Verified the bash logic directly (`bash -c` with the exact updated
  if/elif chain) for `gp01, gp12, jjjj, iiii, zzzz, 7, cp, ecmc, oooob,
  badreg` — all eleven/three new keys resolve to the correct upper-cased
  basename, the pre-existing keys are unaffected, and an unknown reg still
  hits the `else` branch and exits 1.
- Nothing else in the file changed. `import_ecfr.py`'s own table-extraction
  step already resolves `Path(pdf).with_suffix(".xml")` generically, so
  `SRC_BASENAME=JJJJ` (etc.) automatically makes it read
  `pipeline/sources/JJJJ.xml` with no further workflow change needed.

## Deliverables

- `summarize.py`, `test_summarize.py`, `page.tsx`, `import.yml` — edited in
  place in this directory.
- `plumb.patch` — `diff -u` of the three edited *code* files
  (`summarize.py`, `page.tsx`, `import.yml`) against their `orig_*`
  pristines. Verified: applies cleanly with `patch -p0` against fresh copies
  of the three `orig_*` files and reproduces the edited files byte-for-byte.
- `PLUMBING_CHANGES.md` — this file.

## Verification summary

| Check | Result |
|---|---|
| `python3 -m pytest -q test_summarize.py` | **103 passed** |
| `reg_key_of("sec-gp02-II-A-2")` | `"gp02"` |
| `reg_key_of("sec-zzzz-63.6603-(a)")` | `"zzzz"` |
| Hint word counts (gp / jjjj / iiii / zzzz) | 175 / 177 / 177 / 187 (all ≤190) |
| Byte-identical guard (`orig_summarize.py`, ids `sec-7-B-I-C-1`, `sec-oooob-5390`) | still passes, untouched |
| `plumb.patch` applies cleanly to `orig_*` copies | confirmed (`patch -p0`, diffed output matches edited files) |
| import.yml basename resolution (bash dry run) | `gp01→GP01`, `gp12→GP12`, `jjjj→JJJJ`, `iiii→IIII`, `zzzz→ZZZZ`, existing keys unaffected |
