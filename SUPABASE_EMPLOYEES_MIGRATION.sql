-- RestMex CRM MVP employees migration.
-- Run manually in Supabase SQL Editor (do not auto-apply from the app).
-- File: SUPABASE_EMPLOYEES_MIGRATION.sql
--
-- Safe goals:
--   1) create public.employees
--   2) seed Иван / Максим / Олег (stable by unique name; UUID kept once inserted)
--   3) retarget requests.assigned_to -> employees(id) ON DELETE SET NULL
--   4) do not delete existing request rows
--
-- If requests.assigned_to already has values, this script STOPS with an exception.
-- Migration plan in that case:
--   A. SELECT id, assigned_to FROM public.requests WHERE assigned_to IS NOT NULL;
--   B. Map old profile UUIDs to new employees.id (or set assigned_to = NULL)
--   C. UPDATE public.requests SET assigned_to = <employee_uuid> WHERE id = ...;
--   D. Re-run this file.
-- This migration keeps public.profiles for auth/login and moves task assignment to public.employees.

create extension if not exists pgcrypto;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  role text not null default 'mechanic',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint employees_name_unique unique (name)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.employees'::regclass
      and conname = 'employees_name_unique'
  ) then
    alter table public.employees
      add constraint employees_name_unique unique (name);
  end if;
end;
$$;

insert into public.employees (name, role, is_active, sort_order)
values
  ('Иван', 'mechanic', true, 1),
  ('Максим', 'mechanic', true, 2),
  ('Олег', 'mechanic', true, 3)
on conflict (name) do nothing;

create index if not exists employees_is_active_idx on public.employees(is_active);
create index if not exists employees_sort_order_idx on public.employees(sort_order);

-- Safety guard: old requests.assigned_to values point to profiles.id.
-- If any values exist, stop here and migrate them deliberately before changing the FK.
do $$
declare
  assigned_count integer;
begin
  select count(*) into assigned_count
  from public.requests
  where assigned_to is not null;

  if assigned_count > 0 then
    raise exception
      'public.requests.assigned_to has % non-empty values. Map old profile UUIDs to employee UUIDs before changing the foreign key.',
      assigned_count;
  end if;
end;
$$;

do $$
declare
  constraint_name text;
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.requests'::regclass
      and conname = 'requests_assigned_to_employees_fkey'
  ) then
    alter table public.requests
      drop constraint requests_assigned_to_employees_fkey;
  end if;

  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.requests'::regclass
    and contype = 'f'
    and array_length(conkey, 1) = 1
    and conkey[1] = (
      select attnum
      from pg_attribute
      where attrelid = 'public.requests'::regclass
        and attname = 'assigned_to'
    )
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.requests drop constraint %I', constraint_name);
  end if;
end;
$$;

alter table public.requests
  add constraint requests_assigned_to_employees_fkey
  foreign key (assigned_to)
  references public.employees(id)
  on delete set null;

alter table public.employees enable row level security;

drop policy if exists "MVP anon can read employees" on public.employees;
create policy "MVP anon can read employees"
  on public.employees
  for select
  to anon, authenticated
  using (true);

drop policy if exists "MVP anon can insert employees" on public.employees;
create policy "MVP anon can insert employees"
  on public.employees
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "MVP anon can update employees" on public.employees;
create policy "MVP anon can update employees"
  on public.employees
  for update
  to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update on public.employees to anon, authenticated;
