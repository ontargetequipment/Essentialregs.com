# EssentialRegs — Known Issues and Fixes

A running log of corpus defects that have actually happened, once each, plus
how they were fixed and which check in `scripts/corpus_qa.sql` now catches a
recurrence. The point of pairing every entry with a check is that the next
occurrence gets caught by a query instead of by somebody happening to look.

Entries are grouped by the check that guards them. See `scripts/corpus_qa.sql`
for the exact SQL and `docs/corpus_qa_baseline_2026-09-22.md` for the first
full run's results.

## ERROR: `truncated_summary`

**Issue.** `pipeline/summarize.py`'s output-stripping step let model
scaffolding through into stored `ai_summary` text in a handful of rows:

- `sec-21-A-V-A-2` and `sec-21-A-VI-DDDDD` ended with a stray `</answer>`
  closing tag.
- `sec-11-H-APPENDIX-A-ATT-IV-1.8` ended with `</explanation>`.
- Two more rows ended with dangling markdown emphasis (`*` / `**`) that had
  no opening partner — the model's own formatting leaking past the strip
  step.
- `sec-26-C-FEDJJJJ-60_4243` is a different failure mode: a genuine
  `MAX_TOKENS` cutoff, ending mid-sentence at "may use propane as an
  alternative fuel for" with no closing punctuation at all.

**Fix.** Summaries were corrected by hand and re-approved through the admin
review flow (`src/app/admin/review/actions.ts`), which preserves the
original AI output in `summary_original` before overwriting `ai_summary`.
The `MAX_TOKENS` row needs a resubmit through `pipeline/summarize.py` with a
higher output budget, not a hand edit.

**Guarded by.** `truncated_summary` — flags any `ai_summary` ending in an
unclosed tag, dangling emphasis, or no sentence-ending punctuation at all.
Worth re-checking the stripping step itself: whatever let three tags through
may have let others through in a form this check doesn't catch (e.g. a tag
that isn't the last thing in the string).

## ERROR: `page_furniture_in_text`

**Issue.** `full_text` captured running-footer text from the source
PDF/HTML instead of just the provision's own words:

- `sec-8-B-I-C-14` is a garbage row: the entire stored text is 40
  characters, `I.C.14. CCR      Code of Colorado Regulations` — that's a
  page footer that got parsed as if it were the provision body.
- `sec-11-H-III` has the same footer text embedded inside an otherwise
  legitimate 6,357-character provision.

**Fix.** `sec-8-B-I-C-14` needs re-import from the correct source page — its
current row should not be treated as real content. `sec-11-H-III` needs the
footer line stripped from its stored `full_text`, keeping the rest.

**Guarded by.** `page_furniture_in_text` — searches for "Code of Colorado
Regulations" (case-insensitive) inside `full_text`. **Known false
positive:** `sec-cp-I-F` also matches — it's the Common Provisions
abbreviations list, where "CCR — Code Of Colorado Regulations" is a
legitimate glossary entry, not captured furniture. The check deliberately
still counts it so the baseline stays comparable across runs; don't treat
every hit as real without checking the id first.

## ERROR: `repeated_text_block`

