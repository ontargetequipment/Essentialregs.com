# ECMC plumbing changes

Three small changes to wire up the new `ecmc` regulation key (Colorado ECMC
rules, 2 CCR 404-1). Each edited file has an `orig_<name>` copy alongside it
in this directory for reference/rollback.

## 1. `import.yml`

Added `ecmc` -> `ECMC` to the "Map reg to source file basename" step,
updated the `reg` input description, and updated the validate-step error
text. YAML formatting (including the file's existing CRLF line endings) is
unchanged everywhere else.

```diff
--- orig_import.yml
+++ import.yml
@@ -4,7 +4,7 @@
   workflow_dispatch:
     inputs:
       reg:
-        description: "Regulation number to (re-)import, e.g. 7, 3, 22, 26, oooob, ooooa, ooooc."
+        description: "Regulation number to (re-)import, e.g. 7, 3, 22, 26, ecmc, oooob, ooooa, ooooc."
         required: true
       execute:
         description: "Execute: actually write the plan to Supabase. Leave unchecked to only parse/export/diff/build the apply plan and upload the report -- no database writes."
@@ -41,6 +41,8 @@
           # oooob -> OOOOb.pdf/.txt, ooooa -> OOOOa.pdf/.txt, ooooc -> OOOOc.pdf/.txt.
           if [[ "$REG" =~ ^[0-9]+$ ]]; then
             SRC_BASENAME="REG_${REG}"
+          elif [ "$REG" = "ecmc" ]; then
+            SRC_BASENAME="ECMC"
           elif [ "$REG" = "oooob" ]; then
             SRC_BASENAME="OOOOb"
           elif [ "$REG" = "ooooa" ]; then
@@ -48,7 +50,7 @@
           elif [ "$REG" = "ooooc" ]; then
             SRC_BASENAME="OOOOc"
           else
-            echo "::error::Don't know the source file basename for reg '$REG' -- expected a numeric CCR reg (e.g. 7, 22, 26) or one of oooob/ooooa/ooooc."
+            echo "::error::Don't know the source file basename for reg '$REG' -- expected a numeric CCR reg (e.g. 7, 22, 26), ecmc, or one of oooob/ooooa/ooooc."
             exit 1
           fi
           echo "SRC_BASENAME=${SRC_BASENAME}" >> "$GITHUB_ENV"
```

(File verified to still be CRLF-terminated throughout after the edit.)

## 2. `summarize.py`

Three parts, as specified:

**(a) `REG_PROMPT_HINTS["ecmc"]`** — distilled from
`ECMC_SUMMARIZER_WARNINGS.md`, 183 words (within the ~190-word budget and
in the same voice as the "1"/"2"/"6"/"8" hints). Exact text:

> This row is from Colorado's ECMC rules (2 CCR 404-1). "Commission" means
> the Energy and Carbon Management Commission (ECMC, formerly COGCC), never
> the AQCC. This document has no APCD "Division" -- don't default to that
> expansion; "Director" and "LGD" (Local Governmental Designee) are
> ECMC-specific roles instead. "Relevant Local Government" and "Proximate
> Local Government" are distinct defined terms -- never conflate them. Use
> Disproportionately Impacted Community, Cumulative Impacts, Working Pad
> Surface, Oil and Gas Location, and High Priority Habitat only as this text
> itself defines them. A "Form N" reference (e.g. Form 2, 5, 7, 19, 42) is
> an ECMC form -- name it, don't describe its contents. Quote setback
> distances exactly; never round or generalize them. A 1300 Series (Deep
> Geothermal) or 1400 Series (Class VI UIC) rule incorporates the 200-1200
> Series rules by cross-reference rather than restating them -- say that
> rather than treating the rule as short and self-contained. 100 Series
> rows are definitions. Table 423-1/423-2 render as plain text, not a grid.
> The History tail at the end of Appendix IX is a rulemaking changelog, not
> part of Form 41.

**(b) Audience hook.** Introduced `DEFAULT_AUDIENCE` (the exact wording that
used to be hardcoded inline: `"an EHS or compliance person at a Colorado
oil & gas operator"`), `REG_AUDIENCE: dict[str, str] = {}` (empty — no reg
overrides it yet), and `SYSTEM_PROMPT_TEMPLATE` (the old `SYSTEM_PROMPT`
text with the audience clause replaced by a `{audience}` placeholder).
`SYSTEM_PROMPT` is now `SYSTEM_PROMPT_TEMPLATE.format(audience=DEFAULT_AUDIENCE)`
— byte-identical to the old literal, since string concatenation +
`.format()` reproduce it exactly. `system_prompt_for()` renders the
template with `REG_AUDIENCE.get(key, DEFAULT_AUDIENCE)` before appending the
regulation hint. Since `REG_AUDIENCE` is empty, every reg (including `ecmc`)
renders with `DEFAULT_AUDIENCE`, so this is a pure hook for now.

**(c) Docstring / `--reg` help** — both example lists now include `ecmc`
alongside the existing numeric/CFR examples.

Full diff:

```diff
--- orig_summarize.py
+++ summarize.py
@@ -27,7 +27,7 @@
     # Regenerate every summary in Reg 3 from scratch.
     python pipeline/summarize.py --reg 3 --force
 
-    # --reg takes any regulation id prefix: 1, 2, 3, 6, 7, 8, 22, 26,
+    # --reg takes any regulation id prefix: 1, 2, 3, 6, 7, 8, 22, 26, ecmc,
     # ooooa, oooob, ooooc. Regs listed in REG_PROMPT_HINTS get an extra
     # regulation-specific paragraph appended to the system prompt per row.
 
@@ -88,9 +88,19 @@
 NBSP_RE = re.compile(r"&nbsp;")
 WS_RE = re.compile(r"\s+")
 
-SYSTEM_PROMPT = (
-    "You are explaining a legal/regulatory provision to an EHS or compliance "
-    "person at a Colorado oil & gas operator who is NOT a lawyer and does "
+DEFAULT_AUDIENCE = (
+    "an EHS or compliance person at a Colorado oil & gas operator"
+)
+
+# Per-regulation override of the audience clause in SYSTEM_PROMPT, keyed by
+# the row's own regulation key (see REG_PROMPT_HINTS below for the same
+# keying). Regs with no entry get DEFAULT_AUDIENCE -- this is the hook for a
+# future non-oil-and-gas regulation to swap in its own reader description;
+# ECMC is still oil & gas, so it gets no entry here.
+REG_AUDIENCE: dict[str, str] = {}
+
+SYSTEM_PROMPT_TEMPLATE = (
+    "You are explaining a legal/regulatory provision to {audience} who is NOT a lawyer and does "
     "not want to wade through legal language. Write 2-5 short sentences in "
     "plain, everyday English, the way you'd explain it out loud to a "
     "coworker: who it applies to, what it requires or prohibits, and any "
@@ -151,6 +161,11 @@
     "summary."
 )
 
+# The rendered prompt for the default (oil & gas) audience -- every existing
+# call site and test refers to this literal string, so it must stay
+# byte-identical to the pre-audience-hook wording.
+SYSTEM_PROMPT = SYSTEM_PROMPT_TEMPLATE.format(audience=DEFAULT_AUDIENCE)
+
 # Regulation-specific guidance appended to SYSTEM_PROMPT per ROW, keyed by
 # the row's own regulation key (the "<regkey>" in an id like
 # "sec-<regkey>-..."), so it applies in full-corpus runs (no --reg) and
@@ -255,6 +270,27 @@
     "7": _COLORADO_AREA_SCOPE_HINT,
     "22": _COLORADO_AREA_SCOPE_HINT,
     "26": _COLORADO_AREA_SCOPE_HINT,
+    "ecmc": (
+        "This row is from Colorado's ECMC rules (2 CCR 404-1). \"Commission\" "
+        "means the Energy and Carbon Management Commission (ECMC, formerly "
+        "COGCC), never the AQCC. This document has no APCD \"Division\" -- "
+        "don't default to that expansion; \"Director\" and \"LGD\" (Local "
+        "Governmental Designee) are ECMC-specific roles instead. \"Relevant "
+        "Local Government\" and \"Proximate Local Government\" are distinct "
+        "defined terms -- never conflate them. Use Disproportionately "
+        "Impacted Community, Cumulative Impacts, Working Pad Surface, Oil "
+        "and Gas Location, and High Priority Habitat only as this text "
+        "itself defines them. A \"Form N\" reference (e.g. Form 2, 5, 7, 19, "
+        "42) is an ECMC form -- name it, don't describe its contents. Quote "
+        "setback distances exactly; never round or generalize them. A 1300 "
+        "Series (Deep Geothermal) or 1400 Series (Class VI UIC) rule "
+        "incorporates the 200-1200 Series rules by cross-reference rather "
+        "than restating them -- say that rather than treating the rule as "
+        "short and self-contained. 100 Series rows are definitions. Table "
+        "423-1/423-2 render as plain text, not a grid. The History tail at "
+        "the end of Appendix IX is a rulemaking changelog, not part of Form "
+        "41."
+    ),
 }
 
 
@@ -293,10 +329,15 @@
 
 
 def system_prompt_for(provision_id: str) -> str:
-    """SYSTEM_PROMPT plus this row's regulation hint (REG_PROMPT_HINTS),
-    when one exists; otherwise SYSTEM_PROMPT unchanged."""
-    hint = REG_PROMPT_HINTS.get(reg_key_of(provision_id) or "")
-    return f"{SYSTEM_PROMPT}\n\n{hint}" if hint else SYSTEM_PROMPT
+    """SYSTEM_PROMPT_TEMPLATE rendered for this row's audience
+    (REG_AUDIENCE.get(key, DEFAULT_AUDIENCE)) plus this row's regulation hint
+    (REG_PROMPT_HINTS), when one exists. No reg currently overrides
+    REG_AUDIENCE, so this renders byte-identically to SYSTEM_PROMPT for every
+    existing reg; it's the hook for a future non-oil-and-gas regulation."""
+    key = reg_key_of(provision_id) or ""
+    base = SYSTEM_PROMPT_TEMPLATE.format(audience=REG_AUDIENCE.get(key, DEFAULT_AUDIENCE))
+    hint = REG_PROMPT_HINTS.get(key)
+    return f"{base}\n\n{hint}" if hint else base
 
 
 # --------------------------------------------------------------------------
@@ -784,7 +825,7 @@
     )
     parser.add_argument(
         "--reg", default=None,
-        help="Limit to one regulation's id prefix, e.g. 1, 2, 3, 6, 7, 8, 26, oooob. "
+        help="Limit to one regulation's id prefix, e.g. 1, 2, 3, 6, 7, 8, 26, ecmc, oooob. "
              "Omit to run against every regulation. Ignored if --ids-file is given.",
     )
     parser.add_argument(
```

### `test_summarize.py`

Added tests covering:
- `test_ecmc_hint_selected_by_id_prefix` / `test_ecmc_hint_covers_required_points`
  / `test_ecmc_hint_reasonably_short` — the new hint is picked up for
  `sec-ecmc-...` ids, covers every required warning topic, and stays under
  190 words.
- `test_reg7_prompt_has_no_ecmc_specific_text` — the ecmc hint doesn't leak
  into other regs.
- `test_system_prompt_is_template_rendered_with_default_audience`,
  `test_default_audience_matches_original_wording`,
  `test_no_reg_overrides_audience_yet`,
  `test_every_existing_and_new_reg_uses_default_audience` — the audience
  hook exists, defaults correctly, and nothing overrides it yet.
- `test_rendered_prompt_byte_identical_to_before_ecmc_change` (reg 7 and
  oooob) — loads `orig_summarize.py` as a separate module and asserts
  `system_prompt_for()` for those two ids returns exactly what it did
  before this change.

```diff
--- orig_test_summarize.py
+++ test_summarize.py
@@ -105,8 +105,11 @@
 import summarize  # noqa: E402
 from summarize import (  # noqa: E402
+    DEFAULT_AUDIENCE,
+    REG_AUDIENCE,
     REG_PROMPT_HINTS,
     SYSTEM_PROMPT,
+    SYSTEM_PROMPT_TEMPLATE,
     build_prompt,
     reg_key_of,
     system_prompt_for,
 )
@@ (before test_call_sites_use_per_row_system) @@
+# --------------------------------------------------------------------------
+# ECMC hint (added Sept 17 2026)
+# --------------------------------------------------------------------------
+
+@pytest.mark.parametrize("provision_id", [
+    "sec-ecmc-100-a",
+    "sec-ecmc-604-b-(1)",
+    "sec-ecmc-1301-a",
+    "sec-ecmc-APPENDIX-IX",
+])
+def test_ecmc_hint_selected_by_id_prefix(provision_id):
+    system = system_prompt_for(provision_id)
+    assert system == f"{SYSTEM_PROMPT}\n\n{REG_PROMPT_HINTS['ecmc']}"
+    assert "Energy and Carbon Management Commission" in system
+    assert "AQCC" in system
+
+
+def test_ecmc_hint_covers_required_points():
+    hint = REG_PROMPT_HINTS["ecmc"]
+    for marker in (
+        "ECMC", "formerly", "COGCC", "APCD", "Division", "Director", "LGD",
+        "Local Governmental Designee", "Relevant Local Government",
+        "Proximate Local Government", "Disproportionately Impacted "
+        "Community", "Cumulative Impacts", "Working Pad Surface",
+        "Oil and Gas Location", "High Priority Habitat", "ECMC form",
+        "setback", "1300 Series", "1400 Series", "200-1200 Series",
+        "100 Series", "definitions", "Table 423-1", "423-2", "History",
+        "Appendix IX", "Form 41",
+    ):
+        assert marker in hint, f"missing {marker!r} from ecmc hint"
+
+
+def test_ecmc_hint_reasonably_short():
+    assert len(REG_PROMPT_HINTS["ecmc"].split()) <= 190
+
+
+def test_reg7_prompt_has_no_ecmc_specific_text():
+    system = system_prompt_for("sec-7-B-I-C-1")
+    assert REG_PROMPT_HINTS["ecmc"] not in system
+    for ecmc_only in ("ECMC", "1300 Series", "Form 41"):
+        assert ecmc_only not in system
+
+
+# --------------------------------------------------------------------------
+# Audience hook (REG_AUDIENCE / DEFAULT_AUDIENCE / SYSTEM_PROMPT_TEMPLATE)
+# --------------------------------------------------------------------------
+
+def test_system_prompt_is_template_rendered_with_default_audience():
+    assert SYSTEM_PROMPT == SYSTEM_PROMPT_TEMPLATE.format(audience=DEFAULT_AUDIENCE)
+
+
+def test_default_audience_matches_original_wording():
+    assert DEFAULT_AUDIENCE == (
+        "an EHS or compliance person at a Colorado oil & gas operator"
+    )
+
+
+def test_no_reg_overrides_audience_yet():
+    # ECMC stays on the O&G default -- REG_AUDIENCE is a hook for a future
+    # non-oil-and-gas regulation, not yet populated.
+    assert REG_AUDIENCE == {}
+
+
+@pytest.mark.parametrize("provision_id", [
+    "sec-7-B-I-C-1",
+    "sec-ecmc-100-a",
+    "sec-oooob-5390",
+    "sec-1-III-C-1",
+])
+def test_every_existing_and_new_reg_uses_default_audience(provision_id):
+    system = system_prompt_for(provision_id)
+    assert system.startswith(SYSTEM_PROMPT_TEMPLATE.format(audience=DEFAULT_AUDIENCE))
+
+
+# --------------------------------------------------------------------------
+# Byte-identical guarantee: adding the ecmc hint/audience hook must not
+# change the rendered prompt for any pre-existing regulation.
+# --------------------------------------------------------------------------
+
+def _load_orig_summarize():
+    import importlib.util
+
+    orig_path = Path(__file__).resolve().parent / "orig_summarize.py"
+    spec = importlib.util.spec_from_file_location("orig_summarize", orig_path)
+    module = importlib.util.module_from_spec(spec)
+    sys.modules["orig_summarize"] = module
+    spec.loader.exec_module(module)  # type: ignore[union-attr]
+    return module
+
+
+@pytest.mark.parametrize("provision_id", [
+    "sec-7-B-I-C-1",
+    "sec-oooob-5390",
+])
+def test_rendered_prompt_byte_identical_to_before_ecmc_change(provision_id):
+    orig = _load_orig_summarize()
+    assert system_prompt_for(provision_id) == orig.system_prompt_for(provision_id)
+
+
 def test_call_sites_use_per_row_system(monkeypatch):
```

(This diff is a summary for readability — see `diff -u orig_test_summarize.py
test_summarize.py` for the literal patch, which applies cleanly.)

### Test run

```
$ python3 -m pytest -q test_summarize.py
.......................................................                  [100%]
55 passed in 0.04s
```

## 3. `page.tsx` (`/admin/review`)

Added `"ecmc"` to `REG_KEYS` (after `"26"`, before the CFR subparts) and
`ecmc: "ECMC rules"` to `REG_LABELS`. Nothing else touched.

```diff
--- orig_page.tsx
+++ page.tsx
@@ -7,7 +7,7 @@
 
 export const metadata = { title: "Review queue" };
 
-const REG_KEYS = ["1", "2", "3", "6", "7", "8", "22", "26", "ooooa", "oooob", "ooooc"] as const;
+const REG_KEYS = ["1", "2", "3", "6", "7", "8", "22", "26", "ecmc", "ooooa", "oooob", "ooooc"] as const;
 const REG_LABELS: Record<string, string> = {
   "1": "Reg 1",
   "2": "Reg 2",
@@ -17,6 +17,7 @@
   "8": "Reg 8",
   "22": "Regulation 22",
   "26": "Reg 26",
+  ecmc: "ECMC rules",
   ooooa: "40 CFR 60 Subpart OOOOa",
   oooob: "OOOOb",
   ooooc: "40 CFR 60 Subpart OOOOc",
```

## Files in this directory

- `import.yml`, `summarize.py`, `test_summarize.py`, `page.tsx` — edited.
- `orig_import.yml`, `orig_summarize.py`, `orig_test_summarize.py`,
  `orig_page.tsx` — pre-edit copies, kept for diffing/rollback.
- `ECMC_SUMMARIZER_WARNINGS.md` — source material for the `ecmc` hint
  (unchanged, read-only reference).
