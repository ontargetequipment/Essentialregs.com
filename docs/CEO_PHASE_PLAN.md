# EssentialRegs — CEO Phase Plan (kept in the repo so every Claude Code session can read it)

Operating model the owner (Brody) set: Claude acts as CEO — plans in phases, delegates all build work to agents, reviews their output and sends it back for revision, and asks permission before anything that costs money. Brody is non-technical with git; keep instructions to him concrete and click-by-click.

## Status as of Oct 3 2026 (Cowork CEO session)

Three outside reviews run Sep 25 – Oct 3. The third scored 8.4/10 overall (Ask 8, keyword 9, trust 8, reader 8.5, navigation 7.5) and said "ready to charge." The working plan to take every area to 9 is the Cowork doc "EssentialRegs: Path to 9/10" (https://claude.ai/code/artifact/c0b17668-e935-465e-be84-9e28aa651a1e): day-one trust fixes, then Sprint 2 (citation parser and exact deep links, citation preview, back-to-origin trail, jump-field Enter and URL hash, exact official PDFs), then Sprint 3 (GP12 equations, extraction fixes with a [sic] convention, shorter parent summaries, Ask tab click), then the same reviewer again. Its regression-protocol table is the acceptance suite.

Day-one fixes are on branch `claude/third-review-trust-fixes` (also as a patch Brody holds): customer-facing /changelog via `changelog_public()` (migration 20261003160524, already applied), trial terms in /terms, jurisdiction badge from the document (Reg 26's incorporated JJJJ rows no longer read "Federal"), /pricing for subscribers, OOOO-family wording in the tanks and controller maps. Two owner decisions open: (1) 6,300 of the 6,410 "approved" summaries were approved by the AI second pass, and the reader's "Reviewed" badge reads as human review — relabel or do the human pass on the GPs and Reg 3 Part A first; (2) the 20 Subpart JJJJ rows inside Reg 26 Part C are not in the Reg 26 PDF and duplicate the corpus's own JJJJ document — drop them and link, or keep them badged.

## Sprint 2 status, Oct 3 2026 (navigation and provenance)

Built on branch `claude/sprint2-navigation-provenance` (stacked on `claude/third-review-trust-fixes`), five commits, checks green in the Cowork session: lint, typecheck, `npm test` 161 pass / 1 skipped, pipeline pytest 1364 passed / 29 skipped. `npm run build` was NOT run there (the sandbox cannot reach Google Fonts); CI is the first build.

- Importer: `resolve_cross_reg_target` + `pipeline/out/corpus_ids.json` (57 regs, 36,517 ids, md5-verified per regulation against production). Cross-regulation cites deep-link as `/regulations/7#sec-7-B-I-B-33`, one link per cited section; a tail such as "and Section II.B." after a cross-reg cite never binds to the current document (21 such mis-binds removed in the GPs, Reg 3 and Reg 7). `unresolved_cross_reg` bucket in the diff report; `dump-ids` runs in `import.yml` before parse. What a re-import will change is in `pipeline/out/sprint2_link_changes.md`: 770 rows across 27 regulations, link markup only, visible text identical. NOT YET IN PRODUCTION: run the Import workflow (execute) for gp01-03, gp05-12, 3, 7, 26 after merge, then the other 13 regulations the report lists.
- Reader: jump box Enter / arrows / Escape with combobox ARIA; a click on a deep-linked cross-regulation cite previews the other regulation's provision through the gated `/api/provision/[id]` (401 / 403 / 404, RLS-bound read) with "Open in Regulation 7"; `?from=` shows "← Back to GP12 · I.A" and is stripped from the URL. Tested in jsdom with the real component only; needs a pass in a real browser on the Vercel preview.
- Sources: every AQCC regulation and ECMC 2 CCR 404-1 points at its own Secretary of State rule page (all 32 fetched and matched on Oct 3; live effective dates equal the manifest, so nothing in the corpus is stale). Regulation 26 is 5 CCR 1001-30 (1001-28 is Regulation 24). GP roots point at the CDPHE document links (OnBase DocPop; docids equal the manifest's, but the viewer is JavaScript and the documents were not opened by the agent — kept as its own commit). The data change is `supabase/migrations/RUN_ME_20261003_exact_source_urls.sql` (about 21,200 rows, source_url only), NOT applied yet: waiting on Brody's go.
- CDPHE's page does not call GP09/GP10 "closed": GP12 replaces them for new facilities as of July 15 2026, and existing registrations stay active until they expire.

## Citation links (rules in force since Oct 4 2026, PRs #46, #47 and the citation follow-up)

A citation of another regulation deep-links to the exact provision only when the importer can prove the target. The rules, in order:

1. **Exact.** The cited section exists in the cited regulation (corpus id index, dumped from the live database before every import): link it. A target that is a definition must define the phrase the sentence names ("well production facilities as defined in ... I.B.33"); if it does, the link stands.
2. **Renumbered by term.** The cited section defines something else (Regulation 7 was renumbered after the permit was written): link the one sibling definition whose term occurs in the phrase. The printed section stays in the text and rides in the href (`?cited=I.B.33`), so the preview says "GP12 cites this as Section I.B.33; in the current Regulation 7 it is I.B.34."
3. **Nearest-number tie-break.** Several siblings match: take the one whose number is closest to the cited number, only if it is within 5 positions and strictly closer than every other match (II.A.45 -> II.A.47 "Visible Emissions", not II.A.27 "Normal Operation"). A term also matches when its words occur in the phrase in order with other words between them ("natural gas-driven diaphragm pneumatic pumps" -> "Natural Gas-Driven Diaphragm Pump"), with the same tie-break.
4. **Plain text when unsure.** No match, two matches equally near, the nearest more than 5 away, or a "(Reference: Regulation 7 ...)" cite with no defining phrase: the section is plain text. An exact-looking link to the wrong definition is worse than no link.
5. **Version note.** When the citing document predates the cited regulation's current effective date, the preview adds one line: "GP12 cites Regulation 7 as effective 06/14/2025; shown is the current text, effective 07/15/2026. Numbering may differ." (or "GP01 was issued 07/23/2025; shown is the current Regulation 7 ..."). Dates come from `pipeline/sources/manifest.json` through the generated `src/lib/source-dates.generated.ts`; a test fails if the two disagree. The official text is never altered.

After every import read two buckets in the diff report: `renumbered_cross_reg` (every link rule 2 or 3 produced, with the rule that chose it) and `definition_mismatch_no_link` (every citation left as plain text, with the siblings that matched and why none was chosen). Production, Oct 4 2026: 1,133 cross-regulation deep links, 0 broken targets, 0 definition links to the wrong term; 10 renumbered links (GP12 I.A x2 by term; GP01 IV.B, GP05 IV.A, GP07 IV.B, GP08 IV.A.2, GP09 II.D.4, GP10 II.D.4 by nearest number; GP09 IV.G.1, GP10 IV.G.1 by word order), 7 citations plain text (the "(Reference: ...)" forms in GP05/GP07 II.A.1.a, GP09/GP10 II.B and V.A.1, GP12 VII.D.1).

## Status as of Sep 13 2026

**Phase 1 — LIVE, verified on production (www.essentialregs.com):** Stripe annual subscription (checkout/portal/webhook routes; RLS = active/trialing subscriber OR `profiles.access_granted`; pricing card with $299/yr placeholder in `src/lib/pricing.ts`; `/regulations` upsell when no access); plain-English summary panel in the reader (`summaryPanelHtml()`, renders nothing while `ai_summary` is empty, hides `rejected`); site-wide search (`search_vector` + `search_provisions()` RPC, `/search`, header box); legal + marketing pages (`/terms`, `/privacy`, `/disclaimer`, `/about`, `/contact`, sitemap, robots, OG metadata — legal text is a draft awaiting attorney review); summary pipeline (`pipeline/summarize.py` + `.github/workflows/summarize.yml`, GitHub Actions + Anthropic Batches API, resumable).

**Phase 2 — LIVE, verified on production:** security headers + CSP (`next.config.ts`; CSP `form-action` allows checkout.stripe.com / billing.stripe.com), secure cookies, tightened `sanitize-html` allowlist (`scripts/sanitize-check.ts` self-check via `npx tsx`), route param validation, generic auth errors; admin review queue `/admin/review` gated by env `ADMIN_EMAILS` (`src/lib/admin.ts`; Approve / Save-edit-and-approve / Reject; stamps `last_verified_date`, `summary_status`, `reviewed_by`, keeps `summary_original`); public `/changelog` from `provision_changes` (+ trigger on `full_text` changes).

**Database:** Supabase project `tpuowazmmhqlsakghojy`. Migrations 002 (subscriptions), 003 (search), 004 (review/changelog) are applied. Exactly one profile exists (the owner) with `access_granted = true`. 4,420 provisions: Reg 3 (2,022), Reg 7 (1,824), Reg 26 (531), 40 CFR 60 Subpart OOOOb (40), plus 3 hand-written sample rows. **`ai_summary` is NULL on the whole corpus** — 2,301 rows need summaries (2,116 heading-only rows are skipped by the pipeline). All rows `summary_status = 'pending'`.

**Vercel:** project `essentialregs-com` under team `build-a-classic`. Env vars present: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ADMIN_EMAILS`. Auto-deploys on push to `main`.

## Owner tasks still open (Brody does these; Claude guides)

1. **Summary pipeline (most valuable, ~$4):** add GitHub repo secrets `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Settings → Secrets and variables → Actions), then Actions → "Generate summaries" → dry run → `reg=7 limit=25` → full run. Details: `pipeline/README.md`. Estimated cost $3.85 on Sonnet batch.
2. **Stripe:** `docs/stripe-setup.md` — `npm run stripe:setup` creates the product and its monthly/annual Prices by lookup key (no Price id env var), the Customer Portal configuration and the webhook endpoint, and writes the ids to `stripe-setup.local.txt`; then 3 env vars in Vercel (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`; `SUPABASE_SERVICE_ROLE_KEY` is already there) and a redeploy.
3. **Resend SMTP for Supabase Auth** — launch blocker: Supabase's built-in sender cannot deliver signup/reset emails to the public. Steps in `docs/security-next-steps.md`.
4. Review Reg 7 summaries in `/admin/review?reg=7` once generated.

## Phase 3 — First customers (next build round)

- Pricing validation: 5–10 calls with EHS/compliance contacts before setting the real Stripe price.
- LinkedIn launch kit (posts, demo video script, outreach templates) — agent-drafted, Brody-sent.
- Public SEO teaser pages: one indexable page per regulation showing structure + a few reviewed summaries, full text gated.
- Vercel Analytics (free tier); a "contact sales" path for multi-seat requests.
- OSHA 1910/1926 oil-and-gas subset ingestion from the eCFR API into the same `provisions` schema.
- Attorney review of Terms/Privacy/Disclaimer (**costs money** — ask). E&O insurance quote once there's revenue (**costs money**).

Done when: a handful of unaffiliated paying subscribers exist.

## Phase 4 — Operate on autopilot

- Change monitoring: weekly job checking Federal Register / Colorado SoS rulemaking notices, flagging affected provisions for re-review.
- PDF export (headless-browser render of the same templates).
- Playwright smoke tests in CI (signup → pay in test mode → read; search; reader popups).
- Expansion (adjacent state vs. vertical) driven by what paying customers ask for.

## Operating rules (hard-won)

- Brody's standing instruction (Oct 3 2026): when Claude Code can do something, Claude Code does it — git branches, pushes, pull requests, CI, and any build step that needs the repo's own credentials. The Cowork CEO session plans, delegates builds to agents (Sonnet by default; Opus only for design-heavy or correctness-critical pieces; Haiku for lookups and checks), reviews diffs, runs lint/typecheck/tests, and hands finished branches to Code as patches with a one-paragraph brief. It does not ask Brody to run git commands. It has Supabase and Vercel connectors and uses them directly under the Sep 13 rule below.

- Delegate builds to agents (Sonnet is proven on this codebase); the CEO session reviews diffs, runs `npm run build` + `npm run lint`, then commits and pushes to `main`. Always `git log <branch> -3` before merging an agent branch — one worktree once branched from a stale base.
- `AGENTS.md` matters: this is Next.js 16.3.4 — read `node_modules/next/dist/docs/` before writing code. ESLint has `react-hooks/set-state-in-effect` on. Never add jsdom-based deps (they crashed Vercel's runtime before).
- The site can't be reached from some sandboxes; verify production with a fetch tool using a unique query string per request (caches are aggressive). `/regulations/{reg}` returns 404 for anonymous visitors by design.
- Brody's standing instruction (Sep 13 2026): if Claude has a tool that can do something directly, do it that way instead of asking Brody to click through a dashboard. Applies to production DB changes too — the Supabase MCP connection can run safe, non-destructive DML (a handful of UPDATEs/INSERTs on specific known rows) directly; still write the change as a `supabase/migrations/RUN_ME_*.sql` file for the repo's record even when applying it directly, and still confirm the result with a read-back query afterwards. Schema/DDL changes go through `apply_migration`, not raw `execute_sql`. Reserve "Brody needs to click this himself" for things that are genuinely his to do: anything requiring credentials/secrets that shouldn't pass through Claude at all (see below), an account-level toggle Claude has no API for, or a change large/risky enough (e.g. touching most of the corpus, or anything hard to reverse) that it deserves his eyes first.
- Never paste secrets into chat or commit them; they go in Vercel env vars or GitHub Actions secrets. This one stays a hard boundary regardless of the line above — it's not about Claude lacking a tool, it's that a service-role key or API secret shouldn't flow through an AI chat session even when it technically could.
