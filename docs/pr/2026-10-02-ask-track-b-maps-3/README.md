# Ask Track B: maps batch 3 — combustion devices, LDAR, general permits — PR screenshots (2 Oct 2026)

Renders for the PR "Ask Track B: maps batch 3 — combustion devices, LDAR,
general permits". As for #37 and #38, the preview deployment and Voyage are
not reachable from the session that built this change, so these are static
renders of the real `src/app/search/page.tsx` markup (react-dom/server)
with the site's compiled Tailwind CSS, outside Next. The page's data modules
(`@/lib/supabase/server`, `@/lib/semantic`, `@/lib/access`,
`@/lib/regulation`'s list fetch, `next/link`) were replaced by stubs;
nothing in the page itself was changed for this PR or for the render.

What is real: every card is a real row read from the production database on
2 Oct 2026 through the Supabase connector (citation, title, breadcrumb,
summary, review status, child counts), and the retrieval order for each
question is the order the last logged Ask for it returned (`search_queries`,
mode `eval`: 02:32 UTC for the two existing questions, 03:06 UTC for the new
one, written by this PR's own "Ask eval" run). That log is the eval's
five-row window, so each render shows five retrieval hits where the Ask tab
would show ten. What is illustrative: the match scores after the first (the
log keeps only the top score; the others step down from it), because the
hybrid RPC needs a query embedding this session cannot compute. The
breadcrumbs were computed with the `provision_path` function's own query
(the function returns null to a caller with no subscriber JWT).

- `ask-leak-inspections-grouped.png`: `/search?mode=ask&q=How%20often%20do%20I%20have%20to%20do%20leak%20inspections%20at%20a%20well%20production%20facility%3F`
  as a subscriber. "Mapped question: Leak detection and repair at well
  production facilities and compressor stations", the factors sentence, then
  four groups with the map's 25 canonical rows first in each: GP12, GP11 and
  the closed GP09 / GP10 under General Permit options; Reg 7 Part B I.L
  (and I.L.2, I.L.1, I.L.4), II.E (II.E.4, II.E.6), II.F and II.G under
  Colorado standards with the two retrieved II.E.4 paragraphs after them; the
  OOOOb / OOOOa / OOOOc fugitive-emissions sections under Federal NSPS with
  the three retrieved OOOOb / OOOOc tables; the five definitions last. No
  Colorado permitting and APEN group (the map has no row there) and no
  Federal NESHAP group.
- `ask-flare-testing-grouped.png`: `/search?mode=ask&q=flare%20testing`.
  "Mapped question: Flares and enclosed combustion devices". The logged top
  score for this two-word query is 0.499, under the page's weak-match
  threshold, so the amber "Nothing in the regulations closely matches this"
  notice renders above the groups exactly as it would on the live page.
  Three groups: Reg 7 Part B II.B.1, II.B.2, II.B.2.h, I.C.1, I.E.2 and I.E.3
  under Colorado standards; the OOOOb / OOOOa / OOOOc control-device sections
  under Federal NSPS with three of the five retrieved paragraphs after them
  (the cap is three per group; the other two were also federal rows, so they
  are not shown under "Other matches" either); the two II.A definitions last
  ('Air pollution control equipment', 'Approved instrument monitoring
  method': there is no 'Enclosed combustion device' or 'Flare' definition row
  in Regulation 7 Part B, see the PR).
- `ask-general-permits-grouped.png`: `/search?mode=ask&q=Which%20general%20permits%20can%20an%20oil%20and%20gas%20well%20production%20facility%20register%20under%3F`.
  "Mapped question: APCD general permits: which one fits". Two groups: the
  two Regulation 3 headings under Colorado permitting and APEN, then the
  twelve permit rows under General Permit options in the map's order (GP01,
  GP05, GP08, GP02, GP06, GP07, GP11, GP12 I.A, GP12 I.B, GP03, GP09, GP10;
  GP11 I.A, GP12 I.A and GP12 I.B were also retrieved, so they carry a match
  score; GP09 and GP10 carry the closed-permit badge) with the two retrieved
  GP11 I.A.3 / I.A.4 paragraphs after them.

The Playwright smoke (`e2e/smoke-signed-in.spec.ts`) checks the
leak-inspection question grouped under the ldar map on the preview in CI,
alongside the engine, storage-vessel and bulk-plant checks from #37 and #38.
