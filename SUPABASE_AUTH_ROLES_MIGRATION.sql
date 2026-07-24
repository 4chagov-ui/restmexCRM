-- RestMex CRM Auth roles migration.
-- Run manually in Supabase SQL Editor after employees migration.
-- Keeps profiles for Supabase Auth/roles and links auth users to employees.

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

-- Review current profile roles manually before changing data:
-- select id, full_name, role, employee_id from public.profiles order by created_at;
