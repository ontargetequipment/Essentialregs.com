# EssentialRegs — CEO Phase Plan (kept in the repo so every Claude Code session can read it)

Operating model the owner (Brody) set: Claude acts as CEO — plans in phases, delegates all build work to agents, reviews their output and sends it back for revision, and asks permission before anything that costs money. Brody is non-technical with git; keep instructions to him concrete and click-by-click.

## Status as of Sep 13 2026

**Phase 1 — LIVE, verified on production (www.essentialregs.com):** Stripe annual subscription (checkout/portal/webhook routes; RLS = active/trialing subscriber OR `profiles.access_granted`; pricing card with $299/yr placeholder in `src/lib/pricing.ts`; `/regulations` upsell when no access); plain-English summary panel in the reader (`summaryPanelHtml()`, renders nothing while `ai_summary` is empty, hides `rejected`); site-wide search (`search_vector` + `search_provisions()` RPC, `/search`, header box); legal + marketing pages (`/terms`, `/privacy`, `/disclaimer`, `/about`, `/contact`, sitemap, robots, OG metadata — legal text is a draft awaiting attorney review); summary pipeline (`pipeline/summarize.py` + `.github/workflows/summarize.yml`, GitHub Actions + Anthropic Batches API, resumable).

**Phase 2 — LIVE, verified on production:** security headers + CSP (`next.config.ts`; CSP `form-action` allows checkout.stripe.com / billing.stripe.com), secure cookies, tightened `sanitize-html` allowlist (`scripts/sanitize-check.ts` self-check via `npx tsx`), route param validation, generic auth errors; admin review queue `/admin/review` gated by env `ADMIN_EMAILS` (`src/lib/admin.ts`; Approve / Save-edit-and-approve / Reject; stamps `last_verified_date`, `summary_status`, `reviewed_by`, keeps `summary_original`); public `/changelog` from `provision_changes` (+ trigger on `full_text` changes).

**Database:** Supabase project `tpuowazmmhqlsakghojy`. Migrations 002 (subscriptions), 003 (search), 004 (review/changelog) are applied. Exactly one profile exists (the owner) with `access_granted = true`. 4,420 provisions: Reg 3 (2,022), Reg 7 (1,824), Reg 26 (531), 40 CFR 60 Subpart OOOOb (40), plus 3 hand-written sample rows. **`ai_summary` is NULL on the whole corpus** — 2,301 rows need summaries (2,116 heading-only rows are skipped by the pipeline). All rows `summary_status = 'pending'`.

**Vercel:** project `essentialregs-com` under team `build-a-classic`. Env vars present: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ADMIN_EMAILS`. Auto-deploys on push to `main`.

## Owner tasks still open (Brody does these; Claude guides)

1. **Summary pipeline (most valuable, ~$4):** add GitHub repo secrets `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Settings → Secrets and variables → Actions), then Actions → "Generate summaries" → dry run → `reg=7 limit=25` → full run. Details: `pipeline/README.md`. Estimated cost $3.85 on Sonnet batch.
2. **Stripe:** `docs/stripe-setup.md` — product + annual price, 5 env vars in Vercel (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_ANNUAL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`), webhook endpoint, Customer Portal on.
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

- Delegate builds to agents (Sonnet is proven on this codebase); the CEO session reviews diffs, runs `npm run build` + `npm run lint`, then commits and pushes to `main`. Always `git log <branch> -3` before merging an agent branch — one worktree once branched from a stale base.
- `AGENTS.md` matters: this is Next.js 16.3.4 — read `node_modules/next/dist/docs/` before writing code. ESLint has `react-hooks/set-state-in-effect` on. Never add jsdom-based deps (they crashed Vercel's runtime before).
- The site can't be reached from some sandboxes; verify production with a fetch tool using a unique query string per request (caches are aggressive). `/regulations/{reg}` returns 404 for anonymous visitors by design.
- Production DB changes: write a re-runnable `supabase/migrations/RUN_ME_*.sql` and have Brody paste it into the Supabase SQL Editor; confirm afterwards.
- Never paste secrets into chat or commit them; they go in Vercel env vars or GitHub Actions secrets.
