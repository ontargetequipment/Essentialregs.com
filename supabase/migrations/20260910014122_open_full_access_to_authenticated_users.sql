-- Policy change: any signed-in user now gets full read access, not just
-- users manually flagged access_granted=true. This replaces the earlier
-- "granted users only" gate — login itself is now the gate, ahead of any
-- future paid subscription tier. profiles.access_granted is left in place
-- (unused for now) in case a stricter tier is wanted again later.

drop policy if exists "granted users can read all provisions" on provisions;
create policy "authenticated users can read all provisions"
  on provisions for select
  using (auth.role() = 'authenticated');

drop policy if exists "granted users can read all cross-refs" on cross_references;
create policy "authenticated users can read all cross-refs"
  on cross_references for select
  using (auth.role() = 'authenticated');
