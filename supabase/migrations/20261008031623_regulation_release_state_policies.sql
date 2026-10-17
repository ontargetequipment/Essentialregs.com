-- regenerated 2026-10-17 from schema_migrations.statements (piece 3 of 6 of supabase/migrations_archive/20261008040000_regulation_release_state.sql)
alter policy "subscribers can read all provisions"
  on public.provisions
  using (exists (select 1 from public.profiles p
                 where p.id = (select auth.uid())
                   and (p.access_granted or p.subscription_status in ('active','trialing')))
         and public.reg_is_released(reg_key));

alter policy "subscribers can read all neighbors"
  on public.provision_neighbors
  using (public.has_full_access()
         and public.reg_is_released(split_part(provision_id, '-', 2))
         and public.reg_is_released(split_part(neighbor_id, '-', 2)));
