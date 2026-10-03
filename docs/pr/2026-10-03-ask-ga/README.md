# Ask out of beta: Keyword/Ask tabs restored — PR screenshots (3 Oct 2026)

Renders for the PR "Ask out of beta: Keyword/Ask tabs restored; mapped
questions without the weak-match notice". As for #36 and the Track B PRs,
the preview deployment and the smoke account's credentials are not reachable
from the session that built this change (its network policy denies
vercel.app), so these are static renders of the real
`src/app/search/page.tsx` markup (react-dom/server) with the site's compiled
Tailwind CSS, outside Next. The page's data modules (`@/lib/supabase/server`,
`@/lib/semantic`, `@/lib/access`, `@/lib/search`, `@/lib/regulation`'s list
fetch, `next/link`) were replaced by stubs; nothing in the page itself was
changed for the render. Not rendered: the site header and footer, the
next/font web fonts (system serif and mono fall back), the regulation
filter's options (the stub returns no root rows).

What is real: every card is a real row read from the production database on
3 Oct 2026 through the Supabase connector (citation, title, breadcrumb,
summary, review status, child counts). The keyword snippets are the first
160 characters of each row's text with the query marked. On the grouped
page the retrieval order and scores are illustrative, taken from the Ask
eval run of 2 Oct 2026 recorded in `docs/pr/2026-10-02-ask-enforcement/`
(top score 0.439, no row matched the words: the case that used to show the
weak-match notice), with the nine rows that README names; the hybrid RPC
needs a query embedding this session cannot compute.

- `search-anonymous.png`: `/search?q=emissions`, logged out. The Keyword /
  Ask tabs under the heading, the Ask tab linking to
  `/search?mode=ask&q=emissions`; the three public hits; no "beta" anywhere.
- `search-signed-in.png`: the same as a subscriber. Tabs, no not-logged-in
  box, no "Ask (beta) — Try it" line under the form.
- `ask-civil-penalties-grouped.png` (first screen) and
  `ask-civil-penalties-grouped-full.png` (whole page):
  `/search?mode=ask&q=How%20does%20the%20Division%20assess%20civil%20penalties%20for%20a%20violation%3F`
  as a subscriber. The Ask tab selected, the heading "Search" with no Beta
  pill and no "Ask is in beta" line, then the mapped question. No amber
  "Nothing in the regulations closely matches this" notice above the groups.
  The groups run General Permit options, Colorado standards, ECMC rules,
  Federal PHMSA (the map's four canonical groups, in MAP_GROUP_ORDER), and
  only then "Colorado permitting and APEN", the hits-only group the single
  Regulation 3 retrieval hit (Part D X.A.4.c) opens; before this PR that
  group came first.
- `ask-not-subscribed.png`: `/search?mode=ask`, logged out. The tabs, and
  the reworded notice: "Ask is part of the subscription. Log in to search
  the full corpus by meaning. Keyword search of the free sample is still
  available on the Keyword tab."

The Playwright smoke (`e2e/smoke-anonymous.spec.ts`,
`e2e/smoke-signed-in.spec.ts`) checks the live pages on the preview in CI.
