# EssentialRegs batch 3 — merge report (Reg CP, 9, 24, 30)

Work performed entirely in `/home/claude/working/er/batch3/merge/`. All four
patches (`patches/regcp.patch`, `patches/reg9.patch`, `patches/reg24.patch`,
`patches/reg30.patch`) were applied one at a time onto a running copy of
`import_ccr.py` / `test_import_ccr.py`, starting from `import_ccr.ORIGINAL.py`
/ `test_import_ccr.ORIGINAL.py`, in the order **cp → 9 → 24 → 30**. No `git`
3-way merge and no conflict markers were used anywhere — every overlap below
was resolved by hand, reading both sides of the diff and the surrounding
code, then verified against the test suite.

## Apply order and result

| patch | applied against | result |
|---|---|---|
| regcp.patch | ORIGINAL | clean, no rejects |
| reg9.patch | +regcp | applied with fuzz only (offsets from regcp's inserted lines), no rejects |
| reg24.patch | +regcp+reg9 | 2 hunks failed (`import_ccr.py`), 1 hunk failed (`test_import_ccr.py`) — resolved by hand |
| reg30.patch | +regcp+reg9+reg24 | 5 hunks failed (`import_ccr.py`) — resolved by hand |

## Conflicts and how each was resolved

### Reg 24 vs. reg9 (both already applied)

1. **`CORPUS_REGS`** — reg24's hunk expected the pre-reg9 dict; reg9 had
   already inserted `"9": "9"` into the same line. Resolved by adding
   `"24": "24"` alongside it: `"...8": "8", "9": "9", "22": "22", "24": "24", "26": "26",...`.
2. **Trailing `if __name__ == "__main__": unittest.main()` block** — reg9's
   patch deleted this block from the ORIGINAL file's tail and appended its
   new test classes after it *without re-adding it* (a latent bug in reg9's
   own patch, harmless only because reg9 was the last one applied when its
   author wrote it). Reg24's patch still expected that block as trailing
   context. Resolved by appending reg24's new test classes at the true end
   of the file and restoring a single `if __name__ == "__main__":
   unittest.main()` block after them — this trailing block is the one and
   only copy in the final merged file (verified: `reg30.patch` was written
   against a copy where this block was present, so it re-added it correctly
   at the very end once reg30 was applied last).

`REG_META["24"]` and `SOB_PART_CONFIG["24"]` hunks applied cleanly (with
line-offset only) and were verified to have landed inside the correct dict
literals by inspection.

### Reg 30 vs. reg9/reg24 (both already applied)

1. **`CORPUS_REGS`** — same shape as above; added `"30": "30"` by hand.
2. **`REG_NUM_RE` / `BARE_REG_RE`** — untouched by reg9/reg24, so reg30's
   change (accept `"Regulation No."` / `"Regulation No"` alongside
   `"Regulation Number"`) applied by hand exactly as written in the patch.
3. **Appendix marker regex + heading-continuation dedup** — reg9 had
   *already* introduced a generic `heading_extra_lines`/`title_end_line`
   mechanism (via `_heading_continuation_lines` and the
   `APPENDIX_HEADING_DEDUP_REGS` gate) to stop a wrapped appendix title from
   being duplicated as the row's first body paragraph — solving, in a
   reusable way, the exact same class of bug reg30's patch solved with its
   own reg30-specific `heading_extra_lines` field. Rather than laying two
   parallel duplicate-prevention mechanisms on top of each other, I kept
   reg9's generic mechanism and simply:
   - added the optional `:?` to the appendix marker regex (Reg 30 prints
     `"Appendix A: Priority Toxic Air Contaminants"` with a colon, no space)
     — a no-op for every regulation without that colon;
   - added `"30"` to `APPENDIX_HEADING_DEDUP_REGS`.
4. **Uncaptioned-table splice for appendix rows** — reg9's patch (unrelated
   to appendices) had already refactored the per-item `UNCAPTIONED_TABLES`
   swap into a shared `_swap_uncaptioned_table(own_lines, row_id, reg,
   tables_by_caption, table_hits)` helper, called from the ordinary item
   branch of `build_provisions`. Reg30's own `UNCAPTIONED_TABLES["30"]`
   entries (its own Appendix A/B, which print no `"Table N"` caption at all)
   and the `TABLE_CAPTION_EXTRA_RE["30"]` entry had already landed cleanly
   via earlier hunks. The only piece missing was calling the shared helper
   from the *appendix* branch too; added
   `own_lines = _swap_uncaptioned_table(own_lines, aid, reg, tables_by_caption, table_hits)`
   right after the existing `APPENDIX_TABLE_SPLICE_REGS` (reg9-only) call —
   a no-op for every reg without a matching `UNCAPTIONED_TABLES` entry keyed
   to that appendix's own id.