**Issue.** Five rows, all federal engine/injection provisions, contain two
or more sentences that open with the same 60+ character phrase:
`sec-jjjj-60.4231-(b)`, `sec-jjjj-60.4231-(c)`, `sec-jjjj-60.4231-(d)`,
`sec-iiii-60.4210-(c)`, and `sec-ecmc-803-d-(1)`. All five were checked
against the eCFR/CCR source and are genuine: the regulation really does
write parallel paragraphs ("Stationary SI internal combustion engine
manufacturers must certify... Stationary SI internal combustion engine
manufacturers must certify their emergency... Stationary SI internal
combustion engine manufacturers may certify...") rather than a
duplicate-label import merge.

**Fix.** None needed for these five — they're correct as imported.

**Guarded by.** `repeated_text_block`. This check is intentionally a
candidate list, not a pass/fail gate: formulaic regulatory drafting
produces the same shared-opening-sentence pattern legitimately, all over
the corpus, so the count runs into the hundreds. **Do not bulk-fix or
bulk-dismiss based on this check** — eyeball each new candidate against the
source the way the original five were checked. A tighter, lower-noise
version of this check would need something no query over the stored text
can give it: knowing which repeats are stylistic and which are an import
artifact requires reading the source.

## ERROR: `empty_full_text`, `dangling_internal_xref`, `orphan_parent`

**Issue.** None observed yet in this corpus. `full_text` is `NOT NULL` in
the schema, and `cross_references.target_provision_id` /
`provisions.parent_id` are both foreign keys with `ON DELETE SET NULL`, so
none of these three should ever be non-zero through normal writes.

**Guarded by.** These three checks exist as insurance, not because a defect
happened — they'd only fire if a future migration relaxed a constraint, or
a bulk import ran with constraints deferred or bypassed via the
service-role client. Referential integrity is clean across all 36,517 rows
today; that's genuinely worth protecting.

Note on `dangling_internal_xref` specifically: `target_type = 'internal'`
with a **null** `target_provision_id` is normal, not dangling — it means
the citation resolver recognized the reference as internal but couldn't
(or didn't need to) map it to a specific row. `ProvisionCard.tsx` renders
that case as unlinked text rather than a link. There are 666 such rows in
the corpus today; none of them are counted by this check, and they
shouldn't be.

## GUARD: `public_sample_rows`

**Issue.** The `/sample` page's public row set was set by hand twice
(`supabase/seed_sample.sql`, then `docs/site/sample_rows_2026-09-19.sql`),
each time swapping which rows carry `is_public = true`. It's easy for a
one-off `UPDATE` during review or debugging to leave an extra row public,
or accidentally flip one of the four back off.

**Fix.** N/A — this is a guard against a mistake that hasn't happened yet
in this corpus, not a fix for one that did.

**Guarded by.** `public_sample_rows` — must read exactly 4:
`sec-7-B-I-D-3-a-(i)`, `sec-gp02-II-A-2`, `sec-ecmc-604-a-(1)`,
`sec-cp-I-G-90`. Any other number means a row was flipped without going
through review.

## GUARD: `real_review_backlog`

**Issue.** Naively checking `summary_status = 'pending'` on its own gives
~16,840 rows and looks alarming, but nearly all of them are correct by
design: rows below the summarizer's 25-word threshold never get sent to
the model, so `ai_summary` stays `NULL` and `summary_status` stays at its
default of `'pending'` forever. That's not a backlog, it's expected state
for a structural row (a heading, a "Reserved." stub, a bare part number).

**Fix.** N/A — the fix here was recognizing that the naive check was wrong,
not fixing a data defect.

**Guarded by.** `real_review_backlog` — requires `ai_summary IS NOT NULL`
in addition to `summary_status = 'pending'`. That's the actual backlog: a
summary the model wrote that nobody has approved, edited, or rejected yet.
Currently 0.

## REVIEW: `duplicate_citation_in_part`

**Issue.** The first version of this check grouped by citation alone and
returned 1,312 hits — roughly 94% false positives. Provision ids carry the
Part letter (`sec-7-B-I-E-3-a-(i)`), so Part A's `I.A.1.` and Part B's
`I.A.1.` are different provisions that happen to share a label; grouping
by citation without the Part collapses them together.

**Fix.** Group by regulation **and** Part, not citation alone. That brings
the real number down to 83 — still worth a pass, since a true duplicate
citation inside one Part usually means two provisions got the same label
during import, but not urgent enough to block a launch on.

**Guarded by.** `duplicate_citation_in_part` — extracts the reg key and
Part letter from the id itself (`sec-{reg}-{part}-{suffix}`; a part-less
regulation has no Part segment and groups under a null Part, which is
correct since it has exactly one implicit part).

## REVIEW: `provisions_without_neighbours`

**Issue.** 106 provisions have an embedding but no rows in
`provision_neighbors` — every ANN candidate `recompute_provision_neighbors()`
(`supabase/migrations/006_neighbors_rpc.sql`) examined for them got excluded
as a sibling, the parent, an ancestor, or a descendant, leaving nothing to
link to. This happens to provisions that sit in a small or structurally
isolated corner of the corpus (a short regulation, a lightly-populated
Part) where every nearby-by-meaning candidate also happens to be a
relative.

**Fix.** Parked until after launch. Options on the table: widen the ANN
candidate window (`candidates` param) for provisions in small regulations,
or relax the sibling/ancestor exclusion for very small parts specifically —
neither has been decided yet.

**Guarded by.** `provisions_without_neighbours`.

## INFO: `self_referencing_xref`

**Issue.** 525 rows in `cross_references` have `target_provision_id` equal
to their own `from_provision_id`. Mostly legitimate: phrasing like "as
defined in this section" or "pursuant to this Part" gets picked up by the
citation linker and correctly resolves back to the provision it started
from — the provision really is referring to itself.

**Fix.** None needed; this is expected corpus shape, not a defect.

**Guarded by.** `self_referencing_xref` — a trend line, not an alarm. Worth
watching if the rate jumps sharply between import runs (that could mean
the citation linker started mis-resolving external-looking references back
to the source row), but the current 525 is not itself a problem.

## INFO: `summary_longer_than_long_text`

**Issue.** The first version of this check had no length floor and
returned 9,491 hits, virtually all noise: a `REPEALED` or `Reserved.` stub
is one line of `full_text` and will always have a longer AI summary, since
there's nothing short to say about a stub that isn't longer than the stub
itself.

**Fix.** Added a 500-character floor on `full_text` (after stripping HTML
tags) before comparing lengths. That brings it down to 206 — still only
worth tracking as a trend line, since a summary legitimately can spell out
more than a terse provision says in so many words.

**Guarded by.** `summary_longer_than_long_text`.

## Checks considered and rejected

Not every obvious check earned a place in `corpus_qa.sql`. These were
written, run, and rejected — recorded here so nobody re-adds them without
re-learning why they didn't work:

- **"Text starts with its own citation."** 5,941 rows matched. Not a data
  defect — it's how headings and short leaf rows are legitimately stored.
  `full_text` is stored *without* its citation prefix on purpose (the
  citation lives in the separate `citation` column so the app can rebuild
  navigation from structured data); `withItemIdBadge()`
  (`src/lib/regulation.ts`) re-inserts it at render time. The apparent
  "duplication" some rows show in the stored text is a render-time
  behavior, not a data problem, so it doesn't belong in a data-integrity
  suite.
- **`summary_status = 'pending'` on its own.** ~16,840 rows, all correct by
  design — see `real_review_backlog` above. Must always be paired with
  `ai_summary IS NOT NULL`.
- **"Duplicate citation within a regulation" (no Part in the grouping
  key).** 1,312 hits, ~94% false positives — see
  `duplicate_citation_in_part` above.
- **"Summary longer than the provision" with no length floor.** 9,491
  hits, all noise — see `summary_longer_than_long_text` above.

A check that fires on a quarter of the corpus teaches you to ignore the
report. Every threshold in `corpus_qa.sql` was set by running it and
looking at what came back, not chosen up front.
