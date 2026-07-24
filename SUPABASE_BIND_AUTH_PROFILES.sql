-- RestMex CRM: bind Auth users → profiles → employees by email.
-- Run manually in Supabase SQL Editor AFTER testing mechanic login.
-- Prerequisites:
--   1) SUPABASE_EMPLOYEES_MIGRATION.sql
--   2) SUPABASE_AUTH_ROLES_MIGRATION.sql
--   3) Auth users already created for the emails below
--
-- Mapping:
--   nik_ochagov@mail.ru      → Никита → admin   (employee_id optional)
--   razoomdj@gmail.com       → Иван   → manager (link to existing employees.name = 'Иван')
--   ukropkapitan@gmail.com   → Олег   → mechanic (link to existing employees.name = 'Олег')
--   maksim@restmex.local     → Максим → mechanic (Auth uid 366d98af-4e7f-470c-b013-7118b08131bd)

-- Ensure mechanic role exists on user_role enum.
do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.user_role'::regtype
      and enumlabel = 'mechanic'
  ) then
    alter type public.user_role add value 'mechanic';
  end if;
end;
$$;

alter table public.profiles
  add column if not exists employee_id uuid references public.employees(id) on delete set null;

create index if not exists profiles_employee_id_idx on public.profiles(employee_id);

-- Helper: upsert profile for an auth user email.
-- Does not create auth.users — only profiles rows.

-- Никита → admin
insert into public.profiles (id, full_name, role, is_active, employee_id)
select
  u.id,
  'Никита',
  'admin'::public.user_role,
  true,
  null
from auth.users u
where lower(u.email) = lower('nik_ochagov@mail.ru')
on conflict (id) do update
set
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = true;

-- Иван → manager, link to existing employee «Иван» (no duplicate employee)
insert into public.profiles (id, full_name, role, is_active, employee_id)
select
  u.id,
  'Иван',
  'manager'::public.user_role,
  true,
  e.id
from auth.users u
left join public.employees e
  on e.name = 'Иван'
 and e.is_active = true
where lower(u.email) = lower('razoomdj@gmail.com')
on conflict (id) do update
set
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = true,
  employee_id = coalesce(excluded.employee_id, public.profiles.employee_id);

-- Олег → mechanic, link to existing employee «Олег»
insert into public.profiles (id, full_name, role, is_active, employee_id)
select
  u.id,
  'Олег',
  'mechanic'::public.user_role,
  true,
  e.id
from auth.users u
left join public.employees e
  on e.name = 'Олег'
 and e.is_active = true
where lower(u.email) = lower('ukropkapitan@gmail.com')
on conflict (id) do update
set
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = true,
  employee_id = coalesce(excluded.employee_id, public.profiles.employee_id);

-- Максим → mechanic, link to existing employee «Максим»
insert into public.profiles (id, full_name, role, is_active, employee_id)
select
  u.id,
  'Максим',
  'mechanic'::public.user_role,
  true,
  e.id
from auth.users u
left join public.employees e
  on e.name = 'Максим'
 and e.is_active = true
where lower(u.email) = lower('maksim@restmex.local')
   or u.id = '366d98af-4e7f-470c-b013-7118b08131bd'::uuid
on conflict (id) do update
set
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = true,
  employee_id = coalesce(excluded.employee_id, public.profiles.employee_id);

-- Verification (read-only):
-- select
--   u.email,
--   p.full_name,
--   p.role,
--   e.name as employee_name,
--   p.employee_id
-- from auth.users u
-- left join public.profiles p on p.id = u.id
-- left join public.employees e on e.id = p.employee_id
-- where lower(u.email) in (
--   lower('nik_ochagov@mail.ru'),
--   lower('razoomdj@gmail.com'),
--   lower('ukropkapitan@gmail.com'),
--   lower('maksim@restmex.local')
-- )
-- order by u.email;