5. **Link text rendering (`num_text`)** — reg30's change to preserve the
   literal printed keyword ("Number" vs. "No."/"No") in the rendered
   `<a>`/`<span>` text instead of hardcoding `"Regulation Number {num}"`
   applied cleanly with only a line-offset; verified in place at the
   `link_citations` "Regulation Number N" step (step 2, right after regcp's
   inserted "1.5) Common Provisions" step).
6. Reg30's own `test_import_ccr.py` hunk (the whole `Reg30*Tests` block, plus
   restoring the trailing `if __name__` block) applied with fuzz only, no
   rejects — this is what supplied the single final `if __name__ ==
   "__main__": unittest.main()` block for the whole merged test file.

### Post-merge test-suite conflict found only by running pytest

`regcp.patch` had added a `CrossRefNoOpProofTests` class proving Reg 1/2/26
parse byte-identically to their pre-batch-3 baselines with `"cp"` alone
removed from `CORPUS_REGS`, and that with `cp` present every difference is a
new `data-provision-id="sec-cp-..."` link. That test predates reg9/24/30
existing in the corpus at all, so once all four regs were merged into one
`CORPUS_REGS`, removing only `"cp"` still left `9`/`24`/`30` in the corpus —
these two tests then failed for real (not a patch-application conflict, a
semantic one): `sec-1-II-C-1` now legitimately links "Regulation Number 9"
to Reg 9, which regcp's narrow `"cp"`-only regex never anticipated.

Fixed by broadening `CrossRefNoOpProofTests` (kept the class, renamed the two
methods, added a `NEW_REGS = ("cp", "9", "24", "30")` constant):

- `test_reg1_reg2_reg26_are_byte_identical_with_new_regs_absent` now removes
  all four new regs from `CORPUS_REGS`, not just `cp`, before comparing to
  the `out/reg{1,2,26}_baseline.json` fixtures.
