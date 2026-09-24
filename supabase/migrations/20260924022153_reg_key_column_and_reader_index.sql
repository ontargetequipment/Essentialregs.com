-- Reader page loads timed out on large regulations: `id like 'sec-<reg>-%'`
-- can't use an index and `sort_order` restarts per regulation, so every page
-- seq-scanned the table and disk-sorted the whole regulation with full_text
-- attached. A stored regulation key plus a composite index turns each page
-- into an index range that touches only its own rows.
alter table public.provisions
  add column if not exists reg_key text
  generated always as (substring(id from '^sec-([^-]+)-')) stored;

create index if not exists provisions_reg_key_sort_order_idx
  on public.provisions (reg_key, sort_order);

analyze public.provisions;
