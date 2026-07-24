-- Bind Auth user maksim@restmex.local → employee «Максим» → role mechanic.
-- Safe to re-run. Prerequisites: SUPABASE_EMPLOYEES_MIGRATION.sql (Максим exists).

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

-- Check:
select
  u.id,
  u.email,
  p.full_name,
  p.role,
  e.name as employee_name,
  p.employee_id
from auth.users u
left join public.profiles p on p.id = u.id
left join public.employees e on e.id = p.employee_id
where u.id = '366d98af-4e7f-470c-b013-7118b08131bd'::uuid
   or lower(u.email) = lower('maksim@restmex.local');
