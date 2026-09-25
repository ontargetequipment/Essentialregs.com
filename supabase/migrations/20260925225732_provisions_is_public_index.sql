-- /sample's anonymous read (`is_public = true`, plus the RLS policy's own
-- is_public test) had no index to use, so it seq-scanned all ~36.5k provisions
-- to return 4 rows. Warm that is ~27 ms; cold or under load it crossed anon's
-- 3 s statement_timeout (57014) on 3 of 10 /sample loads on 2026-09-25, and
-- the page rendered "Couldn't load sample content" with HTTP 200. Caught by
-- the Playwright smoke (e2e/smoke-anonymous.spec.ts). A partial index holds
-- only the public rows, so the read is an index scan over those few rows.
create index if not exists provisions_is_public_idx
  on public.provisions (id)
  where is_public;

analyze public.provisions;
