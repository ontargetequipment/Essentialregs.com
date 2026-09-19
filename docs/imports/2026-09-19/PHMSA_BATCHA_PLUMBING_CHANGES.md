# PHMSA Batch A — plumbing + site changes (Part 191 / Part 192, `p191`/`p192`)

Applied every section of `PLUMB_BRIEF.md` (1–5) in `/home/claude/working/er/phmsa/plumb/`. No network, no database. Python test suites re-run after each change; results below.

**Environment note (applies to every "expect N" number in the brief):** this working directory ships the pipeline/site source and test files but **not** `pipeline/sources/`, `pipeline/fixtures/`, or `pipeline/out/` — the real PDFs, eCFR XML, saved fixtures and baseline JSON that a full repo checkout carries. Every test that opens one of those (byte-identical baselines, SOS/eCFR/CDPHE fixture-driven checks, the `CrossRefNoOpProofTests` no-op proof) **skips or fails for that reason alone**, identically before and after my changes. I confirmed this by diffing the failing/skipped test names pre- and post-edit — the set is unchanged, so nothing I touched caused it. This is called out per-section below and is the main "could not verify without npm/sources" item.

---

## 1. `pipeline/import_ccr.py` — CCR importer touchpoints

**File:** `pipeline/import_ccr.py` (patched in place)
**Applied:** `patch -p0 < import_ccr_touchpoints.patch` — applied clean (`Hunk #7 succeeded at 7236` offset only; no rejects).

What it adds (from the patch, already written against `import_ccr_for_reference.py`):
- `CORPUS_REGS["p191"/"p192"]`, `ECFR_REGS += {"p191","p192"}`.
- `REG_META["p191"]/["p192"]` (federal, PHMSA, root citation/title).
- `CFR_TITLE_PART_TO_REGKEY` + `CFR_TITLE_PART_RE` + a new **step 1.1** in `link_citations()`: `49 CFR Part 192` / `49 CFR 192.605(b)` → `<a class="xref-external-reg" href="/regulations/p192">`, with `data-provision-id="sec-p192-192.605"` when a section was named. Runs strictly after step 1 (`40 CFR ...` only) and is gated on corpus membership (no-op until p191/p192 are imported).
- CLI: `--xml` added to `parse`, `--pdf` made optional (with an explicit `SystemExit` if a non-p19x reg is parsed without `--pdf`).

