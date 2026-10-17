-- Things (fixture). The repository copy carries notes the applied text did not.

create table public.things (
  id    integer primary key,
  label text not null default '-- not a comment'   -- a real comment
);

comment on table public.things is 'Fixture table; text with ''quotes''.';
