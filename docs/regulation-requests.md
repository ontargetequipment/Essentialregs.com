# Request a regulation

Customers and prospects ask for a regulation we do not have yet at
`/request`. Requests are the owner's signal for what to import next. Each one
lands in two places: the `public.regulation_requests` table (system of record,
read at `/admin/requests`) and, once the Resend key exists, an email to
`regrequest@essentialregs.com`.

## Pieces

| What | Where |
| --- | --- |
| Table and its deny-all RLS | `supabase/migrations/20261012031424_regulation_requests.sql` |
| Field rules, jurisdiction list, spam guards (pure) | `src/lib/regulation-request.ts` |
| Public page and form | `src/app/request/page.tsx`, `src/app/request/RequestForm.tsx` |
| Server action: validate, guards, caps, insert, email | `src/app/request/actions.ts` |
| Admin list, status dropdown, notes | `src/app/admin/requests/page.tsx` (+ `actions.ts`) |
| Unit test | `scripts/regulation-request.test.ts` |
| Smoke | `e2e/smoke-anonymous.spec.ts` ("request a regulation" tests) |

The admin list is gated by `requireAdmin()` (`ADMIN_EMAILS`), like
`/admin/review`.

## How a submission is handled

1. Honeypot: a hidden `website` field. Anything in it and the action returns
   the success state without saving (the bot learns nothing). Logged.
2. Timing: the page stamps its render time into a hidden `rendered_at` field;
   a submission under 3 seconds later is asked to try again. A POST with no
   or an unreadable render time is rejected the same way.
3. Signed in: the requester's email is their account's, whatever the field
   said, and `user_id` is set.
4. Validation (server-side, `validateRegulationRequest`): regulation 3–200
   characters, jurisdiction one of Federal / the fifty states / Other, agency
   and company ≤ 200, link http(s) only and ≤ 2000, reason ≤ 1000, email shape.
5. Caps, counted in the database before the insert: 5 requests per email and
   20 per `ip_hash` in 24 hours. `ip_hash` is
   `sha256(REQUEST_IP_SALT + ":" + first address in x-forwarded-for)`; the raw
   address is never stored.
6. Insert through the service-role client (no client role can read or write
   the table).
7. Email through Resend's HTTP API if `RESEND_API_KEY` is set: from
   `EssentialRegs <noreply@essentialregs.com>`, to
   `regrequest@essentialregs.com`, reply-to the requester, subject
   `Regulation request: <regulation> (<Jurisdiction>)`, plain text with every
   field and the `/admin/requests` link. A missing key is logged once per
   process and skipped; a failed send is logged. Neither changes what the
   requester sees: the request is saved either way.

## Vercel environment variables (owner adds; never in the repo or in chat)

| Name | Value | Environments |
| --- | --- | --- |
| `RESEND_API_KEY` | Resend → **API Keys** → **Create**: name `vercel-request-notifications`, permission **Sending access** only, domain `essentialregs.com`. Copy it once. | All |
| `REQUEST_IP_SALT` | Any long random string you make up. | All |

Vercel → `essentialregs-com` → **Settings** → **Environment Variables**, then
**Deployments** → **Redeploy** the latest: environment variables only take
effect on a new deployment. Both are also listed in `.env.local.example` for
local development. If either value ever appears in a chat or a commit, rotate
it.

Until `RESEND_API_KEY` exists, requests are saved and visible at
`/admin/requests`, and the function log shows one line:
`[request] RESEND_API_KEY is not set; requests are saved but regrequest@ is not emailed`.

## Reading the table directly

```sql
select status, count(*) from public.regulation_requests group by status order by status;

select created_at, regulation, jurisdiction, email, company, status
from public.regulation_requests
order by created_at desc
limit 50;
```
