insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20260104000000', 'pending_record', array[$ledger$update public.things set note = 'seeded' where note is null;
$ledger$])
on conflict (version) do nothing;

select v.version,
       exists (select 1 from supabase_migrations.schema_migrations m where m.version = v.version) as present
from (values ('20260104000000')) as v(version)
order by v.version;
