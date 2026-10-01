# Trust: review-status badge on every summary — PR screenshots (1 Oct 2026)

Renders for the PR "Trust: review-status badge on every summary". The
preview deployment and the database are not reachable from the session
that built this change (its network policy denies vercel.app and
supabase.co), so these are renders of the real markup with real rows,
outside Next:

- `reader-*.png`: Reg 6 Part B rows pulled from the live database, rendered
  through `renderReaderBody` + `reader.css`, with the browser-side fills
  (`fillSummaryBadges`, `fillSummaryLinks`) applied. `I.C.2.b` is a Phase 0
  pending parent; `I.A.` is approved.
- `ask-card.png`, `keyword-card.png`, `related-card.png`: the card markup
  from `src/app/search/page.tsx` and `RelatedProvisions.tsx` with the real
  `SummaryBadge` component (react-dom/server) and the site's compiled
  Tailwind CSS, with real rows (GP01 I.A.1 approved, GP02 II.A.2 pending,
  Reg 7 I.D.3.a.(i) approved).
- `disclaimer-what-reviewed-means.png`: `DisclaimerSections` rendered the
  same way; section 9.

The signed-in Playwright smoke (`e2e/smoke-signed-in.spec.ts`) checks the
live GP01 reader and the live Ask page on the preview in CI.
