alter table public.provision_embeddings
  add column if not exists reg_key text,
  add column if not exists jurisdiction text;

create or replace function public.provision_embeddings_fill_meta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select substring(p.id from '^sec-([^-]+)-'), p.jurisdiction_level
    into new.reg_key, new.jurisdiction
  from public.provisions p where p.id = new.provision_id;
  return new;
end;
$$;

drop trigger if exists provision_embeddings_meta on public.provision_embeddings;
create trigger provision_embeddings_meta
  before insert or update of provision_id on public.provision_embeddings
  for each row execute function public.provision_embeddings_fill_meta();

create index if not exists provision_embeddings_reg_idx on public.provision_embeddings (reg_key);
create index if not exists provision_embeddings_juris_idx on public.provision_embeddings (jurisdiction);
