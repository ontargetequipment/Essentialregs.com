# CCR importer spec (pipeline/import_ccr.py)

Goal: parse an official Colorado Code of Regulations PDF (AQCC regulations such as Reg 3, 7, 26) into the `provisions` rows this app uses, with the SAME id scheme, hierarchy, sort order, and HTML conventions as the rows already in the database — so a re-import fixes text without breaking ids, summaries, review status, or cross-reference links.

## Inputs
- `pipeline/sources/REG_7.pdf` (771 pp) and `pipeline/sources/REG_7.txt` (already produced with `pdftotext -layout`). Same for REG_3, REG_26. `OOOOb.pdf` is a federal eCFR print (different layout; later).

## Existing id scheme (must be reproduced exactly)
- Regulation root: `sec-7-top-REG-7` (citation "Regulation 7", sort_order 0, parent null, full_text = "Regulation 7").
- Part: `sec-7-P-A`, `sec-7-P-B`, `sec-7-P-C` … (citation "PART B" style; full_text is the plain heading text, no `<p>`).
- Section under a part: `sec-7-B-I` (Part B, Section I). full_text = "I. Volatile Organic Compound Emissions from Oil and Gas Operations" (plain heading, citation "I.", title = the heading).
- Nested items: each level appends the label without trailing period: `sec-7-B-I-J` (I.J.), `sec-7-B-I-J-1` (I.J.1.), `sec-7-B-I-J-1-a` (I.J.1.a.), `sec-7-B-I-J-1-a-(i)` (I.J.1.a.(i)), `sec-7-B-I-J-1-a-(i)-(A)` (…(A)), `sec-7-B-III-C-4-c-(ii)-(A)-(1)` (…(1)). Parenthesized labels keep their parentheses in the id.
- Part C (Statements of Basis…): sections are `sec-7-C-XVII` etc., with sub-items like `sec-7-C-I-D-5-g-(iii)`; some Part C headings are lettered, e.g. `sec-7-C-CC`, `sec-7-C-DD`, `sec-7-C-DI`, `sec-7-C-M`.
- Appendix: `sec-7-A-APPENDIX-A` pattern (`-APPENDIX-` in the id marks kind "appendix"); `-PART-` may also appear in some corpora — check the DB.
- `citation` = the label as printed with trailing period, e.g. "I.J.1.a." ; `title` = citation for items, or "I.J.1. Centrifugal compressor" when the label is followed by a heading-only line.
- `sort_order` = document order × 10 (0, 10, 20 …) — keep existing values where the id already exists; new ids get interleaved values.
- `jurisdiction_level` = 'state', `issuing_body` = 'CDPHE-APCD' for AQCC regs (check existing rows and copy).
- `parent_id` = the id of the enclosing label (item → its parent item/section; section → part; part → root).

## full_text HTML conventions (match the existing rows)
- Heading-type rows (root, parts, sections, items whose text is only a heading): plain text, no tags.
- Item text: `<p>…</p>` per paragraph. Do NOT include the citation label itself in the text (the app re-inserts it as a badge). Keep "(State Only)" prefixes in the text.
- Tables: `<div class="doc-table-wrap"><div class="doc-table-caption">Table 2 …</div><table class="doc-table"><thead>…</thead><tbody>…</tbody></table></div>`. Recover table cells from the PDF with pdfplumber where `pdftotext -layout` garbles them (Reg 7 Tables 2/3 in II.C.2.b.(ii)(G) and II.E.3.e are known-garbled in the current DB).
- Cross-references inside the text:
  - Same regulation: `<span class="xref" data-target="sec-7-B-I-A-3">Section I.A.3.</span>`; also "Sections I.D.3.b.(x) through I.D.3.b.(xii)" → each citation gets its own span; "Part B" → `data-target="sec-7-P-B"`; bare "Regulation Number 7" → `data-target="sec-7-top-REG-7"`.
  - Another regulation in the corpus (3, 26, oooob): `<a class="xref-external-reg" href="/regulations/26">Regulation Number 26</a>` (and, when a section is named, link to the reg page; deeper targets can be a later improvement).
  - Regulations/CFR parts NOT in the corpus: leave as plain text but record them in an "unresolved references" list in the report (citation text, count).
- Strip page furniture: lines like "CODE OF COLORADO REGULATIONS 5 CCR 1001-9", "Air Quality Control Commission", and bare page numbers; never let a page number attach to a sentence (the current DB has "must be installed and operating by 45 CODE OF COLORADO…").
- Join wrapped lines into paragraphs; keep paragraph breaks where the PDF has a blank line or a new label.

## Truncation bug to fix
The current DB rows for ~500+ Reg 7 items are missing the text that shared the first line with the label (e.g. `sec-7-B-I-J-1-a` stored text starts "uncontrolled actual…" but the PDF line is "I.J.1.a. Beginning January 1, 2018, or May 1, 2023, if located in northern Weld County, uncontrolled actual…"). The parser must keep that first-line text.

## Deliverables (dry run — NO database writes)
1. `pipeline/import_ccr.py` — `python pipeline/import_ccr.py parse --reg 7 --pdf pipeline/sources/REG_7.pdf --out pipeline/out/reg7_parsed.json` produces a JSON list of provisions {id, citation, title, parent_id, sort_order, full_text, kind}. Also `diff --reg 7 --parsed … --db pipeline/out/reg7_db.json` producing `pipeline/out/reg7_diff_report.md`. An `apply` subcommand can be stubbed with a clear TODO (writes happen later via the service-role key in GitHub Actions or via SQL files).
2. `pipeline/out/reg7_db.json` — export of current DB rows for Reg 7 (id, citation, title, parent_id, sort_order, full_text) obtained with the Supabase MCP `execute_sql` tool in pages (the tool saves large results to a file — read that file with Python, don't paste it into context). Project id `tpuowazmmhqlsakghojy`.
3. `pipeline/out/reg7_diff_report.md` — counts: parsed rows; DB rows; ids in both / only DB / only parsed (list the only-DB and only-parsed ids — they indicate parser gaps or DB junk); rows where DB text is a suffix of parsed text (= truncation confirmed) vs identical vs different; page-furniture leaks found in DB; unresolved external references (top 20); 15 random side-by-side samples (first 200 chars DB vs parsed); the lowercase-start count in parsed output (target ≈ 0, excluding legitimately lowercase list fragments).
