-- Close advisor findings without deleting anything.
-- Backup tables from the Sept 14 Reg 7 re-import: enable RLS with no policies
-- => invisible to anon/authenticated, still readable by service_role / SQL editor.
alter table public.provisions_backup_reg7_20260914 enable row level security;
alter table public.provision_changes_backup_20260914 enable row level security;

-- Trigger functions must not be callable over the REST RPC endpoint.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_provision_text_updated() from public, anon, authenticated;
