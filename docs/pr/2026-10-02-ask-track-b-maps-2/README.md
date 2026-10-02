# Ask Track B: maps batch 2 — tanks, APEN, pneumatics, dehydrators — PR screenshots (2 Oct 2026)

Renders for the PR "Ask Track B: maps batch 2 — tanks, APEN, pneumatics,
dehydrators". As for the Track B PR (#37), the preview deployment and Voyage
are not reachable from the session that built this change, so these are
static renders of the real `src/app/search/page.tsx` markup
(react-dom/server) with the site's compiled Tailwind CSS, outside Next. The
page's data modules were replaced by stubs; nothing in the page itself was
changed for this PR or for the render.

What is real: every card is a real row read from the production database on
1–2 Oct 2026 through the Supabase connector (citation, title, breadcrumb,
summary, review status, child counts), and the retrieval order for each
question is the order the last logged Ask for it returned (`search_queries`,
mode `eval`, 1 Oct 2026 17:43 UTC). That log is the eval's five-row window,
so each render shows five retrieval hits where the Ask tab would show ten.
What is illustrative: the match scores after the first (the log keeps only
the top score; the others step down from it), because the hybrid RPC needs a
query embedding this session cannot compute.

- `ask-condensate-tank-grouped.png`: `/search?mode=ask&q=Do%20I%20need%20emission%20controls%20on%20a%20condensate%20storage%20tank%20at%20a%20well%20site%3F`
  as a subscriber. "Mapped question: Storage tanks and tank batteries", the
  factors sentence, then five groups with the map's 24 canonical rows first
  in each: the APEN rows and the II.D.1.fff tank exemption under Colorado
  permitting and APEN; GP08, GP05, GP12 I.A.3 and GP07 under General Permit
  options with the two retrieved GP07 / GP01 rows after them; Reg 7 Part B
  I.D / I.E / I.F / II.C and the Reg 6 Subpart Kb adoption stub under
  Colorado standards; the OOOOb / OOOOa / OOOOc storage-vessel sections
  under Federal NSPS; the five definitions last. No Federal NESHAP group:
  40 CFR 63 Subpart HH is not in the corpus, and an empty group is not
  rendered.
- `ask-pneumatic-controller-grouped.png`: `/search?mode=ask&q=Can%20I%20install%20a%20natural%20gas%20driven%20pneumatic%20controller%20at%20a%20new%20facility%3F`.
  Three groups: Reg 7 Part B III (the section, III.A, III.C, III.D, III.F)
  and I.K under Colorado standards with the three retrieved III.C rows after
  them; the OOOOb / OOOOa / OOOOc controller and pump sections under Federal
  NSPS with the two retrieved § 60.5365a(d) paragraphs; the six III.B
  definitions last.
- `ask-dehydrator-grouped.png`: `/search?mode=ask&q=What%20controls%20are%20required%20for%20a%20glycol%20dehydrator%3F`.
  The two APEN rows, then Reg 7 Part B I.H / I.H.1 / I.H.3 / II.D / II.D.2 /
  II.D.3 under Colorado standards (I.H.1 and II.D.3 were also retrieved, so
  they carry a match score; II.D.1, I.H.4 and I.H.2 follow as retrieval
  hits), then the two definitions. No Federal NESHAP group, for the same
  reason as the tanks map.
- `ask-apen-grouped.png`: `/search?mode=ask&q=When%20do%20I%20have%20to%20file%20an%20APEN%20for%20a%20new%20source%20and%20what%20is%20the%20threshold%3F`.
  The APEN map: twelve Regulation 3 rows under Colorado permitting and APEN
  (II.B.3, the thresholds, was also retrieved and carries its score), three
  of the four retrieved general-permit APEN clauses under General Permit
  options (the cap is three per group), the three Regulation 3 definitions
  last.
- `ask-bulk-plant-flat.png`: `/search?mode=ask&q=What%20are%20the%20requirements%20for%20loading%20gasoline%20into%20a%20tank%20truck%20at%20a%20bulk%20plant%3F`.
  No map matches a tank-truck question (the storage-tanks trigger never
  matches a bare "tank"), so the page is the flat list, unchanged.

The Playwright smoke (`e2e/smoke-signed-in.spec.ts`) checks the storage-vessel
question grouped under the tanks map and the bulk-plant question flat on the
preview in CI.