- `test_reg1_reg2_reg26_diffs_are_only_new_links_to_the_four_new_regs`
  now strips `<a class="xref-external-reg" href="/regulations/(cp|9|24|30)">`
  (both the generic form and cp's own `data-provision-id="sec-cp-..."` form)
  before comparing, and asserts at least one such link explains every
  differing row.

No other test conflicts existed — the four patches added disjoint test
classes keyed to their own reg numbers, so the rest was a straight union.

## 1. Test suite: all green

```
167 passed, 2 skipped in ~63s
```

Both skips are pre-existing and unrelated to batch 3 (gated on files this
checkout doesn't carry): `pipeline/out/reg7_parsed.json`/`reg7_db.json` not
present, and `sources/REG_8.txt` not present. No batch-3 test skipped or
failed.

Test-count accounting (verified by applying each patch alone to
`test_import_ccr.ORIGINAL.py` and collecting):

| file | tests collected |
|---|---|
| ORIGINAL | 103 |
| ORIGINAL + regcp.patch | 130 (+27) |
| ORIGINAL + reg9.patch | 112 (+9) |
| ORIGINAL + reg24.patch | 113 (+10) |
| ORIGINAL + reg30.patch | 123 (+20) |
| **merged** | **169** (103 + 27 + 9 + 10 + 20, exact) |

169 collected = 167 passed + 2 (pre-existing, file-gated) skipped. The
`CrossRefNoOpProofTests` rewrite above kept the method *count* at 2 (renamed
in place), so it doesn't change this arithmetic.

## 2. New regs parse — identical to agent outputs except new cross-links

Parsed all four with the merged importer:

```
python3 import_ccr.py parse --reg cp  --pdf sources/REG_CP.pdf --out out/regcp_parsed.json
python3 import_ccr.py parse --reg 9   --pdf sources/REG_9.pdf  --out out/reg9_parsed.json
python3 import_ccr.py parse --reg 24  --pdf sources/REG_24.pdf --out out/reg24_parsed.json
python3 import_ccr.py parse --reg 30  --pdf sources/REG_30.pdf --out out/reg30_parsed.json
```

Compared row-by-row against `agent_outputs/reg{cp,9,24,30}_parsed.json`: same
id sets in all four cases, and every row with a `full_text` difference
reduces to an identical string once every `<a class="xref-external-reg"
...>`/`<span class="xref" ...>` wrapper on both sides is stripped down to its
inner text (i.e. the underlying prose is untouched; only which citations got
turned into cross-reg links changed, because all four new regs are now in
`CORPUS_REGS` together instead of just one).

| reg | rows | rows differing | new link tags added |
|---|---|---|---|
| cp | 220 | 1 | 2 |
| 9 | 217 | 3 | 4 |
| 24 | 415 | 1 | 2 |
| 30 | 444 | 4 | 10 |

New links found, by reg and target (only entries that exist in one output
but not the other; counted per occurrence):

- **cp** (2 new links, both → Reg 9): `Regulation Number 9` ×1,
  `Regulation 9` ×1 — in `sec-cp-V-K`'s Statement of Basis narrative.
- **9** (4 new links, all → cp): `Common Provisions Regulation` ×2 (one
  rooted to `sec-cp-top-REG-cp`, i.e. the bare regulation name, one more
  specific `Common Provisions` ×1), `Section II.E.` ×1 rooted to
  `sec-cp-II-E` — in `sec-9-IV-C-4-d-i` and `sec-9-IX-F`. (`sec-9-IV-C-4-d-i`
  is the case where, with cp absent, "Section II.E." previously
  self-resolved to Reg 9's own `sec-9-II-E`; with cp present it correctly
  re-attributes to cp's own Section II.E., since the citation's Common
  Provisions Regulation lead-in makes it externally scoped — the underlying
  text is identical, only the more-correct target changed.)
- **24** (2 new links, both → Reg 30): `Regulation Number 30` ×2 — in
  `sec-24-C-II`.
- **30** (10 new links): `Regulation Number 24` ×5 + `Regulation 24` ×1 (→
  Reg 24), `Common Provisions Regulation` ×2 + `Section II.C.` ×2 (→ cp,
  matching the two "Common Provisions Regulation Section II.C." mentions
  called out in the brief) — in `sec-30-C-III` (and 3 other rows).

No other differences of any kind (citation/title/parent_id/sort_order/kind
all identical; no id set differences) — every merge-introduced discrepancy
is exactly the expected new cross-linking.

## 3. Reg 1/2/26 and ECMC — identical to baselines except new cross-links

Parsed Reg 1, 2, 26 and ECMC with the merged importer and compared to
`out/reg{1,2,26}_baseline.json` and `out/ecmc_baseline.json` the same way
(same id sets, `full_text` diffs reduce to identical prose once new
xref-external-reg / xref-span tags are stripped from both sides):

| reg | rows | rows differing | new link tags |
|---|---|---|---|
| 1 | 344 | (all resolve) | 20 |
| 2 | 310 | (all resolve) | 7 |
| 26 | 625 | (all resolve) | 10 |
| ecmc | 6754 | 0 | 0 |

New-link breakdown by target reg, summed across reg1+reg2+reg26:

- **→ cp: 24** (matches the agents' reported cp: 24 exactly) — "Common
  Provisions Regulation"/"Common Provisions"/"Common Provisions regulation"
  variants, plus one `Section I.G.` deep link, spread across all three regs.
- **→ 9: 11** (matches the agents' reported 9: 11 exactly) — all in Reg 1
  ("Regulation Number 9" ×8, "Regulation 9" ×3).
- **→ 24: 2** (matches the agents' reported 24: 2 exactly) — both in Reg 26
  ("Regulation Number 24" ×2).
- **→ 30: 0** (matches the agents' reported 30: 0 exactly) — Reg 30 is never
  cited by number anywhere in Reg 1/2/26's text.

Total 24+11+2+0 = 37, and the measured total across reg1/2/26 (20+7+10) is
also 37 — an exact match, confirming the union is complete and nothing was
double-counted or dropped.

ECMC (6754 rows, ~50s parse) is **byte-identical** to `ecmc_baseline.json` —
zero new links. ECMC's own AQCC cross-references only ever named regs
already in the pre-batch-3 corpus (e.g. Reg 3/7), so adding cp/9/24/30 was a
true no-op for it in this source text.

## 4. diff / apply for each new reg — all sanity checks PASS

Ran, for each of cp/9/24/30, with an empty `[]` db file (no existing DB rows
for these brand-new regs):

```
python3 import_ccr.py diff  --reg <key> --parsed out/reg<key>_parsed.json --db out/reg<key>_db.json --out out/reg<key>_diff_report.md
python3 import_ccr.py apply --reg <key> --parsed out/reg<key>_parsed.json --db out/reg<key>_db.json --out-dir out/apply_reg<key>
```

All three sanity checks in every `stats.md` **PASS**:
`parent_id resolves`, `no id in both delete/upsert`,
`every obsolete id resolves to a surviving ancestor`.

Since the db file is empty, every row is `new` (0 identical/changed/obsolete)
in all four plans. Row counts and rows with ≥25 words of body text
(HTML-stripped) per reg:

| reg | total rows | rows ≥25 words |
|---|---|---|
| cp | 220 | 127 |
| 9 | 217 | 119 |
| 24 | 415 | 199 |
| 30 | 444 | 238 |

## Deviations from the brief

- The brief's rough test-count arithmetic ("~97 original + 10 + 9 + 27 + 13")
  doesn't match the actual per-patch test counts measured above (103 / +27
  (cp) / +9 (reg9) / +10 (reg24) / +20 (reg30)); the real, verified total is
  169 collected (167 pass, 2 pre-existing skips), and that number reconciles
  exactly against each patch applied alone to the ORIGINAL test file, so it
  is treated as authoritative over the brief's approximate figures.
- `CrossRefNoOpProofTests` (added by `regcp.patch`) needed a genuine logic
  fix, not just a textual merge, once reg9/24/30 joined `cp` in
  `CORPUS_REGS` — see the "Post-merge test-suite conflict" section above.
  This is the only place the merge required changing test *logic* rather
  than just placement.
- No other deviations: `import_ccr.ORIGINAL.py`/`test_import_ccr.ORIGINAL.py`
  were never modified; the merged files are exactly ORIGINAL + all four
  patches' changes reconciled as described above.

## Deliverables in this directory

- `import_ccr.py`, `test_import_ccr.py` — merged files, no conflict markers.
- `batch3.patch` — `diff -u import_ccr.ORIGINAL.py import_ccr.py` followed by
  `diff -u test_import_ccr.ORIGINAL.py test_import_ccr.py`.
- `out/reg{cp,9,24,30}_parsed.json`, `out/reg{1,2,26}_parsed.json`,
  `out/ecmc_parsed.json` — fresh parses from the merged importer.
- `out/reg{cp,9,24,30}_db.json` — empty `[]` fixtures used for `diff`/`apply`.
- `out/reg{cp,9,24,30}_diff_report.md`, `out/apply_reg{cp,9,24,30}/` —
  diff reports and apply plans (`plan.json`, `stats.md`, SQL files).
- `MERGE_REPORT.md` — this file.
