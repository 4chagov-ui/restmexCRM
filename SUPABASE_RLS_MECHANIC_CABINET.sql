-- RestMex CRM: recommended RLS for role-separated access.
-- Review carefully. Do NOT enable blindly over MVP anon policies without a cutover plan.
--
-- Prerequisites (run first if not already applied):
--   SUPABASE_EMPLOYEES_MIGRATION.sql
--   SUPABASE_AUTH_ROLES_MIGRATION.sql
--   SUPABASE_BIND_AUTH_PROFILES.sql
--
-- Goals:
--   - admin / manager: full read (and updates via app Server Actions)
--   - mechanic: read/update requests where assigned_to = own employee_id
--     OR there is a row in request_assignees for that mechanic (any role)
--   - mechanic: locations read-only
--   - column-level whitelist for mechanic updates is enforced in Server Actions
--     (status + executor_comment + closed_at/close_result only)
--
-- Collaborative assignees: also run SUPABASE_REQUEST_ASSIGNEES.sql (or
-- SUPABASE_FIX_RLS_COLLABORATIVE_ASSIGNEES.sql) so request_assignees RLS
-- and is_request_participant() are present.

-- Ensure profiles.employee_id exists (safe if already applied).
alter table public.profiles
  add column if not exists employee_id uuid references public.employees(id) on delete set null;

create index if not exists profiles_employee_id_idx on public.profiles(employee_id);

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text
  from public.profiles
  where id = auth.uid()
    and is_active = true
$$;

create or replace function public.current_profile_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select employee_id
  from public.profiles
  where id = auth.uid()
    and is_active = true
$$;

alter table public.requests enable row level security;
alter table public.locations enable row level security;
alter table public.employees enable row level security;
alter table public.profiles enable row level security;

-- Requests: responsible (assigned_to) OR any row in request_assignees.
-- For collaborative visibility also run SUPABASE_FIX_RLS_COLLABORATIVE_ASSIGNEES.sql
-- (defines is_request_participant + request_assignees policies).
create or replace function public.is_request_participant(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.request_assignees
    where request_id = p_request_id
      and employee_id = public.current_profile_employee_id()
  );
$$;

-- Soft-delete column (no-op if already applied).
alter table public.requests
  add column if not exists deleted_at timestamptz;

drop policy if exists "Role read requests" on public.requests;
create policy "Role read requests"
  on public.requests
  for select
  to authenticated
  using (
    public.current_profile_role() in ('admin', 'manager')
    or (
      public.current_profile_role() = 'mechanic'
      and deleted_at is null
      and (
        assigned_to = public.current_profile_employee_id()
        or public.is_request_participant(id)
      )
    )
  );

drop policy if exists "Role update requests" on public.requests;
create policy "Role update requests"
  on public.requests
  for update
  to authenticated
  using (
    public.current_profile_role() in ('admin', 'manager')
    or (
      public.current_profile_role() = 'mechanic'
      and deleted_at is null
      and (
        assigned_to = public.current_profile_employee_id()
        or public.is_request_participant(id)
      )
    )
  )
  with check (
    public.current_profile_role() in ('admin', 'manager')
    or (
      public.current_profile_role() = 'mechanic'
      and deleted_at is null
      and (
        assigned_to = public.current_profile_employee_id()
        or public.is_request_participant(id)
      )
    )
  );

-- Note: Postgres RLS cannot easily whitelist updated columns alone.
-- Server Actions MUST reject any fields besides:
--   status, executor_comment, closed_at, close_result

-- Locations: mechanic read-only
drop policy if exists "Role read locations" on public.locations;
create policy "Role read locations"
  on public.locations
  for select
  to authenticated
  using (public.current_profile_role() in ('admin', 'manager', 'mechanic'));

drop policy if exists "Role write locations" on public.locations;
create policy "Role write locations"
  on public.locations
  for all
  to authenticated
  using (public.current_profile_role() in ('admin', 'manager'))
  with check (public.current_profile_role() in ('admin', 'manager'));

-- Employees readable for assignment / profile display
drop policy if exists "Role read employees" on public.employees;
create policy "Role read employees"
  on public.employees
  for select
  to authenticated
  using (public.current_profile_role() in ('admin', 'manager', 'mechanic'));

-- Profiles: own row, or managers/admins
drop policy if exists "Role read profiles" on public.profiles;
create policy "Role read profiles"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.current_profile_role() in ('admin', 'manager')
  );
