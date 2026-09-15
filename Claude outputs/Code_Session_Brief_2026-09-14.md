# Brief for the Claude Code CEO session — September 14, 2026

From the Cowork session (which has Supabase access and ran the Reg 7 summary review). Owner decisions are marked **[Brody]**. The full review report is attached separately as `Reg7_Summary_Review_2026-09-14.md`; commit both files under `docs/`.

## Current database state (verified today)

- Reg 7: 910 provisions have summaries. 356 approved (70 by Brody, 286 by the AI second-pass review), 554 still `pending`: 56 flagged wrong, 40 unverifiable, 458 accurate-but-held because the underlying text is defective (below).
- Reg 3, Reg 26, OOOOb: no summaries generated yet.

## Task 1 — Fix the truncated regulation text (highest priority; it's the product)

Roughly 500+ Reg 7 provisions are missing the first line of their text. Detection heuristic: stripped text begins with a lowercase letter — 1,090 of 1,824 Reg 7 rows match; a random sample showed ~10 of 12 are real truncations. Reg 3: 18 rows, Reg 26: 5, OOOOb: 21 of 40. Confirmed examples:

- `sec-7-B-I-J-1-a` stored text begins "uncontrolled actual volatile organic compound emissions from wet seal fluid…" — the provision actually begins "(State Only) Beginning January 1, 2018, or May 1, 2023 for northern Weld County, owners or operators of…".
- `sec-7-B-VI-C-2-b-(ii)` stored text is just "monitored."
- `sec-7-B-VIII-E-1` begins "format and must contain, at a minimum 170 CODE OF COLORADO REGULATIONS…" (page header leaked in, opening clause gone).

The missing text is not in the neighboring rows — it was dropped. Most likely the importer discarded whatever text shared a line with the citation number. Page headers/footers ("170 CODE OF COLORADO REGULATIONS 5 CCR 1001-9…") also leak into some rows and at least one became a fake number ("45 days" in II.B.2.g.(i) is a page number).

Do: find the original source (the reader HTML the corpus was imported from, or the CCR PDF of Reg 7 — ask Brody where the source file lives if it's not in the repo), fix the importer, re-import Reg 7 (and re-check Reg 3/26/OOOOb), strip page headers/footers, and confirm the lowercase-start count drops to near zero. Re-importing must preserve ids, `is_public`, `sort_order`, and the existing `ai_summary`/review columns where the text didn't change; where `full_text` changes, the `text_updated` trigger will log it. Then regenerate summaries only for rows whose text changed (`--force` on those ids; ~$2) and reset their `summary_status` to `pending`.

## Task 2 — Tighten the summary prompt and regenerate the 56 flagged rows

Systematic errors found: MFCE expanded wrongly (it is "midstream fuel combustion equipment"); invented "through 2026" end dates where the text says "thereafter"; "northern Weld County" added where the text scopes by I.A.3./I.A.4.; invented deadlines/thresholds; acronyms expanded from general knowledge (AIMM = "approved instrument monitoring method" in this regulation); "state-only" claims not in the text; two summaries describing the wrong provision.

Add to the system prompt in `pipeline/summarize.py`: never state a date, number, threshold, geographic scope, or cross-reference that is not present in the provided text; if the text appears to begin mid-sentence, say the applicability/effective-date clause is not shown rather than guessing; expand an acronym only if the regulation defines it (provide the definitions block for MFCE and AIMM); "the Division" means the Colorado Air Pollution Control Division. Then regenerate exactly the 56 flagged ids (list in the report) with `--force`, set them back to `pending`, and report.

## Task 3 — Reader label **[Brody decision]**

**[Brody]** The summary panel must NOT say anything about who or what reviewed it — no "reviewed by a person", no "AI-reviewed", no reviewed date. Replace the status line in `summaryPanelHtml()` (`src/lib/regulation.ts`) and the matching line in `ProvisionCard.tsx` with a single link to the original source document: the provision's `source_url` when present, else the regulation root's `source_url`, labeled "View official source". Keep "AI-generated" out of the visible panel as well; the site's Disclaimer page already covers that summaries are AI-generated. Keep the `summary_status`/`reviewed_by` columns and the `/admin/review` workflow unchanged — they're internal.

Check that `source_url` is populated for Reg 7's root and provisions; if it's null, set the root's `source_url` to the Colorado Secretary of State CCR page for 5 CCR 1001-9 (Regulation Number 7) and fall back to it.

## Task 4 — After Tasks 1–2 land

Tell Brody to ask the Cowork session to re-run the second-pass review on the regenerated rows (it has the Supabase connection); it will approve the passes and hand him only the flags.

## Owner tasks still open (unchanged)
Stripe account + setup (`docs/stripe-setup.md`), Resend SMTP (`docs/security-next-steps.md`).
