-- Recommended production RLS policies for RestMex CRM roles.
-- Do not run blindly on the current MVP before testing with real Auth users.
-- Existing MVP anon policies should be removed only when the app is fully auth-based.

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

-- Requests: admin/manager all; mechanic via assigned_to OR request_assignees.
-- Requires is_request_participant() from SUPABASE_REQUEST_ASSIGNEES.sql /
-- SUPABASE_FIX_RLS_COLLABORATIVE_ASSIGNEES.sql when using collaborative assignees.
drop policy if exists "Role read requests" on public.requests;
create policy "Role read requests"
  on public.requests
  for select
  to authenticated
  using (
    public.current_profile_role() in ('admin', 'manager')
    or (
      public.current_profile_role() = 'mechanic'
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
      and (
        assigned_to = public.current_profile_employee_id()
        or public.is_request_participant(id)
      )
    )
  );

-- Locations: mechanics can read, managers/admins can manage through server actions.
drop policy if exists "Role read locations" on public.locations;
create policy "Role read locations"
  on public.locations
  for select
  to authenticated
  using (public.current_profile_role() in ('admin', 'manager', 'mechanic'));

-- Employees: readable enough for assignment/profile display.
drop policy if exists "Role read employees" on public.employees;
create policy "Role read employees"
  on public.employees
  for select
  to authenticated
  using (public.current_profile_role() in ('admin', 'manager', 'mechanic'));

-- Profiles: users can read their own profile; managers/admins can read all.
drop policy if exists "Role read profiles" on public.profiles;
create policy "Role read profiles"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.current_profile_role() in ('admin', 'manager')
  );
