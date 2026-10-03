# Ask Track B: enforcement & penalties map; ECMC and PHMSA groups — PR screenshots (2 Oct 2026)

Renders for the PR "Ask Track B: enforcement & penalties map; ECMC and PHMSA
groups" (maps batch 4). As for #37, #38, #39 and #40, the preview
deployment sits behind Vercel auth and the smoke account's credentials are
repository secrets this session cannot read, so these are static renders of
the real `src/app/search/page.tsx` markup (react-dom/server) with the site's
compiled Tailwind CSS, outside Next. The page's data modules
(`@/lib/supabase/server`, `@/lib/semantic`, `@/lib/access`, `@/lib/search`,
`@/lib/regulation`'s list fetch, `next/link`) were replaced by stubs; nothing
in the page itself was changed for this PR or for the render. The "before"
render bundles the parent commit's `src/lib/question-maps.ts` (main at
3983a08) in place of this branch's; everything else is identical.

What is real: every card is a real row read from the production database on
2 Oct 2026 through the Supabase connector (citation, title, breadcrumb,
summary, review status, child counts); the breadcrumbs were computed with
the `provision_path` function's own recursive query (the function returns
null to a caller with no subscriber JWT). The retrieval order, the match
scores and the "· words" keyword flags are the top 20 the "Ask eval"
workflow printed for each question on this branch (`workflow_dispatch` runs
12 and 13, 2 Oct 2026 20:56 and 20:58 UTC, `--count 20`), which is the same
RPC, arguments and embedding the Ask tab uses (ASK_RESULT_COUNT = 20). Not
rendered: the site header and footer (the render is the page's `<main>`
only) and the next/font web fonts (system serif and mono fall back).

- `ask-civil-penalties-grouped.png`: `/search?mode=ask&q=How%20does%20the%20Division%20assess%20civil%20penalties%20for%20a%20violation%3F`
  as a subscriber. "Mapped question: Enforcement and penalties: APCD, ECMC
  and PHMSA", the factors sentence, then the groups with the map's 21
  canonical rows first in each: GP12 XI.C.8 and GP01 VIII.C.8 under General
  Permit options; Common Provisions III, III.A (the per-day penalty, second
  row), III.B.1, III.B.3 and Procedural Rules VI.D.1 under Colorado
  standards with the retrieved III.B.2 after them; Rules 523.a, 523.c,
  525.a, 525.b, 525.c, 525.e, 525.g under ECMC rules with the retrieved
  525.b.(7), 525.c.(1), 525.c.(4) after them; §§ 190.207, 190.208, 190.221,
  190.223, 190.225, 196.205, 196.207 under Federal PHMSA with the retrieved
  § 190.213(a)(2), § 190.213(a) and § 190.208(a)(1) after them. One more
  group than the four the map carries: the retrieval's #8, Regulation 3
  Part D X.A.4.c (an ambient-air-increment violation row, keyed to
  Regulation 3), goes to "Colorado permitting and APEN" by groupForHit's
  Regulation 3 rule and so opens the page — a real hit on the real rule,
  shown as it would be. The logged top score for this question is 0.439 and
  no row matched the words, so the amber "Nothing in the regulations
  closely matches this" notice renders above the groups exactly as it would
  on the live page (the map is what makes the page useful here: CP III.A
  is #13 by retrieval). No "Other matches".
- `ask-phmsa-max-penalty-grouped.png`: `/search?mode=ask&q=What%20is%20the%20maximum%20PHMSA%20civil%20penalty%20for%20a%20pipeline%20safety%20violation%3F`.
  Same map. Four groups; the PHMSA rows lead the retrieval (§ 190.223(a)
  59%, § 196.205 55%, § 196.209 55%, § 190.221 54%, all also matched by
  words), so the canonical § 190.221 and § 196.205 carry match scores and
  § 190.223(a), § 196.209 and § 190.235 follow the canonical rows under
  Federal PHMSA. Every one of the twenty retrieved rows is a PHMSA row, so
  no other group gains a hit and there is no "Other matches".
- `ask-aqcc-per-day-maximum-grouped.png`: `/search?mode=ask&q=What%20is%20the%20maximum%20civil%20penalty%20per%20day%20for%20violating%20an%20AQCC%20regulation%3F`
  (the 29th eval question). Same map; CP III.A is #1 by retrieval at 58%
  and sits second under Colorado standards (after the III heading); the
  general permits' enforcement clauses (GP03 IV.A.8, GP05 VIII.C.8, GP08
  VIII.C.8) follow the two canonical permit rows; ECMC 525.c.(1), 525.b.(5),
  525.c.(4) and PHMSA § 190.223(a) follow their canonical rows.
- `ask-leak-inspections-grouped.png`: `/search?mode=ask&q=How%20often%20do%20I%20have%20to%20do%20leak%20inspections%20at%20a%20well%20production%20facility%3F`
  (the ldar eval question) on this branch. Four groups, the same as #40's
  render: GP12 / GP11 / GP09 / GP10, the nine Reg 7 Part B rows with the
  retrieved II.E.4.b, II.E.4.e.(ii).(A), II.E.4.a after them, the seven
  OOOOb / OOOOa / OOOOc sections with the three retrieved tables, the five
  definitions. The parent-commit render of the same question is
  byte-for-byte identical (checked with diff), because none of this
  question's twenty retrieved rows is an ECMC or PHMSA row: the group
  change in part A does not touch this page. The next pair shows a question
  on the same map where it does.
- `ask-flowline-leak-detection-before.png` / `ask-flowline-leak-detection-after.png`:
  `/search?mode=ask&q=What%20leak%20detection%20is%20required%20for%20flowlines%20and%20gathering%20lines%20at%20a%20well%20site%3F`,
  which routes to the ldar map ("leak detection"), rendered with the parent
  commit's question-maps.ts (before) and this branch's (after). Its top 20
  carries three ECMC rows (1104.j.(1) 55%, 1104.g.(2) 52%, 304.c.(13) 51%)
  and nine PHMSA rows (§ 192.9(d)(8) 55%, § 195.134(d) 55%,
  § 192.723(b)(1) 54%, § 192.9(e)(1)(vii) 54%, § 195.444(a) 54%,
  § 192.723(b), § 192.706(b), § 192.706(a), § 192.723(b)(2), § 192.706).
  Before: all of them fall to "Other matches", which keeps five
  (1104.j.(1), § 192.9(d)(8), § 195.134(d), § 192.723(b)(1),
  § 192.9(e)(1)(vii)) and drops the rest, so the ECMC flowline rule and the
  PHMSA leakage-survey rule are unlabelled and mixed at the foot of the
  page. After: "ECMC rules" (1104.j.(1), 1104.g.(2), 304.c.(13)) and
  "Federal PHMSA" (§ 192.9(d)(8), § 195.134(d), § 192.723(b)(1)) sit as
  named groups between Federal NSPS and Definitions, and there is no
  "Other matches". The groups are hit-only (the ldar map has no canonical
  ECMC or PHMSA row); the three-per-group cap is MAX_HITS_PER_GROUP, as for
  every other group.

The Playwright smoke (`e2e/smoke-signed-in.spec.ts`) is unchanged by this
PR (part D): its engine, storage-vessel, leak-inspection and bulk-plant
checks run on the preview in CI as before.
