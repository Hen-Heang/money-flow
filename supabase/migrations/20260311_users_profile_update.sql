alter table public.users
  alter column id drop default;

alter table public.users
  add column if not exists avatar_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_id_fkey'
  ) then
    alter table public.users
      add constraint users_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

comment on table public.users is 'Application user profiles keyed by auth.users.id';
