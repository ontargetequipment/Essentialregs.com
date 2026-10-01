# Search: keyword first, Ask as a labelled beta — PR screenshots (1 Oct 2026)

Renders for the PR "Search: keyword first, Ask as a labelled beta". The
preview deployment and the database are not reachable from the session that
built this change (its network policy denies vercel.app and supabase.co), so
these are static renders of the real `src/app/search/page.tsx` markup
(react-dom/server) with the site's compiled Tailwind CSS, outside Next. The
page's data modules were replaced by stubs; nothing in the page itself was
changed for the render.

- `search-anonymous.png`: `/search`, logged out. No tabs, no Ask line.
- `search-subscriber.png`: `/search` as a subscriber. The one "Ask (beta)"
  line under the form, linking to `?mode=ask`.
- `ask-subscriber-gp01.png`: `/search?mode=ask&q=When%20is%20a%20GP01%20required%3F`
  as a subscriber. The Beta pill after the heading, the "← Keyword search"
  line, then the form and results as before. The five cards are real GP01
  rows read from the live database on 1 Oct 2026 (I.A.1, I.A.3, I.E, I.A,
  I.D, with their real summaries and review status); the match scores are
  illustrative, because the hybrid RPC needs a query embedding this session
  cannot compute.
- `ask-not-subscribed.png`: `/search?mode=ask`, logged out. The reworded
  amber notice with its link back to keyword search.

The Playwright smoke (`e2e/smoke-anonymous.spec.ts`,
`e2e/smoke-signed-in.spec.ts`) checks the live pages on the preview in CI.