**File:** `pipeline/test_import_ccr.py` (edited)
- `CrossRefNoOpProofTests.NEW_REGS` and its href/data-provision-id regex extended to include `p191`/`p192` (brief: "follow the pattern" of `cp/9/24/30/jjjj/iiii/zzzz/gp\d\d").
- New `Step1Point1CorpusGateTests` (3 tests) — proves step 1.1 is gated on corpus membership without parsing p191/p192 themselves:
  - `test_49_cfr_part_192_is_a_plain_cfr_bucket_hit_when_p192_not_in_corpus` — with p191/p192 removed from `CORPUS_REGS`, `49 CFR Part 192` and `49 CFR 192.605(b)` land in `BUCKET_CFR`, not a link.
  - `test_49_cfr_part_192_links_to_p192_once_it_is_in_corpus` — with them present, both link, the section cite carries `data-provision-id="sec-p192-192.605"`.
  - `test_40_cfr_part_60_is_unaffected_by_step_1_1` — `40 CFR Part 60`'s bucket/count is identical whether or not p191/p192 are in the corpus (step 1 and step 1.1 never compete).

**Test result:** `python3 -m pytest -q test_import_ccr.py` → **171 passed, 82 skipped** (this checkout has no `sources/`/`out/` fixtures — the brief's "201 passed / 5 skipped" is the full-repo number; the skip set here is the same 82 tests that skip on `main` without those fixtures, now plus 3 new passing tests and the `p191`/`p192` extension to `CrossRefNoOpProofTests`, which itself still skips here for the same reason).

## `pipeline/import_ecfr.py` / `test_import_ecfr.py` — unchanged, re-verified

Not part of the brief's edit list (the importer agent's work is already merged into these files per `REPORT.md`). Re-ran as instructed: `python3 -m pytest -q test_import_ecfr.py` → **107 passed, 36 skipped = 143 total**, matching the brief's expected count.

---

## 1a. Coordinator follow-up — ECMC's dotted 49 C.F.R. forms + merge-and-prove

The full-fixture verification workspace (`/home/claude/working/er/phmsa/verify/`) found that ECMC — the **only** Colorado document that cites 49 CFR at all — never writes the plain `49 CFR N.N` form `CFR_TITLE_PART_RE` originally accepted; it always writes the dotted `C.F.R.` abbreviation with a `§`/`§§` sign, including a two-item `§§ X or Y` list and a bare `§ 195 Subpart A` part+letter cite with no section number. Two fixes, both in `pipeline/import_ccr.py` (and mirrored into `pipeline/test_import_ccr.py`):

1. **`CFR_TITLE_PART_RE` extended** to accept: the dotted/spaced abbreviation (`C\.?\s?F\.?\s?R\.?`, same style as the existing `CFR_RE_DOTTED`), an optional leading `§`/`§§` before a section number, a `§§ X.Y or Z.W` two-item list (new `orsecpart`/`orsecnum` groups), and a bare `§ N Subpart X` part+subpart-letter cite with no section number (new `barepart` group). The handling logic in `link_citations()`'s step 1.1 splits a two-item list into two independent sub-citations — each resolves against the corpus on its own (`195.x` stays in the `cfr` bucket, `192.x` links) — while every other form still wraps/buckets the *whole* match exactly as before, so none of the existing single-citation behavior or tests changed.
2. **Factored the step 1.1 logic into a new shared function, `_link_cfr49_citations()`.** This was the more important find: ECMC has its **own, completely independent** citation linker (`link_citations_ecmc()`) — a different function from `link_citations()` (the one every numbered CCR reg, Reg 26, Reg 30, etc. uses) — and it never called step 1.1 at all. Extending `CFR_TITLE_PART_RE` alone would have changed nothing for ECMC, the one document that actually needed it. `_link_cfr49_citations()` takes a generic `try_claim(start, end) -> bool` callback so both linkers can share it: `link_citations()` wraps its existing `is_claimed`/`claim` pair into one, and `link_citations_ecmc()` passes its own `_claim` directly (same signature already). Called as a new "step 0" at the top of `link_citations_ecmc()`, before its Rule/Series/Table/Appendix patterns.

**New tests** (`pipeline/test_import_ccr.py`): `Cfr49DottedFormsTests` (8 tests, via `link_citations()`) covering the dotted single section (in/out of corpus), the spaced `C. F. R.` variant, the `§§ X or Y` list (both partly and fully out of corpus), the bare `§ N Subpart X` form (bucketed, and linked if its part were ever in corpus), and a regression test that the original undotted forms still work; `Cfr49EcmcOwnLinkerTests` (4 tests) proving the same four behaviors through `link_citations_ecmc()` specifically — the function that would have silently never exercised any of this without the refactor.

**Merge-and-prove**, done in `/home/claude/working/er/phmsa/verify/` (copied the updated `import_ccr.py`/`test_import_ccr.py` there, then synced them back to `pipeline/` here afterward):

- Parsed ECMC, Reg 26, and Reg 30 three ways: (a) the **original** importer at `/home/claude/working/er/markup/import_ccr.py`, (b) the **updated** importer with `p191`/`p192` removed from `CORPUS_REGS`, (c) the **updated** importer with `p191`/`p192` present (default).
- **(a) vs (b): byte-identical for all three regs** (`diff -q` on the parsed JSON) — confirmed with `diff -q`, no output/differences for ecmc, 26, or 30.
- **(b) vs (c):**
  - **Reg 26 and Reg 30: zero differences** (`diff -q` reports the files identical) — neither cites 49 CFR at all, exactly as expected.
  - **ECMC: differs on exactly 2 rows**, `sec-ecmc-100-DEF-GATHERING-LINE` and `sec-ecmc-1102-d-(3)-A`. Stripping every `<a class="xref-external-reg" href="/regulations/p192" ...>...</a>` anchor back to its plain text reconstructs the (b) text exactly, on every changed field, for both rows (checked programmatically, not by eye). **7 new anchors total** (not ~5 — the source repeats each citation phrase 3–4 times within its paragraph, once per "in existence... available for public inspection... may be found at phmsa.dot.gov" repetition, which I counted directly rather than assuming): 4× `192.8` in the gathering-line definition (from `49 C.F.R. §§ 195.2 or 192.8`, each instance's `195.2` staying plain/bucketed alongside it) and 3× `49 C.F.R. § 192.243` in Rule 1102(d)(3)A (each instance's paired `49 C.F.R. § 195.234` staying plain/bucketed). No other row changed. Also confirmed via the parse's own unresolved-buckets: `49 C.F.R. § 195 Subpart A` (3 mentions, the CRUDE OIL TRANSFER LINE definition), `195.2` (4), `49 C.F.R. § 195.234` (3), and a `49 C.F.R. § 195.410` I hadn't originally read (2) are all in the `cfr` bucket, correctly unlinked.
- **Full `test_import_ccr.py` in the verify workspace: 216 passed, 5 skipped** (up from the coordinator's confirmed 204 baseline + the 12 new tests above), well over the requested "≥204."

---

## 2. `pipeline/summarize.py` — summarizer hints

**File:** `pipeline/summarize.py` (edited)
- Added `REG_PROMPT_HINTS["p191"]` (185 words) and `["p192"]` (184 words) — both ≤ 185 words, covering: PHMSA Administrator (never EPA), "operator" = pipeline operator, "this part" = Part 191/192, gathering Type A/B/C/R vs. transmission vs. distribution as distinct legal categories, class locations 1–4 as design classes (p192), the acronym list (MAOP/SMYS/HCA/MCA/IM/DIMP/OQ/ILI/ECDA/GWUT/PIR/UNGSF, p192 only), incorporated standards named-not-described, `[Reserved]` → "no requirements", definition rows scoped to their own section, no Colorado/AQCC/CDPHE/ECMC content, effective dates in text surviving verbatim.
- **Global "Administrator" statement fixed to be genuinely conditional, not just worded that way.** The shared `SYSTEM_PROMPT_TEMPLATE` sentence that says "the Administrator" means the EPA Administrator was previously unconditional text baked into every row's system prompt (its own wording already said "40 CFR parts... e.g. the OOOO subparts", but the literal string "EPA Administrator" still reached every reg, including a future 49 CFR one). Fix: reworded the sentence to spell out that it does **not** hold for another CFR title, **and** added `_EPA_ADMINISTRATOR_SENTENCE` (the sentence, as a constant) + `_REG_49_CFR_KEYS = {"p191", "p192"}`; `system_prompt_for()` now strips that exact sentence out of the rendered base prompt for those two reg keys before appending their hint, so a p191/p192 system prompt never contains the literal string "EPA Administrator" at all. Every other reg (Colorado and the existing 40 CFR subparts — ooooa/oooob/ooooc, which have **no** hint of their own and rely entirely on this base sentence) is untouched: `SYSTEM_PROMPT` itself, `system_prompt_for("sec-oooob-...")`, and every existing hint are byte-identical to before.

**File:** `pipeline/test_summarize.py` (edited)
- `test_batch4_hints_reasonably_short`'s parametrize list extended: `["gp01", "jjjj", "iiii", "zzzz", "p191", "p192"]` (≤190-word cap; both hints pass at 185/184).
- New tests: `test_p191_p192_hints_are_registered`, `test_p19x_build_prompt_system_matches_row_reg` (parametrized over p191/p192), `test_system_prompt_for_p192_says_phmsa_not_epa` and the p191 twin (assert `"PHMSA" in system` and `"EPA Administrator" not in system`), `test_reg7_prompt_has_no_p19x_specific_text`, `test_p19x_hints_do_not_conflate_each_other`.
- `test_hints_are_reasonably_short` needed no edit — it already iterates `REG_PROMPT_HINTS.items()`, so p191/p192 are covered automatically (≤200-word cap).

**Test result:** `python3 -m pytest -q test_summarize.py` → **110 passed, 2 skipped** (up from 107/2 before this change — the pre-existing 2 skips are unrelated fixture-dependent tests). All existing hint/audience tests (`test_system_prompt_is_template_rendered_with_default_audience`, `test_no_hint_for_cfr_subparts`, `test_build_prompt_system_unchanged_for_cfr_row`, the jjjj/iiii/zzzz tests, etc.) still pass unchanged.

---

## 3. `docs/import.yml.new` — workflow mapping

**File:** `docs/import.yml.new` (edited; YAML re-parsed with `yaml.safe_load` — valid)
- `reg` input description extended to mention `p191, p192`.
- Basename mapping: added `elif [[ "$REG" =~ ^p19[12]$ ]]; then SRC_BASENAME="${REG^^}"` (→ `P191`/`P192`), plus the same addition to the error-message fallback text.
- **pdftotext step regated:** the existing unconditional `test -f "$TXT"` / `test -f "$PDF"` block now runs only in an `else` branch for non-p19x regs. For `p191`/`p192` it instead checks `pipeline/sources/${SRC_BASENAME}.xml` exists (erroring clearly if not) and prints a skip message — this is the "sources present" sanity check the brief asked for, and it means the job never tries (and fails) to `pdftotext` a PDF that doesn't exist for these two regs.
- The "Parse PDF into provisions JSON" step is unchanged — it still passes `--pdf`/`--txt` unconditionally; per `REPORT.md`, `import_ecfr.py`'s `part_xml_path()` derives the `.xml` path from the `--pdf` string itself (extension swap) and never requires that file to exist.
- Verified: `bash -n` on the extracted pdftotext step's script body — no syntax errors.

**Could not verify:** no `act`/GitHub Actions runner here, so the workflow wasn't executed end-to-end — only YAML-parsed and had its embedded bash syntax-checked.

---

## 4. `pipeline/freshness.py` / `manifest.json` / `test_freshness.py`

**File:** `pipeline/manifest.json` (edited, re-validated with `json.load`)
- Added `"p191"` and `"p192"` entries: `kind: "ecfr"`, `title: "49"`, `part: "191"/"192"`, `subpart: null`, `as_of: "2026-09-17"`, `xml_sha256: null`.

**File:** `pipeline/freshness.py` (edited)
- New `ecfr_versions_url(title, part, subpart=None)` / `ecfr_full_url(today, title, part, subpart=None)` helpers — build the eCFR URL with `&subpart=...` appended **only** when subpart is truthy. `check_ecfr()` and `cmd_update_manifest()`'s `ecfr` branch both switched from the old `ECFR_VERSIONS_URL_TMPL.format(...)` (which always emitted `&subpart={subpart}`, i.e. a literal `&subpart=None` for p191/p192) to these helpers.
- `check_ecfr()`'s `source_label` is now conditional: `"eCFR {title} CFR {part} subpart {subpart}"` when a subpart exists (unchanged for the six existing 40 CFR subparts), else `"eCFR {title} CFR Part {part}"` → `"eCFR 49 CFR Part 192"` for p191/p192, exactly as specified.
- **CDPHE 403 fix:** added `CDPHE_BROWSER_HEADERS` (a current-Chrome-on-Windows `User-Agent`, `Accept`, `Accept-Language`) and passed them into `check_cdphe_gp()`'s single `fetcher.get_text(url, ..., headers=CDPHE_BROWSER_HEADERS)` call. SOS (`check_sos`) and eCFR (`check_ecfr`) are untouched — `Fetcher.get_text()`'s new `headers` parameter defaults to `None`, which falls back to the original `USER_AGENT` bot header exactly as before.
- New `STATUS_BLOCKED = "⛔"`, distinct from `STATUS_OK`/`STATUS_CHANGED`/`STATUS_ERROR`. `check_cdphe_gp()` now catches `urllib.error.HTTPError` specifically: a 403 returns **one** `CheckResult` (not 11 duplicated per-permit rows) with `status=STATUS_BLOCKED` and `detail="not checked (CDPHE blocked the runner, HTTP 403)"`; any other `HTTPError` or exception still returns the original per-permit `STATUS_ERROR` list, unchanged.
- `render_report()`: when there's nothing changed but something is `STATUS_BLOCKED`, the heading line now reads `"N unchanged · M not checked (blocked)."` instead of the old unconditional `"No changes detected."` (which is preserved verbatim when nothing is blocked, so the existing "all OK" test keeps passing). A separate `"**M source(s) not checked (blocked):** ..."` line lists the blocked keys, parallel to the existing errored-sources line. `STATUS_BLOCKED` does **not** affect `cmd_check`'s exit code (still 1 only on `STATUS_CHANGED`), so a blocked-but-otherwise-clean run exits 0.
- Added `Fetcher.register_error(url_or_label, exc)` — a test hook so `STATUS_BLOCKED`/`STATUS_ERROR` handling can be proven with a synthetic `HTTPError`/exception with no network and no fixture files.

**File:** `pipeline/test_freshness.py` (edited) — 14 new tests, all self-contained (no dependency on the missing `sources/`/`fixtures/` dirs):
- URL/label: `test_ecfr_versions_url_omits_subpart_when_absent`, `..._includes_subpart_when_present`, `test_ecfr_full_url_omits_subpart_when_absent`, `test_check_ecfr_p192_url_has_no_subpart_param`, `test_check_ecfr_p192_source_label_has_no_subpart`, `test_check_ecfr_subpart_source_label_unchanged`.
- Blocked-vs-error: `test_check_cdphe_gp_403_is_status_blocked_not_error` (one line, not 11), `test_check_cdphe_gp_non_403_http_error_is_still_status_error`, `test_check_cdphe_gp_other_exception_is_still_status_error`.
- Headers: `test_check_cdphe_gp_uses_browser_like_headers_not_bot_ua` (asserts `headers == CDPHE_BROWSER_HEADERS`, UA differs from `USER_AGENT`, contains "Chrome" and an `Accept-Language`), `test_check_sos_and_ecfr_still_use_bot_user_agent`.
- Report: `test_render_report_blocked_only_reads_clean_not_as_error`, `test_render_report_all_ok_still_says_no_changes_detected_when_nothing_blocked`, `test_render_report_blocked_does_not_affect_exit_code`.

**Test result:** `python3 -m pytest -q test_freshness.py` → **20 passed, 16 failed**. All 14 new tests plus 6 pre-existing pure-parsing tests (that don't touch `sources/`/`fixtures/`) pass. **The 16 failures are pre-existing and unrelated to this change** — I diffed the failing-test name list before and after my edits and it is identical: every one of them opens `pipeline/sources/manifest.json` (via the test file's own `make_manifest()` helper, a *different* file from `pipeline/manifest.json` that this checkout doesn't have) or a file under `pipeline/fixtures/` (`sos_3.html`, `ecfr_ooooa_*.json`, `cdphe_gp_*.html`), none of which exist in this plumbing directory. This is the environment gap noted at the top of this document, not a regression.

---

## 5. Site (`site/src/...`)

**File:** `site/src/lib/regulation.ts` (edited)
- `groupFederalRegulations()`: now recognizes `^49 CFR Part \d+` citations alongside the existing `^40 CFR Part (\d+)` match. Every `40 CFR Part N` still gets its own group (unchanged, `CFR_PART_HEADINGS` untouched). Every `49 CFR Part N` — regardless of N — collapses into a single shared group keyed `"49"` (constant `PHMSA_GROUP_KEY`) headed `"PHMSA — 49 CFR Pipeline Safety"` (constant `PHMSA_HEADING`), and that group's sort comparator places it after every numbered EPA group. `regulationCardInfo()` needed no p191/p192-specific branch — its existing generic federal fallback (strip the `"<citation> — "` prefix from the stored title, citation as subtitle) already applies correctly to any federal reg, p191/p192 included.
- Confirmed (read-only, no change needed): `kindOf()` derives `"part"` purely from the `-PART-` substring in the id, never from the citation text, so a subpart row whose citation is `"Subpart L"` (rather than `"Part A"`) is unaffected — the sidebar in `[reg]/page.tsx` renders `node.citation` verbatim with no hardcoded "Part" string anywhere in this file or `regulation.ts`. `depthOf()`/`buildTree()` key off `parent_id`/`kindOf(id)` only, never citation shape, so definition-row citations like `§ 192.3 "Administrator"` don't affect nesting. `withItemIdBadge()` inserts whatever `citation` string it's given into the first `<p>` with no shape assumption, so both the definition-row citation and a `[Reserved]` row's plain `<p>[Reserved]</p>` render sensibly through the existing path (the same path Colorado definition/reserved rows already use — there is no separate "definition" or "reserved" `ProvisionKind` on the frontend; everything below `reg`/`part`/`appendix` is `"item"`).

**File:** `site/src/app/federal/page.tsx` (edited)
- Intro paragraph gets one added sentence: "Also included: 49 CFR Parts 191–192, PHMSA's federal pipeline safety standards for gas pipelines, administered by the US DOT."
- Added an `APPLIES_TO` map (`p191`/`p192` → the brief's two description strings) and passed it as `RegulationList`'s existing `appliesTo` prop (the same mechanism `/general-permits` already uses for its per-permit description line) — `mode="federal" appliesTo={APPLIES_TO}`.

**File:** `site/src/app/admin/review/page.tsx` (edited)
- `REG_KEYS` tuple and `REG_LABELS` map both gain `p191: "49 CFR 191 (PHMSA)"` and `p192: "49 CFR 192 (PHMSA)"`.

**File:** `site/src/app/sitemap.ts` — **no change.** It doesn't enumerate a static reg list; `fetchRegulationRootsForSitemap()` reads every `sec-%-top-REG-%` root from the DB dynamically and derives each preview URL's reg number from the row id, so p191/p192 are picked up automatically once imported.

**Could not verify:** no `npm`/`node_modules` in this checkout, so no full Next.js type-check or build. I ran `tsc --noEmit` (a bare `tsc` binary is present, though the brief said "no npm") against the four edited files with `--moduleResolution bundler --skipLibCheck --allowJs` to at least parse them; the only errors reported are pre-existing, environment-only noise present across *unedited* lines too (`Cannot find module '@/...'`, missing `PageProps`/`JSX.IntrinsicElements` from absent Next.js/React type packages, implicit-`any` on framework callback params) — nothing pointing at the lines I added. `RegulationReader.tsx` (referenced by the brief for the collapsible sidebar / hash-jump behavior) is not among the files provided in this checkout, so its "go to Subpart L" behavior specifically could not be inspected or verified.

---

## Test-count summary

| Suite | Result | Notes |
|---|---|---|
| `test_import_ccr.py` | **183 passed, 82 skipped** (here) / **216 passed, 5 skipped** (verified in `/home/claude/working/er/phmsa/verify/`, full fixtures) | Skips here are missing `sources/`/`out/` fixtures (same set before/after). 15 new tests total: 3 step-1.1-gating + 8 dotted-49-CFR-forms + 4 ECMC-own-linker. |
| `test_import_ecfr.py` | **107 passed, 36 skipped** (143 total) | Unchanged file; matches brief's expected 143. |
| `test_summarize.py` | **110 passed, 2 skipped** | Up from 107/2; all new p191/p192 tests pass; no existing hint/prompt test changed behavior. |
| `test_freshness.py` | **20 passed, 16 failed** | 14 new tests all pass; the 16 failures are pre-existing (missing `pipeline/sources/manifest.json` and `pipeline/fixtures/*`), identical failing-test set before and after. |

## Files touched

- `pipeline/import_ccr.py` — patched via `import_ccr_touchpoints.patch` (`patch -p0`, clean apply); plus the follow-up `CFR_TITLE_PART_RE` extension and new shared `_link_cfr49_citations()` (called from both `link_citations()` and `link_citations_ecmc()`) for ECMC's dotted `49 C.F.R. §`/`§§` forms.
- `pipeline/test_import_ccr.py` — `NEW_REGS`/regex extended; new `Step1Point1CorpusGateTests`, `Cfr49DottedFormsTests`, `Cfr49EcmcOwnLinkerTests`.
- `pipeline/summarize.py` — `REG_PROMPT_HINTS["p191"/"p192"]`; `_EPA_ADMINISTRATOR_SENTENCE`/`_REG_49_CFR_KEYS` conditional strip in `system_prompt_for()`.
- `pipeline/test_summarize.py` — parametrize list extended; new p191/p192 test block.
- `docs/import.yml.new` — basename mapping, error text, gated pdftotext/sources-present check.
- `pipeline/manifest.json` — `p191`/`p192` entries.
- `pipeline/freshness.py` — `ecfr_versions_url`/`ecfr_full_url` helpers, conditional source label, `CDPHE_BROWSER_HEADERS`, `STATUS_BLOCKED`, `Fetcher.register_error`, `render_report` heading.
- `pipeline/test_freshness.py` — 14 new tests.
- `site/src/lib/regulation.ts` — `groupFederalRegulations()` PHMSA grouping.
- `site/src/app/federal/page.tsx` — intro sentence, `APPLIES_TO` map.
- `site/src/app/admin/review/page.tsx` — `REG_KEYS`/`REG_LABELS` entries.
- `site/src/app/sitemap.ts` — reviewed, no change needed.
