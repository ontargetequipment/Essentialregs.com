# Ask Track B: question maps, grouped results, regression gate — PR screenshots (1 Oct 2026)

Renders for the PR "Ask Track B: question maps, grouped results, regression
gate". The preview deployment, the database's REST endpoint and Voyage are not
reachable from the session that built this change (its network policy denies
vercel.app, supabase.co and voyageai.com), so these are static renders of the
real `src/app/search/page.tsx` markup (react-dom/server) with the site's
compiled Tailwind CSS, outside Next, exactly as the Ask-beta PR's screenshots
were made. The page's data modules were replaced by stubs; nothing in the page
itself was changed for the render.

What is real: every card is a real row read from the production database on
1 Oct 2026 through the Supabase connector (citation, title, breadcrumb,
summary, review status, child counts), and the retrieval order for the two
questions is the order the last logged Ask for each question returned
(`search_queries`, 1 Oct 2026 04:23 UTC, ten hits). What is illustrative: the
match scores after the first (the log keeps only the top score; the others
step down from it), because the hybrid RPC needs a query embedding this
session cannot compute.

- `ask-engine-grouped.png`: `/search?mode=ask&q=What%20regulations%20apply%20to%20a%20natural%20gas-fired%20engine%3F`
  as a subscriber. The "Mapped question" line and the factors sentence, then
  all six groups with the engines map's 22 canonical rows first in each
  ("Why it's here" above the summary label) and the retrieval hits that
  belong to the group after them (at most three per group): JJJJ § 60.4230
  under Federal NSPS, ZZZZ § 63.6585 under Federal NESHAP, GP09 and GP10 last
  under General Permit options with the "Closed to new registrations" badge.
  No retrieval hit fell outside the six groups, so there is no "Other
  matches" section for this question.
- `ask-engine-flat.png`: the same with `&flat=1`. The retrieval list exactly
  as before, with a "Show grouped" link.
- `ask-storage-vessels.png`: `/search?mode=ask&q=What%20Colorado%20and%20federal%20requirements%20could%20apply%20to%20storage%20vessels%3F`.
  No map matches a storage-vessel question, so the page is the flat list,
  unchanged.

The Playwright smoke (`e2e/smoke-signed-in.spec.ts`) checks the live grouped
and flat pages on the preview in CI.
