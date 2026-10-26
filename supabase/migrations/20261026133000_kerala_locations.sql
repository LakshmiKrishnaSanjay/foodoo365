-- For databases created before the Kerala relocation.
-- Fresh installs already have these columns from the initial migration.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trucks' and column_name = 'emirate'
  ) then
    alter table public.trucks rename column emirate to district;
  end if;
end $$;

alter table public.trucks add column if not exists latitude double precision not null default 0;
alter table public.trucks add column if not exists longitude double precision not null default 0;
alter table public.trucks add column if not exists fssai text not null default '';
alter table public.trucks add column if not exists gstin text not null default '';
alter table public.profiles add column if not exists pan text not null default '';
